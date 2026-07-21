import type { PaymentTransactionDto } from '@dripplex/types';
import type { PaymentTransaction } from '@prisma/client';

export function toPaymentTransactionDto(transaction: PaymentTransaction): PaymentTransactionDto {
  return {
    id: transaction.id,
    orderId: transaction.orderId,
    customerId: transaction.customerId,
    merchantId: transaction.merchantId,
    provider: transaction.provider,
    providerReference: transaction.providerReference,
    providerTransactionId: transaction.providerTransactionId,
    status: transaction.status,
    amount: Number(transaction.amount),
    currency: transaction.currency,
    authorizationUrl: transaction.authorizationUrl,
    accessCode: transaction.accessCode,
    paidAt: transaction.paidAt ? transaction.paidAt.toISOString() : null,
    verifiedAt: transaction.verifiedAt ? transaction.verifiedAt.toISOString() : null,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

export function generatePaymentReference(orderNumber: string): string {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  const safeOrder = orderNumber.replace(/[^A-Z0-9-]/gi, '').slice(0, 24);
  return `DPX-PAY-${safeOrder}-${suffix}`;
}
