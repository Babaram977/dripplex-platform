export interface ParsedSmartQuery {
  /** Remaining free-text terms after known patterns are stripped out. */
  keywords: string;
  maxPrice?: number;
  nearMe: boolean;
  openNow: boolean;
}

const PRICE_CEILING_PATTERN =
  /\b(?:under|below|less than)\s*(?:₦|ngn|naira)?\s*([\d,]+(?:\.\d+)?)\s*(k)?\b/i;
const NEAR_ME_PATTERN = /\b(?:near me|nearby|close to me)\b/i;
const OPEN_NOW_PATTERN = /\b(?:open now|currently open)\b/i;

/**
 * Structural parsing only — no LLM call. Extracts a handful of known
 * patterns (price ceilings, "near me", "open now") from a plain-language
 * query so the marketplace search bar can feel smart without the cost,
 * latency, and fallback-handling of a real NL model. Anything not
 * recognized is left in `keywords` and passed straight through to the
 * existing keyword search. True conversational search is deferred.
 */
export function parseSmartQuery(rawQuery: string): ParsedSmartQuery {
  let text = rawQuery.trim();
  let maxPrice: number | undefined;

  const priceMatch = PRICE_CEILING_PATTERN.exec(text);
  if (priceMatch) {
    const [full, digits, thousands] = priceMatch;
    const numeric = Number((digits ?? '').replace(/,/g, ''));
    if (!Number.isNaN(numeric)) {
      maxPrice = thousands ? numeric * 1000 : numeric;
      text = text.replace(full, ' ');
    }
  }

  const nearMe = NEAR_ME_PATTERN.test(text);
  if (nearMe) {
    text = text.replace(NEAR_ME_PATTERN, ' ');
  }

  const openNow = OPEN_NOW_PATTERN.test(text);
  if (openNow) {
    text = text.replace(OPEN_NOW_PATTERN, ' ');
  }

  return {
    keywords: text.replace(/\s+/g, ' ').trim(),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    nearMe,
    openNow,
  };
}
