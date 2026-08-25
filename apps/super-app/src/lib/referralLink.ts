// ─── Referral links ───────────────────────────────────────────────────────────
//
// A code on its own asks a lot of the person receiving it: install the app,
// find registration, remember eight characters, type them correctly. A link
// carries the code for them — they tap it, land in the app, and the field is
// already filled.
//
// The link is just the app's own URL with `?ref=CODE`. There is no new
// endpoint and no shortener: the code in the query string is the whole
// mechanism, and registration already accepts a referralCode.
//
// The catch is that landing and registering are not the same moment. Someone
// taps the link, looks around, and signs up later — possibly after a reload,
// which is when a code held only in memory would be lost. So the code is
// captured on the landing load, stored, and read back when the registration
// screen mounts.

const KEY = 'dx.referralCode';
const PARAM = 'ref';

/**
 * How long a captured code stays attached to this device.
 *
 * Without an expiry a code stored today would attach itself to a signup a year
 * from now, crediting a referrer for someone they had nothing to do with.
 * Thirty days is a judgement call, not a founder decision — it is the one
 * number here worth revisiting if the referral programme gets formal terms.
 */
const CAPTURE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Same shape the server issues and registration validates against. */
const CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

interface StoredCapture {
  code: string;
  at: number;
}

/**
 * The link to share. Built from the current origin rather than a hardcoded
 * domain, so a preview build shares a preview link instead of sending testers
 * to production — the same reasoning as gatewayCallbackUrl.
 */
export function referralShareUrl(code: string): string {
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set(PARAM, code);
  return url.toString();
}

/**
 * Read `?ref=` off the landing URL, remember it, and take it out of the
 * address bar so a reload or a shared screenshot does not carry it around.
 *
 * Safe to call on every load: with no `?ref=` it does nothing, and it never
 * overwrites a stored code with a malformed one.
 */
export function captureReferralCodeFromUrl(): void {
  if (typeof window === 'undefined') return;
  const raw = new URLSearchParams(window.location.search).get(PARAM);
  if (raw === null) return;

  const code = raw.trim().toUpperCase();
  if (CODE_PATTERN.test(code)) {
    try {
      const entry: StoredCapture = { code, at: Date.now() };
      window.localStorage.setItem(KEY, JSON.stringify(entry));
    } catch {
      // Storage disabled. The customer can still type the code by hand.
    }
  }

  // Strip the param whether or not it was usable, so a bad code does not sit
  // in the URL being retried on every reload.
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * The captured code, if there is a live one. Expired or malformed entries are
 * cleared rather than returned.
 */
export function capturedReferralCode(): string {
  if (typeof window === 'undefined') return '';
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return '';
  }
  if (raw === null) return '';

  try {
    const parsed: unknown = JSON.parse(raw);
    const entry = parsed as StoredCapture;
    if (
      typeof entry?.code === 'string' &&
      typeof entry?.at === 'number' &&
      CODE_PATTERN.test(entry.code) &&
      Date.now() - entry.at < CAPTURE_TTL_MS
    ) {
      return entry.code;
    }
  } catch {
    // Corrupt entry — fall through and clear it.
  }
  clearCapturedReferralCode();
  return '';
}

/** Called once the code has been used, so it cannot attach to a second signup. */
export function clearCapturedReferralCode(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
