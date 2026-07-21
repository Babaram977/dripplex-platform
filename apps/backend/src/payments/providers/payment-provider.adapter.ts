import type { PaymentProvider as PaymentProviderEnum } from '@prisma/client';

export interface InitializePaymentInput {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  orderId: string;
  orderNumber: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
  provider: PaymentProviderEnum;
  reference: string;
  authorizationUrl: string;
  accessCode?: string | null;
  providerTransactionId?: string | null;
  raw?: unknown;
}

export interface VerifyPaymentInput {
  reference: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  reference: string;
  providerTransactionId?: string | null;
  amount?: number;
  currency?: string;
  paidAt?: Date | null;
  gatewayResponse?: unknown;
  status?: string;
}

export interface WebhookHandleInput {
  rawBody: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
  payload: unknown;
}

export interface WebhookHandleResult {
  accepted: boolean;
  event?: string;
  reference?: string;
  success?: boolean;
  providerTransactionId?: string | null;
  amount?: number;
  currency?: string;
  paidAt?: Date | null;
  gatewayResponse?: unknown;
  reason?: string;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProviderEnum;
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  handleWebhook(input: WebhookHandleInput): Promise<WebhookHandleResult>;
}

export const PAYMENT_PROVIDER_ADAPTERS = Symbol('PAYMENT_PROVIDER_ADAPTERS');
