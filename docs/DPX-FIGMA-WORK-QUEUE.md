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

## Two App.tsx fixes to keep (so Claude's live fixes aren't overwritten on your next edit)
1. Welcome/Register **"Sign In" must route to `signin`** (the real email/password screen), NOT `returning` (the mock biometric screen). Also make the `returning` entry render `<SignInScreen .../>`.
2. Home header name/avatar read from `auth.getUser()` (not a hardcoded name).

**Order to maximize the demo:** JOB 3 + JOB 4 first (they complete the two acceptance loops with the customer side Claude is finishing now), then 1/2/5/6.
