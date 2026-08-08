# DPX-DRIVER-013 — Driver Production-Readiness (consolidated)

**Date:** 2026-08-08 · **Baseline:** `main` @ `8e39b95` (PRs #54–#58 merged) · **Figma:** live, `rsHHFRxHVE3OKv81p7m3K1` (Make file, read-only)
**Nature:** consolidated readiness map. Supersedes the interim DPX-DRIVER-009 map. No product/Figma/business decisions were made here — all such items are elevated to the founder.

Legend: ✅ done · 🟢 buildable now (unblocked) · 🟡 founder decision · 🔴F Figma-gated · 🔴I infrastructure-gated · 🔴P production/payment blocker.

---

## 1. Completed & merged

- ✅ **Registration → SUBMITTED** (DPX-DRIVER-007, #54)
- ✅ **Admin driver review + per-document KYC verify/reject + lifecycle** (DPX-DRIVER-008, #55)
- ✅ **Admin vehicle approval** (DPX-DRIVER-011, #58) — closes the `vehicleApproved` activation gate
- ✅ **Phone-or-email login fix** (DPX-DRIVER-010, #57) — phone-only accounts can now log in
- ✅ **Security gate** — `nanoid` 3.3.16 → 3.3.18
- ✅ **SDK completeness** (DPX-DRIVER-012, #59, in review) — 7 previously-uncovered admin controllers now have clients

**The driver activation loop is functionally complete on `main`:** register → submit → admin KYC review → vehicle approval → activation, with lifecycle (approve/reject/suspend/reactivate) and phone/email login.

---

## 2. Item-by-item audit (Phase 2)

### A. Admin/Ops authentication — 🟡 founder decision (P1)

`sdk.auth.login()` → `POST /auth/login` is called by **operations-console + admin-portal** login forms, but **no bare `/auth/login` route exists** — only `/auth/login/{customer,merchant,rider,driver}`. There is **no admin/operations login portal**, so ops/admin staff authenticate against a non-existent route (latent breakage). **No auth model was invented.** Decision required: add `/auth/login/operations` + `/auth/login/admin` portal endpoints (mirroring the existing four, mapped to `operations_staff`/`administrator`+`super_administrator` roles), or repoint the portals to an agreed existing endpoint. Once decided, this is a bounded backend + SDK + 2-line portal change.

### B. Vehicle approval — ✅ verified integrated

PR #58 is merged and verified on `main` (`/vehicles` page + `adminDriverVehicles` SDK + `admin:drivers:vehicles:manage`). End-to-end path (submit → PENDING → admin approve/reject → `vehicleApproved`) works. Deferred Figma extras (photo grid, per-document checklist, "Request Corrections") remain gated on storage / no backend endpoint — see E and §3.

### C. Driver SDK/API completeness — ✅ done (#59)

7 admin controllers had no SDK client; all now covered (identity-verification require/unlock, planned-availability, shifts, support, incident-reports, sos-alerts, ride-reports). No types gap. No UI wired (see D).

### D. Operations Console review flows — ✅ no new screens needed

Driver review (#55) and vehicle approval (#58) exist. Incident/Support/SOS **admin queues already exist** in operations-console via the `operationsCases`/`operationsQueues` module (`/queues/{sos,incidents,support}`, DPX-OPS-001). Building screens for the parallel driver-domain admin controllers (#59) would duplicate those — **not built, to avoid duplication.** Whether the two backend surfaces (`/operations/queues/*` vs `/admin/{incident-reports,sos-alerts,driver-support-tickets}`) should be reconciled is a **🟡 backend-architecture decision** (P2), not a UI task.

### E. Storage / upload dependency — 🔴I infrastructure-gated (P1)

No file-upload/storage backend exists. Surfaces that depend on it:

1. **Driver KYC documents** — currently hosted-URL strings (`kyc-document-form`).
2. **Driver profile photo / avatar** — hosted-URL string.
3. **Vehicle photos** (`Vehicle.photos: string[]`) — no upload path; blocks the Figma vehicle photo grid.
4. **Identity selfie** (`selfieImageBase64`) — inline base64, no capture UI (see F).
   **Smallest production-ready recommendation (for approval, not implemented):** object storage (e.g. Cloudflare R2 / S3-compatible — Cloudflare is already in the stack) + a backend `POST /uploads/sign` issuing short-lived pre-signed PUT URLs + an `uploads` allow-list of mime/size; clients upload direct-to-storage and submit the returned URL (fits the existing URL-string contracts with minimal schema change). **Decision required:** approve the storage provider + the signed-upload contract before implementation.

### F. Identity verification — 🔴F Figma-gated (P1)

Backend is real: provider-agnostic risk engine + **Smile ID** adapter (`SmileIdProvider`), `DriverIdentityVerification` model, admin require/unlock (now SDK-covered, #59). To reach `identityVerified`, a driver must submit a facial/identity verification (`selfieImageBase64` + id document). **No driver-facing selfie/liveness capture screen exists in Figma anywhere** (confirmed live). So the capture UI cannot be built under the "no UI without Figma" rule. **Requirements to unblock:** (1) a Figma design for the driver selfie/liveness capture screen, and (2) storage (E) if the capture uploads media rather than base64. Backend + admin controls are ready.

### G. Payments — 🔴P production blocker + 🟡 decisions (P0/P1)

- **OPay** — 🔴P: `OPAY` is in the `RidePaymentMethod` enum + `GATEWAY_METHODS` and accepted by the pay DTO, but the real `OpayProvider` throws `NotImplementedException` → **production 501 when a customer selects OPay**. Decision: implement the adapter, or safe-disable selection (note: the ride-lifecycle e2e injects a fake working OPAY adapter, so disabling also edits that test). **Not implemented/disabled — payment decision.**
- **Moniepoint** — stub, but not in `GATEWAY_METHODS` (unreachable from rides). Low.
- **Commission rate** `RIDE_PLATFORM_COMMISSION_RATE = 0.15` and **fare table** `RIDE_FARE_RATES` — placeholders marked "founder approval required before production." 🟡 go-live blocker (business sign-off).

### H. Field / design discrepancies (Figma ↔ backend) — 🟡 decisions (P2)

- **Passenger Seats** (Figma vehicle field) — no `seats` column (only `rideCategory`). Add or confirm covered.
- **"Road Worthiness"** doc type — not in `KycDocumentType`. Add or confirm out of scope.
- **"Passport Photo"** doc type — no distinct photo type (only `PASSPORT`). Add or fold in.
- **Passenger verification / PIN** — Figma "Verify Passenger" screen conflicts with the **locked "no passenger PIN before ride start"** decision. Drop the screen or reverse the lock. **Not built either way.**
- **KYC progress ring / %** (Figma KYC Status) — no required-checklist/percentage concept backend-side; UI shows status list instead. Add a checklist model or confirm status-list is acceptable.

---

## 3. Priority-ranked summary

**P0 (production blockers)**

- G-OPay 🔴P — selectable + non-functional (501 in prod). Decision + fix/disable.

**P1**

- A — Admin/Ops auth contract 🟡 (latent broken login for admin/ops staff).
- E — Storage architecture 🔴I (gates KYC/vehicle/selfie media, 4 surfaces).
- F — Driver selfie/liveness capture 🔴F + depends on E (blocks `identityVerified` self-service).
- G-commission/fare 🟡 (go-live sign-off).

**P2**

- D-reconciliation 🟡 (dual admin/operations queue surfaces).
- H — seats / road-worthiness / passport-photo / passenger-PIN / KYC-progress 🟡 (field decisions).

---

## 4. Recommended next execution order

1. **Founder decisions batch:** OPay strategy (P0), admin/ops auth contract (A), storage approval (E), commission/fare sign-off, and the H field decisions.
2. **After A decided:** implement admin/ops login endpoints + SDK + repoint the two portals (bounded, no Figma).
3. **After E approved:** implement signed-upload storage → unblocks KYC/vehicle photos; then, **after a Figma selfie screen exists**, build identity capture (F).
4. **After OPay decided:** implement or safe-disable (with the ride e2e update).
5. H field items as the founder rules on each (some need Figma, some are schema additions).

**Nothing in §2–§4 was implemented in this pass beyond the SDK completeness (#59); all decisions remain the founder's.**
