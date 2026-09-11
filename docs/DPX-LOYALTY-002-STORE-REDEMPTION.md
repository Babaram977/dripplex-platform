# DPX-LOYALTY-002 — spending DX points at a merchant's counter

**Status:** Shipped.
**Date:** 2026-09-11

---

## 1. Founder decision

> "All merchants' dashboard should [have] a coupon and loyalty points redeeming option for
> customers. A customer, or driver or rider having 50,000 DX points can walk in and say I want to
> redeem my points, make shopping, pay for hotel booking in the future, book flight. Paying for ride
> and delivery possible but not now, we will activate it later. Merchant who redeems customer points
> will add up to his DX wallet and he can request for payout, or pay for store listing, or settle DX
> commissions with the reward redeemed."

Two follow-up decisions, confirmed 2026-09-11:

- **Authorisation:** the holder generates a one-time code in their own app and shows it at the
  counter. Not a merchant looking the customer up by phone number.
- **Minimum:** 50,000 was an example, not a floor. Anyone can spend whatever they hold, in whole
  naira.

---

## 2. The authorisation model, which is the whole design

A merchant spending somebody else's points is the most dangerous thing in the loyalty module, so the
mechanism matters more than the money maths.

**Rejected: merchant enters the customer's phone number.** Fastest at the counter, and wrong.
DrippleX identity is phone-primary — the founder's own locked decision — which means phone numbers
are known to anyone who has ever taken a delivery from that person. Any merchant who knows a number
could drain that balance, and the customer's only protection would be noticing afterwards.

**Shipped: the holder generates the code.** Nothing leaves an account unless its owner produced an
authorisation for a specific amount, seconds earlier, on their own device. Three properties make it
safe to hand a code across a counter:

| Property                                                       | Why                                                                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Worth a **fixed amount**, decided before the code exists       | A merchant cannot take more than was authorised, and the preview shows exactly what they are accepting before they accept it. |
| **Ten minutes, single use**, claimed with a conditional update | A code overheard or photographed is worthless shortly after, and two tills cannot both take one.                              |
| **Plaintext never stored** — only a SHA-256                    | A database dump is not a wallet full of live authorisations. Same reasoning as `OtpService`.                                  |

**One live code per holder.** Generating a new one cancels the outstanding one. That is what stops
two codes drawn on the same balance reaching two merchants at once — cheaper and clearer than
putting a hold on the points, and the balance is re-checked at the counter regardless.

---

## 3. What this ships

**Holder side** (`customer`, `driver` and `rider` alike — a DX point balance is keyed on the user,
not the persona):

- `POST /customer/loyalty/redemption-code` — issues a code for a fixed number of points. Returns the
  plaintext once.
- `DELETE /customer/loyalty/redemption-code` — revokes the outstanding code.
- Customer Rewards screen: "Pay with points in a store" → enter the naira amount → the code, its
  value and its expiry, with a cancel.

**Merchant side:**

- `POST /merchant/loyalty/redemptions/preview` — what a code is worth and whose it is, without
  taking it. Finding out after handing over goods that a code was worth ₦2 rather than ₦200 is the
  merchant's loss, and the check costs one call.
- `POST /merchant/loyalty/redemptions` — takes the points and credits the merchant's DX wallet.
- Both throttled at 30/min: a code is a bearer authorisation, and an unthrottled preview endpoint is
  a machine for trying codes until one works.
- Merchant portal wallet page: enter code → check → confirm.

**What the merchant can then do with it**, per the founder's list:

| Use                   | Status                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Request a payout      | Already worked — it is ordinary wallet balance.                                                                                                 |
| Settle DX commissions | **New.** `POST /merchant/wallet/commission-settlements`, and a "Pay from wallet" control on the commission card. Never takes more than is owed. |
| Pay for store listing | **Not possible.** See §4.1.                                                                                                                     |

The points debit and the merchant's wallet credit commit in one transaction, and the credit is keyed
on the loyalty ledger row that paid for it — so the two ledgers cannot come apart and a retry pays
once. The holder is notified that their points were spent, under its own notification type
(`LOYALTY_POINTS_SPENT`), because somebody spending your balance is not something to be muted
alongside offers.

### Verification

- 257 suites / 2541 tests green against **real Postgres and Redis**.
- `pnpm lint` 17/17, `pnpm typecheck` 18/18, schema/migration parity green.
- 11 database tests, almost all of them about the authorisation rather than the arithmetic: a code
  that was never issued, the same code twice, an expired code, a revoked code, a superseded code,
  more points than the holder has, a balance that no longer covers the code at the counter, and a
  check that the plaintext appears nowhere in the stored row.

### Why merchant commission settlement is separate from payout settlement

`settleCommissionFromPayout` is automatic and applies to riders and drivers, whose cash jobs leave
them owing commission that has to come off a payout before money leaves the platform. Merchant
commission is already deducted at settlement, so nothing is taken from a merchant's balance unless
they ask. Adding merchants to the automatic path would risk deducting twice; this is a separate,
explicit action.

---

## 4. Open — not built, and why

### 4.1 Paying for a store listing

**Nothing to pay for.** There is no listing fee, no subscription, no merchant billing of any kind in
the platform — a merchant's only financial relationship with DrippleX is commission. This cannot be
built as loyalty work; it needs a listing/subscription product to exist first.

### 4.2 Coupons at the merchant counter

The founder asked for "a coupon **and** loyalty points redeeming option". Points shipped; coupons did
not, because they are a different money flow rather than a different button. A points redemption
_moves value_ from holder to merchant. A coupon is a _discount_ — somebody has to fund it, and
whether that is DrippleX or the merchant is a commercial decision nobody has made. The promotions
module already issues and redeems coupons online, so the mechanism exists; what is missing is the
answer to "who pays for an in-store discount".

### 4.3 Hotel bookings, flights, rides and deliveries

The founder named these as future uses, with rides and deliveries explicitly deferred
("possible but not now, we will activate it later"). Nothing here blocks them: points already
convert to wallet balance, and anything payable from the DrippleX wallet is payable with points
today by redeeming first. A direct "pay with points" button on those flows is a presentation
decision, not new plumbing.

### 4.4 Which wallet a partner's self-redemption pays into

`POST /customer/loyalty/redeem` credits the **customer** wallet. A driver or rider redeeming to
themselves would have it land there rather than in their earnings wallet. That is arguably right —
it is not money they earned driving — but it has not been decided, so self-redemption was left as it
was and only the in-store path was opened to all three personas.
