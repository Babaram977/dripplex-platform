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
  provider?: PaymentProvider;
  callbackUrl?: string;
}

export interface InitializePaymentResponseDto {
  authorizationUrl: string;
  reference: string;
  provider: PaymentProvider;
  transaction: PaymentTransactionDto;
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
