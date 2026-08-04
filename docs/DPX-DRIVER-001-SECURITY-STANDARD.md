# DPX-DRIVER-001 — Driver Security Standard

**Status: Approved — Founder-Locked (2026-08-04).** This is the authoritative
reference for driver authentication, risk-based facial verification, device
trust, session management, audit logging, and security event policy across
the Driver module. It consolidates and supersedes the narrative design notes
(`DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md`, `DPX-900-DRIVER-SECURITY-TRUST.md`)
as the single place to check "what's the policy" — those two docs remain as
the detailed implementation history and stay in sync with this one, but this
document is what a future change should be checked against before it ships.

Locked the same way Ride, Marketplace, and Wallet's production standards were
frozen after founder sign-off (`docs/DPX-100-MODULE-COMPLETION-GATE.md` item
10): a change to any policy value or trigger described here needs an explicit
founder decision, not a code change made in passing. The one exception is the
admin-configurable settings in §3 — those are _designed_ to change without a
redeploy, by an authorized admin, through the settings API in §3.4.

## 1. Driver authentication

- **Credentials.** Email/password (bcrypt, `BCRYPT_SALT_ROUNDS`, default 12
  rounds) plus phone-OTP verification during onboarding. Shared
  `AuthService`/`LoginService` used by every portal — no driver-specific
  login path exists or is planned; the differentiation between a driver
  session and any other portal's session is the `portal` claim on the issued
  JWT and `AuthSession.portal`.
- **Failed login lockout.** `LoginAttemptService`, platform-wide (not
  driver-specific): `LOGIN_MAX_ATTEMPTS_PER_EMAIL` (default 10) failed
  attempts locks the account for `LOGIN_LOCKOUT_SECONDS` (default 900s /
  15min). This was explicitly reconfirmed as platform-wide, not forked for
  drivers — see §7's decision log.
- **Session tokens.** JWT access (`JWT_ACCESS_TTL`, default 15m) + refresh
  (`JWT_REFRESH_TTL`, default 7d) pair, refresh token hash stored on
  `AuthSession`. `AuthenticatedUser.sid` carries the session ID through every
  authenticated request — this is the field DPX-DRIVER-001's audit trail
  (§5) captures.

## 2. Risk-based facial/identity verification

Provider-agnostic (`IdentityVerificationProvider` interface, `SmileIdProvider`
the first real implementation — HMAC-SHA256 request signing, real
`submit_job` shape, environment-blocked only on missing live credentials).
**Never required before every trip** — that would be unusable friction for a
working driver. `DriverIdentityVerificationService.checkRequired()` evaluates
these triggers in priority order (first match wins):

1. **Locked account** — short-circuits everything; only a support-review
   unlock (§6) clears it.
2. **Already flagged** — a prior FAILED/ERROR result, or an event-driven flag
   (`CREDENTIAL_CHANGE`, `FAILED_LOGIN_LOCKOUT`, `ACCOUNT_RECOVERY`,
   `MANUAL_ADMIN`) — stays required until a PASSED result clears it.
3. **`ONBOARDING`** — never verified before.
4. **`FIRST_LOGIN_OF_DAY`** — the calendar date (Africa/Lagos, UTC+1, no DST)
   of the last verification differs from today.
5. **`IDLE_TIMEOUT`** — longer than the configured idle interval (§3) since
   last verified.
6. **`NEW_DEVICE`** — the go-online device fingerprint isn't in
   `DriverVerifiedDevice` (toggleable, §3).
7. **`GPS_ANOMALY`** — implied speed (haversine distance ÷ elapsed time)
   between the last known position and the new one exceeds the configured
   threshold (§3), with a 5-minute minimum-elapsed-time floor to avoid
   GPS-jitter false positives.
8. **`SUSPICIOUS_ACTIVITY`** — an open (`OPEN`/`UNDER_REVIEW`) `FraudSignal`
   for the driver.
9. **`RANDOM_SPOT_CHECK`** — a configurable-odds roll (§3), only on a real
   "go online" attempt, never on a passive status read.

On failure: the driver is taken offline immediately
(`DriverAvailability.online/acceptingRides = false`) and must re-verify
before going online again. `DriverProfile.failedVerificationAttempts`
increments on FAILED/ERROR and resets on PASSED.

## 3. Admin-configurable risk-engine settings

Per the founder's explicit requirement — "these values should come from
configuration... not hard-coded values" — the risk engine's numeric
thresholds and two feature toggles are **not compiled into the
application**. They live in `DriverSecuritySettings`, a single admin-editable
database row, changeable without a redeploy.

### 3.1 Settings

| Setting                               | Field                           | Default                    | Notes                                                                                                                           |
| ------------------------------------- | ------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Offline (idle) verification interval  | `idleHours`                     | **2 hours**                | Reconfirmed by the founder (2026-08-04), tightened from the original 6-12h range's 8h midpoint.                                 |
| GPS-anomaly implied travel speed      | `gpsAnomalySpeedKmh`            | **150 km/h**               | Reconfirmed as "what's live now" over a later message's 900 km/h.                                                               |
| Failed-verification lockout threshold | `lockoutThreshold`              | **5 consecutive failures** | Reconfirmed as immediate lockout at this count — not gated behind a login-lockout cadence.                                      |
| Random spot-check odds                | `spotCheckDenominator`          | **1-in-20**                | Rolled only on a real go-online attempt.                                                                                        |
| New-device verification               | `newDeviceVerificationEnabled`  | **on**                     | When off, the `NEW_DEVICE` trigger is skipped entirely — an emergency kill-switch, not expected to be used in normal operation. |
| Admin force-verification              | `adminForceVerificationEnabled` | **on**                     | Gates the `MANUAL_ADMIN` "require verification" admin action (§6) — a kill-switch for that specific capability.                 |

### 3.2 What is _not_ admin-configurable, and why

- **`GPS_ANOMALY_MIN_INTERVAL_MS`** (5-minute jitter floor) — a false-positive
  guard, not a security threshold the founder specified. Stays a constant in
  `driver.constants.ts`.
- **Priority order of the trigger chain** (§2) — this is enforcement logic,
  not a tunable value; changing it is a code change reviewed like any other.
- **Which events set `CREDENTIAL_CHANGE`/`FAILED_LOGIN_LOCKOUT`** (§7) —
  these are wired to real domain events, not configurable toggles, because
  turning them off would mean silently accepting a real risk signal.

### 3.3 How defaults are seeded

Env vars (`IDENTITY_VERIFICATION_IDLE_HOURS`, `DRIVER_IDV_LOCKOUT_THRESHOLD`,
`DRIVER_IDV_GPS_ANOMALY_SPEED_KMH`, `DRIVER_IDV_SPOT_CHECK_DENOMINATOR`) only
seed the `DriverSecuritySettings` row's initial values the first time
`DriverSecuritySettingsService.getEffective()` creates it. After that, the
database row is the source of truth — an admin's change persists across
deploys and does not get reset by the env var.

### 3.4 Settings API

`GET/PATCH /admin/drivers/security-settings`, gated behind
`admin:drivers:security-settings:manage` — deliberately a separate
permission from `admin:drivers:identity-verification:manage` (per-driver
unlock/flag actions), since editing the security _policy_ itself is more
sensitive than a routine per-driver support action. Granted to
`administrator` and `super_administrator` only, not `operations_staff`. Every
update is audit-logged (`driver.security_settings.updated`) with a
before/after diff and the admin's user ID.

## 4. Device trust

`DriverVerifiedDevice` — SHA-256 fingerprint of a client-supplied device
identifier per driver, `firstVerifiedAt`/`lastSeenAt`. A device is "trusted"
only after a PASSED verification from it; an unrecognized fingerprint at
go-online time fires `NEW_DEVICE` (§2, toggleable via §3). Same trust model
as `AuthSession`'s device parsing for Wallet's trusted-devices list — never
raw user-agent alone, but not cryptographic device attestation either
(that would require a native app, see §8).

## 5. Session management & audit logging

Every `DriverIdentityVerification` row (append-only, kept forever) captures:

| Field                              | Source                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `id`, `requestedAt`, `completedAt` | Generated at submit/complete time                                           |
| `driverId`                         | The authenticated driver                                                    |
| `deviceId`                         | Client-supplied device identifier                                           |
| `ipAddress`                        | Request IP                                                                  |
| `latitude`/`longitude`             | If the driver granted location                                              |
| `trigger`                          | Which risk-engine reason required this verification                         |
| `status`                           | `PENDING` → `PASSED`/`FAILED`/`ERROR`                                       |
| `confidenceScore`                  | Provider's match/liveness score                                             |
| `sessionId`                        | `AuthSession.id` behind the caller's access token (`AuthenticatedUser.sid`) |
| `failureReason`                    | Provider's or fail-closed reason, on failure                                |

This is the complete field list the founder's approved standard specified —
timestamp, driver ID, device ID, IP, location, trigger reason, result,
confidence score, session ID. General account-level audit entries
(`AuditLog`, via `AuditService`) are also recorded for every
requested/passed/failed/locked/unlocked/settings-changed event, separate
from this per-attempt table.

## 6. Online/offline security & support actions

- **Going online is gated**: `assertNotRequired()` throws (not silently
  no-ops) if verification is required, and always rolls the random
  spot-check — it's only ever called from a real go-online attempt.
- **`MANUAL_ADMIN`** — a security-team action to force re-verification on an
  account, gated by `admin:drivers:identity-verification:manage` and the
  §3 `adminForceVerificationEnabled` toggle.
- **Support-review unlock** — after a lockout, only an admin `unlock()` call
  clears `DriverProfile.identityVerificationLockedAt` and resets the failure
  counter; the driver still needs a normal PASSED verification afterward.

## 7. Security event policies — decision log

| Trigger                                         | Status                                      | Decision                                                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential change (password, wallet PIN)        | **Built**                                   | `CredentialChangeSubscriber` fires `CREDENTIAL_CHANGE` on `PASSWORD_CHANGED`/`WALLET_PIN_CHANGED` domain events.                                                                                                                      |
| Failed-login lockout                            | **Built**                                   | `FailedLoginLockoutSubscriber` fires `FAILED_LOGIN_LOCKOUT` when the platform-wide per-email lockout trips — immediately, not after a repeated-lockout count (reconfirmed 2026-08-04).                                                |
| Account recovery                                | **Built**                                   | `AccountRecoverySubscriber` fires `ACCOUNT_RECOVERY`.                                                                                                                                                                                 |
| New device                                      | **Built**                                   | See §2/§4.                                                                                                                                                                                                                            |
| GPS anomaly                                     | **Built**                                   | See §2/§3.                                                                                                                                                                                                                            |
| Random spot-check                               | **Built**                                   | See §2/§3.                                                                                                                                                                                                                            |
| Manual admin flag                               | **Built**                                   | See §6.                                                                                                                                                                                                                               |
| Email-change requiring re-verification          | **Gap — no flow exists.**                   | No self-service "change my email" endpoint exists anywhere in the platform to hook a trigger onto.                                                                                                                                    |
| BVN/NIN-update requiring re-verification        | **Gap — concept doesn't exist.**            | BVN/NIN isn't a stored, updatable driver attribute in the schema; Smile ID's `idNumber` is an opaque pass-through string at submission time only.                                                                                     |
| Driver-licence-update requiring re-verification | **Gap — no distinct event.**                | `DRIVER_LICENSE` is only a `KycDocumentType` for the one-time onboarding upload; no separate "update" event exists.                                                                                                                   |
| SIM-card-change detection                       | **Gap — not observable.**                   | No telecom/carrier integration exists in this stack. `PHONE_NUMBER_CHANGED` is reserved in the trigger enum as the closest real proxy, but there's also no self-service phone-number-change flow for an already-verified account yet. |
| Rooted/jailbroken device detection              | **Gap — architecturally infeasible today.** | Requires native-app platform attestation (Play Integrity API / iOS DeviceCheck); `driver-portal` is a Next.js web app with no access to those signals. See §8.                                                                        |
| Reported compromise / suspicious API behaviour  | **Partially built.**                        | Covered by the existing `FraudSignal`/`SUSPICIOUS_ACTIVITY` mechanism (fraud module), not a distinct driver-specific event.                                                                                                           |

## 8. Future native-app security (deferred, not built)

Several items on the founder's original standard require capabilities a
native mobile app has and a web portal does not:

- **Rooted/jailbroken device detection** — Play Integrity API (Android) /
  DeviceCheck (iOS). Not buildable from `driver-portal` today.
- **Stronger device attestation** — hardware-backed device identity beyond
  the SHA-256 fingerprint in §4.
- **Push-based out-of-band device-change alerts** — flagged as a real gap in
  `DPX-900-DRIVER-SECURITY-TRUST.md` independent of native-app status
  (this one is buildable today via the existing notification infrastructure,
  just not yet built).

These are not silently deferred — they're named here so the Driver Figma
port and any future native-app initiative know exactly what security
capability needs picking up, rather than rediscovering the gap.

## 9. Figma-first process (standing rule, not specific to security)

Per the founder's explicit correction (2026-08-04): this standard describes
**backend capability only**. No driver-facing UI screens exist for facial
verification, the locked-account state, or any security settings — and none
should be built ad hoc. `driver-portal` only sends the signals the risk
engine needs (device ID, location) and falls through to its existing generic
error state on a block. The actual capture/verification-required/locked-out
screens ship when the Driver module's Figma designs are ported, matching
this platform's Figma → Shared UI → Backend → Verification discipline.

## Related documents

- `docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md` — full implementation
  history and reasoning, including the DPX-DS-001 addendum and the Addendum
  2 reconciliation against this standard's later revisions.
- `docs/DPX-900-DRIVER-SECURITY-TRUST.md` — the founder's original checklist,
  tracked item-by-item against real code.
- `docs/DRIVER-APP-DPX-100-AUDIT.md` — where facial verification sits in the
  overall Driver module reality audit and slice plan.
