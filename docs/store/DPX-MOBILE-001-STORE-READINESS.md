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
- [ ] Successful production Android AAB build recorded
- [ ] Successful iOS Release simulator build recorded
- [ ] Signed iOS archive/TestFlight build recorded

## Gate B — Brand and store assets

The repository currently identifies launcher/store assets as placeholders. Public submission must not proceed until the approved DrippleX mark has been exported into the required native/store sizes.

Required:

- [ ] Android 512x512 store icon
- [ ] Android adaptive icon foreground/background
- [ ] Google Play feature graphic
- [ ] Android phone screenshots
- [ ] iPhone screenshots
- [ ] iPad screenshots if the iPad target remains enabled
- [ ] iOS App Store icon set
- [ ] Final splash assets
- [ ] Store listing copy
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Marketing website URL

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
