/**
 * Name enquiry — asking the bank who actually owns an account number before
 * anyone sends money to it.
 *
 * Phase 0 of docs/DPX-WALLET-001-WALLET-FINANCIAL-INFRASTRUCTURE-SPEC.md, and
 * the only phase that needs no licence, no partner agreement and no counsel.
 *
 * Until this existed, a withdrawal destination was whatever the customer
 * typed: `BankAccountsService` stored `accountName` as free text and nothing
 * checked it against the bank. One transposed digit is a valid account number
 * belonging to a stranger, and the only thing standing between that and the
 * money leaving is an operator reading the row before making a manual
 * transfer. Phase 4 removes that operator. So the check lands first.
 *
 * Deliberately mirrors `PayoutProvider` / `PaymentProviderAdapter`: one
 * interface, one real class per provider, so the wallet never learns a
 * provider's vocabulary (DPX-WALLET-001 §11.1).
 */

export interface ResolveAccountInput {
  accountNumber: string;
  /** Required. Name enquiry is meaningless without knowing which bank —
   * the same ten digits exist at every one of them. */
  bankCode: string;
}

export interface ResolvedAccount {
  /** The name the bank returns. This is authoritative and replaces whatever
   * the customer typed — it is the entire point of asking. */
  accountName: string;
}

export interface BankOption {
  name: string;
  code: string;
}

export interface BankAccountResolver {
  /** False when no credentials are configured. Callers check this before
   * requiring verification, so an unconfigured environment degrades to the
   * previous self-attested behaviour rather than refusing every account. */
  readonly configured: boolean;

  /**
   * Resolves the account holder's name, or throws.
   *
   * Throws `ValidationDomainException` when the bank says the account does
   * not exist — that is a real answer about a real account number and the
   * customer needs to see it, not a system fault.
   */
  resolveAccountName(input: ResolveAccountInput): Promise<ResolvedAccount>;

  /** The banks name enquiry can be performed against, with the codes it
   * needs. A free-text bank name cannot be resolved. */
  listBanks(): Promise<BankOption[]>;
}

export const BANK_ACCOUNT_RESOLVER = Symbol('BANK_ACCOUNT_RESOLVER');
