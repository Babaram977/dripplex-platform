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
 * Moniepoint adapter stub — same interface as live providers.
 * Throws until Moniepoint credentials and API contract are wired.
 */
@Injectable()
export class MoniepointProvider implements PaymentProviderAdapter {
  public readonly provider = PaymentProvider.MONIEPOINT;

  public initializePayment(_input: InitializePaymentInput): Promise<InitializePaymentResult> {
    return Promise.reject(
      new NotImplementedException('Moniepoint payment provider is not implemented yet'),
    );
  }

  public verifyPayment(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return Promise.reject(
      new NotImplementedException('Moniepoint payment verification is not implemented yet'),
    );
  }

  public handleWebhook(_input: WebhookHandleInput): Promise<WebhookHandleResult> {
    return Promise.reject(
      new NotImplementedException('Moniepoint webhooks are not implemented yet'),
    );
  }
}
