import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { PayoutFulfillmentService } from './payout-fulfillment.service';

/**
 * What a provider's transfer webhook means, applied once.
 *
 * Both payout rails report the same three outcomes about the same transfers,
 * so the reconciliation lives here rather than in each provider's controller.
 * The two controllers differ only in how they authenticate the caller — HMAC
 * signature for Paystack, a shared hash header for Flutterwave — and that is
 * the only thing they should differ in. Copying this logic per provider is how
 * one rail quietly stops restoring a fleet receivable that the other still
 * does.
 */
@Injectable()
export class PayoutReconciliationService {
  constructor(
    private readonly fulfillment: PayoutFulfillmentService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * @param reference our own reference, which is the withdrawal or transfer id
   * @param reason    free text recorded against a failure; also distinguishes a
   *                  reversal from an outright failure for fleet transfers
   */
  public async apply(
    reference: string,
    status: 'SUCCESS' | 'FAILED',
    providerReference: string | null,
    reason: string,
  ): Promise<void> {
    // Wallet payouts: customer, rider, driver and merchant.
    await this.fulfillment.processProviderResult(reference, status, providerReference, reason);
    // Fleet settlements go through the same rails but have their own payable
    // ledger, because they are not wallet withdrawals.
    await this.processFleetTransfer(reference, status, providerReference, reason);
  }

  public async processFleetTransfer(
    reference: string,
    status: 'SUCCESS' | 'FAILED',
    providerReference: string | null,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          id: string;
          request_id: string | null;
          amount: number;
          transfer_status: string;
          receivable_id: string | null;
        }[]
      >`
        SELECT t.id, t.settlement_request_id AS request_id, t.amount::float8 AS amount,
               t.status::text AS transfer_status, r.receivable_id
        FROM fleet_settlement_transfers t
        LEFT JOIN fleet_settlement_requests r ON r.id = t.settlement_request_id
        WHERE t.id = ${reference}::uuid
        LIMIT 1
        FOR UPDATE`;
      const transfer = rows[0];
      if (transfer?.transfer_status !== 'PENDING') return;

      if (status === 'SUCCESS') {
        await tx.$executeRaw`
          UPDATE fleet_settlement_transfers
          SET status = 'SUCCESS', provider_reference = ${providerReference}, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${reference}::uuid AND status = 'PENDING'`;
        if (transfer.request_id) {
          await tx.$executeRaw`
            UPDATE fleet_settlement_requests SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${transfer.request_id}::uuid AND status = 'PROCESSING'`;
        }
        return;
      }

      await tx.$executeRaw`
        UPDATE fleet_settlement_transfers
        SET status = CASE WHEN ${reason} = 'transfer.reversed' THEN 'REVERSED' ELSE 'FAILED' END,
            provider_reference = ${providerReference}, failure_reason = ${reason.slice(0, 500)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${reference}::uuid AND status = 'PENDING'`;
      if (transfer.request_id) {
        await tx.$executeRaw`
          UPDATE fleet_settlement_requests SET status = 'APPROVED', transfer_id = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${transfer.request_id}::uuid AND status = 'PROCESSING'`;
        if (transfer.receivable_id) {
          await tx.$executeRaw`
            UPDATE fleet_settlement_receivables SET remaining_amount = remaining_amount + ${transfer.amount}, status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${transfer.receivable_id}::uuid`;
        }
      }
    });
  }
}
