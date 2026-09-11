import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

import type {
  InitiatePayoutInput,
  InitiatePayoutResult,
  PayoutProvider as PayoutProviderInterface,
  VerifyPayoutInput,
  VerifyPayoutResult,
} from './payout-provider.adapter';

interface FlutterwaveTransferData {
  id?: number | string;
  reference?: string;
  status?: string;
  complete_message?: string;
}

interface FlutterwaveTransferResponse {
  status?: string;
  message?: string;
  data?: FlutterwaveTransferData;
}

interface FlutterwaveTransferListResponse {
  status?: string;
  message?: string;
  data?: FlutterwaveTransferData[];
}

/**
 * Flutterwave outbound transfers — the second payout rail.
 *
 * It does not replace Paystack. Both are registered, and which one sends a
 * given payout is a configured choice, so one being unavailable (Paystack
 * restricts Transfers to registered businesses with a funded balance) does not
 * stop partners being paid.
 *
 * Simpler than the Paystack adapter by nature: Flutterwave takes the
 * destination inline on the transfer, with no recipient object to create
 * first, so there is one call rather than two and nothing to cache.
 *
 * The bank code passed in must be a *Flutterwave* code. Codes are not
 * interchangeable between providers — sending a Paystack code here either
 * fails or, worse, names a different institution. `PayoutDestinationService`
 * is what guarantees the right one arrives; this adapter simply refuses
 * anything that is not plausibly a code at all.
 */
@Injectable()
export class FlutterwaveTransferProvider implements PayoutProviderInterface {
  public readonly provider = PaymentProvider.FLUTTERWAVE;

  constructor(private readonly config: AppConfigService) {}

  public async initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    const bankCode = input.bankCode?.trim();
    if (bankCode === undefined || bankCode === '') {
      throw new ValidationDomainException('Verified bank code is required before payout');
    }
    if (!/^\d{2,10}$/.test(bankCode)) {
      throw new ValidationDomainException('Invalid bank code');
    }
    if (!/^\d{10}$/.test(input.accountNumber)) {
      throw new ValidationDomainException('Invalid Nigerian account number');
    }
    if (input.amount <= 0) {
      throw new ValidationDomainException('Payout amount must be greater than zero');
    }
    if (input.currency.toUpperCase() !== 'NGN') {
      throw new ValidationDomainException('Flutterwave bank payouts currently require NGN');
    }

    const response = await this.request<FlutterwaveTransferResponse>('/v3/transfers', {
      method: 'POST',
      body: {
        account_bank: bankCode,
        account_number: input.accountNumber,
        amount: input.amount,
        currency: 'NGN',
        narration: input.narration ?? 'DrippleX payout',
        // Our own reference, so a webhook or a later lookup can be tied back to
        // the withdrawal that caused it without trusting Flutterwave's id.
        reference: input.reference,
        beneficiary_name: input.accountName,
      },
    });

    const data = response.data;
    if (response.status !== 'success' || data === undefined) {
      throw new ValidationDomainException(
        response.message?.trim() ?? 'Flutterwave transfer failed to initiate',
      );
    }

    return {
      provider: this.provider,
      reference: data.reference ?? input.reference,
      providerTransferId: data.id === undefined ? null : String(data.id),
      status: this.mapStatus(data.status),
      raw: response,
    };
  }

  public async verifyPayout(input: VerifyPayoutInput): Promise<VerifyPayoutResult> {
    // Flutterwave has no lookup by our own reference, so the transfer is found
    // by listing on it. A miss is not an answer about the transfer — treating
    // it as failure would reverse a payout that may well have gone out.
    const response = await this.request<FlutterwaveTransferListResponse>(
      `/v3/transfers?reference=${encodeURIComponent(input.reference)}`,
      { method: 'GET' },
    );

    const data = response.data?.[0];
    if (response.status !== 'success' || data === undefined) {
      throw new ValidationDomainException(
        response.message?.trim() ?? 'Flutterwave transfer lookup failed',
      );
    }

    return {
      reference: data.reference ?? input.reference,
      providerTransferId: data.id === undefined ? null : String(data.id),
      status: this.mapStatus(data.status),
      raw: response,
    };
  }

  /**
   * Flutterwave's transfer vocabulary. Anything unrecognised is PENDING, never
   * FAILED: an unknown status is an unknown outcome, and calling it a failure
   * would credit the money back into a wallet that may already have been paid.
   */
  private mapStatus(status: string | undefined): 'PENDING' | 'SUCCESS' | 'FAILED' {
    switch (status?.toUpperCase()) {
      case 'SUCCESSFUL':
      case 'SUCCESS':
      case 'COMPLETED':
        return 'SUCCESS';
      case 'FAILED':
      case 'ERROR':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  private async request<T>(
    path: string,
    options: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
  ): Promise<T> {
    const secret = this.config.flutterwaveSecretKey;
    if (secret === '') {
      throw new ValidationDomainException('Flutterwave is not configured');
    }

    const baseUrl = this.config.flutterwaveBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });

    if (!response.ok) {
      const text = await response.text();
      let message = '';
      try {
        const parsed: unknown = JSON.parse(text);
        const raw =
          typeof parsed === 'object' && parsed !== null && 'message' in parsed
            ? (parsed as { message?: unknown }).message
            : undefined;
        message = typeof raw === 'string' ? raw : '';
      } catch {
        message = '';
      }
      throw new ValidationDomainException(
        message === ''
          ? `Flutterwave request failed (${String(response.status)})`
          : `Flutterwave: ${message}`,
      );
    }

    return (await response.json()) as T;
  }
}
