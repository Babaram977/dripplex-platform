# DPX-901 — Configuration-Driven Security Policy

Established by the founder on approval of `docs/DPX-DRIVER-001-SECURITY-STANDARD.md`,
as a permanent engineering principle — not scoped to the Driver module. It applies
to every security-relevant threshold, interval, risk score, and enforcement toggle
built from here on, alongside the DPX-100 methodology and the
[Module Completion Gate](./DPX-100-MODULE-COMPLETION-GATE.md).

## The rule

> All platform-wide security policies must be configuration-driven whenever
> practical. Thresholds, verification intervals, risk scores, feature toggles,
> and enforcement rules live in configuration — or, where they need to change
> without a redeploy, in a database-backed admin setting — not hard-coded into
> application logic.

## What this looks like in practice

DPX-DRIVER-001's risk engine is the reference implementation: the lockout
threshold, GPS-anomaly speed, spot-check odds, idle-verification interval, and
the new-device/admin-force-verification toggles all live in `DriverSecuritySettings`
(a single admin-editable database row, `apps/backend/src/drivers/identity-verification/driver-security-settings.service.ts`),
seeded from env vars on first creation but authoritative afterward. An admin
with `admin:drivers:security-settings:manage` changes policy through
`GET/PATCH /admin/drivers/security-settings` — no code change, no redeploy.

Two-tier approach, applied in this order of preference:

1. **Database-backed admin setting** — when the value is something a security
   or ops team member should reasonably be able to tune in production without
   engineering involvement (a threshold, a window, a kill-switch). This is the
   default choice for anything genuinely operational.
2. **Environment variable** — when the value is deployment-specific but not
   something that should change without a deliberate config/infra change (e.g.
   provider credentials, base URLs, structural limits). Still not hard-coded,
   but doesn't need a full settings-service/audit-log treatment.

What stays a plain code constant: values that are false-positive guards or
internal implementation details, not security thresholds the founder or an
admin would tune (e.g. DPX-DRIVER-001's GPS-jitter floor), and enforcement
_logic_ itself (priority ordering, which events fire which triggers) — those
are code changes, reviewed like any other, not configuration.

Every admin-editable security setting must be audit-logged with a before/after
diff and the acting admin's identity — see DPX-DRIVER-001 §3.4/§5 for the
concrete pattern (`DriverSecuritySettingsService.update()`,
`driver.security_settings.updated` audit action).

## Where this applies going forward

This principle isn't limited to Driver. It's the standard for:

- **Wallet** — spending limits, withdrawal thresholds, fraud-review score
  cutoffs, session/PIN-retry limits.
- **Marketplace** — fraud-signal thresholds, review-moderation auto-flag
  scores, checkout velocity limits.
- **Ride** — dispatch radius, surge triggers, cancellation-penalty thresholds,
  driver-rating suspension cutoffs.

None of these are being retrofitted as part of this principle's adoption —
each module is frozen and only gets touched for verified defects or an
explicit founder-directed change, per the DPX Freeze Rule. This principle
governs _new_ security-relevant work in any module from here on, and is the
bar a reopened module's security-adjacent thresholds should be held to.

## How this interacts with the Module Completion Gate

A module's production audit (gate item 9) should call out, explicitly, which
security-relevant values are configuration-driven and which remain hard-coded
constants with a stated reason — the same honesty discipline the gate already
requires for missing capabilities. An unreviewed hard-coded security threshold
found later is a defect against this principle, not a style preference.
