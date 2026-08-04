# DPX-900 — Driver Security & Trust

Founder-authored standard (2026-08-04), tracked here against the real state of
the codebase as DPX-DS-001 (docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md
and its addendum) lands. Updated honestly as work ships — an unchecked box
here means the capability genuinely doesn't exist yet, not that it's assumed
or deferred without saying so.

**This checklist's authoritative, locked successor is
`docs/DPX-DRIVER-001-SECURITY-STANDARD.md`** — check that document for the
current policy; this one remains as the founder's original item-by-item
checklist, kept in sync but not the primary reference going forward.

## Checklist

- [x] **Device binding implemented** — `DriverVerifiedDevice` (SHA-256 device
      fingerprint per driver); an unrecognized device on "go online" fires
      `NEW_DEVICE` and requires re-verification.
- [x] **Driver facial verification** — provider-agnostic
      `IdentityVerificationProvider` interface; `SmileIdProvider` is the real,
      complete first implementation (real HMAC-SHA256 request signing, real
      `submit_job` shape). Environment-blocked only on live credentials, the
      same state every other external vendor integration in this codebase is in
      without sandbox access — not a stub.
- [x] **Risk-based online verification** — full engine, first-match-wins:
      locked-account short-circuit → already-flagged (credential change /
      failed-login lockout / phone number change / account recovery / manual
      admin) → onboarding → first login of the day (Africa/Lagos) → idle timeout
      → new device → GPS anomaly → suspicious activity (open fraud signal) →
      1-in-20 random spot-check. Never required before every trip.
- [ ] **Liveness detection** — delegated to Smile ID's SmartSelfie product,
      which performs liveness server-side as part of its verification job. Not
      independently built or verified in this codebase, and not confirmable
      end-to-end until real Smile ID credentials exist.
- [x] **Suspicious login detection** — `LoginAttemptService`'s existing
      per-email lockout (platform-wide, not driver-specific) now emits
      `LOGIN_LOCKED`, which requires driver re-verification on the next
      successful login. Existing `FraudSignal` records (OPEN/UNDER_REVIEW) also
      gate going online.
- [ ] **Device change alerts** — a new device requires re-verification, but
      no notification (push/email/SMS) is sent to the driver when it happens.
      Real gap — a driver whose account is compromised has no out-of-band signal
      that a new device was used.
- [x] **GPS anomaly detection** — implied speed between the driver's last
      known position and a new "go online" position, computed via haversine
      distance ÷ elapsed time. >150 km/h requires re-verification (tuned for a
      ride-hailing context, not general "impossible travel" heuristics). A 5-minute
      minimum elapsed-time floor guards against GPS-jitter false positives.
- [ ] **Account-sharing detection** — no dedicated model or score. Addressed
      only indirectly, as a side effect of `NEW_DEVICE`, `GPS_ANOMALY`, and
      `RANDOM_SPOT_CHECK` firing when an account is actually being shared.
- [x] **Biometric verification audit logs** — `DriverIdentityVerification`
      (append-only): timestamp, device ID, IP address, latitude/longitude (when
      permitted), confidence score, provider, trigger, session ID, and result
      for every verification attempt.
- [ ] **Driver trust score** — not started. No scoring model exists anywhere
      in the platform.
- [x] **Extensible/configurable design** — the three DPX-DS-001 risk-engine
      thresholds (lockout-attempt count, GPS-anomaly speed, spot-check
      denominator) are read from `AppConfigService` getters backed by
      `DRIVER_IDV_*` env vars, not hard-coded constants.

## Known gaps not on the founder's original list

- **SIM-card-change detection** — not built. No telecom/carrier integration
  exists anywhere in this backend, and there's no way to observe a SIM swap
  from this stack.
- **Phone-number-change detection** — `PHONE_NUMBER_CHANGED` is reserved in
  the `DriverVerificationTrigger` enum but not wired to anything, because
  there's no self-service "change my phone number" flow for an _existing
  verified_ account anywhere in the platform (the only phone-mutation code
  path is the one-time OTP verification during onboarding).
- **Lockout threshold and GPS-anomaly speed threshold are env-configurable, not
  admin-panel-configurable** — `DRIVER_IDV_LOCKOUT_THRESHOLD`,
  `DRIVER_IDV_GPS_ANOMALY_SPEED_KMH`, and `DRIVER_IDV_SPOT_CHECK_DENOMINATOR`
  are real env vars (`env.validation.ts` → `AppConfigService`), changeable at
  deploy time without a code change. A live in-app admin control panel
  (database-backed, editable without a redeploy) is a reasonable future
  follow-up, not invented here.
- **Email-change, BVN/NIN-update, and driver-licence-update re-verification
  triggers** — not built. None of these flows exist anywhere in the platform
  to hook a trigger onto: no self-service email-change endpoint, no BVN/NIN
  concept in the schema, no distinct "update my licence" event separate from
  the one-time KYC document upload. See Addendum 2 in
  docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md for the full reasoning.
- **Rooted/jailbroken device detection** — not built, not feasible from
  `driver-portal` (a Next.js web app). Requires native-app platform attestation
  APIs (Play Integrity / DeviceCheck) that don't exist in this architecture.

See docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md for the full technical
design, including the addenda documenting every DPX-DS-001 decision.
