# Driver-001 — Risk-Based Facial/Identity Verification Design Note

Written before implementation, per the same "design note before code" discipline as
`RIDE-002.7-WALLET-PAYMENT-DESIGN.md` and `WALLET-004-WITHDRAW-DESIGN.md`. Locks the
founder's requirements into concrete decisions before touching schema or service code.

**This is the implementation history.** For the authoritative, founder-locked
policy reference, see `docs/DPX-DRIVER-001-SECURITY-STANDARD.md` — this
document remains the detailed design/decision record and stays in sync with
it, but the standard doc is what a future change should be checked against.

## Founder's requirements (verbatim scope)

- Smile ID as the initial provider, chosen for DrippleX's launch market (Nigeria/Africa).
- Driver KYC during onboarding: NIN/BVN where applicable, driver's licence verification,
  selfie/liveness.
- Risk-based re-verification when: a driver comes online after being offline for a
  configurable idle period (6-12h), logs in on a new device, triggers a suspicious-activity
  signal, or completes account recovery. **Not** before every trip.
- On failure: keep the driver offline immediately, require re-verification before they can
  try again.
- Every verification event logged: timestamp, device ID, location (if permitted),
  confidence score, result — for audit.
- Core production security feature, not optional.
- Provider-agnostic: a real `IdentityVerificationProvider` interface, Smile ID as the first
  implementation, swappable for Onfido/AWS Rekognition/etc. later without touching the
  Driver module's own logic.

## Reality audit (verified before writing code)

**No identity/facial verification infrastructure exists anywhere in the platform.**
`IdentityVerification` (existing model) is unrelated — it's OTP-based email/phone
verification (`otpHash`, `tokenHash`), not biometric. The Figma auth flow's "biometric"
screen is device Face ID/Touch ID app-unlock (WebAuthn), a different, already-documented
gap in Wallet Security — not identity-proofing. `DriverKyc` today is a flat
document-upload model (front/back image, manual admin review) with no selfie/liveness
step and no vehicle-registration structured data (`VEHICLE_REGISTRATION` is just a
`KycDocumentType`, an uploaded file).

**Smile ID's real API surface** (confirmed via their public docs/SDK repos, not
fabricated): signature scheme is `HMAC-SHA256(key=api_key, message=timestamp + partner_id

- "sid_request")`, base64-encoded, sent alongside `partner_id`/`timestamp`on every
request.`submit_job`is the primary endpoint for SmartSelfie enrollment/authentication
and Biometric KYC;`get_job_status` retrieves results. No sandbox credentials exist in
this environment — same situation as every other external vendor already integrated in
this codebase (Paystack/Flutterwave/OPay, the payout providers, Firebase before Phase D).
**Decision, matching that exact precedent** (`PaystackTransferProvider`): a real
`SmileIdProvider`class, real signing helper, real request-shape builder, throwing a clear
"not configured" error on the actual network call until`SMILE_ID_PARTNER_ID`/
`SMILE_ID_API_KEY` are set — never a fake "verified" result.

**Backward-compatibility problem this design must solve.** If every driver's
"verification required" state defaults to "yes, unverified," every existing seeded/
approved driver becomes instantly locked out of going online the moment this ships —
including in this dev/test environment, where Smile ID can never actually succeed (no
credentials), which would make the driver dispatch test suite and every Playwright driver
flow permanently broken. **Decision:** the migration backfills `lastIdentityVerifiedAt =
now()` for every existing `DriverProfile` row. This is the same reasoning a real production
rollout would use — you don't retroactively lock out your entire existing driver base the
moment a new gate ships; the gate applies to trigger conditions occurring _after_ it's
live (an existing driver's next idle-timeout window, next new device, etc.), not to
history that predates the feature. New driver signups after this ships get `NULL` and
must complete real enrollment — which is honestly, environmentally blocked here, same as
gateway top-up funding for a brand-new wallet.

## Data model

```prisma
enum IdentityVerificationProvider {
  SMILE_ID
}

enum DriverVerificationTrigger {
  ONBOARDING
  IDLE_TIMEOUT
  NEW_DEVICE
  SUSPICIOUS_ACTIVITY
  ACCOUNT_RECOVERY
  MANUAL_ADMIN
}

enum DriverVerificationStatus {
  PENDING
  PASSED
  FAILED
  ERROR
}

model DriverIdentityVerification {
  id                 String                        @id @default(uuid())
  driverId            String                        (→ User)
  provider            IdentityVerificationProvider
  trigger              DriverVerificationTrigger
  status               DriverVerificationStatus      @default(PENDING)
  confidenceScore      Decimal?                       // 0-100, provider's match/liveness score
  providerReference    String?                        // Smile ID's job_id, once real
  deviceId             String?                        // client-supplied device identifier
  ipAddress            String?
  latitude             Decimal?                       // only if the driver granted location
  longitude            Decimal?
  failureReason         String?
  requestedAt           DateTime  @default(now())
  completedAt           DateTime?
  createdAt             DateTime  @default(now())

  @@index([driverId, createdAt(sort: Desc)])
}

// on DriverProfile
lastIdentityVerifiedAt              DateTime?
identityVerificationRequiredReason  DriverVerificationTrigger?  // null = not required

model DriverVerifiedDevice {
  driverId          String    (→ User)
  deviceFingerprint String    // SHA-256 of a client-supplied device ID (never raw UA alone —
                               // spoofable, but this is the same trust level as every other
                               // device-recognition signal already in this platform, e.g.
                               // AuthSession's device parsing for Wallet's trusted-devices list)
  firstVerifiedAt   DateTime  @default(now())
  lastSeenAt        DateTime  @updatedAt

  @@id([driverId, deviceFingerprint])
}
```

`DriverIdentityVerification` is the append-only audit trail (every attempt, pass or fail,
kept forever — this is the record a compliance review or incident investigation needs).
`DriverProfile.identityVerificationRequiredReason` is the live enforcement flag — cheap to
check on every "go online" call without scanning the log table.

## Provider interface (provider-agnostic, per the founder's explicit ask)

```ts
interface IdentityVerificationProvider {
  readonly provider: IdentityVerificationProviderEnum;
  enroll(input: EnrollInput): Promise<VerificationResult>;
  verify(input: VerifyInput): Promise<VerificationResult>;
}

interface VerificationResult {
  status: 'PASSED' | 'FAILED' | 'ERROR';
  confidenceScore?: number;
  providerReference?: string;
  failureReason?: string;
  raw?: unknown;
}
```

Exactly the same shape discipline as `PayoutProvider`/`PaymentProviderAdapter` — one
interface, real class per vendor, injected by a DI token so
`DriverIdentityVerificationService` never imports `SmileIdProvider` directly. Adding
Onfido or AWS Rekognition later means writing one new class against this interface and
swapping the DI binding — zero changes to the risk engine, the enforcement logic, or the
audit-log schema.

## Risk engine (when re-verification is required)

`DriverIdentityVerificationService.checkRequired(driverId, context)` runs on every
`POST /driver/rides/availability` call that sets `online: true`, in this priority order
(first match wins, since only one `trigger` reason is stored at a time):

1. **Already flagged** — `identityVerificationRequiredReason` is non-null from a prior
   failure/admin action → stays required until a PASSED verification clears it.
2. **Idle timeout** — `lastIdentityVerifiedAt` is null, or older than
   `IDENTITY_VERIFICATION_IDLE_HOURS` (env-configurable, default 8, within the founder's
   6-12h range) → `IDLE_TIMEOUT` (or `ONBOARDING` if never verified at all).
3. **New device** — the request's device fingerprint has no `DriverVerifiedDevice` row for
   this driver → `NEW_DEVICE`.
4. **Suspicious activity** — an unresolved `FraudSignal` exists against this driver's
   `userId` (reusing the platform's existing `FraudModule`, not a new detector — this
   module already exists and is wired for admin review) → `SUSPICIOUS_ACTIVITY`.
5. **Account recovery** — a password-reset completed for this driver since their last
   verification → `ACCOUNT_RECOVERY`, set directly by the auth flow, not computed here.

If none match, availability update proceeds normally — no verification prompt on a normal
"go online" for a recently-verified driver on a known device. This satisfies "not before
every trip" directly: the check only runs on the online-toggle action, and only blocks
when one of the five conditions is actually true.

## Enforcement

- `checkRequired` returning non-null **blocks** `updateDriverAvailability` when
  `dto.online === true` — throws a domain exception (never a silent no-op). Going offline
  is never blocked. Driver-portal sends `deviceId`/`latitude`/`longitude` on every
  go-online attempt so the risk engine has what it needs, but deliberately does not
  render any custom UI around a blocked attempt (see "UI correction" below) — a blocked
  attempt currently falls through to the existing generic "couldn't update status" error.
- `submitVerification(driverId, selfie, context)` calls the bound provider's `verify()` (or
  `enroll()` for a first-time `ONBOARDING` trigger), writes the `DriverIdentityVerification`
  row with every required audit field, and:
  - **PASSED** — clears `identityVerificationRequiredReason`, sets
    `lastIdentityVerifiedAt = now()`, upserts `DriverVerifiedDevice` for this fingerprint.
  - **FAILED** — force-sets `DriverAvailability.online = false` if the driver is currently
    online (covers the case where a mid-session risk signal fires), keeps the required
    flag set, driver must retry.
  - **ERROR** (provider unreachable/misconfigured) — same as FAILED for enforcement
    purposes (fail closed, not open) but recorded distinctly for ops triage.

## API surface

```
GET  /driver/identity-verification/status   { required: boolean, reason, lastVerifiedAt }
POST /driver/identity-verification/submit   { selfieImage, deviceId, latitude?, longitude? }
                                             → runs enroll() or verify() depending on trigger
```

`updateDriverAvailability` (existing endpoint) gains the `checkRequired` gate; no new
endpoint needed there.

## Out of scope for this pass

- The actual Smile ID network call succeeding — environment-blocked, no credentials, same
  as every other external vendor in this codebase without sandbox access.
- Vehicle management, shift management, support — separate, unblocked items from
  `docs/DRIVER-APP-DPX-100-AUDIT.md`'s slice plan; not part of this founder request.
- A configurable per-driver or per-admin override of the idle-timeout window — one
  platform-wide env var is the v1; a future admin control panel setting is a reasonable
  follow-up, not invented here.
- **Any driver-facing UI.** DrippleX's process is Figma → Shared UI → Backend →
  Verification, never Backend → Invent UI → Verify. This slice ships the backend
  capability only (API, SDK client, risk engine, provider integration, audit logging,
  permissions) — no login page, capture screen, or "verification required" screen was
  built, and none should be until the Driver module's Figma designs exist and are ported.
  An earlier pass of this work briefly shipped a hand-built selfie-capture drawer; it was
  removed on founder correction (2026-08-04) for violating this process. The backend gate
  is fully functional today via `curl`/the SDK; the driver-portal only sends the signals
  (`deviceId`, `latitude`/`longitude`) the risk engine needs and otherwise falls through to
  its existing generic error state when blocked.

---

## Addendum: DPX-DS-001 — Driver Security Standard (expanded scope)

Founder follow-up formalized the risk-based verification above into a named platform
standard with a larger trigger set. This addendum documents the additional decisions,
each locked in before implementation:

| Question                                         | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GPS-anomaly implied-speed threshold              | **150 km/h** — tuned for a ride-hailing driver context (catches same-day account-sharing across cities), not the looser "commercial flight speed" heuristic generic account-security tools use.                                                                                                                                                                                                                                                                                                                                                                                                          |
| Consecutive verification failures before lockout | **5** — after 5 failed attempts in a row, the driver account is locked (`DriverProfile.identityVerificationLockedAt`); only an admin unlock clears it. Below 5, the driver can keep retrying (kept offline the whole time).                                                                                                                                                                                                                                                                                                                                                                              |
| SIM-card-change detection                        | **Not built.** No telecom/carrier integration exists anywhere in this backend, and there is no way to observe a SIM swap from this stack. Closest real proxy — "the driver's registered phone number changed" — was approved, but there is also no self-service "change my phone number" flow for an _existing verified_ account anywhere in the platform (the only phone-mutation code path is the one-time OTP verification during onboarding). Reserving `PHONE_NUMBER_CHANGED` in the trigger enum for forward-compatibility; not wiring a fabricated trigger point to a feature that doesn't exist. |

### New triggers and how they fire

Event-driven (set directly via `requireVerification`, same mechanism as `ACCOUNT_RECOVERY`):

- **`CREDENTIAL_CHANGE`** — fires on `PASSWORD_CHANGED` (authenticated password change,
  `password.service.ts#changePassword`) and `WALLET_PIN_CHANGED` (`wallet-pin.service.ts#change`).
  The Wallet touch is a single event-emission line in a frozen module, justified as a
  critical-security-patch-class change per the DPX Freeze Rule — the same category of
  minimal, safe addition as the `PASSWORD_RESET` gap fixed earlier in Driver-001, not a
  feature addition to Wallet.
- **`FAILED_LOGIN_LOCKOUT`** — fires when `LoginAttemptService`'s per-email lockout trips
  (not the per-IP lockout, which isn't scoped to one account). Fired at lockout time, not
  at the next successful login, mirroring how `ACCOUNT_RECOVERY` fires at reset time.
- **`MANUAL_ADMIN`** — already existed as an enum value with no caller; this pass adds the
  admin endpoint that actually uses it ("security team flags the account").

Computed live inside `checkRequired` (evaluated fresh every call, in priority order after
the existing chain):

- **`FIRST_LOGIN_OF_DAY`** — the calendar date (Africa/Lagos, UTC+1, no DST — the stated
  launch market) of `lastIdentityVerifiedAt` differs from today's date. Distinct from
  `IDLE_TIMEOUT`: a driver working a night shift who logs back in after only 3–4 hours
  offline, but past midnight, still needs same-day re-verification.
- **`GPS_ANOMALY`** — compares the incoming go-online `latitude`/`longitude` against the
  driver's last stored `DriverAvailability` position and `updatedAt`. Implied speed
  (haversine distance ÷ elapsed time) above 150 km/h requires re-verification. Guarded
  against GPS-jitter false positives with a 5-minute minimum elapsed-time floor — under
  that window the check is skipped rather than computing a noisy speed. Only evaluated at
  the actual go-online gate (not on every high-frequency in-trip location ping — those
  aren't gated at all, same as before).
- **`RANDOM_SPOT_CHECK`** — 1-in-20 chance, rolled once per real go-online attempt only
  (never on a passive `GET /status` poll — polling must be side-effect-free and
  deterministic within a short window, or the UI would flicker required/not-required with
  no state change).

### Lockout mechanics

`DriverProfile` gains `failedVerificationAttempts` (int, resets to 0 on any `PASSED`) and
`identityVerificationLockedAt` (set the moment the 5th consecutive failure/error lands).
While locked:

- `assertNotRequired` throws `ForbiddenDomainException` with `details: { reason, locked: true }`
  — the frontend uses `locked` to show a distinct "contact support" message instead of the
  normal capture flow, since retrying is pointless until an admin clears it.
- `submit()` refuses outright (no provider call, no new audit record) rather than letting a
  locked driver keep attempting.
- An admin endpoint (`DriversModule`, admin-permission-gated) clears the lock and resets
  the counter — the "support review" step in the founder's flow diagram.

### Not built in this pass

- A driver trust score (DPX-900's last checkbox) — no scoring model exists yet; flagged in
  `docs/DPX-900-DRIVER-SECURITY-TRUST.md` as not started rather than fabricated.
- Account-sharing detection beyond what the triggers above already catch indirectly
  (new-device, GPS-anomaly, random spot-check are the actual mechanism; there's no
  separate "account-sharing" model).

## Addendum 2: "Driver-001 Security Standard (Approved)" — reconciliation

A later founder message restated the standard with two numeric/behavioral values that
differ from what's already live (implemented and shipped under Addendum 1 above), plus a
few new trigger asks not covered by the original scope. Rather than silently pick one
version, the two direct conflicts were confirmed with the founder before touching any
code; both were reconfirmed as "what's live now" — no code changes were needed for them:

| Item                        | Addendum 1 (live)          | Later message               | Founder's call            |
| --------------------------- | -------------------------- | --------------------------- | ------------------------- |
| GPS-anomaly threshold       | 150 km/h                   | >900 km/h                   | **150 km/h** (unchanged)  |
| Failed-login → verification | Immediate on first lockout | After 3 lockouts within 24h | **Immediate** (unchanged) |

The remaining new items from that message were investigated, not guessed at:

- **Email change requiring re-verification** — not built. No self-service "change my
  email" flow exists anywhere in the platform for an authenticated user (grepped for a
  `changeEmail`-style method; none exists). Nothing to hook a trigger onto.
- **BVN/NIN update requiring re-verification** — not built. BVN/NIN doesn't exist as a
  concept anywhere in the schema (Smile ID's `idNumber` field on submission is an opaque
  string passed through to the provider, not a stored, updatable driver attribute). There
  is no "BVN/NIN on file" to detect a change against.
- **Driver-licence update requiring re-verification** — not built. `DRIVER_LICENSE` exists
  only as a `KycDocumentType` enum value for the initial KYC document upload; there is no
  distinct "update my licence" event separate from that one-time submission to fire a
  trigger from.
- **Rooted/jailbroken device detection** — not built, and not feasible in the current
  architecture. Detecting root/jailbreak status (Play Integrity API, iOS DeviceCheck)
  requires a native mobile app with platform-level attestation APIs; `driver-portal` is a
  Next.js web app with no access to device integrity signals. This would need a native
  Driver app before it could exist at all — out of scope for this backend-capability pass.

These follow the same discipline as the SIM-card-change and phone-number-change gaps in
Addendum 1: documented honestly as gaps with a stated reason, not wired to a fabricated
hook that would silently do nothing.

Two items from the same message were real, actionable asks and are now built:

- **Session ID in the audit trail** — `DriverIdentityVerification.sessionId` (migration
  `20260804170000_add_driver_idv_session_id`), populated from `AuthenticatedUser.sid` (the
  real `AuthSession.id` behind the caller's access token) at `submit()` time. Exposed on
  `DriverIdentityVerificationDto.sessionId`.
- **Configurable risk-engine thresholds** — the three DPX-DS-001 thresholds
  (lockout-attempt count, GPS-anomaly speed, spot-check denominator) moved from hard-coded
  constants to `AppConfigService` getters backed by `DRIVER_IDV_LOCKOUT_THRESHOLD`,
  `DRIVER_IDV_GPS_ANOMALY_SPEED_KMH`, and `DRIVER_IDV_SPOT_CHECK_DENOMINATOR` env vars
  (validated via `env.validation.ts`, defaulting to the same 5 / 150 / 20 values already
  live). `driver.constants.ts` keeps the old numbers as `DEFAULT_*` fallbacks for
  documentation and test fixtures, not as the values the running service reads.
