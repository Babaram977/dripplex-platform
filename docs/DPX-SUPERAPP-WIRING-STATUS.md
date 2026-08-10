# DPX — Super App Backend Wiring: Verified Status & Runbook

**Purpose:** durable session memory for the DrippleX Super App ↔ real backend wiring effort.
Read this first (per CLAUDE.md §1) before continuing Super App work. Everything below was
verified against the actual code/backend at the time of writing, not just reported.

Last updated: session on branch `claude/figma-connect-iugdbg` (PR #94).

---

## 1. What the Super App is & where it lives

- **App:** `apps/super-app/` — the founder's Figma Make Super App, stood up as a Vite SPA
  (React 18 + MUI + Radix + motion + socket.io-client). Single app for all four personas
  (Customer / Driver / Rider / Merchant). Flat "Screen union" router in `src/app/App.tsx`.
- **Integration layer (do not rewrite):** `src/lib/api.ts` (REST client, base
  `https://api.dripplex.com/api/v1`, `{success,data}` envelope, Bearer + silent 401→refresh,
  per-persona logins), `src/lib/ws.ts` (socket.io, **rides namespace only**), `src/lib/auth.ts`
  (`setTokens/setUser/getUser/clear/isLoggedIn`), `ApiProvider.tsx`.
- **Live URL:** https://super-app-production-2345.up.railway.app
- **Railway:** project `overflowing-unity` (`f09361bd-3cda-4f0f-a22a-2ea464e47ab2`), env
  `production` (`2a5bfc88-aeee-437e-9695-1c5176d424b8`).
  - super-app service `32989428-7aa6-4d4b-bfcf-023fc01aeb38` — **tracks branch
    `claude/figma-connect-iugdbg`**, Dockerfile `apps/super-app/Dockerfile` (bakes
    `VITE_API_BASE`/`VITE_SOCKET_URL` at build). Auto-deploy is unreliable → trigger a build
    with the commit SHA via the Railway agent.
  - backend service `@dripplex/backend` `c37d0dc3-f0ca-4a3d-8080-298ed26d6adb` — builds from
    **`main`**. CORS_ORIGINS (redacted) must include the super-app origin (founder-managed).

## 2. Demo personas (seeded, loginable) — password `Dripplex#Demo1`

| Persona             | Email                   | Notes                                                       |
| ------------------- | ----------------------- | ----------------------------------------------------------- |
| Mr D (customer)     | `mrd@dripplex.demo`     | funded wallet (~₦50,000)                                    |
| Drip (driver)       | `drip@dripplex.demo`    | ride offers/accept/complete                                 |
| Drippo (rider)      | `drippo@dripplex.demo`  | food delivery jobs                                          |
| Dx Resto (merchant) | `dxresto@dripplex.demo` | storefront + 5 products + **Access Bank payout 0123456789** |

Seeded by `apps/backend/prisma/seed-demo.cjs` (idempotent, self-guarded by
`DEMO_SEED_ENABLED=true`, non-fatal). The Dx Resto **payout bank** was seeded on prod this
session (see runbook §6) so `GET /customer/orders/:id/merchant-bank` resolves for the
MERCHANT_DIRECT ("Pay to Merchant Bank") checkout option.

## 3. Wiring status — LIVE & verified

All screens connect to real endpoints (no invented routes; DTO field names verified against
`api.ts` / `packages/types`). Figma remains the visual source of truth — this is data wiring only.

- **Customer:** Home (real wallet balance + Income/Spent summed from `wallet.getTransactions`,
  Savings/USD = "—"; live merchants via `marketplace.getMerchants`, "View Store" routes with the
  real id) · Marketplace (`getMerchants`/`searchMerchants`, real ids) · Store
  (`marketplace.getMerchant(id)`) · Product (`getProduct(id)`, `cart.addItem`) · Cart · Checkout
  (`orders.checkout` + **CASH** and **MERCHANT_DIRECT** via `orders.getMerchantBank`) · Order
  Tracking + Order History (`orders.get`/`getDelivery`/`getEta`/`getTracking`/`getPaymentStatus`/
  `list`/`cancel`, REST poll) · Ride booking (`rides.getRideTypes`/`estimate`/`book`, then
  `ws.joinRide`/`onRideStatus` + poll `rides.get`; cash `rides.pay`; rate `rides.rateDriver`) ·
  Wallet (`wallet.get`/`getTransactions`/`fund`/`verifyFunding`/`getBankAccounts`/
  `addBankAccount`/`requestWithdrawal`/`findRecipient`/`transfer`/`getStatement`/`getPinStatus`) ·
  Auth — **real customer self-registration** (`RegisterScreen` → `auth.registerCustomer`
  {firstName,lastName,phone,password} → `OTPScreen` `auth.verifyPhoneOtp` {phone,otp} activates the
  account → `auth.loginCustomer` persists the session → `ProfileSetupScreen` `auth.updateMe`) and
  real Sign In (`auth.loginCustomer` phone+password) · Notifications (`notifications.list`/
  `markRead`/`markAllRead`).
  - **Deviation logged & founder-flagged (2026-08-10):** the Figma register screen collected only a
    phone; the backend requires name+password+phone BEFORE the OTP is sent (login is password-based,
    no passwordless path). Added a Full Name + Password field to `RegisterScreen` (min 8, upper+lower+
    digit, matching backend policy). SDK OTP paths were dead (`/auth/otp/verify` doesn't exist) →
    corrected to `/auth/phone/*` + `/auth/email/*`. `ProfileSetup` mock **username** field removed
    (locked no-username decision). Prod has Termii (SMS) + Resend (email) keys set → OTP delivery is
    live. See `docs/reference/DPX-FIGMA-DIFF-REGISTER.md` → "Customer self-registration wiring".
- **Driver (Drip):** `auth.loginDriver`; `driverRides.getAvailability`/`setAvailability`;
  poll `getOffers` + `getOfferPreview(id)`; `acceptOffer`/`declineOffer`; `arrive`/`start`/
  `complete`/`confirmCash`. (`getOfferPreview` was added to `api.ts` this effort — it exposes the
  existing `GET /driver/rides/offers/:id`.)
- **Merchant (Dx Resto):** **login gate** (`auth.loginMerchant` → persist → dashboard, guarded);
  `merchant.getBusiness`/`getWallet`; poll `getOrders({status:"CONFIRMED"})` + PREPARING/READY;
  **`acceptOrder` → PREPARING** (accept _is_ preparing, no separate call), **`markReady` → READY
  (auto-dispatches the rider)**; `rejectOrder`/`cancelOrder`/`delayOrder`; products; earnings
  (`getSettlements`/`getWallet`/`getWalletTransactions`); KYC.
- **Rider (Drippo):** wired earlier (`rider.getJobs`/`acceptJob`/`pickup`/`arrived`/`deliver`/
  `confirmCash`/`setAvailability`/`getWallet`).

### Both acceptance loops run end-to-end

- **Food:** Mr D orders from Dx Resto → checkout (cash or bank) → live tracking → **Dx Resto**
  accepts/marks ready → **Drippo** delivers → cash → 10% settlement.
- **Ride:** Mr D books → **Drip** receives offer → accept → complete → cash → settlement.

## 4. Real bugs caught in Figma output & fixed (don't reintroduce)

- `SignInScreen` navigated to `onBack` on login success → bounced to Welcome. Patched to honor
  `onSuccess` (→ Home). **App wires Welcome/Register "Sign In" → `signin`, not the mock
  `returning`/biometric screen.** Keep this.
- `marketplaceScreen` called `searchMerchants({q})` but the real sig is
  `searchMerchants(query, params?)`. Fixed.
- Home header was hardcoded "Saeed" → wired to `auth.getUser()`.
- `productDetailScreen` live mapper omitted required `related` → `.map` crash. Fixed (`related: []`).
- `screensD` referenced undefined `PinDots`/`PinPad`; `screensB` referenced undefined `DEVICES`
  (pre-existing in Figma output) → supplied minimal components / empty list so they don't crash.

## 5. Documented gaps (NOT faked — honest empty/"Not available yet")

- Marketplace **Trending / Nearby / AI-Picks** strips + **Continue Shopping** = decorative mock
  (no backend); the merchant list is real. Marketplace **search box** is visual only.
- Ride **Driver Assigned / En route / Arrived / In progress** still show placeholder driver
  identity + no live marker; the status _transitions_ are real. Needs `ws.onDriverLocation`
  wiring (queued as "Ride polish" in the master prompt).
- Trusted Devices (empty), 2FA/Privacy/Consent/etc. = "Not available yet" (no backend).
- PIN pad is a plain keypad (Figma's `PinPad` was missing; minimal one supplied).
- `features/AUTH/index.ts` is a **dead/broken barrel** (references non-existent exports); not
  imported anywhere; ignore or delete later.
- Pickup in ride booking is a fixed demo location (Ikeja GRA); map pin not draggable.

## 6. RUNBOOK — operational knowledge (learned this session)

### Reading Figma Make source directly (no zip exports)

- Figma file key `rsHHFRxHVE3OKv81p7m3K1`. `mcp__Figma__whoami` to confirm connection.
- Read a screen's real source: `ReadMcpResourceTool(server="Figma",
uri="file://figma/make/source/rsHHFRxHVE3OKv81p7m3K1/src/app/<file>.tsx")`.
  **Only works in the main/launching context, NOT subagents.**
- Large reads persist to `/root/.claude/projects/<proj>/tool-results/<id>.txt` as JSON →
  decode with `python3 -c "import json; open(dst,'w').write(json.load(open(src))['contents'][0]['text'])"`
  and write to disk (clean, no hand-transcription). Small reads return inline.
- **Verify before trusting:** Figma sometimes reports "done" but its saved source is still the
  pre-wiring mock (e.g. `homeScreen` came back mock). Rule: read Figma source; if it's _behind_
  the live on-disk file, apply the job directly to the live file instead of overwriting, and say
  so. Always check exports match what `App.tsx` imports, and that every `api.*`/DTO field is real.

### Building / deploying the super-app

- Build: `pnpm --filter @dripplex/super-app build` (Vite; strips types — no full typecheck).
- The app has **no tsconfig** (build-only, excluded from monorepo lint/typecheck). For a real
  typecheck use a throwaway tsconfig; ignore `@/` alias errors (vite has the alias) and
  `import.meta.env` (needs vite/client types).
- Deploy: push commit, then trigger the super-app build via the Railway agent with the commit
  SHA (auto-deploy unreliable). Confirm status reaches SUCCESS.

### Railway deploy quirks (important)

- **`preDeployCommand` runs WITHOUT a shell** — `a && b` does NOT chain (only the first runs).
  Use a single command per need.
- **`redeploy` replays the previous deployment's config snapshot** — it does NOT pick up a
  fresh `update-service` (e.g. a changed `preDeployCommand`). To apply new config you must
  trigger a **fresh build** (deploy a commit SHA via the agent).
- Backend `preDeployCommand` (steady state) = `["node prisma/seed-rbac.cjs"]`. `startCommand` =
  `node dist/main.js`. Health `/api/v1/health`.

### Running the demo seed on prod (how the bank got seeded)

1. Ensure `DEMO_SEED_ENABLED=true` on the backend service.
2. `update-service` backend `preDeployCommand` → `["node prisma/seed-demo.cjs"]` (seed-rbac
   roles already exist in the DB, so seed-demo alone is fine for one run).
3. Trigger a **fresh build** of `@dripplex/backend` (agent, main HEAD SHA) so the new preDeploy
   is used. Confirm in deploy logs: `[seed-demo] Demo cast result: ... merchant=OK ...`.
4. **Revert** `preDeployCommand` → `["node prisma/seed-rbac.cjs"]`. (Leaving `DEMO_SEED_ENABLED=true`
   is harmless since seed-demo is no longer in the deploy path.)

## 7. Locked founder decisions to respect

- No username (identity = phone primary + optional email + name).
- Customer KYC is a **separate** model from DriverKyc.
- **Do not change** money movement, the **10% commission**, settlement, refunds, or payment
  providers without founder review. Cash + MERCHANT_DIRECT are the demo payment paths; card
  gateways stay dormant.
- One feature per branch/PR; PRs are review PRs (founder approves before merge).

## 8. Git / PR state at write time

- Branch `claude/figma-connect-iugdbg`; PR **#94** → `main`
  (https://github.com/babaram977/dripplex-platform/pull/94). Diff scope = `apps/super-app/*` +
  `docs/*` only (zero backend/packages/other-app changes → merging does not touch the live API).
- Figma work queue: `docs/DPX-FIGMA-WORK-QUEUE.md`; one-shot prompt:
  `docs/DPX-FIGMA-MASTER-WIRING-PROMPT.md`; backend contract:
  `docs/DPX-BACKEND-CONTRACT-FOR-FIGMA.md`.

## 9. Session 2026-08-10 (part 2) — self-registration for all personas

Founder ask: customer (no KYC/approval) registers & orders; merchant/driver/rider register
and **wait for approval**; **all register by EMAIL** while the Termii SMS sender ID is pending;
approvals go to the Ops desk.

**Verified backend truth (read the controllers/DTOs directly):**

- Customer portal `requiresPhoneVerification=false` → email signup activates on the email code
  alone, no approval. Merchant/driver/rider portals require a _verified phone_ to both activate
  AND log in (two separate gates: `verification.service`/`email-verification.service` for
  activation, `login.service` for login) → email-only would be stuck at PENDING_VERIFICATION.
- Email OTP **code** endpoint is `POST /auth/verify/email {email, otp}` (VerificationService).
  The `/auth/otp/*` and `/auth/email/verify` (magic-link token) paths are different things.
- Prod has Termii + Resend keys set; email OTP is deliverable now, SMS is not (sender pending).
- Merchant/driver **approval endpoints exist** under `admin:*` (admin-merchants / admin-drivers
  controllers), NOT the operations module. **Rider approval does not exist** — `RiderProfile.
isApproved` is a schema stub nothing reads/writes.

**Shipped this session:**

- **Customer email onboarding** (super-app, this branch): RegisterScreen takes Email (primary)
  - phone optional; OTPScreen verifies email (`/auth/verify/email`) or phone, then logs in +
    persists. Deployed via super-app build `76cdc212` (commit `d514af5`).
- **Backend `PORTAL_EMAIL_ACTIVATION` flag** (PR **#95**, branch `claude/portal-email-activation`,
  **MERGED** → main `903071eb`): when true, merchant/driver/rider activate + sign in on EMAIL
  verification alone (no phone OTP dispatched; phone gate skipped at activation + login).
  Reversible — flip to `false` when Termii SMS is live. Env var `PORTAL_EMAIL_ACTIVATION=true`
  **set on prod backend**; backend redeployed (`0f72c548`, commit `903071eb`). 156 auth tests green.
- **Figma onboarding prompt**: `docs/DPX-FIGMA-ONBOARDING-PROMPT.md` — one-shot brief for
  merchant/driver/rider signup + driver doc-upload + pending-approval screens (founder runs it;
  Claude wires the result).

**In progress / next (Piece C — founder chose "Ops Console + build rider approval"):**

- Build rider approve/reject backend (mirror admin-drivers) — riders currently have no approval
  endpoints. Then surface merchant/driver/rider approvals in the **operations-console** app.
- Dependencies still open: file-upload/storage for KYC doc images (URLs only today); Smile-ID →
  DrippleX-native IDV (task #15); wiring the Figma onboarding screens once designed.
