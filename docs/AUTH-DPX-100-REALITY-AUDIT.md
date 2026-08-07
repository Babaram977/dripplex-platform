# Auth/Onboarding — DPX-100 Reality Audit + Slice Plan

**Status:** Slices 1-3 and 5 shipped (Slice 4 deferred with reasoning
below; Returning Login/Recovery within Slice 5 also deferred). Written
after the founder flagged that live registration/login pages don't
match the Figma standard — verified directly against the live Figma
Make file via the Figma MCP connection (`rsHHFRxHVE3OKv81p7m3K1`,
"DrippleX Super App Design (Copy)"), not just the static export
previously saved to `docs/reference/figma-super-app-source/`. Founder
follow-up mid-build: "phone only is not what we want, phone or email
either can sign" — confirmed as already the direction being built (not
a course correction), plus explicit authorization to finish all
remaining slices before reporting back.

**Slice 2 note:** Splash (`SplashScreen`/AUTH-001) turned out to already
exist in production as `marketing/splash-intro.tsx`, wired to the
marketing homepage — discovered during Slice 2 research, not rebuilt.
Slice 2 delivered Welcome (`SuperAppAuthWelcomeScreen`) and Register
(`SuperAppAuthRegisterScreen`, phone/email toggle) as real
`packages/ui/src/components/super-app/` components, orchestrated by
`apps/customer-web/src/components/auth/auth-flow.tsx` at the new
`/get-started` route, calling the real `registerCustomer` SDK method.
`/register` now redirects to `/get-started`; the generic legacy
`register-form.tsx` was removed. `verify-otp` was extended to handle
phone-only signups (it previously only supported email).

## What's live today vs. what Figma defines

**Live production** (`apps/customer-web/src/app/(auth)/*`,
`register-form.tsx` / `misc-forms.tsx`): a generic email+password form.
Email required, phone optional and never verified for customer
registration, plain `Input`/`Label`/`Button` primitives, no branding,
no OTP digit-box UI, no phone-primary flow.

**Figma's `AUTH` feature module** (confirmed via the live file's own
`src/features/AUTH/index.ts` barrel — the design system's own scoping
of what belongs to Auth, not a guess):

Core sign-up/sign-in flow (`screensA.tsx`, all 10 confirmed still live):

| #   | Screen           | Component              | Purpose                                  |
| --- | ---------------- | ---------------------- | ---------------------------------------- |
| 1   | Splash           | `SplashScreen`         | Boot animation, logo, "life, Simplified" |
| 2   | Welcome          | `WelcomeScreen`        | Get Started / Sign In entry              |
| 3   | Register         | `RegisterScreen`       | **Phone-primary** registration form      |
| 4   | OTP Verification | `OTPScreen`            | 6-digit code entry, error states         |
| 5   | Profile Setup    | `ProfileSetupScreen`   | Name/DOB/photo after verification        |
| 6   | Permissions      | `PermissionsScreen`    | Location/notifications/contacts opt-in   |
| 7   | Biometric Setup  | `BiometricScreen`      | Face ID/fingerprint opt-in               |
| 8   | Sign In          | `SignInScreen`         | Returning user, phone + biometric/social |
| 9   | Returning Login  | `ReturningLoginScreen` | Biometric unlock, OTP fallback           |
| 10  | Account Recovery | `RecoveryScreen`       | Multi-step device/identity recovery      |

Account security/session screens (`screensB.tsx`, 8 screens — folded
into the same `AUTH` module by Figma's own barrel, lower priority, see
below): Two-Factor, Trusted Devices, Security Activity, Security
Center, Session Management, Privacy Controls, Identity Verification,
Account Management.

**Verified overlap, not double work:** several of the `screensB.tsx`
screens (Security Center, Session Management, Privacy Controls) cover
the same ground as **Wallet Slice 5** (`WALLET-005-STATEMENT-SECURITY-SETTINGS-DESIGN.md`),
already shipped and frozen — "Security's trusted-devices list reuses
the platform's existing portal-agnostic `AuthSession` system as-is."
Rebuilding these under Auth would duplicate that work. **Decision:**
Slice 1-3 below cover the 10 core `screensA.tsx` screens only — the
ones actually blocking registration/login today. The 8 `screensB.tsx`
screens are deferred, to be reconciled against Wallet's existing
Security/Settings screens rather than rebuilt from scratch, once the
core flow is done.

## The founder's requirement: phone OR email, either works

Figma's `RegisterScreen`/`SignInScreen` are phone-primary with no
email/password field at all (Google/Apple/biometric are the "or
continue with" row). The founder's ask — accept either identifier — is
a deliberate adaptation of that, recorded here as the actual
requirement we're building to.

### Current backend state (why this isn't a form tweak)

`User.email` is `String @unique` — **required, NOT NULL** in the
schema. `User.phone` is `String? @unique` — already optional. Making
email genuinely optional touches:

- The schema (`email String?` + a partial unique index, since Postgres
  unique constraints already treat multiple NULLs as non-conflicting —
  no extra work needed there).
- ~26 backend call sites that read `user.email` assuming it's a
  non-null string (JWT payload, audit logs, driver/merchant mappers,
  KYC, settlement).
- Every `NotificationService` method signature (`sendPasswordReset`,
  `notifyOrderCreated`, etc.) — all currently type `email: string`,
  not `email?: string`.
- `registration.service.ts` / `login.service.ts`'s `PORTAL_CONFIG` —
  currently keyed on `roleName`/`channel`, needs an identifier-type
  concept added (`email` vs `phone`, whichever was supplied).
- `PrismaRegistrationRepository` uniqueness checks (currently checks
  email always, phone conditionally).

This is real backend work, not a schema flag flip — scoped as its own
slice below, done once, correctly.

## Slice plan

Same proven process as Marketplace/Ride/Wallet: backend first where a
slice needs it, then the screen(s) it unblocks, Playwright-verified,
no slice marked done without a real backend call behind it.

| Slice    | Scope                                                                                                                                                                                                                                                                                                         | Depends on |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **1** ✅ | Backend: flexible identifier (email OR phone) for registration + login across all 4 portals. Schema migration, DTO/validation changes, `PrismaRegistrationRepository`/`LoginService` updates, `NotificationService` interface nullable-email handling, OTP dispatch routes to whichever channel was supplied. | —          |
| **2** ✅ | Splash + Welcome + Register (ported to `packages/ui/src/components/super-app/`, ties into Slice 1's backend). Splash already existed (`splash-intro.tsx`); Welcome + Register are new.                                                                                                                        | Slice 1    |
| **3** ✅ | OTP Verification screen (digit-box UI, error states matching `OTPError`/`OTPStatus` from Figma)                                                                                                                                                                                                               | Slice 1, 2 |
| **4** ⚠️ | Profile Setup + Permissions + Biometric (post-verification onboarding) — **deferred, see below**                                                                                                                                                                                                              | Slice 3    |
| **5** ✅ | Sign In (ported, real phone-OR-email password login, fixes the live email-only `LoginForm` bug) + Returning Login/Account Recovery — **deferred, see below**                                                                                                                                                  | Slice 1    |
| **6**    | Full E2E Playwright walkthrough (register via phone, register via email, login both ways, recovery), production audit, freeze                                                                                                                                                                                 | 2-5        |

### Slice 4 deferred — no real backend to attach it to

Researched before building anything (same discipline as Driver-001's
"document infeasible/unwired trigger gaps honestly" and RIDE-003 Slice
4's capability-gap documentation) rather than shipping decorative UI
that can't actually persist:

- **Where this sits in the flow**: after OTP verification, before
  login. At this point in `AuthFlow` there is **no authenticated
  session yet** — `onVerified` sends the user to `/login`, it doesn't
  log them in. Anything Profile Setup/Permissions would "save" has no
  session to attach to.
- **Profile Setup's fields aren't backed by schema**: `username`,
  `gender`, `dateOfBirth`, `interests`, and avatar upload don't exist
  anywhere on `User` or `CustomerProfile` (checked directly against
  `schema.prisma`). Only `firstName`/`lastName` are real, and those
  are already collected at Register (Slice 2).
- **Permissions' most real candidate, push notification registration,
  is already automatic and session-gated**: `usePushRegistration`
  (`packages/hooks`, DPX-CORE-001 Phase D-2) fires on login transition,
  not on a manual "grant" button, and needs `isAuthenticated` true —
  which, per the point above, isn't available yet at this step. It
  isn't a decision this screen could meaningfully front-run.
- **Biometric has no WebAuthn/Face ID infra** — same reasoning already
  applied when the "Use Biometric Authentication" button was
  deliberately left off the Slice 2 Register screen.

Building these three screens today would mean shipping inputs that
don't save and toggles that don't do anything — worse than the gap
they'd claim to close. Revisiting this is real work: either move
onboarding after login (architecture change) or add the missing
`CustomerProfile` fields — recorded here for whoever picks it up, not
silently dropped.

`screensB.tsx`'s 8 security/session screens: not slotted into this
plan — tracked separately, to be reconciled against Wallet's existing
Security/Settings work first (see "Verified overlap" above) before any
new screens get built.

### Slice 5 — Sign In shipped; Returning Login/Recovery deferred

**Sign In (real, shipped):** ported from Figma's `SignInScreen`
(phone-only, passwordless) and adapted the same way Register was in
Slice 2 — a Phone/Email toggle plus a real password field, since our
backend is password-based. While building this, found that the **live
production login form never actually used the backend's phone-OR-email
capability**: `login-form.tsx` was hardcoded to `loginSchema`
(`{email, password}`) and called `sdk.auth.loginCustomer({email,
password})` only, even though `PortalLoginDto`/`portalLoginSchema` (and
the SDK method's own `PortalLoginValues` type) already accept phone OR
email — the same pattern already found and fixed once for registration
in the original Slice 1 research. `login-form.tsx` and the old
`(auth)/login/page.tsx` are removed; `/login` now renders the real
`SuperAppAuthSignInScreen` via `sign-in-flow.tsx`, moved into the
`(onboarding)` route group so it gets the same NAVY_DEEP full-bleed
shell as `/get-started` (route groups don't change the URL, so no
`href="/login"` caller needed updating). Google Sign-In
(`sdk.auth.googleSignInUrl()`) was kept and re-themed for the dark
screen rather than dropped — it's a real, working OAuth integration
that was only ever wired into the form being replaced here, and this
module doesn't get to regress it as a side effect of a redesign.

**Returning Login and Account Recovery — deferred**, same
audit-before-build discipline as Slice 4:

- **`ReturningLoginScreen`** is a biometric-unlock-first design (Face
  ID/fingerprint prompt, OTP as the fallback) built around a
  `LoginStatus`/`LoginError` state machine that resolves through a
  `setTimeout`, not a real auth call. We have no WebAuthn/Face ID infra
  (same gap already recorded for Slice 2's Register screen and Slice
  4's Biometric screen) — there's nothing behind this screen to wire up
  today. The screen `SignInScreen` already ships covers the same job
  (returning-user login) with the auth we actually have.
- **`RecoveryScreen`** is a choreographed multi-step demo
  (`RecoveryStep = 'options' | 'phone' | 'verify_device' |
'success'`) built around device-trust recovery — it has no real form
  fields, just animated state transitions. Our actual account-recovery
  mechanism is the already-shipped, functional
  `/forgot-password` → `/reset-password` email-OTP flow, which follows
  completely different mechanics (email link + token, not device
  trust). Porting Figma's screen wouldn't replace or improve that flow,
  just add a decorative one beside it.

Net effect: no regression (the working recovery flow is untouched) and
no decorative UI shipped. `/forgot-password`/`/reset-password` stay on
the existing light `(auth)` layout for now — Figma's `RecoveryScreen`
was the only design source that would have justified restyling them,
and it's deferred, so there's no real target to build toward yet. This
is an accepted interim visual inconsistency (dark Sign In → light
forgot-password), not a functional gap.

## Starting now

Slice 1 (backend identifier flexibility) begins immediately following
this doc. Slices 2-6 (the actual screen rebuilds) are real,
multi-session UI work — same scale as Ride's 5 slices or Wallet's 5 —
not something to compress into one pass. Each will be verified against
the real backend and reported back before moving to the next, same
discipline as every other DPX-100 module.
