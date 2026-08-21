# DPX-HOTEL-001 — Hotel booking on the merchant rails

**Status:** DECIDED 2026-08-20 — all seven answered in §7, plus one they created. Building.
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

```
Customer picks dates + room type
        |
        v
Availability check: every night from checkIn to checkOut-1 has a free room
        |
        v
Order created (PENDING) + Booking (PENDING_PAYMENT)
Nights held: roomsBooked +N per night, in ONE transaction
        |
        v
Payment via existing gateway --- fails or times out ---> nights released,
        |                                                booking CANCELLED
        v
Booking CONFIRMED, commission accrues to the hotel's account
        |
        v
Guest arrives -> hotel marks CHECKED_IN -> CHECKED_OUT -> Order COMPLETED
                                                          settlement runs
```

**Two failure modes worth naming now, because both have bitten this platform
already:**

1. **Payment held but never confirmed.** The utilities work established the
   rule: a provider _rejection_ proves nothing executed and must be reversed; a
   _timeout_ may have succeeded and must never be silently reversed. Apply the
   same distinction here — a rejected card releases the nights immediately; a
   timeout holds them and raises an Ops task.

2. **Nights held forever by an abandoned checkout.** `InventoryReservation`
   already solves the equivalent for carts with `expiresAt` and a sweep. The
   night-hold needs the same expiry, or a browsing customer quietly makes a
   hotel look full.

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

Recorded verbatim from the founder, with the reading applied where the answer
needed one. **These supersede the flow sketched in §5**, which assumed
pay-then-confirm.

| #   | Decision                                | Answer                                                                                            |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Pay in full, deposit, or pay at hotel?  | **Pay in full**, through the DrippleX payment window, settling to the merchant's DrippleX account |
| 2   | Cancellation window and refund          | **Non-refundable. Bookings are final.**                                                           |
| 3   | Instant confirmation, or hotel accepts? | **Hotel accepts first**, to confirm availability                                                  |
| 4   | Commission rate for hotels              | **10%, Ops-adjustable** — the existing commission config, no new mechanism                        |
| 5   | No-show policy                          | **Non-refundable**, same as #2                                                                    |
| 6   | Extra KYC for hotels?                   | **No — merchant KYC is enough**                                                                   |
| 7   | Booking horizon and minimum stay        | **3 months ahead maximum. One night minimum**, multi-night allowed                                |

### 7.1 The decision these created

#2 and #3 collide: if the guest has already paid in full and the hotel then
**rejects**, "non-refundable" would mean DrippleX keeping money for a room
nobody ever provided. That is not what "final" was meant to cover, so it was
put back to the founder and answered:

| #   | Decision                                           | Answer                                                                                                                          |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 8   | What happens to the money while the hotel decides? | **It is not taken until the hotel accepts.** A wallet HOLD reserves it; accepting commits it, rejecting or expiring releases it |
| 9   | How long does the hotel have?                      | **30 minutes**, then the booking auto-expires and the hold is released                                                          |

**Non-refundable therefore applies to the guest changing their mind and to a
no-show — never to a hotel declining or letting the window lapse.** In those
cases no room was ever contracted and the guest is made whole automatically.

Decision 8 is why `WalletService.hold/commitHold/releaseHold` exists
(shipped 2026-08-20); `pendingBalance` had been declared since the wallet was
created and never written to until this needed it.

---

## 8. Suggested sequence

Each slice ships independently and is testable on its own.

| Slice | Contents                                                                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Merchant category field (§6.1) — needed regardless of hotels                                                                                                                                  |
| 1     | `roomTypeDetail` + `room_availability` + the merchant calendar. No booking yet; a hotel can list rooms and open nights                                                                        |
| 2     | `Booking` + the availability check + night-hold transaction, with the double-booking constraint and its tests against real Postgres. Per decision 8 the guest's money is HELD here, not taken |
| 3     | Customer flow: dates → room → hold → hotel accepts (30 min) → commit. Commission accrues on acceptance, not on payment                                                                        |
| 4     | Check-in / check-out / no-show, settlement, Ops visibility                                                                                                                                    |
| 5     | Cancellation and refund per decision #2                                                                                                                                                       |

**Slice 2 is the one that deserves the most care.** Everything else is
recombination of parts already working in production; that slice is the only
genuinely new invariant, and it is the one whose failure a guest experiences at
a hotel desk at night.

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
