# DPX-DRIVER-003 — Background Screening (Future Milestone)

**Status: Deferred, not yet implemented.** Founder decision (2026-08-04): criminal/
watchlist checks are explicitly out of scope for DPX-DRIVER-002's Slice 1, because
they depend on country-specific data-source relationships and legal agreements
that take real time to establish, and the Driver module's onboarding foundation
(identity verification, licence/vehicle documents, mandatory physical inspection)
already provides a strong baseline without them. This document exists so that
foundation is built with the right extension points now, rather than needing a
redesign when a provider is eventually chosen.

## Scope, once activated

- A criminal-record check against Nigerian federal/state records (or whichever
  jurisdiction is relevant at the time), where legally available.
- A watchlist check against known-fraud or known-safety-risk lists, if such a
  list exists and is legally accessible to a private platform.
- Provider decision itself: no vendor is chosen or assumed here. This needs its
  own founder decision with the same weight as the Smile ID choice — real cost,
  real data-residency/compliance implications, and (per the founder's own
  reasoning above) real lead time to establish the data-access relationship.

## Extension points to preserve in DPX-DRIVER-002's Slice 1 implementation

So that adding this later doesn't require touching the onboarding state machine:

- **`Inspection`/onboarding status model stays provider-agnostic.** The
  `DriverProfile`/onboarding status enum should have room for a
  `BACKGROUND_CHECK_PENDING` (or similarly named) state without assuming it's
  used yet — Slice 1 skips straight past it, DPX-DRIVER-003 activates it later
  by adding the check into the existing state sequence, not restructuring it.
- **A `DriverBackgroundCheck` model shape, sketched but not created.** When
  built: `driverId`, `provider` (an enum, mirroring
  `IdentityVerificationProvider`'s pattern), `status`
  (`PENDING`/`CLEARED`/`FLAGGED`/`ERROR`), `providerReference`,
  `requestedAt`/`completedAt`, `resultSummary` (no raw provider payload stored
  longer than necessary — matches how `DriverIdentityVerification` avoids
  storing raw Smile ID responses). This is not created in Slice 1; sketched
  here so the eventual migration doesn't have to guess at Slice 1's
  assumptions.
- **A provider-adapter interface, when built, mirrors the established pattern**
  (`IdentityVerificationProvider`, `PaymentProviderAdapter`, `PayoutProvider`):
  one interface, a real class per vendor, DI-token-injected — never a fake
  "cleared" state before a real vendor is wired.
- **Driver activation (DPX-DRIVER-002 Phase 4) does not gate on this.** Slice 1
  activates a driver once identity + documents + inspection + agreement are
  all satisfied. When DPX-DRIVER-003 ships, whether it becomes a hard gate
  (blocks activation) or a soft flag (activates the driver, flags the account
  for review) is itself a founder decision at that time — not decided here.

## Why this is safe to defer

The founder's own reasoning, recorded because it's the actual justification for
not blocking Slice 1 on this: Smile ID's identity/liveness check, the mandatory
physical inspection (DPX-DRIVER-002 Phase 3 — an in-person check a criminal
background check cannot substitute for), and manual document review together
form a real security baseline. A missing background-check integration is a
named, honest gap — not a silently-skipped one — the same discipline this
platform has applied to every other deferred capability (SIM-card-change
detection, rooted-device detection, etc. in `docs/DPX-DRIVER-001-SECURITY-STANDARD.md`).
