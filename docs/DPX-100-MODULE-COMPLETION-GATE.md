# DPX-100 Module Completion Gate

Established by the founder after the Ride module's DPX-100 port
(Slices 1-5) reached completion, to make "done" a checkable standard
rather than a judgment call repeated fresh for every module. Every
module in the founder's ordering — Wallet, Marketplace (already met this
bar retroactively), Orders, AI, Merchant, Driver, Admin — is held to the
same ten items before it's declared complete and frozen.

## The gate

A module is not "done" until all ten are true:

1. **100% Figma screen coverage** — every real screen the module needs
   (per the locked Figma export, adapted for capability gaps that are
   documented rather than invented) exists.
2. **100% shared component implementation** — every screen composes
   `packages/ui/src/components/super-app/` pieces; no screen hand-rolls
   markup that duplicates an existing or reasonably-extractable shared
   component.
3. **Real backend integration wherever endpoints exist** — no screen
   reads from a mock or hardcoded fixture when a real endpoint is
   available. Seed data is Phase-1 testing infrastructure only
   (`apps/backend/prisma/seed-data/`), never hardcoded into frontend
   components.
4. **Missing backend capabilities are documented, never faked** — a
   disabled button with an honest inline explanation, not a canned
   success state for a capability that doesn't exist yet.
5. **Zero TypeScript errors** — `tsc --noEmit` clean across every touched
   package/app.
6. **Zero lint errors** — `eslint --max-warnings=0` clean across every
   touched package/app.
7. **Zero unexpected browser console errors** — verified live, not
   assumed; sandbox/proxy noise (e.g. CSP warnings injected by the test
   environment itself, confirmed absent from the app's own config) is
   filtered out explicitly, not silently ignored.
8. **Playwright verification** — a real browser walkthrough against a
   real backend (not a mock server), screenshotted, for every screen or
   flow added.
9. **A production audit document** — written after the module is
   feature-complete, covering: a backend-coverage table, a genuinely-
   missing-capabilities table (verified by reading/grepping the backend,
   not assumed), and a per-dimension readiness assessment. No single
   overall percentage — collapsing UI completeness and, say, offline
   support into one number hides which one actually matters for a launch
   call.
10. **Frozen after approval** — once the founder reviews the audit and
    signs off, the module gets a `MATURITY.md` freeze notice (bug fixes
    for verified defects only) until explicitly reopened. Freezing
    protects the rest of the platform build from regressions in modules
    that are already done.

## Applying it retroactively

- **Home**: met 1-9 during DPX-100/101; formally **Locked** per
  `MATURITY.md` (a stronger status than "frozen" — Locked also protects
  the visual spec itself from redesign drift, not just from new
  features). Locking happens per-module after explicit founder pixel-
  final approval; freezing per this gate can happen without that.
- **Marketplace**: met 1-9 during its stabilization pass
  (`DPX-100-COVERAGE.md`'s "Production Candidate" section); not yet
  formally frozen or locked pending founder review of that pass.
- **Ride**: met 1-9 across Slices 1-5 and
  `docs/RIDE-DPX-100-PRODUCTION-AUDIT.md`; **frozen** per founder
  direction (see `MATURITY.md`'s "Ride module — Frozen" section).

## Notes for whoever runs the next module through this gate

- Item 9's audit doc should name what it could and couldn't verify live
  (e.g. a payment gateway with no sandbox credentials in this
  environment is a documented limitation, not a failed check) — the
  audit's credibility depends on being explicit about its own
  methodology, the same way `RIDE-DPX-100-PRODUCTION-AUDIT.md` and the
  earlier `RIDE-003-PRODUCTION-AUDIT.md` both were.
- Before writing item 9, actually grep/read the backend for capabilities
  you're about to call "missing" — the Ride audit almost repeated an
  inaccurate claim that push notifications were missing; a grep across
  `apps/backend/src` showed they were real (`DPX-CORE-001`). Assumed gaps
  are exactly the kind of thing this gate exists to prevent.
- If the module shares a test database with manual/Playwright QA (true
  of this repo's backend today — no dedicated `DATABASE_URL_TEST`),
  re-run the module's backend spec suite as part of item 9 and treat any
  failure caused by leftover manual-test state as a real process finding
  to report, not something to silently work around.
