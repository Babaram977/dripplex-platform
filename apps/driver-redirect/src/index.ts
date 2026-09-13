/**
 * driver.dripplex.com — a compatibility doorway, and nothing else.
 *
 * The standalone Driver Portal was retired by founder decision on 2026-08-30:
 * every capability it offered lives in the Super App, and the separate address
 * was a second front door to the same account. What that decision did not do
 * was take the hostname down. CI stopped re-attaching it; the DNS record and
 * the Railway attachment were left behind, and the CNAME went stale
 * (`hhni6n78.up.railway.app`, where Railway wanted `u1jtq3rx`). Railway could
 * therefore never finish validating ownership, never issued a certificate, and
 * the host settled into the two failures the founder photographed on
 * 2026-09-13: Railway's "the train has not arrived at the station", and an iOS
 * "This Connection Is Not Private".
 *
 * Drivers still hold the old link — in bookmarks, in messages, on paper. This
 * Worker exists so those links land somewhere real instead of on a browser
 * security warning.
 *
 * It is deliberately the smallest thing that can work: no origin, no assets, no
 * bindings, no fetch. It cannot serve the old Driver Portal or the customer app
 * because it has no way to reach either — the only value it can produce is the
 * Response constructed below. That is the point, not an accident of the
 * implementation, and `driverRedirect.test.ts` pins it.
 */

/**
 * Every request lands here, whatever was asked for.
 *
 * The old portal had eighteen paths — /earnings, /shift, /sos, /wallet and the
 * rest. The Super App's router recognises five, and `driver` is the only one
 * they share. So forwarding a path is worse than dropping it: `/earnings`
 * would resolve to app.dripplex.com/earnings, match no portal route, fall
 * through to the hostname check, and put a driver hunting for their earnings
 * on the customer splash screen. Everything goes to the one address that is
 * certain to be the Driver login.
 */
export const DRIVER_ENTRY_POINT = 'https://app.dripplex.com/driver';

export default {
  fetch(_request: Request): Response {
    // 301, not 302: the move is permanent, and a permanent redirect lets
    // browsers stop asking. Nothing here is going to start serving an app
    // again — reversing this means changing the Worker, not the cache.
    return Response.redirect(DRIVER_ENTRY_POINT, 301);
  },
};
