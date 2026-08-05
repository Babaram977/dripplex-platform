# ADR-0002: Figma Protection Boundary for DPX-OPS-001

- Status: Accepted
- Date: 2026-08-05

## Context

DPX-OPS-001 (Operations Command Centre) reads real platform data directly
out of Postgres — `Ride`, `RideOffer`, `RideTracking`, `DriverAvailability`,
`SosAlert`, and more — to build an internal, operator-facing console
(`apps/operations-console`). That console shares two things with the
customer/driver/merchant apps whose screens are Figma-derived and
founder-approved: the same backend, and the same `packages/ui` component
library.

Sharing the backend is inherently safe: reading data does not change how
any other app renders it. Sharing `packages/ui` is not automatically safe —
if a future slice (or a future session that didn't have this context)
edited a Locked shared component to accommodate an Operations Console
visual need, that change could silently propagate into an already
founder-approved, Figma-derived screen elsewhere (Ride, Marketplace,
Wallet, Driver), without anyone realizing the two were coupled.

## Decision

Operations Command Centre work (DPX-OPS-001, and any future initiative of
the same shape — a new internal app reading platform data and sharing
`packages/ui`/backend with Figma-derived apps) may never modify the
appearance, layout, typography, spacing, colors, gradients, icons,
animations, responsive behaviour, or interaction patterns of an existing
Figma-derived screen (Ride, Marketplace, Wallet, Driver), and may never
change a Locked `packages/ui` component's existing rendering to satisfy an
Operations Console requirement.

Where Operations Console needs a visual pattern a shared component doesn't
already support: build a new Operations-specific component, or extend the
shared component in a strictly additive/backward-compatible way whose
defaults reproduce existing rendering exactly. A backend read integration
is never, by itself, justification to redesign existing UI. Figma remains
the visual source of truth wherever an approved Figma source exists.

Each DPX-OPS-001 slice's Production Audit must include an explicit
regression check against this boundary before that slice is considered
complete.

Full text of the rule, rationale, and the regression-check procedure:
`docs/DPX-OPS-001-FIGMA-PROTECTION-RULE.md`.

## Consequences

- Operations Console's own components live entirely under
  `apps/operations-console/src/components/` — verified true for Slices 1-3
  retroactively, and required going forward.
- Any `packages/ui` diff touched by an Operations Command Centre commit
  gets scrutinized line-by-line during that slice's Production Audit: a new
  component file or an additive, default-preserving prop passes; anything
  that changes existing rendering does not, and needs its own separate
  founder approval first.
- This does not block Operations Console's own visual design from evolving
  freely — it has no Figma source and isn't a Figma-derived product
  surface, so this ADR doesn't constrain it, only what it's allowed to do
  to shared/frozen surfaces.
