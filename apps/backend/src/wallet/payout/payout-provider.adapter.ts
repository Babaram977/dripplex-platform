import type { PaymentProvider as PaymentProviderEnum } from '@prisma/client';

/**
 * Phase 2 of docs/WALLET-004-WITHDRAW-DESIGN.md. Deliberately mirrors
 * `PaymentProviderAdapter`'s shape (payments/providers/payment-provider.adapter.ts)
 * — same "one interface, real class per provider" pattern, applied to
 * outbound transfers instead of inbound charges. No provider implements
 * this for real yet (see `PaystackTransferProvider`); `WithdrawalService`
 * does not call it — Phase 1 fulfillment is the real admin manual-completion
 * path in `AdminWithdrawalController`.
 */
export interface InitiatePayoutInput {
  reference: string;
  amount: number;
  currency: string;
  bankCode: string | null;
  accountNumber: string;
  accountName: string;
  narration?: string;
}

export interface InitiatePayoutResult {
  provider: PaymentProviderEnum;
  reference: string;
  providerTransferId?: string | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  raw?: unknown;
}

export interface VerifyPayoutInput {
  reference: string;
}

export interface VerifyPayoutResult {
  reference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  providerTransferId?: string | null;
  raw?: unknown;
}

export interface PayoutProvider {
  readonly provider: PaymentProviderEnum;
  initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult>;
  verifyPayout(input: VerifyPayoutInput): Promise<VerifyPayoutResult>;
}

export const PAYOUT_PROVIDERS = Symbol('PAYOUT_PROVIDERS');
