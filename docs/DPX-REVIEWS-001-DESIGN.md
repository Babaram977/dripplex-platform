# DPX-REVIEWS-001 — Reviews & star ratings for merchant, driver & rider

**Status:** Design (approved decisions below). **Build gated on:** PR #97 merge — the
implementation lands on a **fresh branch/PR off `main`**, not on `claude/figma-connect-iugdbg`.
**Owner:** founder. **Compiled by:** Claude.

---

## 1. Founder decisions (locked)

1. **Rating directions (4):**
   - Customer → **Merchant** (after an order)
   - Customer → **Driver** (after a ride)
   - Customer → **Rider** (after a delivery)
   - **Merchant → Rider** (the delivery rider who picked up the merchant's order)
2. **Review shape:** 1–5 **star rating + optional comment + preset tags**.
3. **Tags source:** **fixed, code-defined sets** per direction (not Ops-configurable).
4. **Architecture:** **fill gaps in each existing system** — do not rebuild or merge the two
   rating subsystems. Driver ratings stay in `RideRating`; merchant/rider ratings use the
   polymorphic `Review` system.

---

## 2. Verified baseline (from code inventory, 2026-08-10)

Two deliberately-separate systems already exist:

- **System A — polymorphic `Review`** (`apps/backend/src/reviews/`): `Review`, `ReviewAggregate`,
  `ReviewVote`, `ReviewReport`. `ReviewTargetType = PRODUCT | MERCHANT | RIDER`. Endpoints for
  submit (`POST /customer/reviews`), public list (`GET /reviews`), merchant reply, admin moderate.
  Aggregates (avg + count + 1–5 histogram) maintained by `recalculateAggregate()`.
- **System B — `RideRating`** (`apps/backend/src/rides/`): ride-scoped, two-sided
  (`RideRatingRole = CUSTOMER | DRIVER`), `@@unique([rideId, raterRole])`, numeric
  `categoryRatings` JSON. Endpoints `POST /customer/rides/:id/rate-driver`,
  `POST /driver/rides/:id/rate-customer`, `GET /driver/rides/:id/ratings`.

Per-direction reality:

| Direction           | Store                                    | Records                                    | Submit                                        | Public display                                       | Verdict                                           |
| ------------------- | ---------------------------------------- | ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Customer → Merchant | ✅ `ReviewAggregate`                     | ✅ `Review`                                | ✅ `POST /customer/reviews`                   | ✅ aggregate real in UI; **review cards still mock** | **Mostly done** — add tags, wire real review list |
| Customer → Driver   | ⚠️ live-computed only (`DriversService`) | ✅ `RideRating`                            | ✅ `rate-driver` (real UI at ride completion) | ⚠️ driver's shown rating is **static mock**          | Add tags; expose a **real public** driver rating  |
| Customer → Rider    | ❌ unwired (enum only)                   | ⚠️ generic `Review(RIDER)` only, no caller | ❌ no dedicated endpoint                      | ❌ none; no post-delivery rate step                  | **Net-new wiring**                                |
| Merchant → Rider    | ❌ none                                  | ❌ none                                    | ❌ none                                       | ❌ none                                              | **Net-new**                                       |

**Net-new work concentrates on rider + merchant→rider + tags.** Merchant is largely complete.

Supporting facts: `RatingSummaryDto { average, count }` is the shared summary shape
(`packages/types/src/product/index.ts`); `MerchantSummaryDto`/`ProductSummaryDto`/`ProductDetailDto`
carry `.rating`. `rider/index.ts` has **no** rating field. `Review` verified-purchase logic already
resolves `RIDER` via `deliveryJobs.riderId`. SDK `ReviewsClient` exists; ride-rating SDK methods
exist. No `tags` field on `Review` or `RideRating` today.

---

## 3. Fixed tag sets (code-defined)

Stored as `string[]` on the review record; submission validates each tag ∈ the direction's set.

- **Customer → Merchant:** `Fast prep` · `Well packaged` · `Accurate order` · `Great value` · `Friendly service`
- **Customer → Driver:** `Safe driving` · `Clean vehicle` · `Polite` · `On time` · `Great conversation` · `Helped with bags`
- **Customer → Rider:** `On time` · `Careful with items` · `Polite` · `Good communication`
- **Merchant → Rider:** `Prompt pickup` · `Professional` · `Careful handling` · `Good communication`

(Final wording is founder-editable before build.)

---

## 4. Design

### 4.1 Schema (`schema.prisma`)

- `Review`: add `tags String[] @default([]) @map("tags")`.
- `Review`: add `authorRole ReviewAuthorRole @default(CUSTOMER) @map("author_role")` with new enum
  `ReviewAuthorRole { CUSTOMER MERCHANT }` — lets a **merchant → rider** review coexist with
  customer → rider reviews under the same `RIDER` target while keeping the author's role explicit
  (for verified-purchase resolution and display filtering).
- `RideRating`: add `tags String[] @default([]) @map("tags")` (driver tags; keeps `categoryRatings`).
- One migration `dpx_reviews_001_tags`. No new aggregate tables — reuse `ReviewAggregate` for rider;
  driver aggregate stays computed (see 4.3).

### 4.2 Endpoints

- **Customer → Rider (new):** `POST /customer/deliveries/:jobId/rate-rider` — mirrors `rate-driver`.
  Creates `Review(targetType=RIDER, targetId=<riderUserId>, authorRole=CUSTOMER, orderId=<job order>)`,
  validates tags ∈ customer→rider set, guarded on delivery `DELIVERED`, one review per job per author.
- **Merchant → Rider (new):** `POST /merchant/riders/:riderId/review` — `Review(targetType=RIDER,
authorRole=MERCHANT)`; verified = the rider delivered an order belonging to this merchant.
- **Driver public rating (new):** `GET /drivers/:driverId/rating` (public/customer) returning
  `RatingSummaryDto` computed from `RideRating(rateeId=driver, raterRole=CUSTOMER)` — so the
  customer-facing driver card can show a **real** rating instead of the static mock.
- **Tags on existing driver flow:** extend `RateRideDto` with `tags?: string[]` (validated ∈
  customer→driver set) on `POST /customer/rides/:id/rate-driver`.
- **Wire real review lists:** the product/store/rider review card lists call the existing
  `GET /reviews?targetType=…&targetId=…` (replace UI mock arrays).

### 4.3 Aggregates & DTOs

- **Rider:** add `rating: RatingSummaryDto` to `RiderProfileDto`, sourced from
  `ReviewAggregate(RIDER, riderUserId)` (0/empty when none). Surface in the rider self-profile,
  the admin rider detail (Ops Console — extends the card added in DPX-RIDER-002), and any rider
  display. `recalculateAggregate()` already handles the `RIDER` target on write.
- **Driver:** keep the live-computed aggregate; expose it publicly via the new endpoint and add
  `rating: RatingSummaryDto` to the customer-facing driver info shown on a ride.
- **Types:** add `tags` to the review DTOs + `CreateReviewRequest`; add `RiderProfileDto.rating`;
  add tag-set constants to `packages/types` (or a shared constants module) so UI and backend agree.

### 4.4 Permissions (all 3 seed sources + count bump + `prisma-foundation.spec`)

- `merchant:reviews:manage` — merchant submits a rider review (distinct from the existing
  `merchant:reviews:reply`). Granted to `merchant` + `super_administrator`.
- Reuse `customer:reviews:manage` for customer → rider (already covers `POST /customer/reviews`;
  the new delivery-scoped endpoint uses the same permission).
- No new permission for driver tags (same `rate-driver` path/permission).

### 4.5 UI

- **Super-app:** post-**delivery** rate-rider screen (mirror the ride rate-driver flow), tag chips
  on all rate screens (driver/rider/merchant), real driver & rider rating displays (replace static
  4.8/4.92), and wire the mock review-card lists to real `reviews.listForTarget`.
- **Merchant app:** a "rate the rider" action on a completed/delivered order.
- **Ops Console:** a rider **Reputation** line (avg ★ + count) on the rider detail page.
- All reuse the existing Figma star components (`StarRow` in `rideScreen.tsx`, `Stars` in
  `productDetailScreen.tsx`). Reconcile against Figma and log any new screen (rate-rider) in the
  diff register — Figma has no rate-rider frame today (same situation as rider docs).

---

## 5. Build sequencing (after #97 merges; fresh branch off `main`)

Large feature → split into reviewable sub-PRs (one concern each):

- **PR A — backend:** migration (`tags`, `authorRole`), new endpoints (customer→rider,
  merchant→rider, driver public rating), `RateRideDto.tags`, rider aggregate in `RiderProfileDto`,
  permissions (3 seed sources + count + spec), types + SDK + tag constants, unit tests. Verify
  against real Postgres.
- **PR B — super-app UI:** rate-rider at delivery completion, tag chips on all rate flows, real
  driver/rider rating displays, wire mock review lists to real API. Reconcile against Figma +
  diff-register.
- **PR C — merchant + Ops Console:** merchant→rider review UI; rider Reputation on Ops Console
  rider detail.

Each PR is a review PR (no auto-merge), verified per the standard gate (real Postgres/Redis where
DB behavior is touched; note any pre-existing failures explicitly).

---

## 6. Open items to confirm before build

- Tag wording (§3) — founder sign-off.
- Merchant → rider **verified** rule: rider must have delivered ≥1 of this merchant's orders — confirm.
- Whether a rider/driver can see _who_ left a review, or only aggregates + anonymized text (privacy).
- Whether driver ratings should also gain a **stored** aggregate (perf) or stay live-computed (current).
