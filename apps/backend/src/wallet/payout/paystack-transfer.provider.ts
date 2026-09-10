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

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data?: T;
}

interface RecipientData {
  recipient_code: string;
  active?: boolean;
  details?: {
    account_number?: string | null;
    account_name?: string | null;
    bank_code?: string | null;
    bank_name?: string | null;
  };
}

interface TransferData {
  id?: number | string;
  /** Optional because Paystack does not always echo it, which is exactly why
   *  the caller falls back to the reference it sent. Declaring it required made
   *  that fallback look dead when it is the thing keeping a transfer
   *  reconcilable. */
  reference?: string;
  status: string;
  transfer_code?: string | null;
  amount?: number;
  currency?: string;
  reason?: string | null;
}

/**
 * Real Paystack outbound-transfer adapter.
 *
 * The adapter deliberately creates the recipient from the verified destination
 * on every payout. Recipient creation is idempotent at Paystack for the same
 * account, while keeping the platform from ever trusting a recipient supplied
 * by a client. A future recipient-cache table can replace this without
 * changing the PayoutProvider contract.
 */
@Injectable()
export class PaystackTransferProvider implements PayoutProviderInterface {
  public readonly provider = PaymentProvider.PAYSTACK;

  constructor(private readonly config: AppConfigService) {}

  public async initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    const bankCode = input.bankCode?.trim();
    if (!bankCode) {
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
      throw new ValidationDomainException('Paystack bank payouts currently require NGN');
    }

    const recipient = await this.request<PaystackResponse<RecipientData>>('/transferrecipient', {
      method: 'POST',
      body: {
        type: 'nuban',
        name: input.accountName,
        account_number: input.accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      },
    });

    const recipientCode = recipient.data?.recipient_code;
    if (!recipient.status || !recipientCode) {
      throw new ValidationDomainException(
        recipient.message || 'Paystack recipient creation failed',
      );
    }

    const response = await this.request<PaystackResponse<TransferData>>('/transfer', {
      method: 'POST',
      body: {
        source: 'balance',
        amount: Math.round(input.amount * 100),
        recipient: recipientCode,
        reference: this.normalizeReference(input.reference),
        reason: input.narration ?? 'DrippleX payout',
        currency: 'NGN',
      },
    });

    const data = response.data;
    if (!response.status || !data?.reference) {
      throw new ValidationDomainException(
        response.message || 'Paystack transfer failed to initiate',
      );
    }

    return {
      provider: this.provider,
      reference: data.reference,
      providerTransferId: data.id !== undefined ? String(data.id) : (data.transfer_code ?? null),
      status: this.mapStatus(data.status),
      raw: response,
    };
  }

  public async verifyPayout(input: VerifyPayoutInput): Promise<VerifyPayoutResult> {
    const response = await this.request<PaystackResponse<TransferData>>(
      `/transfer/${encodeURIComponent(input.reference)}`,
      { method: 'GET' },
    );
    const data = response.data;
    if (!response.status || !data) {
      throw new ValidationDomainException(response.message || 'Paystack transfer lookup failed');
    }

    return {
      reference: data.reference ?? input.reference,
      providerTransferId: data.id !== undefined ? String(data.id) : (data.transfer_code ?? null),
      status: this.mapStatus(data.status),
      raw: response,
    };
  }

  private mapStatus(value: string | undefined): 'PENDING' | 'SUCCESS' | 'FAILED' {
    switch ((value ?? '').toLowerCase()) {
      case 'success':
        return 'SUCCESS';
      case 'failed':
      case 'reversed':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  private normalizeReference(reference: string): string {
    const normalized = reference.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return normalized.length >= 16
      ? normalized.slice(0, 50)
      : `dpx-${normalized}`.padEnd(16, '0').slice(0, 50);
  }

  private async request<T>(
    path: string,
    options: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
  ): Promise<T> {
    const secret = this.config.paystackSecretKey;
    if (!secret) {
      throw new ValidationDomainException('Paystack is not configured');
    }

    const baseUrl = this.config.paystackBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ValidationDomainException(`Paystack request failed (${String(response.status)})`);
    }

    if (!response.ok) {
      // Only use it when it really is a string. Coercing an unknown here is how
      // "[object Object]" ends up as the error a caller is shown.
      const raw =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? (payload as { message?: unknown }).message
          : undefined;
      const message = typeof raw === 'string' ? raw : '';
      throw new ValidationDomainException(
        `Paystack request failed (${String(response.status)}): ${message.slice(0, 200)}`,
      );
    }

    return payload as T;
  }
}
