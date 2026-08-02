# RIDE-003 — Slice 3: Ride Completion

## Implemented screens

Real source, ported: `TripCompletedScreen`, `PaymentScreen`,
`WalletPaySuccessScreen`, `TipDriverScreen`, `RateDriverScreen`,
`TripReceiptScreen`, `ReportTripScreen`. Generated, extending the same
locked design language (full record in
`docs/RIDE-003-GENERATED-SCREENS.md`): `GatewayPaymentScreen`,
`CashPaymentScreen`.

## Backend APIs consumed

`POST /customer/rides/:id/pay`, `POST /customer/rides/:id/pay/verify`,
`POST /customer/rides/:id/tip`, `POST /customer/rides/:id/rate-driver`,
`GET /customer/rides/:id/receipt`, `POST /customer/rides/:id/report`, plus
the pre-existing customer wallet balance endpoint (`useCustomerWallet`,
reused as-is, not Ride-specific). No new backend endpoints this slice —
everything needed already existed from Phase 0.

## WebSocket events

`ride:status` (`COMPLETED` transition out of `RideInProgressScreen`),
`ride:payment` (cache invalidation driving `CashPaymentScreen`'s real
waiting state and `GatewayPaymentScreen`'s post-verify state).

## Real behaviors that reshaped the flow (not just the visuals)

1. **Payment isn't automatic.** The received `TripCompletedScreen` only had
   `onRate`/`onHome` — it assumed payment already happened by the time the
   trip ends. The real backend never auto-charges; the customer has to
   explicitly call `initiatePayment`. Adapted the flow order: Trip
   Completed → Payment → (method-specific) → Success → Rate → Tip, not
   straight to Rate. This also matches a real dependency the backend
   enforces — `tipDriver()` rejects with "Ride must be paid before it can
   be tipped" if attempted first.

2. **No stored-card concept.** The mock's "Visa Card •••• 4821" option
   doesn't correspond to anything in `RidePaymentMethod`
   (`WALLET`/`CASH`/`PAYSTACK`/`FLUTTERWAVE`/`OPAY`). `PaymentScreen`'s
   method list was adapted to the real five, with a real wallet-balance
   check (`useCustomerWallet`) disabling Wallet when the balance is
   insufficient — a real constraint, not decorative.

3. **Cash payment is driver-confirmed, not customer-confirmed.** Verified
   in `ride-payment.service.ts`: `selectCash()` (called by the customer via
   `initiatePayment`) only records `paymentMethod: CASH` — it does not set
   `paymentStatus: PAID`. Only the driver's `confirmCash()` (a
   driver-only, customer-unreachable action) does that. The generated
   `CashPaymentScreen` reflects this honestly: a real waiting state driven
   by the ride's actual `paymentStatus`, not an immediate fake "confirmed."

4. **Gateway payments (Paystack/Flutterwave/OPay) are one contract, not
   three.** `GATEWAY_METHODS` in `ride-payment.service.ts` treats all three
   identically — same `initiatePayment` → `authorizationUrl` redirect →
   `verifyPayment` on return. One generated `GatewayPaymentScreen` covers
   all three (parametrized by `authorizationUrl`) instead of building three
   near-duplicate screens, resolving the original gap question ("does OPay
   return a session_token for embedded checkout?" — no, it's a redirect,
   server-side, same as the other two).

5. **The redirect actually round-trips.** `PaymentScreen` sets
   `callbackUrl` to `${origin}/ride?rideId=...&payVerify=1`. `RideFlow`
   checks those query params on mount (`useResumeScreen`, via
   `next/navigation`'s `useSearchParams`) and resumes straight into
   `GatewayPaymentScreen`'s verifying state — a real, working resume path,
   not just a screen that assumes it'll never actually be reached via a
   redirect.

6. **Driver name is real, post-completion, unlike during the active ride.**
   `GET /customer/rides/:id/receipt` exposes `RideReceiptDriverDto.name`
   (and `phone`) — a real name, not an opaque ID. `TipDriverScreen` and
   `RateDriverScreen` use it (via `useRideReceipt`), a genuine improvement
   over the "Your driver" placeholder that Slice 2's active-ride screens
   are stuck with (no such endpoint exists before `COMPLETED`). Still no
   photo/vehicle-model/plate at any stage — `RideReceiptDriverDto` doesn't
   have those fields either.

7. **Rating drops the freeform tag chips.** `RateRideRequest` has
   `rating`/`comment`/a fixed `categoryRatings` shape — no field for
   arbitrary tags like the mock's "Safe driving"/"Friendly" chips. Rather
   than invent a mapping from tag labels onto `categoryRatings` (guessing
   at meaning the backend never defined), the tag picker was dropped;
   stars + comment are wired to the two real fields.

8. **Report categories are the real enum, not the mock's list.** The mock
   had "Wrong route" and "Cancelled by driver" among its options — neither
   maps to a real `RideProblemCategory`
   (`WRONG_FARE`/`DRIVER_BEHAVIOUR`/`UNSAFE_DRIVING`/`LOST_ITEM`/
   `VEHICLE_ISSUE`/`OTHER`), and "cancelled by driver" isn't a problem
   report at all — it's a cancellation reason, already captured elsewhere
   in the ride record. Dropped rather than mapped to something they don't
   mean. No photo attachment either — confirmed `ReportRideProblemRequest`
   has no such field (this was flagged as an open gap back in Phase 0's
   integration map; now confirmed unresolved).

9. **No PDF receipt.** The mock's "Download PDF Receipt" button has no
   backing field — `RideReceiptDto` has no `pdf_url` (another Phase 0 gap
   question, now confirmed: no). Omitted rather than wired to nothing.

## Verification

- `apps/customer-web`: `npx tsc --noEmit` clean; `npx eslint` clean across
  all new/changed files; `npx vitest run` 4/4 passed (unchanged); `npm run
build` clean — `/ride` route present (29.0 kB, up from 25.0 kB in Slice
  2), all 21 routes still generate.
- Backend/SDK: unchanged this slice (no new endpoints, no new SDK
  methods) — Slice 1's backend/SDK verification stands.

## Defects found

None in already-shipped backend code. Items 1-9 above are all genuine
capability/flow mismatches between the received mock and real backend
behavior, each handled by adapting the frontend rather than reporting a
"bug."
