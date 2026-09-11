import { Injectable, Logger } from '@nestjs/common';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

import type {
  BankAccountResolver,
  BankOption,
  ResolveAccountInput,
  ResolvedAccount,
} from './bank-account-resolver.port';

interface FlutterwaveBankListResponse {
  status?: string;
  message?: string;
  data?: { id?: number; code?: string; name?: string }[];
}

interface FlutterwaveResolveResponse {
  status?: string;
  message?: string;
  data?: { account_number?: string; account_name?: string };
}

const BANK_LIST_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Name enquiry through Flutterwave, for the accounts Flutterwave will pay.
 *
 * Deliberately a second implementation of `BankAccountResolver` rather than a
 * branch inside the Paystack one: the two providers publish their own bank
 * lists with their own codes, and a code from one is not a code for the other.
 * Keeping them separate is what makes it impossible to accidentally send
 * Flutterwave a Paystack code — the type says which resolver produced it
 * because there is only ever one provider inside a given resolver.
 *
 * Nigeria only, matching the Paystack resolver: every payout on this platform
 * is NGN to a Nigerian bank.
 */
@Injectable()
export class FlutterwaveBankAccountResolver implements BankAccountResolver {
  private readonly logger = new Logger(FlutterwaveBankAccountResolver.name);
  private bankCache: { value: BankOption[]; expiresAt: number } | null = null;

  constructor(private readonly config: AppConfigService) {}

  public get configured(): boolean {
    return this.config.flutterwaveConfigured;
  }

  public async resolveAccountName(input: ResolveAccountInput): Promise<ResolvedAccount> {
    const body = await this.request<FlutterwaveResolveResponse>('/v3/accounts/resolve', {
      account_number: input.accountNumber,
      account_bank: input.bankCode,
    });

    const accountName = body.data?.account_name?.trim();
    if (body.status !== 'success' || accountName === undefined || accountName === '') {
      // Flutterwave answers an unresolvable account with status "error" and a
      // readable message. That is the bank's verdict on the number somebody
      // typed, so it goes back to them rather than being logged and hidden.
      throw new ValidationDomainException(
        body.message?.trim() ??
          'That account number could not be verified with the bank. Check the number and the bank.',
      );
    }

    return { accountName };
  }

  public async listBanks(): Promise<BankOption[]> {
    const hit = this.bankCache;
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value;
    }

    const body = await this.request<FlutterwaveBankListResponse>('/v3/banks/NG');
    const banks = (body.data ?? [])
      .map((bank) => ({ name: bank.name ?? '', code: bank.code ?? '' }))
      .filter((bank) => bank.name !== '' && bank.code !== '')
      .sort((a, b) => a.name.localeCompare(b.name));

    // An empty list is never cached: one bad response would otherwise mean an
    // hour of unusable bank pickers.
    if (banks.length > 0) {
      this.bankCache = { value: banks, expiresAt: Date.now() + BANK_LIST_CACHE_TTL_MS };
    }
    return banks;
  }

  private async request<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    const secret = this.config.flutterwaveSecretKey;
    if (secret === '') {
      throw new ValidationDomainException('Bank verification is not configured');
    }

    const baseUrl = this.config.flutterwaveBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(
        `Flutterwave name enquiry failed (${String(response.status)}): ${text.slice(0, 200)}`,
      );
      throw new ValidationDomainException(
        'That account number could not be verified with the bank. Check the number and the bank.',
      );
    }

    return (await response.json()) as T;
  }
}
