import { Injectable, Logger } from '@nestjs/common';

import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

import type {
  BankAccountResolver,
  BankOption,
  ResolveAccountInput,
  ResolvedAccount,
} from './bank-account-resolver.port';

interface PaystackResolveResponse {
  status: boolean;
  message?: string;
  data?: { account_number?: string; account_name?: string };
}

interface PaystackBankListResponse {
  status: boolean;
  message?: string;
  data?: { name?: string; code?: string; active?: boolean; currency?: string }[];
}

/** The bank list moves rarely and every account addition needs it, so it is
 * cached rather than fetched per keystroke. An hour is short enough that a
 * newly-licensed bank appears the same day and long enough that the list is
 * not a per-request dependency. */
const BANK_LIST_CACHE_TTL_MS = 60 * 60_000;

/**
 * Paystack name enquiry.
 *
 * `GET /bank/resolve` and `GET /bank` are read-only lookups. They move no
 * money and cannot: the secret key is the same one already configured for
 * collections, and no new credential or scope is introduced by this class.
 */
@Injectable()
export class PaystackBankAccountResolver implements BankAccountResolver {
  private readonly logger = new Logger(PaystackBankAccountResolver.name);
  private bankCache: { value: BankOption[]; expiresAt: number } | null = null;

  constructor(private readonly config: AppConfigService) {}

  public get configured(): boolean {
    return this.config.paystackConfigured;
  }

  public async resolveAccountName(input: ResolveAccountInput): Promise<ResolvedAccount> {
    const query = new URLSearchParams({
      account_number: input.accountNumber,
      bank_code: input.bankCode,
    });
    const body = await this.request<PaystackResolveResponse>(`/bank/resolve?${query.toString()}`);

    const accountName = body.data?.account_name?.trim();
    if (!body.status || !accountName) {
      // Paystack answers a nonexistent or mismatched account with
      // status:false and a readable message ("Could not resolve account
      // name. Check parameters or try again."). That is the bank's verdict
      // on the number the customer typed, so it goes to the customer.
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

    const body = await this.request<PaystackBankListResponse>('/bank?country=nigeria&perPage=100');
    const banks = (body.data ?? [])
      .filter((bank) => bank.active !== false)
      .map((bank) => ({ name: bank.name ?? '', code: bank.code ?? '' }))
      .filter((bank) => bank.name !== '' && bank.code !== '')
      .sort((a, b) => a.name.localeCompare(b.name));

    // An empty list is not cached. Caching it would turn one bad response
    // into an hour of unusable bank pickers.
    if (banks.length > 0) {
      this.bankCache = { value: banks, expiresAt: Date.now() + BANK_LIST_CACHE_TTL_MS };
    }
    return banks;
  }

  private async request<T>(path: string): Promise<T> {
    const secret = this.config.paystackSecretKey;
    if (!secret) {
      throw new ValidationDomainException('Bank verification is not configured');
    }

    const baseUrl = this.config.paystackBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      // A 404 here means "no such account", not "endpoint missing" — Paystack
      // uses it for an unresolvable account number. Both read as a failed
      // verification to the caller, which is the correct outcome either way:
      // nothing gets saved as verified.
      const text = await response.text();
      this.logger.warn(
        `Paystack name enquiry failed (${String(response.status)}): ${text.slice(0, 200)}`,
      );
      throw new ValidationDomainException(
        'That account number could not be verified with the bank. Check the number and the bank.',
      );
    }

    return (await response.json()) as T;
  }
}
