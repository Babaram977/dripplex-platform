import { Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';

import {
  BANK_ACCOUNT_RESOLVER,
  FLUTTERWAVE_BANK_ACCOUNT_RESOLVER,
  type BankAccountResolver,
} from '../verification/bank-account-resolver.port';
import { findBank, normalizeBankName } from '../verification/bank-directory';

/** A verified destination as it is stored, whichever table it came from. */
export interface StoredDestination {
  bankName: string;
  bankCode: string;
  /** Which provider's list `bankCode` came from. */
  bankCodeProvider: string;
  accountNumber: string;
  /** The name the bank returned when this account was verified. */
  accountName: string;
}

export interface ResolvedDestination {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

/**
 * The bank code to send, for the provider that is actually sending.
 *
 * This exists because bank codes are provider-specific and nothing about them
 * says so. Paystack calls Guaranty Trust "058"; Flutterwave publishes its own
 * list. Handing one provider the other's code does not reliably fail — it can
 * name a different institution, and the failure is a stranger receiving a
 * partner's earnings. A second payout rail is only safe with something
 * standing between the stored code and the transfer.
 *
 * Two paths:
 *
 * - The stored code already belongs to the sending provider. Send it. No extra
 *   calls, which is the common case and stays the common case.
 *
 * - It does not. The bank is matched by name against the sending provider's
 *   own list, and then — this is the part that makes it safe — the account is
 *   re-verified with that provider. The account name it returns must match the
 *   name the account was verified under. If we picked the wrong bank, a
 *   different holder (or nothing at all) comes back and the payout is refused.
 *   Name matching alone would not be enough: "Guaranty Trust Bank" and
 *   "GTBANK PLC" are the same bank spelled differently by two providers, and a
 *   matcher confident enough to join those is confident enough to join two
 *   banks that are not the same.
 *
 * Returning null always means "do not send", never "send anyway".
 */
@Injectable()
export class PayoutDestinationService {
  private readonly logger = new Logger(PayoutDestinationService.name);

  constructor(
    @Inject(BANK_ACCOUNT_RESOLVER) private readonly paystack: BankAccountResolver,
    @Inject(FLUTTERWAVE_BANK_ACCOUNT_RESOLVER)
    private readonly flutterwave: BankAccountResolver,
  ) {}

  public async resolveFor(
    provider: PaymentProvider,
    stored: StoredDestination,
  ): Promise<ResolvedDestination | null> {
    if (stored.bankCodeProvider === provider) {
      return {
        bankCode: stored.bankCode,
        accountNumber: stored.accountNumber,
        accountName: stored.accountName,
      };
    }

    const resolver = this.resolverFor(provider);
    if (!resolver?.configured) {
      this.logger.warn(
        `Cannot re-resolve a destination for ${provider}: no configured resolver for it.`,
      );
      return null;
    }

    const bank = findBank(await resolver.listBanks(), { bankName: stored.bankName });
    if (bank === null) {
      this.logger.warn(
        `${provider} does not list a bank matching "${stored.bankName}"; refusing the payout.`,
      );
      return null;
    }

    try {
      const confirmed = await resolver.resolveAccountName({
        accountNumber: stored.accountNumber,
        bankCode: bank.code,
      });

      if (normalizeBankName(confirmed.accountName) !== normalizeBankName(stored.accountName)) {
        // Right number, different holder: the bank matched by name is not the
        // bank this account is at. Exactly what this check is here to catch.
        this.logger.warn(
          `${provider} resolved a different account holder for the same number; refusing the payout.`,
        );
        return null;
      }

      return {
        bankCode: bank.code,
        accountNumber: stored.accountNumber,
        accountName: confirmed.accountName,
      };
    } catch {
      // The provider could not confirm the account at that bank. An
      // unconfirmed destination is not one to send money to.
      this.logger.warn(`${provider} could not confirm the destination; refusing the payout.`);
      return null;
    }
  }

  private resolverFor(provider: PaymentProvider): BankAccountResolver | null {
    if (provider === PaymentProvider.PAYSTACK) {
      return this.paystack;
    }
    if (provider === PaymentProvider.FLUTTERWAVE) {
      return this.flutterwave;
    }
    return null;
  }
}
