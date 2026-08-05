# DPX-MERCHANT-011 — Full E2E Verification of the Order Lifecycle Workflow

## 1. Scope (Merchant Phase 2, per founder's locked sequencing)

Per the founder's explicit sequencing after DPX-MERCHANT-010 (Analytics +
store controls), the Merchant module's screen-by-screen build is complete.
Before any DPX-COMMERCIAL-001 work resumes, the founder locked this order:

1. **Full E2E verification of the order lifecycle** (this doc)
2. Security review (#390)
3. Production audit + docs + commit/push (#391)
4. Founder Review
5. Freeze Merchant Module

This document covers step 1: driving the complete, real order lifecycle —
Customer places order → Merchant receives → accepts → prepares → marks
ready → Rider pickup flow → Delivery → automatic completion → Wallet/
settlement visibility → Notifications → Reviews → Analytics update — over
real HTTP endpoints against the real backend (Postgres + Redis), with
Prisma used only for fixture setup and to invoke internal mechanisms that
have no HTTP surface (the completion sweep, review moderation).

## 2. Method

A temporary script, `verify-order-lifecycle.script.ts`, was written,
run, iterated on, and deleted after the run went green — the same
methodology used for every prior DPX-MERCHANT-00x live verification.

- **Fixtures** (Phase 0): a merchant user + `MerchantProfile` (APPROVED) +
  `Business` (ACTIVE/VERIFIED) + one PUBLISHED `Product`; a customer user +
  funded `Wallet` + `CustomerAddress`; a rider user + `RiderProfile`
  (approved) + online `RiderAvailability` near the business. Created
  directly via Prisma — this is setup, not the thing under test.
- **Every lifecycle transition** was driven by the real HTTP contract each
  portal actually uses: cart → checkout → wallet-pay (customer), accept →
  ready (merchant), accept → pickup → arrived → deliver (rider), tracking
  (customer).
- **The order-completion sweep** (`OrderCompletionSweepService.runSweep()`,
  normally fired by a 15-minute `setInterval`) was invoked directly via a
  real `NestFactory.createApplicationContext(AppModule)` — the exact
  production DI graph and code path, just triggered on-demand instead of by
  timer, so the 24h auto-complete window didn't have to be waited out for
  real.
- **Settlement and merchant wallet crediting** were read back via the real
  `GET /merchant/wallet` and `GET /merchant/wallet/transactions` endpoints
  after the sweep's `ORDER_COMPLETED` event had actually finished
  processing (see §4.1 on why that's not automatic).
- Cleanup deleted every fixture row at the end of a green run; the script
  file itself was deleted afterward; the dev backend process was stopped.

**Result: 65/65 assertions passed** across all 9 phases (order placement,
merchant accept/prepare, rider pickup, customer tracking, real completion
sweep, settlement + wallet, notifications, review + moderation, analytics).

## 3. Full lifecycle verified, phase by phase

| Phase                                      | What was verified                                                                                                                                                                                                                                           | Assertions |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1. Customer places order                   | Cart → checkout → `POST /customer/orders/:id/pay` (WALLET) → order `CONFIRMED`, `paymentStatus: PAID`, customer wallet debited by `order.total`                                                                                                             | 9          |
| 2. Merchant accepts/prepares               | New order visible in `GET /merchant/orders?status=CONFIRMED`; `accept` → `PREPARING`; `ready` → `READY`; `DeliveryJob` auto-created and auto-assigned to the online rider (`ASSIGNED`)                                                                      | 11         |
| 3. Rider pickup flow                       | Job visible in `GET /rider/jobs`; `accept` → order `DRIVER_ASSIGNED`; `pickup` → `PICKED_UP`; `arrived`; `deliver` (with `DeliverProofDto`, `proofType: SIGNATURE`) → `DELIVERED`, `deliveredAt` set                                                        | 12         |
| 4. Customer tracking                       | `GET /customer/orders/:id` reflects `DELIVERED`; `GET /customer/orders/:id/tracking` reachable                                                                                                                                                              | 3          |
| 5. Real completion sweep                   | Backdated `deliveredAt` 25h; real `OrderCompletionSweepService.runSweep()` invoked via `NestFactory` app context → order `COMPLETED`                                                                                                                        | 2          |
| 6. Settlement + merchant wallet            | Real `ORDER_COMPLETED` handler created an `OrderSettlement` row; `grossAmount === subtotal`, `commissionAmount = round(rate × subtotal)`, `merchantAmount = subtotal − commission`; merchant wallet balance and transaction history both reflect the credit | 9          |
| 7. Notifications (customer/merchant/rider) | Customer received `ORDER_ACCEPTED` and `ORDER_READY` in-app; merchant and rider notification gaps confirmed (see §4)                                                                                                                                        | 6          |
| 8. Review + moderation                     | `POST /customer/reviews` (verified purchase); moderation gate confirmed (see §4); once approved, visible via `GET /merchant/reviews`                                                                                                                        | 7          |
| 9. Analytics                               | `GET /merchant/analytics/overview` reflects the completed order's `orders`/`revenue` KPIs                                                                                                                                                                   | 3          |

Settlement math was independently confirmed against the live
`MerchantSettlementService` calculation for this run's real numbers:
subtotal 8000 → commission 800 (10% default rate) → merchant amount 7200,
exactly matching the API responses read back from `GET /merchant/wallet`.

## 4. Genuine findings (the point of this verification pass)

Per the founder's own framing after DPX-MERCHANT-008/010 — that a
reality-driven process is meant to expose real gaps before launch — this
pass surfaced four, none of which were "fixed" mid-verification; each is
recorded here for the production audit (#391) to weigh and prioritize.

### 4.1 `DomainEventBus.emit()` is fire-and-forget by design

`emit()` always returns immediately (`Promise.resolve()`); handler
dispatches run in the background and are only awaitable via a separate
`drain()` method. `OrderCompletionSweepService.runSweep()`'s own
`await eventBus.emit(DOMAIN_EVENTS.ORDER_COMPLETED, …)` does **not** wait
for `MerchantSettlementService.handleOrderCompleted()` to actually finish —
in production this is intentional (the 15-minute interval timer must not
block on settlement side effects), but any caller that needs the side
effects to have happened — including this E2E script, and potentially a
graceful-shutdown path — must explicitly call `eventBus.drain()` first.
Not a bug; a real behavior worth documenting so it isn't rediscovered the
hard way during an incident.

### 4.2 Merchants receive zero in-app order-lifecycle notifications

Every order-lifecycle domain event (`ORDER_CREATED`, `ORDER_ACCEPTED`,
`ORDER_READY`, `ORDER_COMPLETED`, `DELIVERY_ASSIGNED`,
`DELIVERY_COMPLETED`, etc.) in `notification-center.subscriber.ts` maps
its `userKeys` to `['customerId', 'userId']` or `riderId` — never
`merchantId`. The only merchant-targeted in-app notification types in the
entire system are `LOW_INVENTORY` and `MERCHANT_APPROVAL`. New-order
alerts to merchants exist only as an **email**, sent separately by
`checkout.service.ts`'s `dispatchOrderCreatedNotifications()` via
`NotificationsService` — entirely disconnected from the in-app
`NotificationCenterService`/`Notification` model that DPX-MERCHANT-009's
Notifications screen reads. **Net effect**: the merchant Notifications
screen, built and live-verified in DPX-MERCHANT-009, has no real content
to show across the entire order lifecycle it visually represents — a
merchant logging into the portal today would see it permanently empty for
new orders, ready reminders, or completions.

### 4.3 No rider-facing notifications route exists at all

`grep`-ing every controller under `notification-center/` turns up exactly
four: customer, merchant, admin, and `driver/notifications` — the last one
serving the Ride module's ride-hailing **driver** portal, a different
role/portal entirely from the marketplace **rider** role verified here.
`GET /rider/notifications` genuinely 404s; it isn't merely empty. Notably,
`role-permissions.ts` already grants the `rider` role
`customer:notifications:read`/`manage`, so the permission model assumes
riders should eventually read notifications — no route currently exposes
that.

### 4.4 New reviews require admin moderation before merchant visibility — correct design, but with two gaps

`Review.status` defaults to `PENDING` (`prisma/schema.prisma`); both
`listMerchantReviews()` and the public `listTargetReviews()` filter
`status: APPROVED` only. This is intentional, correctly implemented
content moderation — not a bug — reachable via
`PATCH /admin/reviews/:id/moderate` (permission `admin:reviews:moderate`,
granted to `operations_staff`/`administrator`/`super_administrator`).
Verified live: a fresh review is correctly absent from
`GET /merchant/reviews` while `PENDING`, and correctly appears once
`APPROVED`.

Two adjacent gaps surfaced while confirming this:

- **Merchants aren't notified when a review needs attention or goes
  live** — consistent with §4.2, since `REVIEW_SUBMITTED`/moderation
  events aren't in the merchant-targeted notification set either.
- **No admin/operations-console login route exists in this codebase
  snapshot.** `LoginService` implements exactly four portal logins —
  `loginCustomer`/`loginMerchant`/`loginRider`/`loginDriver` — and no
  `admin`/`operations` equivalent. The `operations-console` frontend
  (`login-form.tsx`) calls `sdk.auth.login()` → `POST /auth/login`
  (no portal segment); that route returns a confirmed `404` against the
  live backend (`curl -X POST /api/v1/auth/login` → `404`). This means
  operations-console currently has no way to authenticate at all,
  including for the review-moderation action exercised here — which is
  why this script applied the moderation status change directly via
  Prisma, standing in for the real admin action. **This is outside
  Merchant module scope** (it's an Operations/admin-auth gap, not a
  merchant-portal one) and was not touched here; flagging it for
  visibility since it was discovered incidentally while verifying a
  Merchant-module dependency.

## 5. What this phase deliberately did not do

- Did not add merchant in-app notification wiring, a rider notifications
  controller, or an admin login route. All three are real, confirmed gaps
  — fixing any of them is unrequested scope expansion during a
  verification pass and belongs to the production audit's prioritization
  (#391) or a founder decision, not this step.
- Did not modify any production code. This was a read/verify pass only;
  the only artifacts produced are this document and the (now deleted)
  verification script.

## 6. Next step

Proceed to **#390 — security review** (Authorization, Merchant isolation,
API exposure, Permission checks, Input validation, Cross-merchant access
attempts, Rate limiting where applicable), per the founder's locked
sequence, followed by **#391 — production audit + docs + commit/push**,
Founder Review, and Freeze Merchant Module — all before DPX-COMMERCIAL-001
implementation resumes.
