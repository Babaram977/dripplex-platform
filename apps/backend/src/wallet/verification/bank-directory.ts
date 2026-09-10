/**
 * One bank-matching rule for every persona.
 *
 * Turning what somebody typed ("UBA", "gtbank", "First Bank") into a bank the
 * provider actually recognises used to be reimplemented at each call site, and
 * they had drifted apart:
 *
 * - customer/driver/rider matched on a normalised name plus an alias table
 * - fleet matched on an exact lowercase name, so "UBA" was rejected outright
 *   while a driver typing the same three letters was accepted
 * - both merchant paths normalised the name but knew no aliases
 *
 * That is not a cosmetic inconsistency. A bank that fails to match is a bank
 * account that cannot be linked, and on the merchant settlement path it is a
 * payout that quietly does not happen. Same input, same answer, everywhere —
 * so this module is the only place that decides.
 *
 * What it deliberately does NOT do is decide whether an account is genuine.
 * Matching a bank only picks the code to ask with; the account-name enquiry
 * against that bank is what makes a destination real, and every caller still
 * has to do it.
 */

import { ValidationDomainException } from '../../common/exceptions/domain.exception';

import type { BankOption } from './bank-account-resolver.port';

/**
 * Strip everything that varies between how a person writes a bank name and how
 * the provider spells it: case, spaces, punctuation, and "&" vs "and"
 * (Paystack returns "Guaranty Trust Bank", people write "GT Bank", and
 * "Heritage & Co" / "Heritage and Co" are the same bank).
 */
export function normalizeBankName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Everyday Nigerian shorthand mapped to the canonical names providers return.
 * Keyed by the normalised form of what someone types; the values are
 * normalised provider names.
 *
 * Only unambiguous shorthand belongs here. If a term could plausibly mean two
 * banks, leave it out and let the caller be told to choose from the list —
 * guessing wrong sends money to the wrong institution.
 */
const BANK_NAME_ALIASES: Record<string, string[]> = {
  gtbank: ['guarantytrustbank'],
  gtb: ['guarantytrustbank'],
  gtbanknigeria: ['guarantytrustbank'],
  guarantytrust: ['guarantytrustbank'],
  uba: ['unitedbankforafrica', 'unitedbankforafricaplc'],
  fcmb: ['firstcitymonumentbank'],
  firstbank: ['firstbankofnigeria'],
  firstbanknigeria: ['firstbankofnigeria'],
  fbn: ['firstbankofnigeria'],
  access: ['accessbank'],
  accessbanknigeria: ['accessbank'],
  ecobank: ['ecobanknigeria'],
  fidelity: ['fidelitybank'],
  stanbic: ['stanbicibtc', 'stanbicibtcbank'],
  stanbicibtc: ['stanbicibtcbank'],
  sterling: ['sterlingbank'],
  polaris: ['polarisbank'],
  union: ['unionbankofnigeria'],
  unionbank: ['unionbankofnigeria'],
  unity: ['unitybank'],
  wema: ['wemabank'],
  zenith: ['zenithbank'],
  zenithbanknigeria: ['zenithbank'],
  keystone: ['keystonebank'],
  providus: ['providusbank'],
  jaiz: ['jaizbank'],
  titan: ['titanbank', 'titantrustbank'],
  kuda: ['kudabank', 'kudamicrofinancebank'],
  moniepoint: ['moniepoint', 'moniepointmfb', 'moniepointmicrofinancebank'],
  palmpay: ['palmpay'],
  opay: ['opay', 'opaydigitalservices'],
  heritage: ['heritagebank'],
  globus: ['globusbank'],
  parallex: ['parallexbank'],
  premiumtrust: ['premiumtrustbank'],
  suntrust: ['suntrustbank'],
  taj: ['tajbank'],
  lotus: ['lotusbank'],
  optimus: ['optimusbank'],
  signature: ['signaturebank'],
  sparkle: ['sparklemicrofinancebank'],
  vfd: ['vfdmicrofinancebank'],
  rubies: ['rubiesmicrofinancebank'],
  mint: ['mintmicrofinancebank'],
};

export function bankAliases(value: string): string[] {
  return BANK_NAME_ALIASES[normalizeBankName(value)] ?? [];
}

export interface BankSelection {
  /** What the caller supplied, free text. Optional so a code alone is enough. */
  bankName?: string | null;
  /** A provider bank code, when the client already used a bank picker. */
  bankCode?: string | null;
}

/**
 * Find the bank a selection refers to, or null when nothing matches.
 *
 * An exact `bankCode` wins outright — a client that used the picker has
 * already been unambiguous, and re-deriving from the display name could only
 * lose information. Otherwise the name is matched against the canonical name
 * and then the alias table.
 */
export function findBank(banks: BankOption[], selection: BankSelection): BankOption | null {
  const code = selection.bankCode?.trim();
  if (code) {
    const byCode = banks.find((bank) => bank.code === code);
    if (byCode) {
      return byCode;
    }
  }

  const name = selection.bankName?.trim();
  if (!name) {
    return null;
  }

  const requested = normalizeBankName(name);
  if (!requested) {
    return null;
  }

  // What the caller typed, plus any known shorthand for it. Both are matched
  // the same way, so an alias benefits from the relaxed passes below too.
  const terms = [requested, ...bankAliases(name)];
  const canonical = (bank: BankOption): string => normalizeBankName(bank.name);

  const exact = banks.find((bank) => terms.includes(canonical(bank)));
  if (exact) {
    return exact;
  }

  // Providers pad canonical names in ways nobody types: "OPay Digital Services
  // Limited (OPay)", "Sparkle Microfinance Bank", "Moniepoint MFB". Enumerating
  // every such spelling by hand is a losing game, so fall back to matching a
  // typed term against the start of a canonical name, and then anywhere in it.
  //
  // Each pass only answers when it lands on exactly ONE bank. Two candidates
  // means the term is ambiguous ("first" is both First Bank and First City
  // Monument) and the caller is told to choose rather than being sent to
  // whichever happened to sort first. Sending money to the wrong institution is
  // far worse than asking again.
  //
  // Short terms are excluded: two or three characters match too much to be
  // evidence of anything, and the alias table already covers the real ones.
  const usable = terms.filter((term) => term.length >= 4);

  for (const match of [
    (bank: BankOption, term: string): boolean => canonical(bank).startsWith(term),
    (bank: BankOption, term: string): boolean => canonical(bank).includes(term),
  ]) {
    const hits = banks.filter((bank) => usable.some((term) => match(bank, term)));
    if (hits.length === 1) {
      return hits[0] ?? null;
    }
  }

  return null;
}

/**
 * Same as findBank, but refuses rather than returning null. Use this on any
 * path where failing to identify the bank must stop the operation — linking an
 * account, or sending money to one.
 */
export function requireBank(
  banks: BankOption[],
  selection: BankSelection,
  message = 'Choose a valid Nigerian bank so we can confirm the account name',
): BankOption {
  const bank = findBank(banks, selection);
  if (!bank) {
    throw new ValidationDomainException(message);
  }
  return bank;
}
