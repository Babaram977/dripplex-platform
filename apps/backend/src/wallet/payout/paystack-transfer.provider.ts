import { Injectable, NotImplementedException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import type {
  InitiatePayoutInput,
  InitiatePayoutResult,
  PayoutProvider as PayoutProviderInterface,
  VerifyPayoutInput,
  VerifyPayoutResult,
} from './payout-provider.adapter';

/**
 * Paystack Transfer API adapter stub — real class, real DI wiring, real
 * method signatures, same "stub until real credentials arrive" pattern as
 * `MoniepointProvider`/`OpayProvider` in payments/providers. Throws until
 * Paystack transfer-API credentials are configured; see
 * docs/WALLET-004-WITHDRAW-DESIGN.md's Phase 2 note. Not called by
 * `WithdrawalService` today — Phase 1's real fulfillment path is manual
 * admin completion (`AdminWithdrawalController`).
 */
@Injectable()
export class PaystackTransferProvider implements PayoutProviderInterface {
  public readonly provider = PaymentProvider.PAYSTACK;

  public initiatePayout(_input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    return Promise.reject(
      new NotImplementedException('Paystack transfer (payout) provider is not implemented yet'),
    );
  }

  public verifyPayout(_input: VerifyPayoutInput): Promise<VerifyPayoutResult> {
    return Promise.reject(
      new NotImplementedException('Paystack transfer verification is not implemented yet'),
    );
  }
}
