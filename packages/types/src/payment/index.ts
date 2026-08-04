import type { OrderDto, OrderPaymentMethod } from '../order/index.js';

export type PaymentProvider = 'PAYSTACK' | 'FLUTTERWAVE' | 'MONIEPOINT' | 'OPAY';

export type TransactionStatus =
  'PENDING' | 'SUCCESS' | 'FAILED' | 'ABANDONED' | 'CANCELLED' | 'REFUNDED';

export interface PaymentTransactionDto {
  id: string;
  orderId: string;
  customerId: string;
  merchantId: string;
  provider: PaymentProvider;
  providerReference: string;
  providerTransactionId: string | null;
  status: TransactionStatus;
  amount: number;
  currency: string;
  authorizationUrl: string | null;
  accessCode: string | null;
  paidAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitializePaymentDto {
  provider?: OrderPaymentMethod;
  callbackUrl?: string;
}

/**
 * Mirrors InitiateRidePaymentResponse's shape: only the gateway path
 * (PAYSTACK/FLUTTERWAVE/OPAY) populates authorizationUrl/reference/
 * transaction — WALLET completes immediately (check
 * `order.paymentStatus === 'PAID'`) and CASH leaves the order pending
 * (payment collected at delivery). `order` lets the frontend branch on
 * outcome without a fake transaction for the non-gateway paths.
 */
export interface InitializePaymentResponseDto {
  order: OrderDto;
  authorizationUrl?: string;
  reference?: string;
  provider?: PaymentProvider;
  transaction?: PaymentTransactionDto;
}

export interface PaymentVerificationDto {
  success: boolean;
  alreadyProcessed: boolean;
  orderStatus: string;
  paymentStatus: string;
  transaction: PaymentTransactionDto;
}

export interface PaymentStatusDto {
  orderId: string;
  orderStatus: string;
  paymentStatus: string;
  transaction: PaymentTransactionDto | null;
}

export const PAYMENT_AUDIT_ACTIONS = {
  INITIALIZED: 'payment.initialized',
  VERIFIED: 'payment.verified',
  FAILED: 'payment.failed',
  WEBHOOK_RECEIVED: 'payment.webhook.received',
  WEBHOOK_REJECTED: 'payment.webhook.rejected',
} as const;

export type PaymentAuditAction = (typeof PAYMENT_AUDIT_ACTIONS)[keyof typeof PAYMENT_AUDIT_ACTIONS];
