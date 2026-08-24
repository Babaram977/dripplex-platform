# DPX-MOBILE-001 — Store Readiness Gate

## Objective

Prepare the DrippleX customer mobile application for controlled Android and iOS testing first, then store review. Mobility/ride booking and driver dispatch are intentionally excluded from this workstream while that functionality is being actively fixed elsewhere.

## Current packaging baseline

- Customer app: `@dripplex/customer-mobile`
- Framework: Capacitor 7
- Android application ID: `com.dripplex.customer`
- iOS bundle identifier: `com.dripplex.customer`
- Android channels: `production`, `internal`, `closedBeta`
- Production customer URL: `https://app.dripplex.com` — the Capacitor default, **not a settled choice**; see _Shell target_ below
- Android release artifacts: AAB + APK
- iOS release validation: unsigned simulator Release build in CI; signed App Store archive requires Apple signing credentials on macOS

## Shell target — open founder decision (2026-08-20)

`CAPACITOR_SERVER_URL` is the page the WebView **loads**. It is a different thing from
`VITE_API_BASE`, the API that loaded page **calls**. Verified live on 2026-08-20:

| Host                                               | Verified state                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `https://app.dripplex.com`                         | HTTP 200 — serves **customer-web** (Cloudflare Worker), byte-identical to `www.dripplex.com`, `robots: index, follow` |
| `https://super-app-production-2345.up.railway.app` | HTTP 200 — serves **super-app**, `robots: noindex, nofollow`; no custom domain attached                               |
| `https://api.dripplex.com/`                        | HTTP 404 `application/json` — an API root, never a valid `CAPACITOR_SERVER_URL`                                       |

The super-app already calls the production API (`VITE_API_BASE` / `VITE_SOCKET_URL` default to
`api.dripplex.com` — `apps/super-app/src/lib/api.ts:9`, `src/lib/ws.ts:10`), and the backend's
live CORS allowlist already admits both the super-app Railway host and `app.dripplex.com`
(unknown origins receive no `access-control-allow-origin` header).

So the shell as configured ships **customer-web**, not the super-app. Repointing it is a CI
input (`server_url` on `mobile-build.yml` and `mobile-store-readiness.yml`), not a code change
— but it is blocked on the item below, which is not a matter of configuration.

### Resolved — the super-app now owns both auth landing routes

Founder decision 2026-08-20: build the routes, then move `CUSTOMER_APP_URL`. The Super App is the
production frontend for Customer, Driver, Rider and Merchant; `api.dripplex.com` stays the
backend; the Super App owns its required frontend routes rather than redirecting customers into
customer-web. Ops Console remains separate.

The backend holds a single `CUSTOMER_APP_URL`, currently `https://www.dripplex.com`
(`docs/ops/DPX-LAUNCH-003-GOOGLE-SIGNIN.md:76`). Two flows redirect the browser to it:

- `apps/backend/src/auth/controllers/google-auth.controller.ts:50` → `${CUSTOMER_APP_URL}/auth/google/callback?code=…`
- `apps/backend/src/notifications/production-notification.service.ts:85` → `${CUSTOMER_APP_URL}/verify-email?token=…`

The super-app has no router. `initialScreenFromLocation` recognises only `PORTAL_ROUTES` paths
(`src/app/App.tsx:462-464`), trip codes `/t/<code>` (`App.tsx:2159`) and the `?app=`/`?preview=`
and gateway-return query params; anything else resolved to `null` and rendered splash, so both
paths dropped their handoff code and verification token.

Both are now answered by `apps/super-app/src/app/authRouteScreens.tsx`, rendered outside AppShell
on the `SharedTripScreen` precedent, with the URL rewritten to `/` on exit so neither payload
lingers in history or referrer headers. Google exchanges its single-use code through the new
`api.auth.exchangeGoogleCode` and hands the result to the existing
`ApiProvider.loginWithResponse` — no new auth machinery. Email verification asks for the address
alongside the token, because the backend requires both (`VerifyEmailTokenDto`) so a leaked token
alone is not sufficient.

Verified against production contracts, then in Chromium against those same shapes: Google success
stores the session, cleans the URL, lands on the customer home screen and survives a reload;
rejection surfaces the backend message and writes no session; missing code, `?error=`, verify
success and verify rejection all behave; `/` and `/ops` unchanged.

**Still open before `CUSTOMER_APP_URL` can move:**

1. The super-app has no custom domain — only `super-app-production-2345.up.railway.app`. DNS for
   `dripplex.com` is on Cloudflare and is founder-side.
2. Moving the variable restarts the backend (see below), so it wants doing deliberately.
3. **Google sign-in inside the Capacitor shell is expected to fail.** The "Continue with Google"
   button now exists on `SignInScreen` and navigates to `api.auth.googleSignInUrl()`
   (`https://api.dripplex.com/api/v1/auth/google`), verified in a browser. But Google refuses
   OAuth in an embedded WebView, and Capacitor opens off-origin top-level navigations in the
   system browser by default (`server.allowNavigation` is unset), so the redirect back would land
   outside the app. Making this work on device needs a native plugin or a system-browser flow
   with a deep link back — not yet built, and it should be tested on real hardware before any
   store submission claims Google sign-in works. Apple and Face ID sign-in stay hidden: Apple has
   no backend and Face ID is native-only.

### Dependencies once a target is chosen

- Do not ship a `*.up.railway.app` host in a submitted build.
- A new domain must be added to `CORS_ORIGINS` on the `@dripplex/backend` Railway service.
  `apps/backend/src/main.ts:23-26` reads it once at bootstrap, so that variable change
  **restarts the backend**. Railway's Raw Editor replaces the entire variable set — paste the
  complete block (`docs/ops/PRODUCTION-RAILWAY.md:104`).
- DNS for `dripplex.com` is on Cloudflare and is founder-side; no tooling available to the
  agent session can change it.

## Shell target — RESOLVED 2026-08-24

`app.dripplex.com` now serves the **super-app**, not customer-web — verified the same day by
fetching the page (`<title>Dripplex — life, Simplified</title>`, `robots: noindex`) and by
grepping the served bundle for code merged in #261. `capacitor.config.ts:20` defaults
`CAPACITOR_SERVER_URL` to that host and `mobile-build.yml` passes it, so the shell finally opens
the intended app. The three blockers listed above are closed: the super-app has its custom
domain, CORS admits it, and no `*.up.railway.app` host is shipped.

Google sign-in inside the WebView is **still expected to fail** and is still unbuilt. Do not
claim it works in a store listing.

The "do not submit while ride booking is broken" instruction at the foot of this document has
also lifted: the complete driver journey — register through to a paid cash trip with commission
split — was run against production on 2026-08-24.

## Gate A — Technical packaging

- [x] Android/iOS native projects present
- [x] Stable app identifiers configured
- [x] Release version/build metadata aligned at `1.0.0` / `1000100`
- [x] Android release flavors present
- [x] Android HTTPS app-link host configured
- [x] iOS custom URL scheme configured
- [x] Apple privacy manifest present
- [x] Android release signing is secret-driven in CI
- [x] Static packaging verification strengthened
- [x] Dedicated store-readiness CI workflow added
- [x] Successful production Android AAB build recorded — `mobile-build.yml` run #3
      (2026-08-22, `4984d3b`), `:app:signProductionReleaseBundle` executed and logged SIGNED.
      **That artifact is stale**: it was built when `app.dripplex.com` still served
      customer-web. Re-run recorded below.
- [x] **Current signed AAB + APK — run #4, 2026-08-24, `b229331`, against the corrected shell
      target.** All three jobs green (packaging verify, iOS project preflight, Android build);
      `CAPACITOR_SERVER_URL=https://app.dripplex.com`, flavor `production`, `REQUIRE_SIGNED=1`.
      Artifacts `dripplex-customer-production-aab` / `-apk` on
      [run 32704498517](https://github.com/Babaram977/dripplex-platform/actions/runs/32704498517).
      **This is the build to upload.** Not yet installed on real hardware — Gate C is unrun.
- [ ] Successful iOS Release simulator build recorded
- [ ] Signed iOS archive/TestFlight build recorded

## Gate B — Brand and store assets

Launcher and splash assets shipped the **stock Capacitor logo** up to 2026-08-21 —
verified by opening the files, not by reading a manifest. They are now generated from the
founder-supplied master vector `apps/customer-mobile/resources/dripplex-mark.svg`.

Required:

- [x] Android 512x512 store icon — `apps/customer-mobile/resources/play-store-icon-512.png`
- [x] Android adaptive icon foreground/background — foreground at every density; background
      layer `@color/ic_launcher_background` moved `#FFFFFF` → `#000000`
- [x] Google Play feature graphic — `resources/play-feature-graphic-1024x500.png`, verified 1024x500
- [x] Android phone screenshots — five 1080x1920 PNGs in `resources/play-screenshots/`,
      captured from the real signed-in app. Their README rates `05-orders.png` **do not ship**
      and `04-wallet.png` thin, so 2-3 of the five are listing-quality as things stand
- [ ] iPhone screenshots
- [ ] iPad screenshots if the iPad target remains enabled
- [x] iOS App Store icon set — 1024x1024, alpha-free (Apple rejects transparency)
- [x] Final splash assets — all 11 Android densities + the 3 iOS entries, black ground;
      `capacitor.config.ts` splash `backgroundColor` moved `#0E7A3E` → `#000000` so the
      splash is not framed in a colour the artwork does not contain
- [ ] Store listing copy
- [~] Privacy policy URL — `https://www.dripplex.com/privacy` is live and now carries a full
  policy grounded in DPX-MOBILE-003. **Blocked on Nigerian legal review and on the
  registered controller name/address**, which are placeholders in the page source
- [~] Support URL — `https://www.dripplex.com/contact` is live (HTTP 200); confirm it is the
  address you want reviewers and users to write to
- [ ] Marketing website URL

Assets are **generated, never hand-edited**:

```
pnpm --filter @dripplex/customer-mobile icons:generate   # rewrite all 31 assets
pnpm --filter @dripplex/customer-mobile icons:verify     # assert they are correct
```

`icons:verify` checks more than existence: exact dimensions, no alpha on store icons, a
black ground, adaptive foregrounds entirely inside the launcher mask-safe circle, no
blue-dominant (Capacitor-logo) regression, and — because the failure that motivated it was
silent — that a column through the mark crosses exactly four painted bands, so a dropped
element cannot pass as a valid icon. Both checks run in `mobile-store-readiness.yml`, which
also regenerates and fails if the committed PNGs drift from the master.

**Known limitation, accepted.** The master's three paths are `M`/`L`/`Z` polygons (18, 23 and
98 points) — a fine raster trace, not Bézier curves. Faceting is invisible at 1024px and
below, which covers every asset here, so it is production-ready for app icons, splash screens
and digital use. Large-format print, signage and vehicle livery want a true Bézier redraw;
tracked in `docs/TODO-BRAND-ASSETS.md`. The master's gradient also resolves per path rather
than sweeping the whole mark; that matches the approved artwork and is preserved deliberately
(founder decision 2026-08-21).

Source of truth for the brand mark: `packages/ui/src/brand/dripplex-mark.ts` and the approved brand-identity reference documented in `docs/TODO-BRAND-ASSETS.md`.

## Gate C — Functional smoke test

Before external testing, execute on a real Android device and a real iPhone:

1. Cold launch
2. Splash/initial loading
3. Registration
4. Login/OTP
5. Logout/login again
6. Customer profile
7. Location permission where the product requires it
8. Marketplace browsing
9. Search
10. Merchant/product detail
11. Cart
12. Checkout
13. Payment success
14. Payment failure/cancel
15. Order creation
16. Order history
17. Order status updates
18. Push notification receipt/tap
19. Deep-link open
20. Poor-network recovery
21. App background/foreground recovery
22. Force-close/relaunch session recovery
23. Account deletion flow if exposed to customers

Ride booking/driver dispatch is a separate test gate and remains blocked until Claude's current mobility work is complete.

## Gate D — Apple review readiness

- [ ] Signed archive created on macOS
- [ ] TestFlight build uploaded
- [ ] App Store Connect metadata complete
- [ ] Privacy nutrition labels match actual data collection
- [ ] Permission prompts have clear user-facing explanations
- [ ] Universal/custom link behavior verified
- [ ] Push notification entitlement/capability verified
- [ ] No placeholder branding or debug UI
- [ ] Review notes prepared for any non-obvious login/test flow

## Gate E — Google Play readiness

- [ ] Signed production AAB
- [ ] Play Console app details complete
- [ ] Data Safety declaration matches actual collection
- [ ] Content rating complete
- [ ] Target SDK verified against current Play policy
- [ ] App access/test credentials prepared for reviewers if needed
- [ ] Internal testing track passes
- [ ] Closed testing track passes
- [ ] No placeholder store assets

## Release strategy

```text
Development
   ↓
Internal build
   ↓
Real-device smoke test
   ↓
Closed beta / TestFlight
   ↓
Full regression
   ↓
Store submission
   ↓
Production
```

Do not submit the public store builds while the ride-booking/driver-dispatch path is known to be broken.
