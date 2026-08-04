# DPX-100 Module Completion Gate

Established by the founder after the Ride module's DPX-100 port
(Slices 1-5) reached completion, to make "done" a checkable standard
rather than a judgment call repeated fresh for every module. Every
module in the founder's ordering — Wallet, Marketplace (already met this
bar retroactively), Orders, AI, Merchant, Driver, Admin — is held to the
same ten items before it's declared complete and frozen.

Two standing principles apply on top of this gate, platform-wide, not
scoped to one module: [DPX-UX-001 — Simplicity First](./DPX-UX-001-SIMPLICITY-FIRST.md)
and [DPX-901 — Configuration-Driven Security Policy](./DPX-901-CONFIG-DRIVEN-SECURITY-POLICY.md).

## The module lifecycle

Founder-formalized (2026-08-04) as the named sequence every module goes
through, mapping onto the ten-item gate below rather than replacing it:

1. **Figma implementation** — gate item 1-2.
2. **Backend integration** — gate item 3-4.
3. **End-to-end verification** — gate items 5-8 (typecheck/lint/console/
   Playwright).
4. **Security review** — a named, explicit step, not folded silently
   into the production audit. For a module with real security-relevant
   surface (auth, payments, identity, anything DPX-901 governs), this is
   its own pass with its own findings, the way Driver-001/DPX-DS-001/
   DPX-DRIVER-001 was for Driver — not every module needs one (Home's
   port didn't), but when a module has one, it gets documented as its
   own thing, not buried in prose inside item 9's audit.
5. **Production audit** — gate item 9.
6. **Documentation update** — every doc this module touches (this gate's
   "Applying it retroactively" section, `MATURITY.md`, `RELEASE-HISTORY.md`,
   the module's own audit/design docs) gets brought current as part of
   closing the module, not left stale for the next module's audit to
   trip over.
7. **Founder approval** — the actual sign-off gate item 10 requires.
8. **Module freeze** — gate item 10.

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
  (`DPX-100-COVERAGE.md`'s "Production Candidate" section), then a
  founder-flagged pricing-integrity defect was found and fixed
  (`docs/PRICING-ENGINE.md`) before the freeze; **frozen** per founder
  direction (`docs/DPX-100-COVERAGE.md`).
- **Ride**: met 1-9 across Slices 1-5 and
  `docs/RIDE-DPX-100-PRODUCTION-AUDIT.md`; **frozen** per founder
  direction (see `MATURITY.md`'s "Ride module — Frozen" section).
- **Wallet**: met 1-9 across Slices 1-5 and
  `docs/WALLET-DPX-100-PRODUCTION-AUDIT.md` (which found and fixed six
  real issues); **frozen** per founder direction.
- **Driver security (facial verification)**: backend-only pass (items 3-4,
  5-6, no Figma/Playwright items since no UI was built — see the
  Figma-first correction in `docs/DPX-DRIVER-001-SECURITY-STANDARD.md` §9),
  with an explicit security-review step (item "4" above) producing
  `docs/DPX-DRIVER-001-SECURITY-STANDARD.md`; **locked** per founder
  direction.
- **Driver Slice 1 (onboarding, KYC, vehicle management, inspection engine,
  unified activation gate)**: backend-only pass, same Figma-first scope
  note as above — see `docs/DPX-DRIVER-002-INSPECTION-STANDARD.md` and
  `docs/DRIVER-APP-DPX-100-AUDIT.md`'s Slice 1 status note for what shipped
  and was verified; **frozen** per founder direction (2026-08-04). The one
  open design note from the freeze review (whether a failed re-inspection
  should auto-revert an already-approved vehicle's status) is recorded as
  a future milestone, not a reopening —
  `docs/DPX-DRIVER-004-VEHICLE-APPROVAL-LIFECYCLE-POLICY.md`. The DPX-100
  UI port itself remains open — see `docs/DRIVER-APP-DPX-100-AUDIT.md`.
- **Driver Slice 2** (Navigation handoff, one-tap phone calling, Driver
  Support, Incident Reporting, SOS/Emergency, Shift Management, Help
  Centre, Operational Notifications, Profile Enhancements): met items 1-9
  — see `docs/DRIVER-SLICE-2-AUDIT.md` (per-item shipped log) and
  `docs/DRIVER-SLICE-2-PRODUCTION-AUDIT.md` (item 9's audit, no
  launch-blocking issues found, Figma fidelity N/A per that doc's §1 —
  same Figma-first scope note as Slice 1, since no locked Figma export
  exists for this module's screens yet); **frozen** per founder direction
  (2026-08-04, see `docs/RELEASE-HISTORY.md`). The audit's one
  operational-readiness observation (no operations-console UI for the
  SOS/incident/support/shift queues this slice built) was accepted as
  correctly out of scope and recorded as a new future module,
  `docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md`, not a reopening.

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
