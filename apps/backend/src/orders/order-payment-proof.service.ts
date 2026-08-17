import { Injectable } from '@nestjs/common';
import { OrderPaymentMethod, type OrderPaymentProof } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { StorageAssetService } from '../uploads/storage-asset.service';

import { ORDER_AUDIT_ACTIONS } from './order.constants';

import type { OrderPaymentProofDto } from '@dripplex/types';

export interface SubmitPaymentProofInput {
  receiptUrl: string;
  reference?: string;
  amount?: number;
  note?: string;
}

/**
 * DPX-ORDER-PROOF-001 — the customer's receipt for a "Pay to Merchant Bank"
 * transfer.
 *
 * Founder decision (2026-08-17): "when an order is paid to merchant customer
 * should have an option to upload receipt of payment which will go to merchant
 * for confirmation and in case of dispute it can be referenced."
 *
 * Three things this deliberately does NOT do:
 *
 *  - It does not mark anything paid. On a MERCHANT_DIRECT order the money goes
 *    to the merchant's own account and DrippleX never sees it, so confirmation
 *    stays the merchant's word (`MerchantOrdersService.confirmPaymentReceived`).
 *    A customer could upload any image; treating that as payment would let
 *    anyone mark their own order paid.
 *  - It does not verify the receipt. Nothing here reads the image or checks the
 *    reference against a bank. It records what the customer submitted.
 *  - It never edits or deletes. A dispute is worth nothing if the evidence
 *    could be rewritten afterwards, so a customer who uploads the wrong image
 *    adds a second row and both stay on file, oldest first.
 */
@Injectable()
export class OrderPaymentProofService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageAssets: StorageAssetService,
  ) {}

  /**
   * File a receipt against the customer's own order.
   *
   * Ownership of the uploaded object is asserted before anything is stored: the
   * key must sit under `payment-proofs/<this customer>/`, so a customer cannot
   * attach somebody else's uploaded file (or a KYC document) to their order.
   */
  public async submit(
    customerId: string,
    orderId: string,
    input: SubmitPaymentProofInput,
    context: AuditContext,
  ): Promise<OrderPaymentProofDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.customerId !== customerId) {
      // Same message either way — an attacker must not learn that an order id
      // exists just because it belongs to somebody else.
      throw new NotFoundDomainException('Order not found');
    }
    if (order.paymentMethod !== OrderPaymentMethod.MERCHANT_DIRECT) {
      throw new ValidationDomainException(
        'A payment receipt only applies to an order paid by transfer to the merchant',
      );
    }

    this.storageAssets.assertOwned(input.receiptUrl, {
      folder: 'payment-proofs',
      ownerId: customerId,
    });

    const created = await this.prisma.orderPaymentProof.create({
      data: {
        orderId: order.id,
        submittedBy: customerId,
        receiptUrl: input.receiptUrl,
        reference: input.reference ?? null,
        amount: input.amount ?? null,
        note: input.note ?? null,
      },
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.PAYMENT_PROOF_SUBMITTED,
      { ...context, userId: customerId },
      {
        resource: 'order',
        resourceId: order.id,
        metadata: {
          proofId: created.id,
          // The URL itself is not recorded: it is a private object and the audit
          // log is read far more widely than the receipt is.
          reference: created.reference,
          amount: created.amount === null ? null : Number(created.amount),
        },
      },
    );

    return await this.toDto(created);
  }

  /** The customer's own receipts for their own order. */
  public async listForCustomer(
    customerId: string,
    orderId: string,
  ): Promise<OrderPaymentProofDto[]> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order?.customerId !== customerId) {
      throw new NotFoundDomainException('Order not found');
    }
    return await this.listFor(order.id);
  }

  /** The receipts filed against an order the merchant owns — what they look at
   *  before confirming they received the transfer. */
  public async listForMerchant(
    merchantId: string,
    orderId: string,
  ): Promise<OrderPaymentProofDto[]> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    if (order.merchantId !== merchantId) {
      throw new ForbiddenDomainException('This order belongs to another merchant');
    }
    return await this.listFor(order.id);
  }

  /** Operations' view, for a disputed order. Authorization is the controller's
   *  permission guard — Ops legitimately reads any order. */
  public async listForAdmin(orderId: string): Promise<OrderPaymentProofDto[]> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundDomainException('Order not found');
    }
    return await this.listFor(order.id);
  }

  private async listFor(orderId: string): Promise<OrderPaymentProofDto[]> {
    const rows = await this.prisma.orderPaymentProof.findMany({
      where: { orderId },
      // Oldest first: the sequence is the story a dispute needs to read.
      orderBy: { createdAt: 'asc' },
    });
    return await Promise.all(rows.map(async (row) => await this.toDto(row)));
  }

  private async toDto(row: OrderPaymentProof): Promise<OrderPaymentProofDto> {
    return {
      id: row.id,
      orderId: row.orderId,
      submittedBy: row.submittedBy,
      // Receipts live in the private bucket, so every read mints a short-lived
      // signed GET rather than handing out a durable link.
      receiptUrl: await this.storageAssets.toSignedGetUrl(row.receiptUrl),
      reference: row.reference,
      amount: row.amount === null ? null : Number(row.amount),
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
