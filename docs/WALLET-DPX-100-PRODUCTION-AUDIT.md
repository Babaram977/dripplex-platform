# Wallet Module — DPX-100 Production Audit

Item 9 of `docs/DPX-100-MODULE-COMPLETION-GATE.md`, run after Wallet Slices 1-5 (the
`packages/ui` re-platform) completed all 10 real Wallet screens. Same discipline as
`docs/RIDE-DPX-100-PRODUCTION-AUDIT.md`: this ran against a live local backend + Postgres

- Redis and a live customer-web dev server, so every claim marked "verified" was actually
  exercised this session — not inferred from reading source. Bug-level findings and fixes
  from this same pass are in the companion doc, `docs/WALLET-PRODUCTION-AUDIT.md` — this
  document is the gate-required coverage/readiness audit; that one is the "what broke and
  what was fixed" record.

Scope: the 10 real Wallet screens and their backing hooks/services, as they exist after
Slice 5 plus this audit's fixes. Marketplace, Ride, Orders, AI, Merchant, Driver, and
Admin are out of scope.

## 1. Backend coverage

Every row below was exercised this session via real API calls and/or a real Playwright
walkthrough against the live dev backend — not assumed from reading code.

| Capability                                              | Status           | Evidence                                                                                                                                                                              |
| ------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Balance + recent transactions                           | ✅               | Real `GET /customer/wallet`, `GET /customer/wallet/transactions`, Slice 1-2                                                                                                           |
| Transaction history (filter + pagination)               | ✅               | Real cursor-paginated ledger query, Slice 2                                                                                                                                           |
| Transfer (phone lookup + send)                          | ✅               | Real recipient lookup, real debit/credit pair, limit-gated, Slice 2 + this audit                                                                                                      |
| Top Up (gateway funding)                                | ⚠️ not exercised | Real `POST /customer/wallet/fund` reached and returned a real 422 (no gateway sandbox credentials in this environment) — same documented limitation as Ride/Marketplace gateway paths |
| Withdraw (bank-linked, PIN-gated)                       | ✅               | Real debit-at-request-creation, real admin manual-completion queue (Phase 1), Slice 4                                                                                                 |
| Payment Methods (funding gateways + bank list)          | ✅               | Real bank-account list wired this audit (was stale since Slice 3, see companion doc §2.2)                                                                                             |
| Rewards (loyalty tier + referrals + cashback)           | ✅               | Real `GET /customer/loyalty`, `GET /customer/referrals/me`+`/stats`, real cashback ledger entries, Slice 3                                                                            |
| Statement (monthly aggregation + CSV export)            | ✅               | Real ledger aggregation and CSV export, sanitized against formula injection this audit, Slice 5                                                                                       |
| Security (PIN status/change, trusted devices)           | ✅               | Real bcrypt PIN change, real `AuthSession` list/revoke (verified live: revoke removes the session and a subsequent request with that session's token is rejected), Slice 5            |
| Settings (spending limits, notification prefs, privacy) | ✅               | Real persisted limits (enforced on Transfer/Withdraw, verified at both boundaries), real `NotificationPreference` toggles, Slice 5                                                    |

**Backend test suite**: `apps/backend/src/wallet/*.spec.ts` — 6 files, all passing as
part of the full 1075/1075 backend suite this session (no wallet-specific isolation
issues found, unlike Ride's §4 finding — the wallet suite doesn't depend on any
manually-created-and-left-online fixture the way Ride's driver-matching tests did).

## 2. Genuinely missing backend capabilities

Checked by grep across `apps/backend/src/wallet/` and its dependencies for the relevant
domain concepts, not assumed.

| Capability                                                         | Status                      | Where it shows up in the UI today                                                                                    |
| ------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Auto Top-Up (saved-card auto-charge)                               | Missing                     | Settings shows a disabled toggle with an honest "not available yet" note                                             |
| Face ID / biometric auth                                           | Missing                     | Security shows a disabled toggle — needs native WebAuthn integration this web app doesn't have                       |
| Wallet 2FA (SMS-gated large transfers)                             | Missing                     | Security shows a disabled toggle — needs OTP enforcement wired into Transfer/Withdraw specifically                   |
| PDF statement export                                               | Missing                     | Statement offers CSV only, matching the platform's existing PDF-export gap pattern (e.g. trip receipts)              |
| Automated payout provider (Paystack/Flutterwave/OPay transfer API) | Missing (Phase 2 stub only) | Withdraw fulfilled via a real admin manual-completion queue instead — a genuine, working alternative, not a dead end |
| Bank-account provider verification (name-matching)                 | Missing                     | Bank accounts are self-attested — same trust level merchant `BankAccount` already operates at                        |

None of these were faked in the UI at any point — every disabled control carries a real,
honest capability-gap message rather than a dead click, the same discipline the Ride port
followed.

## 3. Real findings from writing this audit

Six real issues were found and five were fixed in this same pass (one — a check-then-act
race in daily-limit enforcement — was deliberately left as documented technical debt
given its narrow, self-limit-only blast radius). Full detail, live verification evidence,
and fix log: `docs/WALLET-PRODUCTION-AUDIT.md`. Summary:

1. **CSV formula injection** in Statement export via a transfer's free-text description —
   fixed (OWASP-standard cell-prefix sanitization).
2. **No brute-force protection** on Wallet PIN verification (a 4-digit PIN, only the
   generic 100-req/60s app-wide throttle) — fixed (scoped `@Throttle` to 5/5min on the two
   PIN-guessing endpoints).
3. **Self-introduced WCAG AA contrast failure** in two of the three Slice 5 screens (`.4`
   opacity vs. the established `.5`, 11 occurrences) — fixed, mechanical.
4. **Payment Methods showed a stale "no bank accounts" message** after Slice 4 made
   bank-account linking real — fixed.
5. **Rewards' three data queries silently mishandled fetch failures** (misleading empty
   states, one genuinely stuck "Loading…") — fixed.
6. **`setLimits` gated behind a read-only-named permission** — fixed (no live exploit
   today, since every role bundles read+transfer+withdraw together, but a latent
   authorization-scoping mistake worth closing).

Unlike Ride's audit (§4 there), no shared-dev-DB test-isolation issue was found in the
wallet backend suite this session.

## 4. Readiness scorecard

Qualitative, based on what was actually read/tested this session — not a benchmark tool's
output.

| Dimension                | Assessment                                                                                                                  | Why                                                                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI completeness          | 10/10 real screens ported to `packages/ui`, Playwright-verified                                                             | Slices 1-5                                                                                                                                                                                                         |
| Backend completeness     | 9/10 capabilities in §1 fully verified; 1 (Top Up gateway funding) code-complete but environment-blocked (no sandbox creds) | See §1                                                                                                                                                                                                             |
| Money-safety controls    | Solid                                                                                                                       | Optimistic-locked, reference-idempotent `mutateAndEmit` on every wallet mutation; PIN gate on withdrawal; spending limits enforced at real boundaries (verified live)                                              |
| Error handling           | Solid after this audit's fixes (§3.5); not fully re-audited on Slices 1-2/4 screens beyond what the original slices covered | Rewards was the one screen with a real gap; Transfer/Withdraw/Statement/Security/Settings all already had `.isError` handling from their original slices                                                           |
| Security                 | Improved this audit                                                                                                         | JWT auth + `AuthSession` revocation verified live to actually reject a revoked session's next request; CSV injection and PIN brute-force both closed; one documented TOCTOU race left as low-impact technical debt |
| Test isolation (backend) | No issue found                                                                                                              | Unlike Ride's §4 finding — the wallet suite ran clean without any shared-DB pollution this session                                                                                                                 |
| Offline support          | Not evaluated                                                                                                               | No offline-specific handling exists anywhere in Wallet, same as the rest of the platform; not flagged as a Wallet-specific gap since it's a cross-module pattern                                                   |

No single overall percentage is given here deliberately — collapsing "10/10 screens
ported" and "no automated payout" into one number would hide which of these actually
matters for a launch decision more than it would help one.

## 5. Recommendation

Wallet has met gate items 1-9. All five slices are real, backend-verified, and this
audit's fixes closed every concrete defect and security finding surfaced by a live,
adversarial-minded pass (not just a happy-path re-check). The module is ready for
founder review and, per item 10 of the completion gate, **freezing is the founder's call
to make** — this audit does not declare Wallet frozen on its own authority.

Two items worth a deliberate decision before or alongside that sign-off:

1. **Top Up gateway funding** — needs real Paystack/Flutterwave/OPay sandbox credentials
   in this environment (or a staging environment that has them) to get an actual
   end-to-end verification of the one funding path that's still code-only-verified — the
   same environmental limitation already accepted for Ride and Marketplace's gateway
   paths.
2. **The daily-limit TOCTOU race** (`docs/WALLET-PRODUCTION-AUDIT.md` §3.1) — real,
   scoped, low-impact (self-limit only, doesn't touch actual balance integrity), left
   unfixed this pass. Worth a deliberate decision on priority, not silently carried
   forward.

Everything else in §2 (Auto Top-Up, Face ID, Wallet 2FA, PDF export, automated payout,
bank-account provider verification) is real, scoped, future work — already honestly
disclosed in the UI rather than hidden, matching the same pattern Ride's audit found for
its own missing capabilities.
