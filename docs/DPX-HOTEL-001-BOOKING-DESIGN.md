# DPX-HOTEL-001 — Hotel booking on the merchant rails

**Status:** DRAFT — awaiting founder decisions in §7
**Author:** drafted 2026-08-20, from the live schema at `1b29fbf`
**Founder direction (2026-08-20):** _"Hotel booking design going through merchant
registration, adding rooms as products will be a good stress free idea."_

---

## 1. The shape of the decision

A hotel joins DrippleX the way Ghasan Leather Shop did: merchant registration,
KYC, a store, products. A **room type** is a product. A **booking** is a sale.
Everything DrippleX already does to a merchant — approval, commission accrual,
the credit limit and its blocking latch, wallet settlement, the Ops console —
applies without a second system.

That is the right call, and this document takes it as settled. What follows is
an honest account of how much of it is free, and the one part that is not.

**All charges continue to land in the DrippleX payment gateway and refunds
continue to go to the DrippleX Wallet (DPX-D4).** That is the decisive
advantage of own-supply over an aggregator API, whose money moves on their
rails, not ours.

---

## 2. What is free

Verified against the schema, not assumed:

| Need                                              | Already exists                               |
| ------------------------------------------------- | -------------------------------------------- |
| Hotel signs up, is approved, is suspendable       | `MerchantProfile`, `Business`, merchant KYC  |
| Hotel page with photos, description, hours        | `Business`, `StoreScreen`                    |
| Room type with name, price, images, publish/draft | `Product`, `ProductImage`, `ProductStatus`   |
| Room grouping (Standard / Deluxe / Suite)         | `Category` (hierarchical, `parentId`)        |
| Customer pays by card or wallet                   | `PaymentTransaction`, `PaymentProvider`      |
| DrippleX takes its cut                            | `CommissionAccount`, `CommissionLedgerEntry` |
| Hotel owes DrippleX, gets blocked at the ceiling  | commission credit limit + latch              |
| Money out to the hotel                            | `OrderSettlement`, wallet                    |
| Complaints                                        | `OrderDispute`                               |
| Ops sees all of it                                | Operations Console                           |

A room type maps onto `Product` cleanly: `name`, `description`, `basePrice`,
`currency`, `status`, `images`, `merchantId`. Nothing has to bend.

---

## 3. The one part that is not free

`ProductInventory` is a **single scalar**:

```prisma
model ProductInventory {
  quantity   Int  @default(0)
  reserved   Int  @default(0)
}
```

"We have 5 Deluxe rooms" is one number. A hotel needs **5 Deluxe rooms on the
night of 20 August, 3 on the 21st, 5 again on the 22nd**. Availability has a
date axis, and this model has none.

The same gap runs through the order path:

- `Order.fulfillmentType` is `DELIVERY | PICKUP`. A stay is neither.
- `OrderStatus` is a delivery lifecycle — `PREPARING`, `DRIVER_ASSIGNED`,
  `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`. A booking goes
  **booked → checked in → checked out**, or **no-show**.
- `OrderItem` carries `quantity` and `unitPrice` and no dates.
- `InventoryReservation` looks promising but is a **cart hold** — it has
  `expiresAt` for releasing an abandoned basket, not the nights of a stay.

**This is the whole of the new work.** Everything else is reuse.

> Recorded plainly because it is the one place where "rooms are just products"
> stops being true. Bending `quantity` into a per-night figure would produce a
> system that silently double-books, and a double-booked guest at 11pm is the
> worst failure this feature can have.

---

## 4. Proposed model

Three new tables. Nothing existing changes shape.

### 4.1 `RoomType` — the hotel-specific half of a product

One row per `Product` that is a room. Keeps hotel concerns out of the shared
catalogue, so a Product stays a Product for the marketplace.

```
roomTypeDetail
  productId      uuid  unique -> Product
  maxOccupancy   int          -- guests per room
  bedType        varchar      -- "1 double", "2 singles"
  roomCount      int          -- how many of this type the hotel has
  sizeSqm        int?         -- optional
  amenities      text[]       -- wifi, AC, breakfast
```

### 4.2 `RoomAvailability` — the date axis

**One row per room type per night.** This is the standard hotel model and the
reason the feature works at all.

```
room_availability
  productId    uuid    -> Product
  date         date            -- the NIGHT being sold
  roomsTotal   int             -- normally roomTypeDetail.roomCount
  roomsBooked  int     default 0
  priceOverride decimal?       -- weekend/holiday pricing; null = basePrice
  closed       boolean default false   -- merchant shuts the night

  @@unique([productId, date])
  CHECK (roomsBooked >= 0 AND roomsBooked <= roomsTotal)
```

`@@unique([productId, date])` plus the `CHECK` is what makes double-booking
**impossible at the database level**, not merely unlikely. A booking increments
`roomsBooked` for every night of the stay inside one transaction; the constraint
rejects the row that would overshoot.

This mirrors a pattern already proven in this codebase: `CommissionAccount`
guards its balance with an optimistic-concurrency conditional update and a
`version` column, and `WalletService.applyMutation` does the same. Use the same
primitives here rather than inventing a third approach.

### 4.3 `Booking` — the stay, beside the money

```
bookings
  id            uuid
  orderId       uuid unique -> Order    -- the money lives there
  productId     uuid        -> Product  -- the room type
  merchantId    uuid        -> MerchantProfile
  customerId    uuid        -> User
  checkIn       date
  checkOut      date                    -- exclusive; nights = checkOut - checkIn
  rooms         int
  guests        int
  guestName     varchar                 -- may not be the account holder
  guestPhone    varchar
  status        BookingStatus
  checkedInAt   timestamp?
  checkedOutAt  timestamp?
  cancelledAt   timestamp?
  createdAt / updatedAt
```

```
enum BookingStatus {
  PENDING_PAYMENT
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
  NO_SHOW
}
```

**A booking is not an Order — it sits beside one.** The `Order` carries
subtotal, total, payment, commission accrual and settlement, so DPX-D4 and the
commission machinery apply untouched. The `Booking` carries the stay. This
keeps `OrderStatus` out of a lifecycle it was never built for, instead of
adding five booking states to an enum the delivery flow switches on.

---

## 5. How a booking runs

Revised 2026-08-20 to match the answered decisions. The hotel now accepts
before the money is committed, which moves the risky step earlier and shortens
the window in which anything can be held wrongly.

```
Guest picks dates + room type          (>=1 night, <=3 months ahead)
        |
        v
Availability check: every night from checkIn to checkOut-1 has a free room
        |
        v
Booking AWAITING_HOTEL + funds HELD, not taken   <-- see 7.1: the wallet has
Nights held: roomsBooked +N per night, ONE txn       no hold concept yet
        |
        +----- hotel REJECTS ---------> nights released, hold released,
        |                               booking REJECTED. Nothing charged.
        |
        +----- 30 minutes elapse -----> nights released, hold released,
        |                               booking EXPIRED. Nothing charged.
        |
        v
Hotel ACCEPTS
        |
        v
Hold committed: the guest is charged in full, funds settle to the hotel's
DrippleX account, commission accrues at 10% (Ops-adjustable)
        |
        v
Booking CONFIRMED  --- from here the payment is FINAL and non-refundable ---
        |
        v
Guest arrives -> hotel marks CHECKED_IN -> CHECKED_OUT -> settlement runs
        |
        +----- guest never arrives ---> NO_SHOW. Money stays where it is;
                                        commission still accrues.
```

**Where "non-refundable" starts.** At `CONFIRMED`, not before. A rejection or a
timeout is not a cancellation — no room was ever contracted — so nothing is
charged and there is nothing to refund. Guest cancellation after confirmation,
and no-show, are the two cases decisions 2 and 5 govern, and in both the money
stays.

**Three failure modes worth naming now, because the first two have already
bitten this platform:**

1. **Money moved but nothing confirmed it.** Utilities learned this the
   expensive way (see the payment sweep, 2026-08-20): a trigger that waits for
   an event is not a guarantee. Whatever commits the hold on accept needs a
   sweep behind it, not just a webhook and a hopeful comment.

2. **Nights held forever by an abandoned request.** `InventoryReservation`
   already solves the equivalent for carts with `expiresAt` and a sweep, and the
   30-minute accept window makes this concrete rather than theoretical. The same
   sweep releases both the nights and the money hold — they must be released
   together or a hotel looks full while nobody is charged.

3. **A hotel that accepts on the 29th minute while the sweep is expiring it.**
   One transaction decides, the same way `confirmCardPurchase` claims a row with
   a conditional `updateMany` before acting. Accept and expire must not both
   win.

---

## 6. Where it appears

**Merchant portal** — new "Rooms" section beside Products:
room types, a per-night availability calendar (open/close a night, set rooms
and price), and a bookings list with Check in / Check out / No-show.

**Customer app** — the Hotels category leads to hotels, a hotel page shows room
types for the chosen dates, then a date picker → room → guest details → pay,
and "My bookings" beside Orders.

**Ops console** — bookings alongside orders; hotels appear in Commission
Accounts already, with no new work.

### 6.1 Prerequisite, and it is not optional

**There is no merchant category field.** `BusinessType` is a _legal structure_
enum — `SOLE_PROPRIETORSHIP`, `PARTNERSHIP`, `LIMITED_LIABILITY` — which is why
merchant cards read "SOLE_PROPRIETORSHIP" under the shop name.

Consequences today, both live:

- The marketplace **Hotels** chip is not a filter. It runs a free-text search
  for the word "Hotels" against merchant names, so a hotel called _Tahir Guest
  Palace_ would never appear under it.
- `ICON_POOL[m.businessType]` can never match, so every merchant falls to the
  default icon. This is the real reason every card wore the same storefront
  glyph.

A hotel category that actually selects hotels requires a real merchant category
field. It is small, it is needed regardless of hotels, and it should land
first.

---

## 7. Founder decisions — ANSWERED 2026-08-20

All seven, plus two follow-ups the answers forced. These are now locked; changing
one changes the build.

| #   | Decision                   | Answer                                                                                                  |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Payment shape              | **Pay in full**, through the DrippleX payment window, settling to the merchant's DrippleX account       |
| 2   | Cancellation and refund    | **Non-refundable. Bookings are final.** Covers a guest changing their mind                              |
| 3   | Confirmation               | **The hotel accepts first**, to confirm availability                                                    |
| 4   | Commission                 | **10%, Ops-adjustable** — the existing platform default and the existing console control, not a new one |
| 5   | No-show                    | **Non-refundable**, same as #2                                                                          |
| 6   | KYC                        | **Merchant KYC is enough.** No hotel-specific documents                                                 |
| 7   | Horizon and stay length    | **3 months ahead maximum. One night MINIMUM — multi-night stays allowed**                               |
| 8   | Hotel rejects or times out | **The money is not taken until the hotel accepts** (follow-up to #2/#3)                                 |
| 9   | Accept window              | **30 minutes**, then the request auto-expires (follow-up to #3)                                         |

Decisions 8 and 9 exist because #2 and #3 collide. "Non-refundable" cannot mean
DrippleX keeps money for a room that was never contracted — a hotel declining is
not a guest cancelling. Non-refundable therefore governs guest cancellation and
no-show only.

---

## 7.1 The dependency decision 8 creates

**Not taking the money until the hotel accepts is not free, and the platform
cannot do it today.** Stated here rather than designed around:

- `WalletService` has **no hold or reserve concept** — only debit, credit and
  refund. There is no state between "the customer has it" and "we have taken it".
- `PaymentProviderAdapter` exposes `initializePayment` / `verifyPayment` /
  `handleWebhook` and **no authorise-then-capture**. A card pre-authorisation is
  not merely unimplemented; whether Paystack and Flutterwave will grant DrippleX
  auth/capture at all is an open question with each provider.

Three ways forward, in the order they should be considered:

**A. Hotel bookings are wallet-funded, and the wallet gains a real hold.**
_Recommended._ A hold is a debit that has not been committed: reserved at
request, committed on accept, released on reject or on the 30-minute expiry.
It is DrippleX's own ledger, so no provider has to agree to anything, and the
existing `referenceType`/`referenceId` idempotency carries over unchanged. A
guest paying by card funds their Wallet first — a flow that already exists and
already works.
_Cost to the guest:_ one extra step when their balance is short.
_Cost to build:_ a reserved state on the wallet ledger, and a release path.

**B. Charge at request; return to the Wallet on reject or expiry.**
Uses only what exists today. Contradicts decision 8 literally — the money IS
taken before the hotel accepts — but only for at most 30 minutes, and it
returns automatically. Honest framing to the guest matters: "held while the
hotel confirms", never "paid".

**C. Card pre-authorisation.**
The literal reading of decision 8 for card payments. Requires adapter work AND
provider approval, and may simply not be available on Nigerian card rails.
Not a launch option.

**Needs founder confirmation before Phase 2 of the sequence below.** A is the
recommendation; B is the fallback if wallet-first friction is unacceptable.

---

## 8. Suggested sequence

Each slice ships independently and is testable on its own.

| Slice | Contents                                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| 0     | ✅ **DONE 2026-08-20** — merchant category field (§6.1), shipped in #203 with an Ops control                                      |
| 1     | Wallet **hold** — reserve, commit, release — per §7.1 option A. Nothing hotel-specific; it is the prerequisite decision 8 created |
| 2     | `roomTypeDetail` + `room_availability` + the merchant calendar. No booking yet; a hotel can list rooms and open nights            |
| 3     | `Booking` + availability check + night-hold transaction, with the double-booking constraint and its tests against real Postgres   |
| 4     | The accept flow: guest requests → funds held → hotel accepts/rejects → 30-minute expiry sweep. Commission accrues on acceptance   |
| 5     | Check-in / check-out / no-show, settlement, Ops visibility                                                                        |

Slice 5 is the last one: decisions 2 and 5 make bookings non-refundable, so
there is no cancellation-and-refund slice to build. That is one fewer moving
part than the original sequence assumed.

**Slice 1 is now the gate.** It was not in the original plan — decision 8 put it
there. Until the wallet can hold money without taking it, the accept-first flow
cannot be built honestly, and §7.1 option B is the only alternative.

**Slice 3 is the one that deserves the most care** (it was slice 2 before the
wallet hold moved in front of it). Everything else is recombination of parts
already working in production; that slice carries the only genuinely new
invariant, and it is the one whose failure a guest experiences at a hotel desk
at night.

---

## 9. What this design deliberately does not do

- **No aggregator API.** Booking.com's Demand API and Expedia Rapid (which is
  what "Hotels.com API" resolves to — Hotels.com is an Expedia brand with no
  partner API of its own) are partnership-gated and generally expect
  demonstrated volume. More decisively, they collect and refund on their own
  rails, which contradicts DPX-D4's single settlement path. Own supply keeps
  one answer to "where does the money live". An aggregator can be added later
  as a considered second rail; it should not be the foundation.
- **No bending of `ProductInventory`.** A per-night figure squeezed into
  `quantity` double-books.
- **No new payment path.** Bookings use the gateway, wallet, commission and
  settlement that already exist.
