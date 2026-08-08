# DPX-DRIVER-017 — Vehicle passenger seats (+ field decisions)

**Date:** 2026-08-08 · **Nature:** implementation + gap register for the DPX-DRIVER-013 §H field decisions. Founder-locked decisions batch.

## Implemented — `Vehicle.seats`

Passenger capacity is now first-class operational data on `Vehicle`, per the founder decision that capacity **must not be inferred from `rideCategory`**.

- **Prisma:** `Vehicle.seats Int?` — nullable and additive (migration `20260808020000_dpx_driver_017_vehicle_seats`). Existing rows keep `NULL` (capacity **unknown**, not a fabricated backfill); new submissions require it.
- **API:** `CreateVehicleDto.seats` required (`@IsInt @Min(1) @Max(20)`); `UpdateVehicleDto.seats?` optional; a seats change on an approved vehicle triggers re-review (same rule as make/model/colour/year/category).
- **Contract:** `VehicleDto.seats: number | null`, `CreateVehicleRequest.seats: number`, `UpdateVehicleRequest.seats?: number`.
- **UI:** captured in the driver-portal vehicle form and the customer-web DPX-100 `DriverVehicleForm` (Figma's "Passenger Seats" field, previously dropped for lack of a backend counterpart — now reinstated), and displayed in the operations-console vehicle queue.

`RideType` (`ECONOMY | COMFORT | XL | TRICYCLE`) is unchanged — seats is orthogonal capacity data, not a category.

## Field decisions (DPX-DRIVER-013 §H)

| Field                        | Decision                                                               | Status                       |
| ---------------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| **Passenger seats**          | Add as first-class field                                               | ✅ done (this slice)         |
| **Passenger PIN**            | Keep the locked "no passenger PIN before ride start" decision          | 🔒 unchanged (nothing built) |
| **Road Worthiness** doc type | **Not added** — see below                                              | 🟡 elevated to founder       |
| **Passport Photo** doc type  | Deferred until confirmed as a distinct required document               | 🟡 deferred                  |
| **KYC progress %**           | Keep the existing status-list UI; no backend percentage model invented | 🟡 deferred                  |

### Why Road Worthiness was NOT added

The instruction was to add `ROAD_WORTHINESS` **only where the existing approved contract already requires it** — not to invent it. The evidence says it is an explicitly _deferred, undecided_ item, not an implied requirement:

- The live `KycDocumentType` enum (Prisma + `@dripplex/types`) does **not** contain it, and there is **no vehicle-document model** — only `Vehicle.photos: string[]`.
- `DPX-DRIVER-013` §H lists it as an **open 🟡 P2 field decision** ("Add or confirm out of scope").
- `DPX-DRIVER-011` (the founder-authorized vehicle-approval slice) **explicitly deferred** the per-document checklist (Insurance / Road Worthiness / Reg / Inspection): "no vehicle-document model exists … these remain founder/storage decisions. Nothing invented here."
- The only doc marking it "Required" is `DPX-013` §8.4 — a **superseded Sprint-1 spec** whose vehicle contract (`vehicleType SEDAN/SUV/BIKE`, `ownershipType`) never shipped (the built model uses `RideType` and has no such fields).

Adding `ROAD_WORTHINESS` would also require a whole new **vehicle-document model** (the enum is shared by driver/merchant/customer KYC, which are _identity_ documents, not vehicle documents) — i.e. net-new speculative scope. **Decision required from the founder:** confirm out-of-scope, or approve a dedicated vehicle-document model + document types (Road Worthiness, Insurance, Registration) as a separate slice, ideally alongside the storage upload work (DPX-DRIVER-016) it depends on.

## Verification

Backend build + typecheck + lint; vehicles service spec (seats persisted + re-review on change); `@dripplex/types` build; driver-portal / customer-web / operations-console typecheck + lint. Verified against real Postgres.
