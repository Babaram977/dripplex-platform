import { Controller, Get } from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AppConfigService } from '../config/app-config.service';
import { WALLET_PERMISSIONS } from '../wallet/wallet.constants';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

export interface CardProviderOptionDto {
  provider: 'PAYSTACK' | 'FLUTTERWAVE';
  /** What the customer sees on the button. */
  label: string;
}

export interface CustomerPaymentProvidersDto {
  /** One entry per gateway that can actually take a payment. Empty means no
   * card option should be shown at all. */
  cardProviders: CardProviderOptionDto[];
  /** Used when a caller asks for "card" without naming one. */
  defaultCardProvider: 'PAYSTACK' | 'FLUTTERWAVE' | null;
}

const LABELS: Record<'PAYSTACK' | 'FLUTTERWAVE', string> = {
  PAYSTACK: 'Paystack',
  FLUTTERWAVE: 'Flutterwave',
};

/**
 * Which ways a customer can pay, right now.
 *
 * Founder decision (2026-08-18): both Paystack and Flutterwave stay configured
 * and **the customer chooses**, because one gateway can be down while the other
 * is working. That only works if the client is told which gateways are live —
 * a hardcoded list would offer a dead button on the day a key is rotated, which
 * is the exact bug this replaced.
 *
 * Guarded by the wallet read permission rather than a new one: every customer
 * role already holds it, and "how may I pay" is the same class of question as
 * "what is my balance". A new permission would have to be granted to every
 * role that can spend, for no extra safety.
 */
@Controller('customer/payments')
export class CustomerPaymentProvidersController {
  constructor(private readonly config: AppConfigService) {}

  @Get('providers')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public getProviders(): ApiSuccessResponse<CustomerPaymentProvidersDto> {
    return {
      success: true,
      data: {
        cardProviders: this.config.availableCardProviders.map((provider) => ({
          provider,
          label: LABELS[provider],
        })),
        defaultCardProvider: this.config.defaultCardProvider,
      },
    };
  }
}
