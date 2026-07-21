import { Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreatePaymentTransactionInput,
  MarkPaymentFailedInput,
  MarkPaymentSuccessInput,
  PaymentTransactionRepository,
} from './payment-transaction.repository';
import type { PaymentProvider, PaymentTransaction, Prisma } from '@prisma/client';

@Injectable()
export class PrismaPaymentTransactionRepository implements PaymentTransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreatePaymentTransactionInput): Promise<PaymentTransaction> {
    return await this.prisma.paymentTransaction.create({
      data: {
        orderId: input.orderId,
        customerId: input.customerId,
        merchantId: input.merchantId,
        provider: input.provider,
        providerReference: input.providerReference,
        amount: input.amount,
        currency: input.currency,
        status: TransactionStatus.PENDING,
        ...(input.authorizationUrl !== undefined
          ? { authorizationUrl: input.authorizationUrl }
          : {}),
        ...(input.accessCode !== undefined ? { accessCode: input.accessCode } : {}),
        ...(input.providerTransactionId !== undefined
          ? { providerTransactionId: input.providerTransactionId }
          : {}),
        ...(input.gatewayResponse !== undefined ? { gatewayResponse: input.gatewayResponse } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  }

  public async findById(id: string): Promise<PaymentTransaction | null> {
    return await this.prisma.paymentTransaction.findUnique({ where: { id } });
  }

  public async findByReference(reference: string): Promise<PaymentTransaction | null> {
    return await this.prisma.paymentTransaction.findUnique({
      where: { providerReference: reference },
    });
  }

  public async findByOrderId(orderId: string): Promise<PaymentTransaction | null> {
    return await this.findLatestByOrderId(orderId);
  }

  public async findLatestByOrderId(orderId: string): Promise<PaymentTransaction | null> {
    return await this.prisma.paymentTransaction.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findPendingByOrderAndProvider(
    orderId: string,
    provider: PaymentProvider,
  ): Promise<PaymentTransaction | null> {
    return await this.prisma.paymentTransaction.findFirst({
      where: { orderId, provider, status: TransactionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findSuccessfulByOrderId(orderId: string): Promise<PaymentTransaction | null> {
    return await this.prisma.paymentTransaction.findFirst({
      where: { orderId, status: TransactionStatus.SUCCESS },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Idempotent success transition — only updates when not already SUCCESS.
   */
  public async markSuccess(input: MarkPaymentSuccessInput): Promise<PaymentTransaction | null> {
    const result = await this.prisma.paymentTransaction.updateMany({
      where: {
        id: input.id,
        status: { not: TransactionStatus.SUCCESS },
      },
      data: {
        status: TransactionStatus.SUCCESS,
        verifiedAt: input.verifiedAt,
        paidAt: input.paidAt ?? input.verifiedAt,
        ...(input.providerTransactionId !== undefined
          ? { providerTransactionId: input.providerTransactionId }
          : {}),
        ...(input.gatewayResponse !== undefined ? { gatewayResponse: input.gatewayResponse } : {}),
      },
    });

    if (result.count === 0) {
      return await this.findById(input.id);
    }

    return await this.findById(input.id);
  }

  public async markFailed(input: MarkPaymentFailedInput): Promise<PaymentTransaction> {
    return await this.prisma.paymentTransaction.update({
      where: { id: input.id },
      data: {
        status: TransactionStatus.FAILED,
        ...(input.gatewayResponse !== undefined ? { gatewayResponse: input.gatewayResponse } : {}),
      },
    });
  }

  public async updateStatus(
    id: string,
    status: TransactionStatus,
    extra?: {
      gatewayResponse?: Prisma.InputJsonValue;
      providerTransactionId?: string | null;
    },
  ): Promise<PaymentTransaction> {
    return await this.prisma.paymentTransaction.update({
      where: { id },
      data: {
        status,
        ...(extra?.gatewayResponse !== undefined ? { gatewayResponse: extra.gatewayResponse } : {}),
        ...(extra?.providerTransactionId !== undefined
          ? { providerTransactionId: extra.providerTransactionId }
          : {}),
      },
    });
  }
}
