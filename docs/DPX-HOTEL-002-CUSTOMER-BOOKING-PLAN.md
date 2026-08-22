# DPX-HOTEL-002 — Customer booking: slices and steps

**Status:** PLAN — one blocker needs a founder decision (§2). Everything else is buildable.
**Depends on:** DPX-HOTEL-001 (#225 schema + service, #226 API, #228 merchant screens)

---

## 1. Where this starts from — verified, not assumed

Checked against the code today, because the plan is only useful if its starting
point is real:

| Piece                          | State                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| Hotels chip in the marketplace | **Works.** `CAT_CHIPS` filters on `category: 'HOTEL'`, a real column |
| Tapping a hotel card           | Goes to `StoreScreen`, which lists **products**                      |
| A hotel's products             | **None.** Rooms are `RoomType`, not `Product`                        |
| Customer booking API           | **Live** — browse, calendar, quote, book, my-bookings (#226)         |
| Customer booking UI            | **Nothing**                                                          |
| A guest making a booking       | Only by calling the API directly                                     |

**So the gap is exactly one thing: a hotel's page shows an empty product list,
and there is no way to reach the booking API from the app.**

---

## 2. The blocker, and it is small but real

`GET /customer/bookings/hotels/:businessId/room-types` takes a **`Business.id`**.

The marketplace card carries a **`MerchantProfile.id`** — `toMerchantSummaryDto`
sets `id: merchantProfileId` — and that is what `onStore(m.id)` passes to the
store screen.

They are different ids. As it stands the customer app **cannot call its own
booking endpoint** from a marketplace tap.

Three ways out, and the choice is a real one:

| Option                                                 | Cost                                                                 | Consequence                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **A. Endpoint accepts a merchantProfileId** (proposed) | One backend change: resolve profile → business inside the controller | Matches how every other customer-facing merchant route is addressed. No client work |
| B. Add `businessId` to `MerchantSummaryDto`            | Widens a DTO every marketplace screen reads                          | Two ids on every card, and a caller can pick the wrong one                          |
| C. Resolve client-side with an extra call              | An extra round trip on every hotel page open                         | Slower, and a second failure mode for no benefit                                    |

**Recommendation: A.** The customer app should address a merchant the one way
it already does everywhere else. B invites the exact confusion that produced
this blocker. This is the only item here that changes a shipped contract, which
is why it is called out rather than absorbed.

---

## 3. The slices

Each ships and is testable on its own. Sequenced so the founder can put a real
booking through as early as possible.

### Slice A — A hotel's page shows rooms, not an empty shelf

**The smallest change that stops the app lying.** Today a hotel's page is an
empty product list, which reads as "this hotel has nothing".

- Resolve the id blocker (§2).
- In `StoreScreen`, when `category === 'HOTEL'`, render room types instead of
  products: name, photo, "sleeps N", "from ₦X a night".
- No dates yet — "from" pricing off `basePrice`.

**Done when:** tapping Tahir Guest Palace in the Hotels chip shows its Deluxe
room and a price, instead of nothing.

**Risk:** low. Read-only, one screen, no money.

---

### Slice B — Pick dates, see the real price

- A date picker on the hotel page: check-in, check-out, rooms, guests.
- On change, call `GET …/room-types/:id/availability` per room type.
- Show each room as bookable-with-a-total, or the reason it is not — the API
  already returns a sentence a guest can act on ("No rooms left on 2026-09-11",
  "The hotel has not opened 2026-09-12 for booking").
- Enforce founder decision 7 in the picker: three months ahead, one night
  minimum, so an impossible stay cannot be typed.

**Done when:** choosing 10–12 September shows ₦40,000 for a two-night stay, and
choosing a closed night says which night is the problem.

**Risk:** low-medium. The date arithmetic is the trap, and `lib/bookingDates.ts`
(17 tests, shipped in #228) already covers it.

---

### Slice C — Book it, and watch the thirty minutes

**The money slice.** Everything before this is read-only.

- Guest details: name, phone, optional note. Pre-filled from the account but
  editable — people book rooms for other people.
- A confirmation sheet that says plainly, before the button: **your money is
  held, not taken; the hotel has 30 minutes; if it declines or does not answer,
  the hold is released in full.** Founder decisions 8 and 9 are only honest if
  the guest is told them at the moment they matter.
- `POST /customer/bookings` → a waiting screen with the live countdown.
- Poll the booking; on `CONFIRMED` show the confirmation, on `REJECTED` /
  `EXPIRED` show the `customerMessage` the API already returns ("Your money was
  never charged — it is all still in your DrippleX Wallet").

**Done when:** a guest books, the hotel accepts on the merchant screen, and the
guest's wallet shows the money gone and the booking confirmed.

**Risk:** highest of the set. It moves money and it has a clock. Wants the most
care and the most testing.

**Open dependency, stated not solved:** wallet balance only. There is no card
path for bookings — `createBooking` places a **wallet hold**, and a hold is not
something a card gateway does here. A guest without wallet balance cannot book.
Whether card-funded bookings are needed for launch is a founder decision, and it
is a bigger change than a screen: it needs a decision about what "held" means on
a card.

---

### Slice D — My bookings

- A list beside Orders: upcoming, past, declined.
- Each opens the booking with its reference, the stay, the hotel, what was paid,
  and the `customerMessage` where one applies.
- A pending booking keeps its countdown here too, so closing the waiting screen
  does not lose the thread.

**Done when:** a guest can find a booking they made yesterday and read its
reference at the hotel desk.

**Risk:** low. Read-only.

---

### Slice E — Tell the guest without making them watch

- Notification on `CONFIRMED`, `REJECTED` and `EXPIRED`, through the notification
  centre already wired for utilities (#222).
- Needs two `NotificationType` values and a `BOOKING` category — the same
  additive migration shape as the utilities work.

**Done when:** a guest who closes the app after booking still learns the answer.

**Risk:** low, and it reuses a path proven in production today.

---

## 4. Sequence, and why

```
A ──► B ──► C ──► D ──► E
```

Strictly sequential, because each genuinely needs the one before: dates need
rooms on screen, booking needs a quote, "my bookings" needs a booking, and a
notification needs a status to report.

**A and B are worth shipping together** if the founder wants to see something
quickly — neither touches money, and a hotel page with a working date picker is
the first point where the feature looks real.

**C should ship alone.** It is the only slice that moves a guest's money, and
it should be reviewed and deployed without anything else in the diff.

---

## 5. What this plan deliberately does not include

- **Cancellation.** Founder decision 2 is non-refundable and final; there is no
  cancel button to build. Slice 5 of DPX-HOTEL-001 remains open.
- **Check-in / check-out / no-show, and settlement.** Slice 4 of DPX-HOTEL-001.
  **A hotel is still not paid until that exists** — unchanged and restated here
  so it is not lost between documents.
- **Card-funded bookings.** See Slice C. A decision, not an omission.
- **Photos of rooms.** `RoomType.photoUrl` accepts a URL; no upload endpoint for
  room images exists. A dependency, not something to invent.

---

## 6. What the founder needs to decide

1. **The id blocker (§2)** — option A recommended. Blocks Slice A.
2. **Wallet-only, or card too?** Blocks nothing until Slice C, but changes its
   size considerably. Worth answering before C starts.
3. **Ship A+B together, or one at a time?** A preference, not a risk.
