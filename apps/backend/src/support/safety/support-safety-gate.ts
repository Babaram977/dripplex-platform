import { type SupportCategory } from '@prisma/client';

import { SAFETY_GATE_TERMS } from './support-safety-lexicon';

/**
 * DPX-SUPPORT-002 §4 — the first safety/money gate. LOCKED.
 *
 * Deterministic, server-side, and **no LLM participates in it**. That is the
 * whole point: the decision about whether a person's problem may be handled by
 * automation must not itself be made by automation.
 *
 * Phase 1 left this open. `CreateSupportTicketDto.category` is validated against
 * the ten-value enum but supplied by the caller, so `requiresHumanHandling` was
 * derived from a field the caller controlled. Harmless while every ticket
 * reached a human anyway; a one-field bypass the moment automation exists —
 * file "my driver charged me twice" as TECHNICAL and an AI takes a payment
 * dispute. This closes that.
 *
 * ## Widen only
 *
 * The gate can move a conversation INTO human handling. Nothing — not the
 * declared category, not a classifier, not a confidence score — can move one
 * out of it (§3, §6).
 *
 * ## Biased toward over-triggering, permanently
 *
 * A false positive sends a resolvable question to a human. A false negative
 * lets automation near somebody's money or safety. Those costs are not
 * comparable. This must never be re-tuned toward deflection rate, AI
 * containment or cost per ticket (§4, LOCKED).
 */

/**
 * Lower-case, strip Hausa hooked letters and other diacritics, and flatten
 * punctuation to spaces.
 *
 * Two reasons, both load-bearing:
 *
 * 1. Hausa is written with ɗ, ƙ, ɓ and tone marks, and real users type it both
 *    with and without them — "kuɗina" and "kudina" are the same word and must
 *    match the same term. Unicode NFD splits the combining marks off so they
 *    can be dropped; the hooked consonants are not decomposable, so they are
 *    mapped explicitly.
 * 2. Punctuation must not hide a term. "money?" and "charged!!!" have to match
 *    the same way "money" does, and `\w` boundaries alone would not help for
 *    the multi-word phrases.
 */
export function normalise(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      // Combining diacritical marks, left behind by NFD.
      .replace(/[̀-ͯ]/g, '')
      // Hausa hooked consonants and the glottal apostrophe do not decompose.
      .replace(/[ɗƊ]/g, 'd')
      .replace(/[ƙƘ]/g, 'k')
      .replace(/[ɓƁ]/g, 'b')
      .replace(/[’'ʼ]/g, '')
      // Everything that is not a letter, digit or the naira sign becomes a space,
      // so terms are found on word boundaries without a regex per term.
      .replace(/[^\p{L}\p{N}₦]+/gu, ' ')
      .trim()
  );
}

/**
 * The lexicon, normalised once at module load and split by shape.
 *
 * Two things were wasteful about doing this per call. Every term is a constant,
 * so normalising them on each ticket re-ran an NFD pass and five regex replaces
 * a few hundred times to produce the same strings as last time. And every term
 * was tested with a substring scan, when most of them are single words and a
 * message only has a few dozen words in it.
 *
 * So: single words go in a Set and are answered by hashing the message's own
 * words, which is proportional to the message rather than to the lexicon.
 * Multi-word phrases keep the substring scan, because that is what they need.
 *
 * Matching semantics are unchanged — a Set lookup over the message's words IS
 * whole-word matching, which is why "card" still does not fire on "cardiac".
 */
interface PreparedTerms {
  category: SupportCategory;
  /** normalised single word -> the original lexicon spelling, for the audit
   *  record. Reporting the normalised form would name a term that does not
   *  appear in the lexicon anyone reviews. */
  words: ReadonlyMap<string, string>;
  phrases: readonly { normalised: string; original: string }[];
}

const PREPARED: readonly PreparedTerms[] = SAFETY_GATE_TERMS.map(({ category, terms }) => {
  const words = new Map<string, string>();
  const phrases: { normalised: string; original: string }[] = [];

  for (const original of terms) {
    const normalised = normalise(original);
    if (normalised.length === 0) continue;
    if (normalised.includes(' ')) {
      phrases.push({ normalised, original });
    } else if (!words.has(normalised)) {
      // First spelling wins, so a term listed twice reports consistently.
      words.set(normalised, original);
    }
  }

  return { category, words, phrases };
});

export interface SafetyGateResult {
  /** The category the gate detected, or `null` if it found nothing. */
  category: SupportCategory | null;
  /** The term that fired, kept for the audit record so a decision about
   *  somebody's money can be explained afterwards rather than re-guessed. */
  matchedTerm: string | null;
}

/**
 * Scan the user's own words for money or safety signals.
 *
 * SAFETY is checked before money: a message describing a robbery mentions both,
 * and it is a safety case.
 */
export function detectMandatoryHumanCategory(
  ...parts: (string | null | undefined)[]
): SafetyGateResult {
  const normalised = normalise(
    parts.filter((part): part is string => typeof part === 'string').join(' '),
  );
  if (normalised.length === 0) {
    return { category: null, matchedTerm: null };
  }

  const words = normalised.split(' ');
  const padded = ` ${normalised} `;

  // SAFETY is prepared first, so it is checked first: a message describing a
  // robbery mentions the money too, and it is a safety case.
  for (const { category, words: lexiconWords, phrases } of PREPARED) {
    for (const word of words) {
      const original = lexiconWords.get(word);
      if (original !== undefined) {
        return { category, matchedTerm: original };
      }
    }
    for (const phrase of phrases) {
      if (padded.includes(` ${phrase.normalised} `)) {
        return { category, matchedTerm: phrase.original };
      }
    }
  }

  return { category: null, matchedTerm: null };
}
