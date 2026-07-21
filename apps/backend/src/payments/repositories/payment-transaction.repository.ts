import type {
  PaymentProvider,
  PaymentTransaction,
  Prisma,
  TransactionStatus,
} from '@prisma/client';

export interface CreatePaymentTransactionInput {
  orderId: string;
  customerId: string;
  merchantId: string;
  provider: PaymentProvider;
  providerReference: string;
  amount: Prisma.Decimal | number | string;
  currency: string;
  authorizationUrl?: string | null;
  accessCode?: string | null;
  providerTransactionId?: string | null;
  gatewayResponse?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export interface MarkPaymentSuccessInput {
  id: string;
  providerTransactionId?: string | null;
  gatewayResponse?: Prisma.InputJsonValue;
  paidAt?: Date | null;
  verifiedAt: Date;
}

export interface MarkPaymentFailedInput {
  id: string;
  gatewayResponse?: Prisma.InputJsonValue;
}

export interface PaymentTransactionRepository {
  create(input: CreatePaymentTransactionInput): Promise<PaymentTransaction>;
  findById(id: string): Promise<PaymentTransaction | null>;
  findByReference(reference: string): Promise<PaymentTransaction | null>;
  findByOrderId(orderId: string): Promise<PaymentTransaction | null>;
  findLatestByOrderId(orderId: string): Promise<PaymentTransaction | null>;
  findPendingByOrderAndProvider(
    orderId: string,
    provider: PaymentProvider,
  ): Promise<PaymentTransaction | null>;
  findSuccessfulByOrderId(orderId: string): Promise<PaymentTransaction | null>;
  markSuccess(input: MarkPaymentSuccessInput): Promise<PaymentTransaction | null>;
  markFailed(input: MarkPaymentFailedInput): Promise<PaymentTransaction>;
  updateStatus(
    id: string,
    status: TransactionStatus,
    extra?: {
      gatewayResponse?: Prisma.InputJsonValue;
      providerTransactionId?: string | null;
    },
  ): Promise<PaymentTransaction>;
}

export const PAYMENT_TRANSACTION_REPOSITORY = Symbol('PAYMENT_TRANSACTION_REPOSITORY');
