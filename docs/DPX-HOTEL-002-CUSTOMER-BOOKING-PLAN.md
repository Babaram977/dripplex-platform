# DPX-HOTEL-002 — Customer booking: slices and steps

**Status:** REVISED 2026-08-22 — the payment model changed. §0 supersedes parts of §3.
**Depends on:** DPX-HOTEL-001 (#225 schema + service, #226 API, #228 merchant screens)

---

## 0. Founder decisions, 2026-08-22 — the payment model changed

Recorded verbatim, then the reading applied:

> "take end point as merchant ID"
>
> "for wallet balance NO, everybody can apply for a reservation without funds in
> his wallet until when a hotel accepts booking then the super-App will provide
> a bank account details for the customer pay, after payment customer should
> send a receipt of payment to Merchant hotel agent for confirmation and assured
> booking with booking reference code/pin to be presented to the hotel to verify
> the guest"

### 0.1 What this supersedes

| Was                                                                       | Now                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Decision 8 — a **wallet HOLD** reserves the money while the hotel decides | **No money at all** until the hotel has accepted     |
| Decision 1 — pay in full through the DrippleX payment window              | **Bank transfer to the hotel**, confirmed by receipt |
| A guest needs wallet balance to book                                      | **Anyone can apply.** No funds required to reserve   |

The 30-minute accept window (decision 9) was built to bound how long a guest's
money sits held. **With nothing held, it no longer protects money — it protects
inventory**, which is a different job and probably a different duration. See §0.4.

### 0.2 The new flow

```
Guest applies (no money)  →  PENDING_HOTEL
        │
        ▼
Hotel accepts             →  AWAITING_PAYMENT   ← app now shows the hotel's bank details
        │
        ▼
Guest transfers, uploads receipt →  PAYMENT_SUBMITTED
        │
        ▼
Hotel confirms receipt    →  CONFIRMED  + reference code/PIN for the desk
```

### 0.3 This is not new ground — DrippleX already does it

Every mechanism this needs is already **live in production** for marketplace
orders, from the founder's 2026-08-17 decision:

> "when an order is paid to merchant customer should have an option to upload
> receipt of payment which will go to merchant for confirmation and in case of
> dispute it can be referenced."

| Need                                        | Already exists                                                     |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Show the customer the hotel's bank details  | `CheckoutService.getMerchantBankForOrder` → `BankAccount`          |
| Customer uploads a receipt                  | `OrderPaymentProof` + `OrderPaymentProofService`                   |
| Merchant confirms payment received          | `MerchantOrdersService.confirmPaymentReceived`                     |
| DrippleX's cut when it never held the money | `CommissionAccountService.accrue()` — mode B, the merchant owes it |
| The hotel gets blocked if it owes too much  | commission credit limit + latch                                    |

**Note, superseded within the same day.** When this section was written the
money was going to the hotel's own account, which would have made commission an
accrued debt. Decision 11 then routed payment through DrippleX, so the cut comes
off the settlement instead — back to recording it on the booking, which is what
#225 already did. Left here rather than deleted because the reasoning is what
matters: **who holds the money decides which mechanism is correct**, and that is
worth being able to re-read the next time the question comes up.

`OrderPaymentProofService`'s own header already states the three rules that
matter here, and they carry over unchanged:

- **A receipt does not mark anything paid.** A customer can upload any image.
  Confirmation stays the hotel's word.
- **Nothing verifies the receipt.** No bank is queried. It records what was sent.
- **Proofs are append-only.** A wrong upload adds a second row; both stay, so a
  dispute has real evidence.

### 0.4 The rest of the decisions, 2026-08-22

| #   | Question                          | Answer                                                                             |
| --- | --------------------------------- | ---------------------------------------------------------------------------------- |
| 10  | How long to pay after acceptance? | **24 hours.** Rooms release automatically when it lapses                           |
| 11  | Where does the money go?          | **Through DrippleX**, on the existing card/transfer gateway — not to the hotel     |
| 12  | Who confirms payment?             | **The gateway.** No receipt, no one judging an image, no forged receipt can assure |
| 13  | The desk code                     | **Five characters, alphanumeric**, issued on payment                               |
| 14  | Hotel settlement                  | **Weekly, every Monday**                                                           |

Decision 11 is the one with the largest consequence: because the money lands
with DrippleX, **DrippleX now owes every hotel its share**, and there is no
mechanism that pays one. That makes settlement required rather than deferred —
it is the next piece of work, and decision 14 sets its schedule.

> **Built.** See [DPX-HOTEL-003](./DPX-HOTEL-003-SETTLEMENT.md). Weekly, every
> Monday, settling the seven days that just finished, into the hotel's existing
> merchant wallet. That doc also corrects a claim made in the first version of
> the settlement code about which database guard prevents a double payment.

It also settles the commission question in the opposite direction from the note
in §0.3 below. With DrippleX holding the money the cut comes **off** what the
hotel is paid (mode A, as marketplace online orders work), not accrued as a
debt. `commissionAmount` is snapshotted onto the booking at the rate in force
when the money arrives, so a later rate change cannot move what a past stay
owed.

### 0.5 What this leaves genuinely open

1. **How long does a guest have to pay after the hotel accepts?** This is the
   one that matters. The room is held from the moment of application, and with
   no money at stake there is nothing to stop someone reserving every room in
   Kaduna and never paying. Needs a payment window and an auto-release, the same
   way the 30 minutes works today — but the duration is a business call, not a
   technical one.
2. **Does the 30-minute accept window still apply?** It no longer guards money.
   Keeping it is defensible (a guest deserves a quick answer); so is lengthening
   it now that nothing is held.
3. **Reference code / PIN.** A booking already carries `reference`
   (`DXB-XXXXXXXXXX`). Is that the code the guest shows at the desk, or is a
   separate short PIN wanted alongside it?
4. **The wallet hold code in `BookingsService` becomes dead.** `createBooking`
   calls `walletService.hold`, and accept calls `commitHold`. Both go. The
   `WalletService.hold/commitHold/releaseHold` primitives stay — they are
   general and were the right thing to build; they are simply not what hotel
   bookings use any more.

---

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

## 2. The id blocker — DECIDED and BUILT

`GET /customer/bookings/hotels/:businessId/room-types` took a `Business.id`,
while the marketplace card carries a `MerchantProfile.id`. The customer app
could not call its own booking endpoint from a marketplace tap.

**Founder decision 2026-08-22: "take end point as merchant ID."** The route is
now `hotels/:merchantId`, resolved to the business inside
`RoomInventoryService.resolveBusinessIdForMerchant`. The customer app addresses
a merchant one way everywhere, and no card has to carry two ids.

Two tests cover it, one of which asserts the two ids are genuinely different —
otherwise the test would pass for the wrong reason.

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

> **SUPERSEDED before it was built — 2026-08-22.** Everything below this banner
> describes the **wallet-hold** model: money held on applying, a thirty-minute
> wait, and a guest without balance turned away. Founder decisions 10–13 of §0.4
> replaced that entirely, and #230 shipped the replacement:
>
> ```
> apply (nothing at stake, an empty wallet is fine)
>   → hotel accepts → 24 hours to pay through DrippleX
>   → paid, assured, and a 5-character PIN for the desk
> ```
>
> What was actually built follows that flow, not this text. Three specific
> reversals worth naming, because building to the words below would have got
> each of them wrong:
>
> - **No wallet balance check.** The "open dependency" at the end of this slice
>   — that a guest without balance cannot book — is no longer true and was the
>   main reason the model changed.
> - **Nothing is "held".** The confirmation sheet must not promise a hold; it
>   says plainly that nothing is taken yet.
> - **Two clocks, not one.** The hotel's 30 minutes to accept, then the guest's
>   24 hours to pay.
>
> Kept rather than deleted because the reasoning about _what a guest must be
> told at the moment they commit_ survived the change intact — only the facts
> being told changed. See DPX-HOTEL-003 for the settlement this created.

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
