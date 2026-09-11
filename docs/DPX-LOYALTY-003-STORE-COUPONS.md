# DPX-LOYALTY-003 — coupons at a merchant's counter, funded by DrippleX

**Status:** Shipped.
**Date:** 2026-09-11

---

## 1. Founder decision

> "DrippleX will settlement merchant through the accumulated points."

Asked in the context of: _who funds an in-store coupon discount — DrippleX or the merchant?_ The
answer is **DrippleX funds it**, and the merchant is settled the same way a points redemption
settles them: into their DX wallet.

That closes the gap left open in `DPX-LOYALTY-002` §4.2, which shipped in-store **points** but not
in-store **coupons**, because a points redemption moves value from holder to merchant while a coupon
is a discount somebody has to pay for.

---

## 2. The problem this had to solve first

A coupon is not a points balance. It carries **per-user and per-device limits**, so redeeming one
has to know _whose_ redemption it is. A merchant simply typing in a campaign code they saw on a
poster could spend it against anybody — or against nobody, with no user to count it under.

So the coupon rides on **the holder's existing till code**, the same one-time authorisation
DPX-LOYALTY-002 built for points. The customer picks the coupon in their own app; the code carries
it; the merchant types the code. One code, one interaction at the counter, and the redemption is
unambiguously the holder's.

A code can now carry points, a coupon, or both, and a single till interaction settles all of it.

---

## 3. How the money moves

1. The merchant enters the code and the **bill total** (required when the code carries a coupon — a
   percentage discount is meaningless without something to take it off, and guessing would either
   short the merchant or overpay them).
2. `PromotionsService.redeemForReference` redeems the coupon **as the holder**, enforcing the
   promotion's own rules, usage limits, per-user limits and window — the same discipline the ride
   and marketplace paths use.
3. The merchant's DX wallet is credited the discount amount. They gave money off at the till and are
   made whole here, so an in-store coupon costs them nothing.

The wallet credit is keyed on the till code's id against the existing unique index on
`(wallet, reference type, reference id)`, so a retry pays once.

### Decisions worth knowing

- **The coupon is applied after the points, deliberately outside the points transaction.** A coupon
  that turns out to be expired or over its limit must not un-spend points the holder genuinely
  authorised and the merchant has already been paid for.
- **Wallet-credit promotions are refused at a counter.** Those put money in the _customer's_ wallet,
  which is not money off a bill — crediting the merchant for one would pay them for a saving the
  customer never made at the till.
- **A coupon-only code moves no points at all.** It carries zero points, and the points side is
  skipped rather than attempting a ₦0 wallet movement, which the wallet refuses by design.
- **Both halves are visible before confirming.** The merchant's preview shows the points, the naira,
  the coupon code and the holder's name; nothing moves until they confirm.

### Verification

- 259 suites / 2568 tests green against a fresh, migrate-only, never-seeded Postgres with `CI=true`.
- `pnpm lint` 17/17, `pnpm typecheck` 18/18, schema/migration parity exact.
- Five new database tests on top of the eleven DPX-LOYALTY-002 already had: a coupon funded and the
  merchant paid, points and a coupon spent together on one code in one visit, a coupon refused
  without a bill, a wallet-credit coupon refused at a counter, and a code carrying neither points
  nor a coupon refused at issue.

---

## 4. Still open

### 4.1 Where the discount is _reported_ as a cost

The merchant is made whole from the DrippleX platform wallet path, the same as a points redemption.
What this does **not** do is book the discount as a marketing cost against the campaign that granted
it — `PromotionRedemption.amountSaved` records it, but nothing rolls those up into a funded-cost line
Operations can see next to the campaign's performance. Worth doing once somebody needs to answer
"what did that campaign cost us".

### 4.2 A customer-facing way to pick which coupon

The API accepts a coupon code on the till code, and the customer app's "pay with points in a store"
flow does not yet offer a coupon picker — a customer would have to know the code. Straightforward
UI work; listed here so it is not mistaken for shipped.
