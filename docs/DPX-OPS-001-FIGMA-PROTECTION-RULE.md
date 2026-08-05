# Figma Protection Rule — DPX-OPS-001

**Status: 🔒 Standing instruction, founder-issued (2026-08-05). Binding on
every future DPX-OPS-001 slice, and on any other backend-reads-into-a-new-UI
work that follows this same pattern. This is not scoped to Slice 3 — it is
scoped to the whole Operations Command Centre initiative, and to
`packages/ui` wherever Operations Console is a consumer.**

## Why this exists

DPX-OPS-001 (Operations Command Centre) reads real platform data — `Ride`,
`RideOffer`, `RideTracking`, `DriverAvailability`, `SosAlert`, and so on —
directly out of Postgres to build an internal, operator-facing console. That
console is a genuinely separate application (`apps/operations-console`),
but it shares two things with the customer/driver/merchant apps whose
screens are Figma-derived and founder-approved: the same backend, and the
same `packages/ui` component library. Sharing the backend is safe — reading
data doesn't change how any other app renders. Sharing `packages/ui` is the
one place drift could happen, if a future session ever edited a Locked
shared component's existing rendering to make it fit an Operations Console
need. This document exists so that never happens, in this session or a
future one, human or agent.

## The rule, verbatim (founder, 2026-08-05)

> All previously implemented and Founder-approved Figma-derived screens are
> visually frozen.
>
> DPX-OPS-001 must not modify the appearance, layout, typography, spacing,
> colors, gradients, icons, animations, responsive behaviour, or interaction
> patterns of existing Ride, Marketplace, Wallet, or Driver screens.
>
> Do not modify a Locked `packages/ui` component in a way that changes its
> existing rendering to satisfy Operations Console requirements.
>
> If Operations Console needs a different visual pattern, create a new
> Operations-specific component or make only strictly additive/
> backward-compatible extensions whose defaults preserve the existing
> rendering exactly.
>
> Before completing each OPS slice, run regression checks against affected
> shared components/apps.
>
> Backend read integrations must not be used as justification to redesign
> existing Figma-derived UI.
>
> Figma remains the visual source of truth wherever an approved Figma source
> exists.

## What this means in practice

- **Frozen Ride UI stays frozen.** DPX-OPS-001 slices read `Ride`,
  `RideOffer`, `RideTracking`, `DriverAvailability`, etc.; they do not
  rebuild, restyle, or duplicate the customer-facing Ride screens
  (`apps/customer-web/src/components/ride/`, `docs/DDS-002-*`). Reading data
  is not the same as touching UI.
- **Operations Console is its own app.** Its screens live in
  `apps/operations-console`. Its own components (e.g.
  `ride-status-badge.tsx`, `dispatch-exception-banner.tsx`,
  `dispatch-candidates-panel.tsx`) may look however operations work needs
  them to look — they are not Figma-derived, so nothing here restricts
  their design. What's restricted is anything shared.
- **`packages/ui` is the one real risk.** If Operations Console needs a
  visual pattern a shared component doesn't already support:
  - Prefer a **new, Operations-specific component**, in
    `apps/operations-console/src/components/` (as every Slice 1-3 component
    has been so far) — not a shared one.
  - If a shared component genuinely needs extending, only **additive,
    backward-compatible** changes are allowed: new optional props with
    defaults that reproduce the exact current rendering for every existing
    caller. A prop whose absence changes existing output, or a default that
    shifts existing layout/color/spacing by even one pixel, does not
    qualify.
  - Changing a Locked shared component's existing rendering — even
    "slightly," even for a good operational reason — is out of scope for
    DPX-OPS-001 and needs its own separate founder approval, the same way
    DPX-RIDE-201 Ride mutations do.
- **Marketplace and Wallet are out of scope entirely** for DPX-OPS-001.
  Nothing in this initiative touches `apps/customer-web`'s Marketplace or
  Wallet screens, or their `packages/ui` usage, at all.
- **Backend reads are not a redesign license.** The fact that Operations
  Console can now see real `Ride`/driver/dispatch data is never a
  justification for changing how that same data is _rendered_ anywhere it
  already ships to customers, drivers, or merchants.
- **Figma stays the visual source of truth** wherever an approved Figma
  source exists (Ride, Marketplace, Wallet, Driver). Operations Console has
  no Figma source — it is an internal operational tool, not a Figma-derived
  product surface, and this rule does not require one.

## Regression check, before completing each OPS slice

Each DPX-OPS-001 slice's own Production Audit doc must include an explicit
check (not merely an assertion) that:

1. `git diff` for the slice touches nothing under
   `apps/customer-web/src/components/`, `apps/driver-portal/src/components/`
   (or their app-level page/route trees) except where that slice's own
   explicit scope says otherwise (it hasn't, for Slices 1-3).
2. Any `packages/ui` file the slice touched is inspected line-by-line: if
   the diff is anything other than a new component file, or an additive
   prop with a default that reproduces prior output, that's a violation to
   flag and fix before the audit can pass.
3. Where practical, a visual check (screenshot or the app's own build
   output) of one representative Ride/Marketplace/Wallet/Driver screen
   confirms no visible change.

Slices 1-3 of DPX-OPS-001 already satisfy this retroactively: every new
component so far was added under `apps/operations-console/src/components/`,
and zero files under `packages/ui`, `apps/customer-web`, or
`apps/driver-portal` were modified by any Operations Command Centre slice
to date (verified by re-checking the diffs of commits `2026-08-04` through
`2026-08-05` covering Slices 1-3).

## Scope of this standing instruction

This rule is not a one-time note for Slice 3. It stands for:

- The remainder of DPX-OPS-001 (Slice 4 — Analytics — and any later
  refinement rounds on Slices 1-3).
- Any future initiative with the same shape: a new internal/operator-facing
  application that reads existing platform data and shares
  `packages/ui`/backend with Figma-derived customer/driver/merchant apps.

A future Claude or Codex session picking up DPX-OPS-001 (or a similarly
shaped initiative) should read this document before touching anything
under `packages/ui`, and should treat "Operations Console needs X" as never,
by itself, sufficient reason to change a Locked shared component's existing
rendering.

See also: `docs/DPX-OPS-001-OPERATIONS-COMMAND-CENTRE.md` (scope record),
`docs/DPX-OPS-001-REALITY-AUDIT.md` (audit/plan/approval record),
`docs/design/DPX-001-DRIPPLEX-DESIGN-LANGUAGE.md` (platform design-language
stub), `docs/DDS-002-RIDE-DESIGN-SYSTEM.md` / `docs/DDS-002-RIDE-UI-KIT.md`
(the Ride-specific Figma lock this rule protects).
