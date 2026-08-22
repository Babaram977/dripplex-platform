// ─── Coming back from a payment gateway ──────────────────────────────────────
//
// Every card payment leaves the app: Paystack takes the customer to its own
// page and, unless we tell it otherwise, leaves them there. On 2026-08-19 a
// ₦1,000 airtime purchase was paid for and the customer sat on Paystack's
// "Payment Successful" screen with no airtime and no way back.
//
// Two things fix that, and both are needed:
//   • the gateway is given a callback URL, so the customer lands back here;
//   • the backend settles from the webhook, so the purchase completes even
//     when the customer never comes back at all.
//
// This module is the client half. The pending payment is kept in
// sessionStorage — it survives the round trip through the gateway in the same
// tab, and is gone when the tab is.

/** The flows the app sends to a gateway. Ride fares are cash-only in this
 * client, so there is nothing to come back from there.
 *
 * `booking` joined on 2026-08-22: a hotel booking is now paid through DrippleX
 * after the hotel accepts, so it makes the same round trip — and has the same
 * failure mode the airtime incident exposed, with the added sting that a guest
 * stranded on the gateway's page does not receive the PIN that proves the room
 * is theirs. */
export type GatewayReturnKind = 'utility' | 'wallet' | 'booking';

export interface GatewayReturn {
  kind: GatewayReturnKind;
  /** The utility purchase id, the wallet top-up reference, or the booking id. */
  id: string;
}

const KEY = 'dx.gatewayReturn';
const PARAM = 'dxreturn';

/**
 * Where the gateway should send the customer once they have paid. Query and
 * hash are stripped so a `?preview=1` or a stale `?dxreturn` cannot ride along
 * into the callback.
 */
export function gatewayCallbackUrl(kind: GatewayReturnKind): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(PARAM, kind);
  return url.toString();
}

export function rememberGatewayReturn(kind: GatewayReturnKind, id: string): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ kind, id }));
  } catch {
    // A browser with storage disabled still gets the webhook settlement.
  }
}

/** What the URL says we came back from, before the app has read storage. */
export function gatewayReturnKindFromUrl(): GatewayReturnKind | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(PARAM);
  return value === 'utility' || value === 'wallet' || value === 'booking' ? value : null;
}

/**
 * The pending payment, read once and cleared — a reload must not re-run the
 * confirmation. Returns null when this is not a return trip.
 */
export function takeGatewayReturn(): GatewayReturn | null {
  if (typeof window === 'undefined' || gatewayReturnKindFromUrl() === null) return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as GatewayReturn).id === 'string' &&
      typeof (parsed as GatewayReturn).kind === 'string'
    ) {
      return parsed as GatewayReturn;
    }
  } catch {
    // Corrupt entry — treat it as no pending payment.
  }
  return null;
}

/** Drop `?dxreturn` from the address bar so a refresh is an ordinary load. */
export function clearGatewayReturnParam(): void {
  if (typeof window === 'undefined' || gatewayReturnKindFromUrl() === null) return;
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}
