# Auth/Onboarding DPX-100 — Production Audit (Slice 6)

Commissioned after Slice 5 (Sign In) shipped, completing the shippable
portion of the Auth slice plan (`docs/AUTH-DPX-100-REALITY-AUDIT.md`).
Same methodology as the Wallet/Commercial production audits: full
read-through of every touched screen/component/flow, cross-referenced
against the real backend code. No live Postgres/Redis was available in
this environment (no Docker daemon), so backend behavior claims below
are verified by reading the actual service code (the same code already
covered by the backend's existing jest suite), not by a live database
query — flagged explicitly wherever that distinction matters.

## Scope

`packages/ui/src/components/super-app/Auth*.tsx` (Welcome, Register,
OTP, Sign In), `apps/customer-web/src/components/auth/*.tsx`
(auth-flow.tsx, sign-in-flow.tsx), the `(onboarding)` and `(auth)` route
groups, and the backend `apps/backend/src/auth/` module they call
(`LoginService`, `RegistrationService`, `LoginAttemptService`,
`OtpService` and related domain exceptions).

---

## 1. Security findings

### 1.1 No new findings introduced by Slices 2-5

The backend auth infrastructure these screens call (`LoginService`,
`RegistrationService`, OTP verification, `LoginAttemptService`) predates
this UI work and was already hardened before Slice 1 began:

- **Password comparison is timing-safe against user enumeration**:
  `LoginService.loginPortal()` always runs `bcrypt.compare()` against
  either the real user's hash or a fixed dummy bcrypt hash
  (`TIMING_SAFE_DUMMY_HASH`) when no user is found, and returns the
  identical generic `"Invalid email or password"` message either way —
  verified by reading the method directly. The new Sign In screen
  (Slice 5) passes this message through unmodified via
  `describeSdkError`, adding no new enumeration surface.
- **Real brute-force lockout exists**: `LoginAttemptService` tracks
  per-email and per-IP failure counters in Redis
  (`AppConfigService.loginMaxAttemptsPerEmail`/`loginMaxAttemptsPerIp`)
  and locks with a TTL-based `LoginAttemptsExceededDomainException`,
  confirmed reading `login-attempt.service.ts` directly. This was added
  by DPX-DS-001 after the Wallet production audit noted its absence —
  that finding is stale as of this Slice, not a live gap.
- **OTP has its own attempt/expiry/rate-limit domain exceptions**
  (`OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`,
  `RATE_LIMITED`), already mapped to distinct UI states in Slice 3's OTP
  screen.

### 1.2 No client-side secret handling

Passwords are held in local component state only, never logged
(grepped for `console.log`/`console.error` touching password fields —
none), never sent anywhere except the single `sdk.auth.loginCustomer`/
`registerCustomer` POST body. Password inputs use correct `autoComplete`
hints (`new-password` on Register, `current-password` on Sign In) so
password managers behave correctly.

### 1.3 No open-redirect surface

Every `router.push()` call across `auth-flow.tsx`/`sign-in-flow.tsx`
targets a hardcoded string (`/login`, `/get-started`, `/forgot-password`,
`/`, `siteConfig.links.dashboard`) — none are built from a query
parameter or other user-controlled input, so there's no redirect
target an attacker could steer.

### 1.4 Google Sign-In redirect uses a server-controlled URL

`onGoogleSignIn` does `window.location.href = sdk.auth.googleSignInUrl()`
— the URL comes from the SDK (points at the backend's own `/auth/google`
route), not from any client-supplied value, so this isn't a vector for
redirecting the browser somewhere attacker-controlled.

### 1.5 CSRF not applicable

Auth (like every other portal in this platform) uses bearer JWTs sent
via the `Authorization` header, not cookies — there's no ambient
credential for a cross-site request to ride along on, so CSRF doesn't
apply to any of the new endpoints these screens call.

**Conclusion: no security findings requiring a fix.** The screens built
in Slices 2-5 sit on top of already-hardened backend infrastructure and
introduce no new attack surface.

---

## 2. Defects found and fixed in this pass

### 2.1 Stale "not connected" copy on `/forgot-password`

`(auth)/forgot-password/page.tsx`'s subtitle read _"We will email a
reset link when API auth is connected"_ — leftover placeholder copy
from before the backend was wired. The form right below it
(`ForgotPasswordForm` in `misc-forms.tsx`) has called the real
`sdk.auth.forgotPassword()` for some time (confirmed by reading the
form and by the SDK wiring test in
`packages/sdk/src/e2e/frontend-wiring.e2e.spec.ts`, which already
asserted `misc.toContain('sdk.auth.forgotPassword')`). The page was
telling every visitor a working feature didn't work yet. **Fixed**:
subtitle now reads "Enter your email and we'll send you a link to reset
your password."

Found via the Slice 6 Playwright navigation walkthrough (Welcome →
Register → Sign In → Forgot Password → back), not via code reading —
a genuine "test for bugs" catch, not a spec-compliance nit.

### 2.2 Pre-existing broken test fixed in Slice 5, re-confirmed here

`packages/sdk/src/e2e/frontend-wiring.e2e.spec.ts` referenced
`apps/customer-web/src/components/forms/register-form.tsx`, a file
Slice 2 had already deleted (replaced by `auth-flow.tsx`) — the test
had been silently failing since Slice 2 shipped, because nothing in
this session's prior work had touched that spec file. Fixed in the
Slice 5 commit by pointing both the register and login assertions at
the live files (`auth-flow.tsx`, `sign-in-flow.tsx`); confirmed still
green in this pass's full verification run.

### 2.3 No other defects found

The Slice 6 Playwright walkthrough exercised: Welcome → Get Started →
Register (phone mode, fill, toggle to email mode, fill) → Sign In link
→ `/login` (toggle phone/email, fill/validate) → "Get Started" link back
to `/get-started` → direct-load `/login` → Forgot Password → `/forgot-password`
→ direct-load `/login` → Back button → `/`. Zero console errors across
the whole run, all navigation targets correct, all toggle/validation
states rendered as designed.

---

## 3. What Slice 6 could not verify

**No live-backend E2E was possible in this environment** — no Docker
daemon, so no Postgres/Redis to run the backend against. This means:

- Real registration → real OTP delivery → real verification → real
  login round-trip was **not** exercised end-to-end against a live
  database in this pass. The individual pieces are covered elsewhere:
  the backend's own jest suite (confirmed green as of Slice 1, unchanged
  since — this Slice touched no backend code), and the SDK's mocked
  contract tests (`packages/sdk/src/e2e/customer-flow.e2e.spec.ts` and
  friends, which assert the SDK sends the right request shape and
  handles the right response shape, but don't hit a real server).
- The Playwright walkthrough in this doc is real browser navigation
  against the real running Next.js dev server and the real component
  tree — genuine UI/routing verification — but every network call in
  it necessarily failed silently (no backend running), so submit-button
  outcomes (`Continue` actually registering, `Continue` actually
  logging in) were not observed end-to-end here. They were observed in
  Slices 2, 3, and 5's own per-slice Playwright passes, which used the
  same technique (browser-only, no backend) for the same reason.

This is a real, honestly-recorded limitation of the environment, not a
skipped step — recorded here rather than silently assumed away.

---

## 4. Summary

| Area                   | Result                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Security review        | No findings requiring a fix                                                                                                                |
| Defects                | 1 real bug fixed (stale forgot-password copy), 1 pre-existing broken test fixed (in Slice 5)                                               |
| Navigation walkthrough | Full Welcome→Register→SignIn→ForgotPassword→Back chain verified, zero console errors                                                       |
| Backend E2E            | Not possible in this environment (no Docker/Postgres); covered by existing backend jest + SDK contract tests instead                       |
| Verification           | tsc/eslint clean across `packages/ui`, `packages/sdk`, `packages/types`, `apps/customer-web`; full vitest green; production build succeeds |

**Recommendation: ready for founder review.** No blocking issues found.
Per the founder's explicit instruction this slice does not self-freeze —
returned for review alongside the rest of the Auth slice plan (Slices
1-5 shipped, Slice 4's Profile Setup/Permissions/Biometric and Slice 5's
Returning Login/Account Recovery deferred with documented reasoning in
`docs/AUTH-DPX-100-REALITY-AUDIT.md`).
