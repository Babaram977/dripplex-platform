# DrippleX — Figma Wiring Work Queue

Hand these to Figma **one job at a time** (each is independent and verifiable). Same rules as always:
**connect data only, no redesign, no invented endpoints, no silent mock fallback** — on error show a real error/retry, on empty show a real empty state. Import `{ api }` from `../lib/api`, `{ ws }` from `../lib/ws`, `{ auth }` from `../lib/auth`.

After each job: export is not needed — Claude reads your Figma file directly. Just say **"JOB N done"** and Claude pulls + builds + deploys it.

---

## JOB 1 — RIDE (customer) — unlocks the ride acceptance loop

Wire `rideScreen.tsx` screens:

- Ride Home: `api.rides.getRideTypes()`, `api.rides.getNearbyDrivers({ latitude, longitude, rideType })`
- Fare Estimate: `api.rides.estimate({ rideType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude })`
- Book → `api.rides.book({ rideType, pickup*, dropoff* })` → `ride.id`; then `ws.joinRide(ride.id)` + `ws.onRideStatus` + `ws.onDriverLocation`; fallback poll `api.rides.get(ride.id)`
- Pay (cash): `api.rides.pay(ride.id, { method: "CASH" })`; Rate: `api.rides.rateDriver(ride.id, { rating, comment })`; History: `api.rides.list()` / `api.rides.get(id)` / `api.rides.getReceipt(id)`
- No backend (show "Not available yet"): Saved Places, Schedule Ride, Promo Code, Referral, SOS, Share Trip, OPay.
  **Done when:** booking a ride creates a real ride and status updates drive the UI.

## JOB 2 — WALLET (customer) — `walletScreen.tsx`

- Home: `api.wallet.get()`; Transactions: `api.wallet.getTransactions({ page, pageSize })`
- Top Up: `api.wallet.fund({ amount })` → open `authorizationUrl`; confirm `api.wallet.verifyFunding({ reference })`
- Withdraw: `api.wallet.getBankAccounts()` / `addBankAccount(...)` / `requestWithdrawal({ amount, bankAccountId })`
- Transfer: `api.wallet.findRecipient(phone)` → `api.wallet.transfer({ toUserId, amount })`
- PIN: `api.wallet.getPinStatus/setPin/verifyPin`; Statement: `api.wallet.getStatement({ month, year })`
  **Done when:** wallet home shows the real balance and transactions list is real.

## JOB 3 — MERCHANT (Dx Resto) — `merchantScreen.tsx` — needed for the food loop

- Orders: poll `api.merchant.getOrders({ status: "CONFIRMED" })` (new cash orders land here) → then PREPARING/READY lists
- Accept → `api.merchant.acceptOrder(orderId)` (→ PREPARING); Ready → `api.merchant.markReady(orderId)` (→ READY, auto-dispatches rider)
- Reject `rejectOrder(id, reason)`; Products `api.merchant.getProducts()`; Earnings `api.merchant.getSettlements()` + `api.merchant.getWallet()`
  **Done when:** Dx Resto sees Mr D's cash order and can Accept → Ready.

## JOB 4 — DRIVER (Drip) — `driverScreen.tsx` — needed for the ride loop

- Dashboard: `api.driverRides.getAvailability()`; go online `api.driverRides.setAvailability({ online:true, acceptingRides:true, vehicleType:"ECONOMY" })`
- Offers: poll `api.driverRides.getOffers()` + `ws.onRideOffered`; accept `api.driverRides.acceptOffer(offerId)`
- Trip: `arrive(rideId)` → `start(rideId)` → `complete(rideId)`; cash `confirmCash(rideId)`; Earnings `api.driverRides.getWallet()`
  **Done when:** Drip (online) receives Mr D's ride offer and can accept → complete.

## JOB 5 — AUTH / ACCOUNT / KYC / NOTIFICATIONS — `screensA–D.tsx`

- Register `api.auth.registerCustomer(...)` → OTP `api.auth.verifyPhone/verifyEmail`; Account `api.auth.me()` / `updateMe(...)`; Password `changePassword` / `forgotPassword` → `resetPassword`
- KYC: `api.kyc.get()` / `start()` / `submit({...})`; Notifications: `api.notifications.list()` / `markRead(id)` / `markAllRead()`
- Security Center hub + all no-backend screens (2FA, Privacy, Consent, etc.) → "Not available yet"; "Lock my account" → `api.auth.logoutAll()`
  **Done when:** Account shows the real signed-in profile; KYC + notifications are real.

## JOB 6 — HOME polish — `homeScreen.tsx`

- Income / Spent tiles: compute from `api.wallet.getTransactions()` (sum credits / debits). Savings + "≈ $USD" have **no backend** → show "—" (do not hardcode).
- (Header name/avatar + balance are already real.)
  **Done when:** no hardcoded money figures remain on Home.

---

## Three App.tsx fixes to keep (so Claude's live fixes aren't overwritten on your next edit)

1. Welcome/Register **"Sign In" must route to `signin`** (the real email/password screen), NOT `returning` (the mock biometric screen). Also make the `returning` entry render `<SignInScreen .../>`.
2. Home header name/avatar read from `auth.getUser()` (not a hardcoded name).
3. **Food-loop id threading** (live now): `activeMerchantId` / `activeProductId` are threaded Home → Store → Product. Home's "View Store" passes the **real** merchant id; Store loads `api.marketplace.getMerchant(id)`; Product loads `api.marketplace.getProduct(id)`. Keep these props (`merchantId` on Store/Product, `productId` on Product, `onStore(id)` on Home) wired.

## JOB 0 — MARKETPLACE (customer) — `marketplaceScreen.tsx` — small but blocks the marketplace→store path

Marketplace is still the **mock** version: it renders a hardcoded `MERCHANTS` array with fake ids (`dx-resto`, etc.) and `onStore` passes **no id**. Because of that, tapping a merchant **from Marketplace** cannot open a real store (only the **Home** "Nearby Merchants" path is real today).
Wire it: `api.marketplace.getMerchants({ sort, limit })` for the featured/list, `api.marketplace.searchMerchants({ q })` for search; change `onStore` to `onStore?: (merchantId: string) => void` and pass the **real** `m.id`. Delete the mock `MERCHANTS`. Loading/error+Retry/empty states, no silent mock.
**Done when:** tapping any merchant on Marketplace opens that merchant's real store.

**Order to maximize the demo:** JOB 3 + JOB 4 first (they complete the two acceptance loops with the customer side Claude is finishing now), then JOB 0 (marketplace real ids), then 1/2/5/6.

---

## JOB 7 — ORDERS + LIVE ORDER TRACKING (customer) — `trackingScreen.tsx` (+ Orders list)

Completes the **customer-visible half of the food/delivery loop** — after checkout, Mr D watches his order move through prep → rider → delivered. Pairs with **JOB 3 (Merchant)**, which drives those status changes. Orders have **no socket — REST poll only** (re-fetch every 5–8s while mounted, clear on unmount).

- **Order Tracking** (after checkout, or opened from an order): poll `api.orders.get(orderId)` → drive the status stepper from the real `order.status`:
  `CONFIRMED → PREPARING → READY → DRIVER_ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED` (also handle `CANCELLED`). Show `order.total` + `order.currency` and `order.items`.
- **Rider card + ETA** (once a rider is assigned): `api.orders.getDelivery(orderId)` → `riderName`, `riderPhone`; `api.orders.getEta(orderId)` → `estimatedArrivalAt` / `remainingSeconds`. Live map trail: `api.orders.getTracking(orderId)` → `[{ latitude, longitude, recordedAt }]` (poll).
- **Payment chip:** `api.orders.getPaymentStatus(orderId)` → `PENDING`/`PAID` (cash stays `PENDING` until delivery — show "Pay on delivery", not an error).
- **Order History:** `api.orders.list({ page, pageSize })` → tap a row → tracking. Cancel while allowed → `api.orders.cancel(orderId, reason)`.
- **States:** loading skeleton · error + Retry (`err.message`) · empty ("No orders yet"). **No silent mock.**
- **No-backend rows** (Contact rider / Rate order / Reorder) → **"Not available yet"** unless an `api.ts` method exists. Do not fake.

**Done when:** after Mr D checks out (cash or bank), the tracking screen shows the **real** order status advancing as Dx Resto (JOB 3) accepts → prepares → marks ready and Drippo (rider) picks up → delivers, with the real rider name + ETA.

Import `{ api }` from `../lib/api`; poll (no `ws` for orders); render money as `₦{n.toLocaleString()}`.

---

## JOB 8 — MERCHANT (Dx Resto) — `merchantScreen.tsx` — closes the food loop

This is the **merchant side that drives the statuses Mr D watches in JOB 7**. Without it, a cash order sits at CONFIRMED forever. Merchant persona; **REST poll** (no socket for orders). Import `{ api }` from `../lib/api`, `{ auth }` from `../lib/auth`. Money as `₦{n.toLocaleString()}`.

- **Login (persona) — ADD THIS SCREEN.** The merchant portal currently has **no login** (it drops straight into the dashboard on mock data), unlike Driver/Rider which each have a persona sign-in. Add a "Dx Resto sign-in" screen (mirror `RiderLoginScreen`/`DriverLoginScreen`: email + password, prefilled with the demo creds) that calls `api.auth.loginMerchant({ email, password })` → persist (`auth.setTokens(resp.accessToken, resp.refreshToken); auth.setUser(resp.user)`) → then the dashboard. Demo: `dxresto@dripplex.demo` / `DrippleX#Demo1`. Guard the portal so its pages only load once a merchant session exists.
- **Dashboard:** `api.merchant.getBusiness()` (name, open/paused) + `api.merchant.getWallet()` (balance) + recent `api.merchant.getOrders({ pageSize: 10 })`.
- **Incoming orders (the important one):** poll `api.merchant.getOrders({ status: "CONFIRMED" })` every 5–8s → new cash/bank orders land here. Also keep PREPARING and READY tabs (`getOrders({ status: "PREPARING" })` / `{ status: "READY" }`). Each row → `api.merchant.getOrder(id)` for items/total.
- **Actions (drive the customer's tracker):**
  - Accept → `api.merchant.acceptOrder(orderId)` → order becomes **PREPARING** (there is **no** separate "start preparing" call — accept _is_ preparing).
  - Mark Ready → `api.merchant.markReady(orderId)` → **READY**, which **auto-dispatches a rider** (Drippo).
  - Reject → `api.merchant.rejectOrder(orderId, reason)`; Cancel → `cancelOrder(orderId, reason?)`; Delay → `delayOrder(orderId, { estimatedReadyAt })` (ISO string).
- **Products:** `api.merchant.getProducts()`; create/update/delete via `createProduct/updateProduct/deleteProduct`.
- **Store pause/resume:** `api.merchant.pauseStore()` / `resumeStore()`.
- **Earnings:** `api.merchant.getSettlements()` + `api.merchant.getWallet()` + `getWalletTransactions({ page, pageSize })`.
- **KYC:** `api.merchant.getKyc()` · `submitKycDoc({ documentType, frontImageUrl, backImageUrl? })`.
- **States:** loading · error+Retry (`err.message`) · empty ("No new orders"). **No silent mock.**
- **No-backend rows** (chat with customer, print receipt, analytics charts) → **"Not available yet"**. Don't fake.

**Done when:** Dx Resto logs in, sees Mr D's real CONFIRMED order, and **Accept → Mark Ready** advances it — and Mr D's JOB 7 tracker moves Confirmed → Preparing → Ready → (rider dispatched) in real time.

---

## Backend seed note (for the merchant-bank checkout option)

The `MERCHANT_DIRECT` (bank-transfer) checkout option reads Dx Resto's default bank via `GET /customer/orders/:id/merchant-bank`. That bank row is created by `prisma/seed-demo.cjs` (`DEMO_BANK_ACCOUNT`), but prod's `preDeployCommand` only runs `seed-rbac.cjs`. **Re-run `node prisma/seed-demo.cjs` against prod once** so the bank exists, otherwise the bank option 404s. Cash-on-delivery is unaffected.
