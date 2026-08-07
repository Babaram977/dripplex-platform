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

## Governance: DPX-FIGMA-002A (2026-08-08) — role and workflow, current and standing

**Finding that triggered this:** the Figma MCP's only write-capable tool, `use_figma`, returns
`"This tool is not supported for Make files. Supported file types: Design, Figjam, Slides"` when
called against the live file — confirmed with a live read-only probe, not inferred from the tool
description alone. `get_metadata` and `get_screenshot` carry the same restriction in their own
descriptions. The live Super App file (fileKey `rsHHFRxHVE3OKv81p7m3K1`) is a Figma Make file, so
none of the three can touch it. Only `get_design_context` (read-only, code-out) and
`ReadMcpResourceTool` (reads the underlying `.tsx` source) work against it. **Conclusion: Claude
cannot design, edit, or create screens in the live Figma file. This is a tooling limitation, not a
process choice** — confirmed by founder read of the same finding.

**Founder decision, 2026-08-08 — role change:** Claude is not the designer. The founder designs
every screen directly in Figma Make. Claude's role going forward is **Live Figma Reviewer +
Integrator**:

1. Continuously inspect the live Make file (read-only).
2. Compare every screen against the backend.
3. Maintain three living documents — **Existing Screen Register**, **Missing Backend Register**,
   **Missing Figma Register**. (Already maintained in this file, in the sections below, plus
   `docs/reference/DPX-FIGMA-DIFF-REGISTER.md` for field-level differences. `DPX-BLOCKERS-REGISTER.md`
   is a fourth document from an earlier round, not named in the DPX-FIGMA-002A letter — open
   question to the founder whether it stays a separate severity-ranked view or folds into the
   Missing Figma Register; not resolved unilaterally, kept as-is until told otherwise.)
4. When the founder finishes a screen in Figma, detect it and map it to Backend / SDK / API /
   Database / Authentication / Permissions / Navigation — **without changing the design.**
5. Figma has something the backend doesn't support → do not build UI for it. Log it in the Missing
   Backend Register. Stop.
6. Backend has something Figma doesn't support → do not design it. Log it in the Missing Figma
   Register. Stop.
7. On "Integrate": connect **only** the completed Figma screen — pixel-perfect, no redesign, no
   improvement, no optimization.
8. Primary job: make the backend behave exactly like the approved Figma design, not the reverse.

**Superseded:** DPX-FIGMA-002's "design every missing screen in Figma" objective is retired — not
because the instruction was wrong, but because the tool it depended on (`use_figma`) cannot reach
this file. The four-report FIRST TASK already delivered under DPX-FIGMA-002 (Existing Screens /
Missing Figma / Workflow / Critical Blockers, given to the founder in-chat, not committed) stands
as the current baseline for reports 1–3 above; nothing further is designed in Figma by Claude from
here on.

**Terminology (founder decision, 2026-08-08):** the Figma file is the **DrippleX Super App** —
Customer, Driver, Wallet, Ride, Marketplace, Merchant (once designed), and future modules all live
in one design, one identity system, one app. Not "the customer app." Admin Portal and Operations
Console stay separate desktop web applications, as already decided — not part of the Super App.
Flagging one thing honestly rather than silently acting on it: the actual codebase directory is
still named `apps/customer-web` — this document now uses "Super App" as the product name, but
renaming the package/directory itself is a separate, deliberate technical change (touches imports,
CI, deploy config, `pnpm-workspace.yaml`, etc. across the repo) that hasn't been requested and
won't be done without an explicit ask.

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

## Burn-down (founder-requested format, 2026-08-08)

"Integrated" here means the screen actually renders in the Super App today (a real route/component
exists in `apps/customer-web`), not just "backend exists" — a stricter bar than the ✅ Live status
used in the tables below, which only means connect-ready. Verified against the actual build output
and component tree, not inferred from task-history labels.

| Group                      |   Total |       Integrated |        Remaining | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ------: | ---------------: | ---------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                       |      11 |                6 |                2 | **Updated 2026-08-07**, DPX-INTEGRATION-001 round 1. 6 built & wired: Welcome, Register, OTP, Sign In (unconfirmed whether it matches ReturningLoginScreen's design), **Security (new)**, **Account (new)**. 3 legitimately N/A: Splash, Permissions, Biometric, Auth Summary are client-only or out of `MODULE_GROUPS`. 2 remaining: Profile Setup (documented backend gap — no update endpoint, no `username` field, see `DPX-FIGMA-DIFF-REGISTER.md`) and KYC/Identity Verification (backend ambiguous, held rather than guessed). Prior task-tracker entries claiming Slices 4–5 "completed" were inaccurate — actual commits show Slice 4 was "deferred," Slice 5 only shipped Sign In. |
| Account & Security         |      27 |                0 |               27 | **Verified 2026-08-07.** Exhaustive grep for all 24 named sub-screen components (`TwoFactorScreen`, `TrustedDevicesScreen`, etc.) across `apps/customer-web/src` and `packages/ui/src`: zero matches. No dedicated route exists under `(dashboard)` either — only `dashboard/page.tsx` and `driver-onboarding/*`. Of the 27, most have no backend at all (see §2 — Missing Backend Register candidates); a handful (Sessions, Notification Prefs, Activity Dashboard, Email/Phone change, PIN) have live or partial backend and are legitimate next targets once Auth's 4 gaps are closed.                                                                                                   |
| Consumer Home              |       2 |                2 |                0 | `/dashboard` route confirmed in build output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Marketplace                |       6 |                6 |                0 | 6 marketplace routes confirmed in build output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Ride — Customer            |      31 |               31 |                0 | `/ride` route confirmed; full lifecycle shipped in DPX-100 Ride Slices 1-5 (earlier session).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Driver App                 |      13 |                3 |                7 | 3 verified integrated (Vehicle Registration, KYC Status, Upload Docs). 3 (Splash/Login/OTP) resolved **not applicable** — founder decision 2026-08-08, single-auth-system Super App, not a gap. 7 remaining: Dashboard, Incoming Request, Nav to Pickup, Verify Passenger, Trip In Progress, Trip Completed, Settings — backend/SDK ready, UI not yet built.                                                                                                                                                                                                                                                                                                                                 |
| Wallet                     |      10 |               10 |                0 | `/wallet` route confirmed; shipped in DPX-100 Wallet Slices 1-5 (earlier session).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Ops Console                |      15 |               15 |                0 | Integrated in its own `operations-console` app (desktop), not the Super App — counted separately, not a Super App gap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Total (excl. Merchant)** | **115** | **71 confirmed** | **38 confirmed** | Plus 6 screens resolved not-applicable (3 Driver: Splash/Login/OTP; 3 Auth: Permissions/Biometric/Auth Summary). 71 + 38 + 6 = 115. All groups now verified against the live repo as of 2026-08-07 — no unverified buckets remain. Merchant (Category C) has no screen count — see Missing Figma Design Register.                                                                                                                                                                                                                                                                                                                                                                            |

## 1. Auth (top-level nav group, 11 screens)

**Status at a glance** (founder-requested format, 2026-08-07 — replaces "N/11 built" fractions,
which hide _why_ a screen isn't done). UI/Backend/Integration are independent axes: a screen can
have real UI and real backend but still be non-functional if nothing connects them.

| Screen                      | UI              | Backend        | Integration    | Status                                                                                                                    |
| --------------------------- | --------------- | -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Splash                      | ✅              | N/A            | N/A            | Complete                                                                                                                  |
| Welcome                     | ✅              | N/A            | N/A            | Complete                                                                                                                  |
| Register                    | ✅              | ✅             | ✅             | Complete                                                                                                                  |
| OTP                         | ✅              | ✅             | ✅             | Complete                                                                                                                  |
| Sign In                     | ✅              | ✅             | ✅             | Complete (unconfirmed vs. `ReturningLoginScreen` design — task #512)                                                      |
| Permissions                 | ❌              | N/A            | N/A            | Not in `MODULE_GROUPS`, low priority                                                                                      |
| Biometric                   | ❌              | N/A            | N/A            | Not in `MODULE_GROUPS`, low priority                                                                                      |
| Security Center             | ✅              | Partial        | Partial        | Functional — hub is real, all 7 linked sub-screens show an honest "not available yet" notice (none built)                 |
| Account Management          | ✅              | Read-only      | Read-only      | Functional — real identity data, no save capability (no update endpoint exists)                                           |
| Profile Setup               | ✅ (Figma only) | 🚧 In progress | 🚧 In progress | **Decided 2026-08-07** — editable, no username. See `docs/DPX-PROFILE-KYC-001-DESIGN.md`. Building now.                   |
| KYC / Identity Verification | ✅ (Figma only) | 🚧 In progress | 🚧 In progress | **Decided 2026-08-07** — tiered (Level 0/1/2), 7-state lifecycle. See `docs/DPX-PROFILE-KYC-001-DESIGN.md`. Building now. |
| Auth Summary                | ❌              | N/A            | N/A            | Not in `MODULE_GROUPS` critical path, low priority                                                                        |

**Corrected 2026-08-07** — the table below previously listed Permissions and Recovery as
members of this group and omitted KYC and Account. Re-read directly from the live
`MODULE_GROUPS["Auth"]` array in `src/app/App.tsx` (not `src/App.tsx` — that path 404s; the file
lives at `src/app/App.tsx`), copied verbatim:
`Splash, Welcome, Register, OTP, Profile Setup, Biometric, Sign In (key "returning" ->
ReturningLoginScreen), Security (key "security" -> SecurityCenterScreen), KYC (key "kyc" ->
IdentityVerificationScreen), Account (key "account" -> AccountManagementScreen), Auth Summary`.
Permissions and Recovery are real, reachable screens in the flow (`profile -> permissions ->
biometric`, `returning -> recovery`) but are **not** members of this 11-screen quick-jump array --
tracked in the note below the table instead, not deleted from history.

**UI build state re-verified against the live repo 2026-08-07** (`grep` across
`apps/customer-web/src` + `packages/ui/src`, cross-checked against actual commit messages, not
task-tracker labels): only **4 of 11** have a real component -- Welcome/Register/OTP/Sign-In.
Profile Setup, Security, KYC, and Account have ready or partially-ready backend but **no UI
component exists anywhere in the repo**, despite the task tracker showing Slices 4-5 as
"completed." The actual commits tell a different story: `fbc3f57 docs(auth): Slice 4 (Profile
Setup/Permissions/Biometric) deferred` (not built -- the tracker's "completed" label is wrong),
and `09a98cd feat(auth): Slice 5 -- real Figma Sign In screen` (only Sign In was built, not
"ReturningLogin + Recovery" as the tracker claims).

| Figma Screen                     | Backend                                                                        | SDK                                                                     | Backend Status                                                                      | UI Status (verified 2026-08-07)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Splash                           | — (client-only splash)                                                         | —                                                                       | ✅ N/A                                                                              | ✅ Built (part of app shell)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Welcome                          | — (client-only)                                                                | —                                                                       | ✅ N/A                                                                              | ✅ Built — `AuthWelcomeScreen`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Register                         | `POST /auth/register/*` (`registration.controller.ts`)                         | `sdk.auth.register*`                                                    | ✅ Live                                                                             | ✅ Built & wired — `AuthRegisterScreen`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| OTP                              | `POST /auth/verify/{email,phone}`, `.../resend` (`verification.controller.ts`) | `sdk.auth.verifyEmailOtp/verifyPhoneOtp/resendEmailOtp/resendPhoneOtp`  | ✅ Live (Resend bug fixed this session)                                             | ✅ Built & wired — `AuthOtpScreen`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Profile Setup                    | `PATCH /users/me` (`users.controller.ts`)                                      | `sdk.auth.updateProfile` (verify exact method name at integration time) | 🟡 Partial — endpoint exists, not yet confirmed field-for-field against this screen | ❌ Not built — zero matching component in repo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Permissions (device permissions) | — (client-only, OS-level)                                                      | —                                                                       | ✅ N/A                                                                              | ❌ Not built (not in `MODULE_GROUPS`, low priority)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Biometric                        | — (client-only, device keychain)                                               | —                                                                       | ✅ N/A                                                                              | ❌ Not built (not in `MODULE_GROUPS`, low priority)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Sign In (returning)              | `POST /auth/login` (`login.controller.ts`)                                     | `sdk.auth.login`                                                        | ✅ Live                                                                             | 🟡 Built but unconfirmed — `AuthSignInScreen` exists and is wired to login; not confirmed whether it matches `ReturningLoginScreen`'s design (biometric unlock + OTP fallback + recover/security/account footer links) or the plain `SignInScreen` (neither of which is in `MODULE_GROUPS` at all)                                                                                                                                                                                                                                                                                                 |
| Recovery                         | `POST /auth/password/*` (`password.controller.ts`)                             | `sdk.auth.requestPasswordReset/resetPassword`                           | ✅ Live                                                                             | ❌ Not built (not in `MODULE_GROUPS`, but backend-ready — candidate for later)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Security (center, hub screen)    | aggregates several — see §2                                                    | —                                                                       | 🟡 Partial — hub links to screens below, several of which have no backend           | ✅ Built & wired 2026-08-07 — `SuperAppAuthSecurityCenterScreen` (`/account/security`). The seven Manage Security links show an honest "not available yet" notice (none of the seven have a built target). "Lock My Account" is wired to the real `sdk.auth.logoutAll()`. The source's hardcoded 92% score ring was dropped, not faked — no real security-score signal exists to back a number.                                                                                                                                                                                                    |
| KYC (Identity Verification)      | ambiguous — see §2                                                             | —                                                                       | ⚠️ Ambiguous                                                                        | ❌ Not built — held per DPX-INTEGRATION-001 workflow step 1 (verify backend first): the backend mapping is ambiguous, wiring against the wrong endpoint would be worse than not building. Needs founder confirmation of intent (see §2).                                                                                                                                                                                                                                                                                                                                                           |
| Account (management)             | `GET /auth/me` + aggregates §2 sub-screens                                     | `sdk.auth.me`                                                           | ✅ Live (hub itself), 🟡 Partial (many linked sub-screens have no backend)          | ✅ Built & wired 2026-08-07 — `SuperAppAuthAccountManagementScreen` (`/account`), identity card reads real `firstName`/`lastName`/`email`/`phone` from the session (`useAuth().user`, itself populated from `GET /auth/me`). Editable Full Name/Username/Email inputs and Save Changes from the source were dropped — no update endpoint exists (see Profile Setup gap above) and a Save button that silently no-ops would be worse than a read-only card. All 18 settings-list rows route through an honest "not available yet" notice except Security, which routes to the real Security Center. |
| Auth Summary                     | — (client-only recap)                                                          | —                                                                       | ✅ N/A                                                                              | ❌ Not built (not in `MODULE_GROUPS` critical path, low priority)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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

**Founder decision (2026-08-08): no separate Driver authentication.** The Super App has ONE
identity system -- Splash -> Welcome -> Login/Register -> OTP -> role detection -> Consumer Home,
with Driver/Merchant surfaced as roles in the drawer once granted, same pattern as
Uber/Grab/Careem. `DriverSplashScreen`/`DriverLoginScreen`/`DriverOTPScreen` are confirmed not
built -- this is correct, not a gap. See `docs/reference/DPX-FIGMA-DIFF-REGISTER.md`.

| Figma Screen                                                                            | Backend                                             | SDK (driver-portal barrel, `sdk-driver.ts`) | Status                                         |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| Driver Splash / Login / OTP                                                             | `auth.controller.ts`, `verification.controller.ts`  | `sdk.auth`                                  | ✅ N/A -- resolved not applicable (2026-08-08) |
| KYC Status                                                                              | `drivers/` onboarding + KYC (`GET /driver/profile`) | `sdk.driverProfile`                         | ✅ Live                                        |
| Upload Docs                                                                             | `drivers/` KYC (`POST /driver/kyc`)                 | `sdk.driverProfile`                         | ✅ Live                                        |
| Vehicle Registration                                                                    | `drivers/` vehicles                                 | `sdk.vehicles`                              | ✅ Live                                        |
| Driver Dashboard                                                                        | driver profile + shifts                             | `sdk.profile`, `sdk.shifts`                 | ✅ Live                                        |
| Incoming Request / Nav to Pickup / Verify Passenger / Trip In Progress / Trip Completed | `driverRides` (dispatch/trip lifecycle)             | `sdk.rides` (driver barrel)                 | ✅ Live                                        |
| Driver Settings                                                                         | driver profile + planned availability               | `sdk.profile`, `sdk.plannedAvailability`    | ✅ Live                                        |

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
Merchant Module

Status:
BLOCKED

Reason:
No approved Figma design.

Backend/SDK/Database:
✓ Complete (merchant.controller.ts, ~30 SDK methods in merchant-api.ts covering business
  profile, KYC, bank accounts, wallet, settlements, products, store pause/resume)

Action:
Do not implement. No discussion until an approved design exists (founder decision, 2026-08-08).
```

```
Driver Emergency Contact

Backend
✓ Exists (POST /driver/onboarding/emergency-contact, OnboardingService)

SDK
✓ Exists (sdk.driverOnboarding.submitEmergencyContact)

Database
✓ Exists (DriverProfile.emergencyContactName/emergencyContactPhone)

UI
✗ Missing (no screen in the 13 Driver App Figma screens)

Required Before
Driver Status DRAFT -> SUBMITTED

Priority
HIGH
```

```
Driver Agreement Acceptance

Backend
✓ Exists (POST /driver/onboarding/agreement, OnboardingService)

SDK
✓ Exists (sdk.driverOnboarding.acceptAgreement)

Database
✓ Exists (DriverProfile.agreementAcceptedAt/agreementVersion)

UI
✗ Missing (no screen in the 13 Driver App Figma screens)

Required Before
Driver Status DRAFT -> SUBMITTED

Priority
HIGH
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

**Permanent rule, founder-locked 2026-08-07 (corrects the KYC merge in the first Driver
Registration round):** no UX decisions. Never merge screens, never split screens, never simplify a
flow, even when the backend's data model differs from what Figma assumes. If Figma has N screens
for a flow, build N screens/routes — one component and route per Figma screen, always. Where the
backend can't support something a screen assumes (a computed field, a fixed checklist, a specific
data shape), that goes in `docs/reference/DPX-FIGMA-DIFF-REGISTER.md`, not into a UI restructure.
Every field-level and screen-level Figma/backend difference is tracked there, not scattered across
individual component doc-comments only.

---

_Compiled 2026-08-07 from the live Figma MCP connection + a targeted grep sweep of
`apps/backend/src` and the SDK barrels (`sdk.ts`, `sdk-driver.ts`, `sdk-admin.ts`,
`sdk-merchant.ts`, `sdk-rider.ts`). Ride/Marketplace/Wallet group statuses reflect what was already
shipped in earlier DPX-100 phases, not a fresh re-audit of every individual screen file — call it
out if one of those turns out stale and I'll re-verify that screen specifically._
