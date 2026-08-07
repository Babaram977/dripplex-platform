# DPX-100 — Figma Screen → Backend API → SDK Mapping

**Source of truth:** live Figma Make file, fileKey `rsHHFRxHVE3OKv81p7m3K1`, read directly via
Figma MCP (`get_design_context` + `ReadMcpResourceTool`) on 2026-08-07 — not the uploaded zip,
not the older `docs/reference/figma-super-app-source/` snapshot, not memory. Screen list and
module grouping below are copied verbatim from the live `src/app/App.tsx` `Screen` type and its
own `MODULE_GROUPS` navigator — this is Figma's own taxonomy, not one I invented.

Per DPX-FIGMA-001: this document reports gaps, it does not fill them. No UI has been designed or
guessed to cover a gap on either side (Figma-side or backend-side).

Status legend: ✅ Live (endpoint + SDK method exist and are already wired somewhere in the repo) ·
🟡 Partial (related backend exists but not an exact match / needs product confirmation) ·
❌ Missing (no backend, no SDK — would need new backend work, out of scope per the freeze) ·
⚠️ Ambiguous (two plausible backend owners, founder call needed)

---

## 0. Two findings — resolved by founder decision (2026-08-07)

**1. Merchant has zero screens in the live Figma file.** Not a placeholder stub — genuinely
absent. `App.tsx` imports `HOME, MARKETPLACE, STORE, PRODUCT, CART, CHECKOUT, ORDERS, RIDE,
DRIVER, WALLET, ADMIN` as feature modules. There is no `MERCHANT` import, no merchant entry in
`MODULE_GROUPS`, and no merchant key in the `Screen` union. `features/MERCHANT/index.ts` is an
empty `export {}` stub with no screens behind it to promote later — there's nothing to port. The
"Merchant Store" screen under Marketplace is the _customer's_ view of browsing a merchant's
storefront, not merchant-facing management UI.

**Founder decision:** Merchant is not "blocked forever" — it's a normal Category-C gap (backend
ready, Figma missing). Logged below as:

```
Missing Figma Design

Merchant Module

Backend
✓ Complete

SDK
✓ Complete

Database
✓ Complete

UI
✗ Missing

Status
Waiting for Founder design in Figma.
```

No merchant onboarding/management UI will be built until the founder designs it in Figma.

**2. The Driver App screens are wired into the same phone-frame router as the consumer app**,
reachable from `HomeScreen`'s `onDriverApp` prop (`home: <HomeScreen onDriverApp={() =>
go("drvsplash")} />`), and `isDesktop` (which switches to `DesktopFrame`) only checks
`ADMIN_SCREENS` — Driver screens render in the ordinary `PhoneFrame`. This contradicted the
comment inside `features/DRIVER/index.ts` itself ("separate portal, not consumer app... must NOT
appear in the consumer app UI").

**Founder decision: code wins, comments lose.** The live `App.tsx` routing is the source of truth
— the `features/DRIVER/index.ts` comment is stale/outdated and is to be ignored. Driver is a
first-class in-app section of the Super App, reached from Home, same as it's wired in Figma. The
previously-uncommitted Driver-role-grant backend work (`becomeDriver`, onboarding status page)
was built portal-agnostic and is correct under this resolution — it's being committed as-is (see
§9).

---

## 1. Auth (top-level nav group, 11 screens)

| Figma Screen                     | Backend                                                                        | SDK                                                                     | Status                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Splash                           | — (client-only splash)                                                         | —                                                                       | ✅ N/A                                                                              |
| Welcome                          | — (client-only)                                                                | —                                                                       | ✅ N/A                                                                              |
| Register                         | `POST /auth/register/*` (`registration.controller.ts`)                         | `sdk.auth.register*`                                                    | ✅ Live                                                                             |
| OTP                              | `POST /auth/verify/{email,phone}`, `.../resend` (`verification.controller.ts`) | `sdk.auth.verifyEmailOtp/verifyPhoneOtp/resendEmailOtp/resendPhoneOtp`  | ✅ Live (Resend bug fixed this session)                                             |
| Profile Setup                    | `PATCH /users/me` (`users.controller.ts`)                                      | `sdk.auth.updateProfile` (verify exact method name at integration time) | 🟡 Partial — endpoint exists, not yet confirmed field-for-field against this screen |
| Permissions (device permissions) | — (client-only, OS-level)                                                      | —                                                                       | ✅ N/A                                                                              |
| Biometric                        | — (client-only, device keychain)                                               | —                                                                       | ✅ N/A                                                                              |
| Sign In (returning)              | `POST /auth/login` (`login.controller.ts`)                                     | `sdk.auth.login`                                                        | ✅ Live                                                                             |
| Recovery                         | `POST /auth/password/*` (`password.controller.ts`)                             | `sdk.auth.requestPasswordReset/resetPassword`                           | ✅ Live                                                                             |
| Security (center, hub screen)    | aggregates several — see §2                                                    | —                                                                       | 🟡 Partial — hub links to screens below, several of which have no backend           |
| Auth Summary                     | — (client-only recap)                                                          | —                                                                       | ✅ N/A                                                                              |

## 2. Account & Security — sub-screens (reachable from Account/Security hubs, not in top-nav)

| Figma Screen                            | Backend                                                                                                             | SDK                                                                        | Status                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account (hub)                           | `GET /auth/me` (`auth.controller.ts`)                                                                               | `sdk.auth.me`                                                              | ✅ Live                                                                                                                                                                          |
| KYC / Identity Verification             | `auth/repositories/*identity-verification*` exists but is the OTP/magic-link verification system, not document KYC  | —                                                                          | ⚠️ Ambiguous — likely means driver/merchant document KYC (which does exist, under `drivers/` onboarding), not a generic customer KYC flow. Needs founder confirmation of intent. |
| Verification Status                     | same ambiguity as above                                                                                             | —                                                                          | ⚠️ Ambiguous                                                                                                                                                                     |
| Sessions (management)                   | `auth/controllers/sessions.controller.ts`, `session-management.service.ts`                                          | not yet exposed in `CustomerSdk` (only `sdk-admin`/portal barrels checked) | 🟡 Partial — backend exists, SDK exposure to customer barrel unconfirmed                                                                                                         |
| Two-Factor (2FA)                        | none found (`grep -ri twofactor/2fa` → no hits)                                                                     | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Trusted Devices                         | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Security Activity                       | none found (no security/audit-log-for-self endpoint located)                                                        | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Privacy Controls                        | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Consent                                 | none found (only Google-auth OAuth consent, unrelated)                                                              | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Notification Preferences                | `notification-center/notification-preferences.service.ts`, `customer-notifications.controller.ts`                   | needs confirming against `sdk.notifications`                               | ✅ Live (backend confirmed real)                                                                                                                                                 |
| Language & Region                       | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Accessibility                           | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Onboarding Done (welcome recap)         | — (client-only)                                                                                                     | —                                                                          | ✅ N/A                                                                                                                                                                           |
| Linked Accounts                         | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Emergency Protection (self)             | none found for a _customer_ self-emergency-contact profile (`emergency` hits are all under `drivers/`, driver-only) | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Activity Dashboard (notifications feed) | `notification-center` module                                                                                        | `sdk.notifications`                                                        | ✅ Live                                                                                                                                                                          |
| Connected Services                      | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Trust Center                            | none found (informational/static content candidate — could be `sdk.cms`)                                            | `sdk.cms`?                                                                 | 🟡 Partial — may not need a bespoke endpoint at all if it's static CMS copy                                                                                                      |
| PIN Setup / Change PIN                  | `wallet/controllers/customer-wallet-pin.controller.ts`, `wallet-pin.service.ts`                                     | `sdk.wallet` (PIN methods)                                                 | ⚠️ Ambiguous — backend PIN is a _wallet_ PIN, not a general account PIN. Needs founder confirmation this screen means the wallet PIN and not something else.                     |
| Email Verification (change)             | `auth/controllers/email-verification.controller.ts`                                                                 | `sdk.auth`                                                                 | ✅ Live                                                                                                                                                                          |
| Change Phone                            | `auth/controllers/phone-verification.controller.ts`                                                                 | `sdk.auth`                                                                 | ✅ Live                                                                                                                                                                          |
| Username Management                     | none found (`grep -ri username` only hits `wallet-recipients` and `operations.mapper`, unrelated)                   | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Login Approvals                         | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Recovery Codes                          | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Security Questions                      | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Account Transfer                        | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |
| Account Suspension (self-service)       | none found                                                                                                          | —                                                                          | ❌ Missing                                                                                                                                                                       |

## 3. Consumer Home (2 screens)

| Figma Screen   | Backend                               | SDK                              | Status  |
| -------------- | ------------------------------------- | -------------------------------- | ------- |
| Home Dashboard | aggregates auth/me + module summaries | `sdk.auth.me` + per-module calls | ✅ Live |
| Notifications  | `notification-center` module          | `sdk.notifications`              | ✅ Live |

## 4. Marketplace (6 screens)

| Figma Screen                               | Backend                                     | SDK                             | Status                                           |
| ------------------------------------------ | ------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| Marketplace                                | products/merchants browse endpoints         | `sdk.products`, `sdk.merchants` | ✅ Live — already ported (DPX-100 earlier phase) |
| Merchant Store (storefront, customer view) | merchant public-profile + catalog endpoints | `sdk.merchants`, `sdk.products` | ✅ Live                                          |
| Product Detail                             | product detail endpoint                     | `sdk.products`                  | ✅ Live                                          |
| Cart                                       | cart endpoints                              | `sdk.cart`                      | ✅ Live                                          |
| Checkout                                   | order/payment endpoints                     | `sdk.orders`, `sdk.payments`    | ✅ Live                                          |
| Order Tracking                             | order tracking endpoint                     | `sdk.orders`, `sdk.delivery`    | ✅ Live                                          |

## 5. Ride — Customer (31 screens)

All already ported per DPX-100's earlier Ride phase — `sdk.rides` / `sdk.delivery` cover the
lifecycle (search → fare → dispatch → in-progress → complete → rate → history). Sub-screens for
payment method (OPay/cash), promo codes, SOS, trip sharing, saved places, scheduled rides, and
referrals all map to existing `sdk.rides`, `sdk.payments`, `sdk.promotions`, `sdk.referrals`
surfaces already exposed on `CustomerSdk`. Status: **✅ Live** across the group — this was the
group explicitly confirmed already-ported in earlier session work, not re-verified screen-by-screen
here; flag to me if any individual Ride screen turns out not to have shipped and I'll re-check it
specifically before marking it done.

## 6. Driver App (13 screens) — resolved: in-app Super App section (see §0.2)

| Figma Screen                                                                            | Backend                                            | SDK (driver-portal barrel, `sdk-driver.ts`)        | Status  |
| --------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | ------- |
| Driver Splash / Login / OTP                                                             | `auth.controller.ts`, `verification.controller.ts` | `sdk.auth`                                         | ✅ Live |
| KYC Status / Upload Docs                                                                | `drivers/` onboarding + identity-verification      | `sdk.driverIdentityVerification`, `sdk.onboarding` | ✅ Live |
| Vehicle Registration                                                                    | `drivers/` vehicles                                | `sdk.vehicles`                                     | ✅ Live |
| Driver Dashboard                                                                        | driver profile + shifts                            | `sdk.profile`, `sdk.shifts`                        | ✅ Live |
| Incoming Request / Nav to Pickup / Verify Passenger / Trip In Progress / Trip Completed | `driverRides` (dispatch/trip lifecycle)            | `sdk.rides` (driver barrel)                        | ✅ Live |
| Driver Settings                                                                         | driver profile + planned availability              | `sdk.profile`, `sdk.plannedAvailability`           | ✅ Live |

All backend/SDK support for this group already exists (this is what `driver-portal` itself already
runs on) — the only open question is **which app** consumes it (embedded Super App tab vs. the
existing separate `driver-portal`), per finding #2. No new backend work needed either way.

## 7. Wallet (10 screens)

| Figma Screen                                                                                                            | Backend                                 | SDK          | Status                                     |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------ | ------------------------------------------ |
| Wallet Home / Transactions / Top Up / Withdraw / Transfer / Payment Methods / Rewards / Statement / Security / Settings | `wallet/` module (multiple controllers) | `sdk.wallet` | ✅ Live — already exposed on `CustomerSdk` |

## 8. Ops Console (15 screens, `DesktopFrame` — confirmed desktop by the design itself)

| Figma Screen                    | Backend                                                                                | SDK (`sdk-admin.ts`) | Status                   |
| ------------------------------- | -------------------------------------------------------------------------------------- | -------------------- | ------------------------ |
| Dashboard / Analytics / Reports | `operationsDashboard`, `operationsAnalytics`                                           | ✅ Live              |
| Live Map / Trip Monitoring      | `operationsRides`, `operationsFleet`                                                   | ✅ Live              |
| Drivers / Vehicles / KYC Review | `adminDrivers`, `adminDriverVehicles`, `adminInspectionCentres`                        | ✅ Live              |
| Customers                       | `users.controller.ts` admin surface — needs exact admin-customers SDK method confirmed | 🟡 Partial           |
| Pricing                         | not located in this pass — needs a targeted grep before porting                        | —                    | 🟡 Partial — unconfirmed |
| Incidents                       | `operationsCases`, driver incident reports                                             | ✅ Live              |
| Support                         | `driverSupport`, `operationsQueues`                                                    | ✅ Live              |
| Settings                        | `operationsStaff`, `adminDriverSecuritySettings`                                       | ✅ Live              |
| Audit Logs                      | not located in this pass — needs a targeted grep before porting                        | —                    | 🟡 Partial — unconfirmed |
| Admin Profile                   | `auth.me` (admin session)                                                              | ✅ Live              |

This group was already confirmed out of scope for the mobile Super App (desktop-only by the
design's own `DesktopFrame` wrapper) — included here for completeness of the mapping, not as a
next porting target.

---

## Missing Figma Design Register

```
Missing From Figma
Merchant onboarding & management (all screens)
Reason: No MERCHANT feature module, no screens, no nav entries anywhere in the live Figma Make
        file — features/MERCHANT/index.ts is an empty stub with nothing behind it.
Backend: Fully live (merchant.controller.ts, ~30 SDK methods in merchant-api.ts covering
         business profile, KYC, bank accounts, wallet, settlements, products, store pause/resume).
Status: Waiting for Figma — founder to design in Figma before any Merchant UI is built.
```

## Missing Backend Register (reciprocal gap — Figma has the screen, backend does not)

For completeness, and because the founder's freeze policy says no new backend modules without a
concrete beta-user need — these are Figma screens with **no backend counterpart found**. None of
these block porting the screens that do work; they're just non-functional if ported as-is today:
Two-Factor, Trusted Devices, Security Activity, Privacy Controls, Consent, Language & Region,
Accessibility, Linked Accounts, Emergency Protection (self/customer), Connected Services, Username
Management, Login Approvals, Recovery Codes, Security Questions, Account Transfer, Account
Suspension (self-service). No action taken on these — reported per the "does this help the next
beta user" freeze rule, for the founder to prioritize or explicitly defer.

## Standing rule for all further work (founder-locked, 2026-08-07)

Every screen falls into exactly one category. Nothing else is in scope:

- **A — Figma exists + backend exists → connect.** Compile, lint, test, report after each screen.
  Stop after the report; don't roll into the next screen without it.
- **B — Figma exists, backend missing → document, stop.** Add to the Missing Backend Register.
  Do not build the backend to cover it.
- **C — Backend exists, Figma missing → document, stop.** Add to the Missing Figma Design
  Register. Do not invent UI to cover it.

Additional locked rules: comments that contradict live `App.tsx` routing are stale — routing code
wins. Operations/Admin stay desktop-only per Figma's own `DesktopFrame`. No new screens, no
placeholder UI, no redesign. The founder designs every missing screen in Figma later.

---

_Compiled 2026-08-07 from the live Figma MCP connection + a targeted grep sweep of
`apps/backend/src` and the SDK barrels (`sdk.ts`, `sdk-driver.ts`, `sdk-admin.ts`,
`sdk-merchant.ts`, `sdk-rider.ts`). Ride/Marketplace/Wallet group statuses reflect what was already
shipped in earlier DPX-100 phases, not a fresh re-audit of every individual screen file — call it
out if one of those turns out stale and I'll re-verify that screen specifically._
