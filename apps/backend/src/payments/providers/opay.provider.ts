import { Injectable, NotImplementedException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProviderAdapter,
  VerifyPaymentInput,
  VerifyPaymentResult,
  WebhookHandleInput,
  WebhookHandleResult,
} from './payment-provider.adapter';

/**
 * OPay adapter stub — same interface as live providers, same pattern as
 * MoniepointProvider. Listed as a selectable ride payment method per founder
 * request (high OPay wallet adoption in the Kano launch market), but throws
 * until a real OPay merchant account and API contract are wired in.
 */
@Injectable()
export class OpayProvider implements PaymentProviderAdapter {
  public readonly provider = PaymentProvider.OPAY;

  public initializePayment(_input: InitializePaymentInput): Promise<InitializePaymentResult> {
    return Promise.reject(
      new NotImplementedException('OPay payment provider is not implemented yet'),
    );
  }

  public verifyPayment(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return Promise.reject(
      new NotImplementedException('OPay payment verification is not implemented yet'),
    );
  }

  public handleWebhook(_input: WebhookHandleInput): Promise<WebhookHandleResult> {
    return Promise.reject(new NotImplementedException('OPay webhooks are not implemented yet'));
  }
}
