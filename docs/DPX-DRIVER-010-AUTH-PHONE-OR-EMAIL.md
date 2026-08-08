# DPX-DRIVER-010 — Auth: phone-only login fix (phone OR email identity)

**Type:** Backend-only bug fix + tests.
**Branch:** `claude/driver-auth-phone-or-email`.
**Authorized:** founder decision (2026-08-08) — "Phone OR Email as login/registration; fix the
phone-only login bug now." Consistent with the locked single Super-App identity (no separate
driver auth).

## The fix (Decision 1a)

The backend already supports either identifier at registration (optional email + optional phone
with a one-or-the-other validator) and at login lookup (`resolveUser` → email-else-phone). But a
**phone-only account could register and verify its phone, then fail to log in**:
`LoginService.assertAccountEligible` unconditionally required a non-null `emailVerifiedAt`
(`login.service.ts`), which a phone-only (synthetic-internal-email) account never has.

Phone-only registrations get a deterministic synthetic internal-domain email
(`makeSyntheticEmail`) that is never sent to and is treated as auto-verified for activation. The
fix exempts synthetic emails from the login email-verification gate:

```ts
if (!user.emailVerifiedAt && !isSyntheticEmail(user.email)) {
  throw new EmailNotVerifiedDomainException();
}
```

The status checks above the gate already guarantee the account is `ACTIVE` (i.e. the phone was
verified) before this point, so no real verification is skipped. Single file, single condition;
DTOs, lookup, and schema were already correct.

**Test:** `login.service.spec.ts` — a phone-only synthetic-email account (`emailVerifiedAt: null`)
logs in via phone and receives tokens.

## Deferred (verified NOT safe as a simple cleanup): retire legacy email-only paths (Decision 1c)

The founder also locked "retire legacy email-only paths." Verification shows the supposedly-dead
bare paths are **not dead**, so a blind removal would break the build and two portals:

- **`sdk.auth.login()` → `POST /auth/login` is referenced by `apps/operations-console` and
  `apps/admin-portal` login forms** (and `packages/sdk/src/e2e/admin-flow.e2e.spec.ts`).
- **No bare `POST /auth/login` route exists** — the auth controllers only expose
  `/auth/login/{customer,merchant,rider,driver}`. There is **no admin/operations login portal**,
  so those two portals appear to authenticate against a non-existent route (a separate,
  pre-existing gap outside Driver scope).

**Consequence:** retiring the legacy bare `login()`/`register()` first requires deciding how
operations/admin staff authenticate (which portal-login they should use, or a new admin/ops login
endpoint). That is a separate founder decision, not a safe backend cleanup — elevated, not done
here. `AuthService.login(LoginDto)` is genuinely dead (no controller) but shares fixtures/tests
with the still-wired `register` path, so it's folded into the same deferred cleanup rather than
removed piecemeal.

## Scope

- Backend only. No new endpoints, no schema/migration, no UI.
- No changes to the OPay / commission / storage / selfie / passenger-PIN / field-diff items (all deferred per founder).

## Verification

Typecheck / lint / targeted backend tests — see the PR description.
