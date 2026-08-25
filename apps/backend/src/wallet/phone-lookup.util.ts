/**
 * Phone-number matching for wallet-to-wallet transfer.
 *
 * `User.phone` holds whatever the client that registered the account sent.
 * There is no normalization anywhere in registration, and the clients do not
 * agree:
 *
 *   super-app customer signup   toE164()      → "+2348033968368"
 *   merchant-portal signup      raw field     → "08033968368"
 *
 * The transfer lookup used `findUnique({ where: { phone } })` against the
 * digits the sender typed, so entering a Nigerian number the way Nigerians
 * write it — 08033968368 — could never match an account stored in E.164.
 * Transfer by phone did not work for anybody.
 *
 * This builds the small set of spellings that unambiguously mean the number
 * that was typed, so the lookup can be an exact indexed `in` query rather
 * than a scan. It is a read-side repair only: nothing here changes what
 * registration stores, and the two formats keep diverging until that is
 * fixed separately.
 *
 * Money is moving, so the rules are deliberately narrow:
 *
 *  - An explicit country prefix is believed. "+448033968368" is looked up as
 *    a UK number and never as +234, because expanding it across every
 *    supported country would let a sender land on a stranger who happens to
 *    hold the same national digits under a different code.
 *  - +234 is assumed ONLY when the input carries no country code at all,
 *    which is what the app's own toE164() already does at registration.
 *  - A number too short to identify anyone is not looked up.
 */

/** Nigeria — the only code inferred, and only for input with no prefix. */
const NG = '234';

/** Below this, the digits cannot identify a subscriber. Nigerian national
 *  significant numbers are 10 digits (803 396 8368); the floor is lower so a
 *  short foreign number still works, but not so low that a few taps match. */
const MIN_NSN_DIGITS = 7;

/**
 * Every spelling of the supplied number that means the same subscriber.
 * Empty when the input cannot identify one.
 */
export function phoneLookupCandidates(input: string): string[] {
  const trimmed = input.trim();
  const hadPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return [];

  // An explicit country code, whether written "+234…" or "234…". Taken at
  // face value: only the local forms of a Nigerian number are added, because
  // those are spellings of the same number rather than a guess at a country.
  if (hadPlus || digits.startsWith(NG)) {
    const out = [`+${digits}`, digits];
    if (digits.startsWith(NG)) {
      const nsn = digits.slice(NG.length);
      if (nsn.length >= MIN_NSN_DIGITS) out.push(`0${nsn}`, nsn);
    }
    return dedupe(out);
  }

  // No country code: a national number, with or without the trunk 0.
  const nsn = digits.startsWith('0') ? digits.slice(1) : digits;
  if (nsn.length < MIN_NSN_DIGITS) return [];
  return dedupe([`+${NG}${nsn}`, `${NG}${nsn}`, `0${nsn}`, nsn]);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
