# DPX-LOYALTY-002 — Points and rewards for drivers and riders

**Status:** blocked on a founder decision
**Raised:** 2026-08-19, founder — "driver and rider wallets should show points rewards"
**Owner:** founder (earn rules), then engineering

## What exists today

The loyalty engine is real and running, and it is **customer-only end to end**:

| Piece                                               | Where                                         | Scope                                                                        |
| --------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `LoyaltyAccount` / `LoyaltyLedgerEntry`             | `apps/backend/prisma/schema.prisma`           | keyed on `userId` — not customer-specific                                    |
| `LoyaltyService` (award / redeem / history / tiers) | `apps/backend/src/loyalty/loyalty.service.ts` | persona-agnostic                                                             |
| HTTP surface                                        | `GET/POST /customer/loyalty*`                 | `customer:loyalty:read`, `customer:loyalty:redeem`                           |
| What earns points                                   | `loyalty-events.subscriber.ts`                | `ORDER_PAID`, `DELIVERY_COMPLETED`, `CUSTOMER_REGISTERED`, `COUPON_REDEEMED` |

Every handler in that subscriber resolves its subject as
`payload.customerId ?? payload.userId`. On `DELIVERY_COMPLETED` the points go to
the **customer who received the delivery**, not the rider who made it. So:

- a driver or rider signed into the super app has **no loyalty account with a
  non-zero balance**, because nothing they do awards points;
- and even if they had one, `/customer/loyalty` is behind `customer:loyalty:read`,
  which a driver or rider session does not carry.

Showing a points card on those wallets today would render a permanent zero, or a 403. Neither is worth shipping.

## What is missing, and why it is not an engineering call

The storage and the maths are done. Two things are not, and both are commercial:

1. **What earns a partner points.** Completed trip? Completed delivery? Accepted
   offer? Consecutive days online? Acceptance rate above a threshold? Each is a
   different incentive and each changes driver behaviour in a different
   direction.
2. **How many points, and what they are worth.** The customer rates live in
   `LOYALTY_EVENT_POINTS`. A partner rate is a separate number, and redemption
   has to resolve to something a driver actually wants — wallet credit is the
   obvious candidate, since `LoyaltyService` already redeems to value, but that
   is a payout cost line and therefore a founder decision.

Inventing either would put a number in production that nobody chose, which is
what §3 of the engineering playbook exists to prevent.

## The work, once the rules are decided

Small, and none of it speculative after that point:

1. `partner:loyalty:read` (+ `:redeem` if partners can spend points), added to
   `seed-rbac.cjs` **and** `seed-data/*.ts` — the parity spec fails otherwise —
   and granted to the driver and rider roles.
2. `DriverLoyaltyController` / `RiderLoyaltyController`, or one
   `PartnerLoyaltyController`, over the existing `LoyaltyService`. No new
   service logic.
3. Earn rules in `loyalty-events.subscriber.ts`: subscribe to
   `RIDE_COMPLETED` for the ride's `driverId` and `DELIVERY_COMPLETED` for the
   job's rider, with the founder's rates in `LOYALTY_EVENT_POINTS`.
4. A points card on `DriverWalletTab` and `RiderEarningsScreen`, matching the
   customer wallet's existing one.

## Decisions needed

- [ ] Which partner actions earn points, for drivers and for riders?
- [ ] How many points per action?
- [ ] Can partners redeem them, and into what — wallet credit, or something else?
- [ ] Do the customer tiers (Bronze → …) apply to partners, or do partners get
      their own ladder?
