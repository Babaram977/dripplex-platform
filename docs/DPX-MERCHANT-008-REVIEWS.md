# DPX-MERCHANT-008 — Reviews Reply UI

## 1. Scope (founder-locked)

> Use only the existing review/reply backend capability. Do not invent
> moderation or review-management features. Allow merchants to: view
> customer reviews, view ratings, reply where the backend supports replies,
> edit/update replies only if the backend genuinely permits it. Clearly
> distinguish merchant replies from customer reviews. Use the real backend
> ordering and timestamps. Build proper loading, empty and error states.
> Verify against the real backend before considering the screen complete.

## 2. Reality audit

The reply capability already existed (`Review.merchantReply` /
`merchantRepliedAt`, `POST /merchant/reviews/:id/reply`), but two real gaps
blocked it from being usable, both closed here:

### 2.1 A confirmed authorization bug, not a missing feature

`MerchantReviewsController.reply()` passed the authenticated user's
`User.id` straight into `ReviewsService.replyAsMerchant()` as `merchantId`.
But `assertMerchantCanReply()` compares that value against
`Review.targetId` (for `MERCHANT`-type reviews) and `Order.merchantId` —
and both of those are `MerchantProfile.id`, never `User.id` (confirmed via
`customer-merchants.service.ts`'s `targetId: { in: merchantProfileIds }`
and the same established split documented in
`docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md`). The existing unit test
masked this by fabricating `targetId: userId` directly rather than a real
profile id.

**Net effect before this fix**: a real merchant calling
`POST /merchant/reviews/:id/reply` on a review of their own store would
always get `403 Forbidden` — the reply endpoint could never succeed for
its primary case. Fixed by resolving `MerchantProfile.id` from the
authenticated user inside `replyAsMerchant()` (same pattern as
`MerchantSettlementService.listSettlements()`), before the authorization
check runs. Verified live: replying to the merchant's own store review now
succeeds; replying to a different merchant's review, or to a product
review with no linked order, correctly still returns `403`.

### 2.2 No merchant-facing review listing existed

Only `POST /merchant/reviews/:id/reply` existed — no `GET`. The public
`GET /reviews` endpoint could technically list a merchant's own reviews,
but only if the caller already knows their own `MerchantProfile.id`,
which the merchant-portal has no existing way to obtain (`getBusiness()`
returns `Business.merchantId`, which is `User.id`, not
`MerchantProfile.id` — a different ID than the one `Review.targetId`
uses). Closed with a new, read-only `GET /merchant/reviews`
(`ReviewsService.listMerchantReviews()`) that resolves the profile
server-side and returns every review targeting the merchant's store
**plus** every review of a product they sell — reusing the exact same
`ReviewDto`/pagination/aggregate shape `listTargetReviews` already returns
for the public endpoint, gated by the same `merchant:reviews:reply`
permission already granted to the `merchant` role (no new permission).

### 2.3 What was deliberately not built

- **No moderation status filter.** The merchant list is scoped to
  `APPROVED` reviews only — the same visibility a shopper browsing the
  store sees — never `PENDING`/`REJECTED`/`HIDDEN`. Exposing those would
  edge into the `admin:reviews:moderate` permission's territory, which the
  founder explicitly said not to invent.
- **No customer name.** Nothing in this codebase currently joins a
  customer's name onto anything a merchant can see (Order DTOs don't
  expose it either) — `ReviewDto.authorId` is a raw id, no display name.
  Not fabricated here; the screen simply doesn't show one.
- **No new "edit reply" endpoint.** `POST :id/reply` already overwrites
  `merchantReply`/`merchantRepliedAt` unconditionally, so calling it again
  on an already-replied review _is_ the edit — no separate endpoint was
  needed or invented.

## 3. Backend changes

- `ReviewsService.replyAsMerchant()` — resolves `MerchantProfile.id` first
  (bug fix, §2.1).
- `ReviewsService.listMerchantReviews()` — new, read-only (§2.2).
- `MerchantReviewsController` — added `GET /merchant/reviews`; moved
  `@RequirePermissions(MERCHANT_REPLY)` to the controller class so it
  covers both routes (verified `PermissionsGuard` reads
  `getAllAndOverride([handler, class])`, so this is not a behavior
  change).
- `dto/list-merchant-reviews-query.dto.ts` — new, `page`/`pageSize` only
  (no `targetType`/`targetId` — the scope is fixed server-side).

## 4. SDK

`ReviewsClient.listMerchant(query)` — new, `GET /merchant/reviews`. No new
shared types needed: `ReviewDto`, `ReviewAggregateDto`,
`ReviewWithAggregateDto` already covered the exact response shape.
`ReviewsClient.reply()` already existed and needed no changes. Both are
already exposed on `MerchantSdk` via `reviews: client.reviews`.

## 5. Frontend — `apps/merchant-portal/src/app/(dashboard)/reviews/page.tsx`

- Store-level rating summary (average + count) at the top, from the real
  `ReviewAggregateDto`.
- One card per review: star rating, target badge ("Store review" /
  "Product review" — the founder's "clearly distinguish" applies to
  merchant-reply-vs-customer-review, addressed below; this badge
  distinguishes _what_ is being reviewed), a "Verified purchase" badge
  where applicable, the comment, and real `createdAt`.
- **Merchant reply is visually distinct** from the customer's review: it
  renders inside its own bordered/shaded block labelled "Your reply" with
  its own timestamp (`merchantRepliedAt`), never inline with the customer
  text.
- Reply / edit-reply is an inline expand form (no Dialog component exists
  in this codebase) — "Reply" button when none exists, "Edit reply" when
  one does, both hitting the same `POST :id/reply`.
- Pagination matches every other Phase 2 list screen (`Previous`/`Next`,
  `meta.totalPages`).
- Loading (spinner while first page loads), empty (`EmptyState` when there
  are zero reviews), and error (inline `role="alert"` text) states, same
  pattern as Wallet & Bank / Orders.
- Nav item added to `sidebar.tsx` and `mobile-nav-drawer.tsx`.

## 6. Live verification

Backend started against the real dev Postgres/Redis. A temporary
`verify-reviews.script.ts` created real fixtures — two merchant users
(one control, "a different merchant"), a customer, a product, and five
reviews (an `APPROVED` store review, an `APPROVED` product review with no
order, a `PENDING` store review, and an `APPROVED` review of the _other_
merchant's store) — logged in via the real `POST /auth/login/merchant`,
then drove the exact HTTP contract:

- `GET /merchant/reviews` → returns exactly the store + product review
  (2 items), correctly excludes the `PENDING` review and the other
  merchant's review, includes the real store `ReviewAggregateDto`.
- `POST /merchant/reviews/:id/reply` on the merchant's own store review →
  succeeds, saves the exact text, sets `merchantRepliedAt` — **this is the
  proof the §2.1 bug fix works**; before the fix this call always
  returned `403`.
- Calling the same endpoint again with different text → succeeds (the
  "edit" path), text is overwritten.
- `POST /merchant/reviews/:id/reply` on the product review (no linked
  order) → correctly `403`s — proves the authorization check is real, not
  a rubber stamp.
- `POST /merchant/reviews/:id/reply` on a different merchant's store
  review → correctly `403`s.
- The edited reply is visible via the real public `GET /reviews` endpoint
  too, proving it round-trips through the same `Review` row a customer
  would see.

All 18 assertions passed. Fixtures were deleted at the end of the run; the
script file was deleted after; the dev backend process was stopped.

Frontend: `tsc --noEmit`, `eslint --max-warnings=0`, and `next build` all
clean, including the new `/reviews` route in the build output.

Backend suite: `pnpm exec jest --config ./jest.config.ts "src/reviews"
"src/orders" "src/wallet"` → **18 suites passed, 165/165 tests passed**
(includes 6 new/updated tests in `reviews.service.spec.ts` and 1 updated
permission test).

## 7. Files changed

- `apps/backend/src/reviews/reviews.service.ts` — bug fix + new method.
- `apps/backend/src/reviews/merchant-reviews.controller.ts` — new `GET`,
  permission moved to class level.
- `apps/backend/src/reviews/dto/list-merchant-reviews-query.dto.ts` — new.
- `apps/backend/src/reviews/reviews.service.spec.ts` — updated + new tests.
- `apps/backend/src/reviews/review.permissions.spec.ts` — updated for the
  class-level decorator.
- `packages/sdk/src/platform/platform-client.ts` — `ReviewsClient.listMerchant()`.
- `apps/merchant-portal/src/app/(dashboard)/reviews/page.tsx` — new.
- `apps/merchant-portal/src/components/layout/sidebar.tsx` /
  `mobile-nav-drawer.tsx` — nav item.

## 8. Next step

Continue the locked Phase 2 order: Notifications (#387), then Analytics +
store controls (#388), then the module-level E2E/security/production-audit
pass (#389–#391).
