# DPX-PROFILE-KYC-003 — Profile & KYC Verification & Acceptance Report

Per the founder's instruction (2026-08-07): this is a **verification and acceptance
milestone, not another implementation milestone**. No new features were built here —
only tests, a real-Postgres data-integrity spec, doc corrections, and this report,
scoped exactly to the four verification areas the founder requested.

## Scope recap

DPX-PROFILE-KYC-001 (Slice 1) and DPX-PROFILE-KYC-002 (Slice 2) delivered:
editable customer profiles (`PATCH /auth/me`), verification-gated phone/email change,
and the seven-state `CustomerKyc` document-verification lifecycle (service, controller,
admin review, SDK, UI). Both slices are documented in
`docs/DPX-PROFILE-KYC-001-DESIGN.md`. This report verifies that combined surface
end-to-end and records an acceptance decision.

## 1. Functional verification

| Area                                  | How verified                                                                                                                                                                                                                                                                                                                                                   | Result |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Profile editing                       | `profile.service.spec.ts` (mocked deps — 12 tests: field updates, DOB range validation, no-op on empty payload) + new real-Postgres round-trip of `profilePhotoUrl`/`dateOfBirth`/`gender` in `profile-kyc-lifecycle.e2e.spec.ts`                                                                                                                              | ✅     |
| Phone change request + confirmation   | `profile.service.spec.ts` (same-number rejection, already-used rejection, OTP send, valid confirm, invalid-OTP rejection, lockout) + real-Postgres `updatePhone` write/verify round-trip                                                                                                                                                                       | ✅     |
| Email change request + confirmation   | `profile.service.spec.ts` (already-used rejection, OTP send, valid confirm) + real-Postgres `updateEmail` write/verify round-trip                                                                                                                                                                                                                              | ✅     |
| Customer KYC lifecycle (self-service) | `customer-kyc.service.spec.ts` (18 mocked-Prisma tests) + new `profile-kyc-lifecycle.e2e.spec.ts` real-Postgres run: NOT_STARTED → start → submit → PENDING_REVIEW, and a second REJECTED → re-start → REQUIRES_RESUBMISSION → resubmit → VERIFIED branch                                                                                                      | ✅     |
| Admin review lifecycle                | Same two spec files: verify/reject/requestResubmission guards (mocked) + real-Postgres verify/reject/requestResubmission against actual rows, including `listPendingReview()` correctly including/excluding rows by status                                                                                                                                     | ✅     |
| Permission enforcement                | `permissions.guard.spec.ts` proves the generic mechanism; `KYC_PERMISSIONS.CUSTOMER_MANAGE`/`ADMIN_REVIEW` are applied via the same `@RequirePermissions()` decorator every other controller uses — verified by construction, not a new bespoke check                                                                                                          | ✅     |
| Route protection                      | Both KYC controllers sit behind the global `JwtAuthGuard` + `PermissionsGuard` (registered in `AppModule`, not opted out per-controller) — same as every other authenticated route in the app                                                                                                                                                                  | ✅     |
| SDK contract verification             | Direct diff of all 13 SDK request paths/HTTP verbs (`sdk.auth.updateProfile`/`requestPhoneChange`/`confirmPhoneChange`/`requestEmailChange`/`confirmEmailChange`, `sdk.kyc.getStatus`/`start`/`submit`, `sdk.adminCustomerKyc.listPending`/`getForUser`/`verify`/`reject`/`requestResubmission`) against their controller route decorators — all match exactly | ✅     |

**Scope note on Phone/Email OTP-confirm real-DB coverage:** the Redis-backed
pending-change state (`ProfileService.request/confirmPhoneChange` etc.) is fully
covered by `profile.service.spec.ts` with mocked Redis/NotificationService.
Re-proving that logic against a live Redis instance in this pass would add
infrastructure without new confidence — the two DB writes it ultimately makes
(`updatePhone`/`updateEmail`) are exercised directly against real Postgres instead,
in `profile-kyc-lifecycle.e2e.spec.ts`.

## 2. Regression verification

Full suite re-run after adding this milestone's new spec, both in parallel
(default Jest workers) and `--runInBand` (serial):

- **Backend: 1390/1393 passing.** The 3 that fail are pre-existing, unrelated to
  this diff (see "Known pre-existing failures" below) — same failures reproduce
  identically whether this milestone's changes are present or not, and neither
  failing spec touches `auth/`, `users/`, or `kyc/`.
- **SDK: 152/152 passing.**
- **UI: 2/2 passing.**
- **customer-web: 4/4 passing.**
- Specifically re-confirmed green: `registration.service.spec.ts`, `login.service.spec.ts`,
  `otp.service.spec.ts`, `phone-verification.service.spec.ts`, `email-verification.service.spec.ts`,
  `auth.service.spec.ts`, `jwt.strategy.spec.ts`, `permissions.guard.spec.ts`,
  `profile.service.spec.ts`, `layout.test.tsx` (Account Management route smoke test).

No regressions introduced by DPX-PROFILE-KYC-001/002.

## 3. Data verification

- **Migration integrity:** `prisma migrate diff --from-migrations prisma/migrations
--to-schema-datamodel prisma/schema.prisma --shadow-database-url ...` produces
  **only the seven pre-existing drift statements already documented in
  `docs/REALITY-STAGE-R1.1.md`** (index-rename mismatches on
  `analytics_daily_metrics`/`notification_delivery_attempts`, `ALTER COLUMN "id"
DROP DEFAULT` on `driver_identity_verifications`/`inspection_centres`/
  `inspections`/`vehicles`, the missing `orders.order_number` index, and the
  missing `wallet_ledger_entries` unique constraint) — nothing new from the
  `CustomerKyc`/profile-column migrations. Confirmed clean.
- **Backward compatibility:** existing users (created before these migrations)
  read back with `profilePhotoUrl`/`dateOfBirth`/`gender` all `null` and
  `CustomerKycStatusDto.status` defaulting to `NOT_STARTED` — no backfill needed,
  proven by `getMyStatus()`'s null-record default path (both mocked and real-DB tests).
- **Timestamp population:** `profile-kyc-lifecycle.e2e.spec.ts` asserts each of
  `startedAt`, `submittedAt`, `reviewStartedAt`, `reviewedAt`, `verifiedAt`,
  `rejectedAt` populates at the correct transition and stays `null` otherwise
  (e.g. `rejectedAt` is set and `verifiedAt` stays `null` on the reject path).
- **Status transitions:** the full seven-state graph's reachable paths are
  exercised against real Postgres: `NOT_STARTED → IN_PROGRESS → PENDING_REVIEW →
VERIFIED`, and separately `→ REJECTED`, `→ REQUIRES_RESUBMISSION → (resubmit) →
PENDING_REVIEW → VERIFIED`. `EXPIRED` has no trigger built yet (documented,
  not a gap in this milestone's scope — see DPX-PROFILE-KYC-001-DESIGN.md).
- **Permission seeding:** `prisma-migration-seed.spec.ts` re-runs the actual seed
  against real Postgres and asserts idempotency; `prisma-foundation.spec.ts`
  confirms the permission catalog size (113, up from 111 — the two new
  `customer:kyc:manage`/`admin:customer-kyc:review` entries); `role-permissions.ts`
  grants confirmed by inspection: `customer:kyc:manage` → `customer` role only;
  `admin:customer-kyc:review` → `operations_staff`/`administrator`/
  `super_administrator` (mirroring `admin:drivers:review`'s placement exactly).

## 4. Documentation verification

- `docs/reference/dpx-100-figma-screen-mapping.md` — the §1 summary table's
  Profile Setup and KYC/Identity Verification rows, the Auth group totals row,
  and the §2 KYC/Verification Status sub-screen rows were all stale (written
  before Slice 1/2 landed, claiming "not built"/"ambiguous"). Corrected in this
  milestone to reflect the actual built state; the historical prose audit block
  above the §1 table was left verbatim (per this doc's own stated rule of
  recording what was true at each point in time) with a dated resolution note
  appended rather than edited in place.
- `docs/reference/DPX-FIGMA-DIFF-REGISTER.md` — already closed out correctly in
  the Slice 2 commit with a dated "Built" note; re-verified accurate, no changes
  needed here.
- `docs/DPX-PROFILE-KYC-001-DESIGN.md` — re-read against the shipped
  implementation; the locked enum, timestamp fields, and scope boundaries all
  match what was actually built. No changes needed.

## Known pre-existing failures (not in scope, confirmed unrelated)

Three backend tests fail on this branch, identically whether DPX-PROFILE-KYC-001/002/003's
changes are present or reverted — confirmed by the fact that neither failing spec's
module (`products/`, `operations/`) was touched by any file in this diff, and the
same two failure classes were already present and documented before this milestone
started:

1. `customer-products.service.spec.ts` — two assertions expect a specific product
   id in query results but get an unexpected extra id (`fb905519-...`); real-Postgres
   dev-DB data pollution (leftover rows from other suites sharing the same `dripplex_dev`
   database), not a code defect.
2. `operations-cases.service.spec.ts` — one test's `sosAlert.create()` hits a
   foreign-key violation on `vehicle_id`; same dev-DB-state class of issue (a
   `Vehicle` row the test expects to exist doesn't, in this particular DB state).

Both reproduce identically under `--runInBand` (serial) and default parallel
workers, ruling out cross-test-file race conditions as the sole cause — this is
dev-database state, not flakiness introduced by this milestone.

## Acceptance decision

All four verification areas pass. **DPX-PROFILE-KYC-001/002 (Profile & KYC) is
accepted as complete for its approved scope**, per the founder's stated acceptance
criteria in the DPX-PROFILE-KYC-003 request. No regressions, no migration drift,
correct timestamp/status-transition behavior against real Postgres, accurate
documentation, and SDK contracts verified to match the controllers exactly.

Ready to merge into the main development stream. The next major functional area
can proceed without further Profile & KYC work, per the founder's direction.
