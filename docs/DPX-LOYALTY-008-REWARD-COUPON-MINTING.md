# DPX-LOYALTY-008 — a redeemed coupon becomes a coupon you can spend

**Status:** Shipped (backend).
**Date:** 2026-09-11

---

## 1. The gap

`LoyaltyRewardRedemption.promotionId` has existed since the rewards catalogue shipped
(DPX-LOYALTY-004) and **nothing ever wrote it**.

So a customer who spent 25,000 DX Points on a "₦500 coupon" received a record of the purchase and no
way to use it. The points were gone, the row said `FULFILLED`, and there was no coupon. That is a
broken promise rather than a missing feature, which is why it went ahead of the remaining audit work.

## 2. What shipped

**On redeeming a `DISCOUNT_COUPON` reward, a real `Promotion` is minted** — in the _same
transaction_ as the points debit, because a coupon created afterwards could fail and leave somebody
who has paid 25,000 points holding nothing, which is precisely the state being fixed.

**The coupon is locked to the holder three ways**, because one bought with your own points is not a
campaign:

- `rules.whitelistUserIds` is the holder alone, so nobody else's basket matches it even with the code.
- `perUserLimit` and `usageLimit` are both 1, so it is spent once whatever happens.
- It carries no `merchantId`: DrippleX funds it, because the points were paid to DrippleX rather than
  to whichever shop accepts it.

**`LoyaltyReward.domains` says where the coupon is good.** A "₦500 coupon" that does not state where
it can be spent is under-specified, and guessing fails in both directions — too wide lets a shopping
reward pay for a ride, too narrow is a support ticket. The catalogue's two coupons are seeded to
`MARKETPLACE` and `MERCHANT`: an order, and a merchant's counter. **`RIDE` is deliberately excluded** —
the engine supports it, but letting a rewards coupon pay for a ride is a scope decision nobody has
made, and it is one row to change when somebody does.

**`promotionId` became a relation**, so the redemption can be read with its coupon. The DTO now
carries `couponCode` as well as `promotionId` — an id the holder cannot type is no use to them, and
the code is the part they need.

### Correct silences

`mintCoupon` returns null, minting nothing, in three cases that are all right rather than oversights:

- **Not a discount coupon.** A physical gift is posted, not spent.
- **No domains named.** A reward whose scope nobody has stated must not be given one by this code.
- **No value at all** — neither a percentage nor an amount. That is a misconfiguration, not a free
  coupon; minting an empty promotion would hand somebody a code that silently takes nothing off. It
  is logged as an error so the catalogue row gets fixed.

### Verification

- 9 database tests, the first of which **actually spends the coupon** through the real promotions
  engine rather than only asserting a row exists: minted and spendable, locked to its holder (a
  stranger with the code is refused), spent once and not twice, refused outside its domains, a
  percentage coupon minted with its ceiling, expiry matching the entitlement, and the three silences.
- Proven load-bearing: removing the holder whitelist turns the lock test red.

## 3. FREE_DELIVERY is still not spendable, and this is why

The 10,000-point free delivery — the catalogue's **first rung**, the one most holders will reach
first — is in the same broken state and is **not** fixed here.

Minting it a `DELIVERY`-domain promotion would look like a fix and be nothing of the kind:
**no code anywhere calls the promotions engine with `PromotionDomain.DELIVERY`.** The live callers
are `MERCHANT` (the store counter), `RIDE` (ride fares) and `MARKETPLACE` (the cart). A delivery-fee
coupon would be minted, stored, and never once consulted.

So this is a **dependency, not an invention**: free delivery needs a delivery-fee path that consults
promotions before an entitlement for it can mean anything. Until then the reward mints nothing, which
at least leaves the redemption row honestly empty rather than pointing at a coupon that does not work.

**This is the most important follow-up in this document.** Until it is done, the cheapest reward in
the catalogue is the one that does the least.

## 4. Still open

- **No customer-facing surface for a minted coupon.** The code is on the DTO; no screen shows a
  holder their coupons. They would have to be told the code another way.
- **Nothing expires the promotion when the entitlement lapses.** `endsAt` is set at mint time from
  `entitlementDays`, so it does expire — but a reward with no `entitlementDays` mints a coupon with
  no end date at all.
- **Ops cannot set `domains` from a screen**, because the rewards catalogue still has no Ops console
  page (DPX-LOYALTY-004's open item).
