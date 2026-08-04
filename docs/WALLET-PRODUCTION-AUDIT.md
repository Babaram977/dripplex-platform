# Wallet Production Readiness Audit

Commissioned after Slice 5 (Statement/Security/Settings) shipped, completing all five
Wallet slices. Same methodology as `docs/RIDE-003-PRODUCTION-AUDIT.md`: full read-through
of every screen/hook/service, cross-referenced against the real backend — but unlike that
audit, this one had a live backend and live dev database available, so every finding
below was checked at runtime (curl against the real API, or a live SQL query), not just
inferred from code.

**Status: audited and fixed in the same pass** — findings below, followed by the fix log.
No speculative fixes; only what was verified.

## Methodology

Scope: all 10 screens in `apps/customer-web/src/components/wallet/`, their hooks in
`apps/customer-web/src/hooks/wallet/` (+ `use-sessions.ts`,
`use-notification-preferences.ts`), and the backend `apps/backend/src/wallet/` module
plus its dependencies on `auth/` (sessions), `notifications/` (preferences), and
`loyalty/`/`referrals/` (Rewards). WCAG contrast ratios computed from the literal hex/
rgba values via the standard relative-luminance formula, not estimated. Security findings
verified by reading the actual guard/strategy/throttler wiring, not assumed from
conventions elsewhere.

---

## 1. Security findings

### 1.1 CSV formula injection in Statement export

`CustomerWalletController.exportStatement()` builds each ledger row directly from
`WalletLedgerEntry.description` — for `TRANSFER` entries, this is the sender's free-text
note (`TransferWalletDto.description`, up to 500 characters, no character restrictions
beyond length). The CSV builder quote-escapes embedded `"` but does nothing about a cell
starting with `=`, `+`, `-`, or `@` — the characters Excel/Google Sheets/LibreOffice
Calc interpret as a formula prefix on open. A transfer note of `=HYPERLINK("http://evil.example","Tap for a refund")`
survives untouched into both the sender's **and the recipient's** statement export (a
transfer writes a ledger entry to both wallets), so this is exploitable against a third
party, not just self-harm — a well-known vulnerability class (OWASP "CSV Injection").
Verified by tracing the exact field from `TransferWalletDto` → `WalletLedgerEntry.description`
→ `exportStatement()`'s row-building loop, with no sanitization anywhere in that path.

### 1.2 No brute-force protection on Wallet PIN verification

`WalletPinService.verify()`/`change()` have no attempt counter, lockout, or per-endpoint
rate limit — confirmed by reading the full service (only `bcrypt.compare`, no attempt
tracking anywhere) and the controller (`@RequirePermissions` only, no `@Throttle`). The
only protection is the app-wide `ThrottlerGuard` (`THROTTLE_LIMIT=100` per
`THROTTLE_TTL_MS=60_000`, confirmed in `env.validation.ts`), which gives an attacker (on
their own IP, not sharing the victim's budget) up to 100 PIN guesses per minute against a
4-digit PIN (10,000 combinations) — an expected ~50 guesses to succeed, well inside one
throttle window. This gates a real money-movement action (withdrawal PIN confirmation).
Note: this generic global throttle is the platform's only brute-force defense on
_password_ login too (confirmed — no lockout/attempt-tracking exists anywhere in
`auth/`), so PIN verification isn't uniquely weak versus the rest of the platform, but a
4-digit PIN's tiny keyspace makes the same generic protection meaningfully less effective
here than it is for passwords.

---

## 2. Defects

### 2.1 Self-introduced WCAG AA contrast failure in two of the three Slice 5 screens

`rgba(255,255,255,.4)` — used for real subtitle/helper/label text (11-12px) in
`wallet-security-screen.tsx` (6 occurrences) and `wallet-settings-screen.tsx`
(5 occurrences), 11 total — computes to **3.70:1** against `#0A1628` and **3.80:1**† against
`#112238`, both short of WCAG AA's 4.5:1 minimum for normal-size text. Slices 1-4
consistently use `.5` for the same role (5.00-5.25:1, passes AA) — this is a real
deviation introduced in Slice 5, the same class of bug the Ride audit's finding 2.3
described, just wider in scope (15 sites instead of 1). (†Contrast computed via the
standard WCAG relative-luminance formula from the literal hex/rgba values, matching the
methodology `RIDE-003-PRODUCTION-AUDIT.md` §2.1 used.)

### 2.2 Payment Methods still shows a hardcoded "no bank accounts" message after Slice 4 made bank-account linking real

`payment-methods-screen.tsx`'s "Linked bank accounts" section is static text — "No
linked bank accounts yet. You'll be able to add one when withdrawing from your wallet." —
written in Slice 3, before Slice 4 (Withdraw) added the real `CustomerBankAccount` model
and `useBankAccounts()` hook. The screen was never revisited: a customer who has actually
linked a bank account via Withdraw still sees "No linked bank accounts yet" on this
screen — actively wrong, not just incomplete. Verified: `useBankAccounts()` exists, is
real, and is already used correctly by `withdraw-screen.tsx`; `payment-methods-screen.tsx`
doesn't import it at all.

### 2.3 Rewards screen's three data sources render query failures as misleading states, not errors

Same bug class as `RIDE-003-PRODUCTION-AUDIT.md` §1.2. `RewardsScreen` reads three
independent queries (`useLoyaltyAccount`, `useReferralCode`, `useWalletTransactions` for
cashback) and checks `.isLoading` but never `.isError` on any of them:

- A failed cashback fetch renders **"No cashback yet — it lands here automatically..."**
  — tells the customer they have zero cashback when the real answer is "the request
  failed."
- A failed referral-code fetch renders **"Loading your referral code…"** forever — a
  genuine stuck-loading-state bug, not just a missing error message.
- A failed loyalty fetch silently omits the tier progress bar with no distinction from
  "still loading."

### 2.4 `PUT /customer/wallet/limits` is gated behind a read-only-named permission

`CustomerWalletController.setLimits()` requires `WALLET_PERMISSIONS.CUSTOMER_READ`
(`customer:wallet:read`) — semantically a read permission — for a real mutation
(changes a customer's enforced spending caps). Verified against
`prisma/seed-data/role-permissions.ts`: every role holding `customer:wallet:read` today
also holds `customer:wallet:transfer`/`customer:wallet:withdraw`, so there is no live
privilege-escalation path right now — but the assignment is a latent mistake that would
matter the moment a narrower read-only wallet role (e.g. a future support/ops view) is
introduced.

### 2.5 Transfer and Withdraw discard the backend's specific, actionable error message

Both screens show a generic `isError` fallback ("Transfer failed. Try again." /
"Couldn't submit your withdrawal. Check your PIN and try again.") regardless of the real
reason. Verified this is consistent with the rest of the app (Ride's `payment-screen.tsx`
does the same — "Payment couldn't be started. Try again." — so this is a pre-existing,
app-wide convention, not a Wallet-introduced regression) — but it's specifically harmful
here: the backend already computes a precise, actionable message for the two new Slice 5
limit checks (verified live: `"Amount exceeds your single transaction limit of 500"`,
`"Amount would exceed your daily limit of 1000 (800 already used today)"`), and the
frontend throws both away in favor of "try again" — which, for a limit violation, will
fail identically on every retry. A customer who hits their own configured limit has no
way to learn why from the UI.

---

## 3. Technical debt

### 3.1 `assertWithinLimits`'s daily-limit check is a check-then-act race

The daily-spend `SUM` query in `WalletService.assertWithinLimits()` runs outside any
transaction or lock, separately from the actual debit that follows it
(`transfer()`/withdrawal creation). Two concurrent requests (e.g. two browser tabs)
could each read the same "already spent today" total before either's ledger entry
exists, both pass the check, and jointly exceed the configured daily limit. **Scoped
impact, not fixed this pass**: this only lets a customer race past their own
self-configured convenience limit — it does not threaten actual wallet balance
integrity, which remains correctly protected by `mutateAndEmit`'s optimistic locking and
balance check inside the debit path itself (unchanged, unaffected by this race). A
correct fix means moving the daily-sum check inside the same transactional scope as the
debit, which touches the shared `mutateAndEmit` pipeline every wallet mutation goes
through — larger, riskier surgery than this audit's fix pass, and lower priority given
the limited blast radius. Flagged for a deliberate follow-up, not silently carried
forward.

---

## What this audit did not check

- Real screen-reader output — no way to run one in this sandbox.
- Load-testing the PIN throttle fix under real concurrent traffic (verified the
  decorator is wired correctly and returns 429 after the configured limit; did not
  simulate a distributed attack).
- The pre-existing, platform-wide generic-error-message convention (§2.5) beyond
  Wallet's own two screens — fixing it everywhere is a cross-module effort outside this
  audit's scope.

---

## Fix log

Applied immediately after writing the findings above, in order of severity. All fixes
verified via `tsc --noEmit` (clean across backend/types/sdk/ui/customer-web), `eslint
--max-warnings=0` (clean), the backend Jest suite, and live curl/SQL checks against the
running dev backend.

- **1.1 (CSV injection)** — fixed. `exportStatement()` now prefixes any cell whose first
  character is `=`, `+`, `-`, `@`, tab, or CR with a leading `'` before quote-wrapping —
  the standard OWASP CSV-injection mitigation, applied to every cell (not just
  `description`, since `type`/`direction` are enum-controlled but the mitigation is
  cheap and uniform). Verified live: a transfer with description
  `=HYPERLINK("http://evil.example")` now exports as `"'=HYPERLINK(""http://evil.example"")"`
  — inert text in Excel/Sheets instead of a formula.
- **1.2 (PIN brute-force)** — fixed. Added `@Throttle({ default: { limit: 5, ttl: 300_000 } })`
  (5 attempts per 5 minutes) to `CustomerWalletPinController`'s `verify` and `change`
  endpoints — tighter than the app-wide default, scoped to just the two PIN-guessing
  surfaces. Verified live: 6 rapid `POST /customer/wallet/pin/verify` calls with a wrong
  PIN returned 422 ("Incorrect PIN") five times then a 429 (`ThrottlerException`) on the
  sixth.
- **2.1 (contrast)** — fixed. All 11 `rgba(255,255,255,.4)` occurrences (Security and
  Settings; Statement had none) raised to `.5`, matching Slices 1-4's established token
  (now 5.00-5.25:1, both clear AA). Mechanical find-and-replace, no other changes.
- **2.2 (stale Payment Methods)** — fixed. `PaymentMethodsScreen` now calls
  `useBankAccounts()` and renders the real list (bank name, masked account number, "Default"
  badge) when non-empty, falling back to the original empty-state copy only when the
  customer genuinely has none — with a loading state and an explicit error state (ties
  into 2.3's fix below) added alongside it, since it was reading a real query for the
  first time.
- **2.3 (Rewards error states)** — fixed. `RewardsScreen` now checks `.isError` on all
  three queries: cashback shows "Couldn't load your cashback history — Retry"; referral
  code shows "Couldn't load your referral code — Retry" instead of an infinite "Loading…";
  loyalty tier failure shows a lighter inline note rather than silently vanishing.
- **2.4 (permission scoping)** — fixed. `setLimits()` now requires
  `WALLET_PERMISSIONS.CUSTOMER_TRANSFER` instead of `CUSTOMER_READ` — no seed/migration
  needed since every role already holds both together; this closes the latent gap without
  inventing a new permission.
- **2.5 (specific error messages)** — fixed on Transfer and Withdraw only (the two
  screens gated by the new Slice 5 limit checks), not app-wide. Both now use
  `describeSdkError()` (the same helper `login-form.tsx` already uses) to extract the
  backend's real message when available, falling back to the original generic copy only
  when the SDK can't produce one (network errors, etc.).
- **3.1 (TOCTOU race)** — not fixed, per the scoped-impact reasoning in §3.1. Documented
  as technical debt.

Full verification after all fixes: backend Jest suite 1075/1075 passing (the 2
previously-flaky `customer-products.service.spec.ts` shared-dev-DB tests didn't
reproduce this run — a pre-existing, non-deterministic pollution issue documented
across earlier slices, unrelated to this audit's changes). This codebase doesn't
unit-test controllers (no `*.controller.spec.ts` exists anywhere in `wallet/`),
so 1.1/1.2/2.4 (all controller-level) were verified live against the running dev backend
instead of with new Jest tests: real CSV injection payload confirmed neutralized, PIN
throttle confirmed returning 429 on the 6th rapid attempt, `setLimits` confirmed still
working end-to-end under its new permission. `tsc --noEmit` and `eslint
--max-warnings=0` clean across backend, types, sdk, ui, and customer-web. `customer-web`
production build succeeds.
