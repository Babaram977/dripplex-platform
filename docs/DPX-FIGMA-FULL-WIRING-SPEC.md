# DrippleX — Full Screen-Wiring Spec (paste into Figma Make)

Wire EVERY screen below to the already-built `src/lib/api.ts` + `src/lib/ws.ts`.
**Do not create a new API client, do not invent endpoints, do not redesign.** Connect data only.
Every `api.*` / `ws.*` name below exists and is verified against the real backend.

## Global rules (apply to every screen)

1. Import `{ api }` from `../lib/api`, `{ ws }` from `../lib/ws`, `{ auth }` from `../lib/auth`. Never re-implement fetch.
2. **Three states, NEVER silent mock:** loading → spinner/skeleton; error → real error + Retry showing `err.message`; success → real data. Empty list → real empty state. **Do not fall back to mock data. Delete the mock arrays once a screen is wired.**
3. **Login persistence:** persona login → persist via `ApiProvider.loginWithResponse(resp)` (or `auth.setTokens(resp.accessToken, resp.refreshToken); auth.setUser(resp.user)`) → navigate. Guard authed screens with `auth.isLoggedIn()`.
4. **Money:** numbers + a sibling `currency` (`"NGN"`). Render `₦{n.toLocaleString()}`.
5. **Polling** (orders/deliveries — no socket): re-fetch status every 5–10s while mounted; clear on unmount.
6. **Realtime** (rides only): `ws.joinRide(rideId)` on active-ride screens; `ws.onRideStatus/onDriverLocation/onRideOffered`; call the returned unsubscribe on unmount.
7. **"No backend" rows:** keep the screen visually, but its actions show an honest **"Not available yet"** state. Do NOT fake data or calls.

---

## AUTH & ACCOUNT (screensA–D)

| Screen                                                                                                                                                                                                            | Wire to                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register                                                                                                                                                                                                          | `api.auth.registerCustomer({ firstName, lastName, phone, email?, password })` → then OTP                                                              |
| OTP verify                                                                                                                                                                                                        | `api.auth.verifyPhone({...})` / `api.auth.verifyEmail({...})`; resend → `api.auth.resendPhoneVerification/resendEmailVerification`                    |
| Sign In (persona)                                                                                                                                                                                                 | `api.auth.loginCustomer` / `loginDriver` / `loginRider` / `loginMerchant` (persist + route)                                                           |
| Account / Profile                                                                                                                                                                                                 | load `api.auth.me()`; edit → `api.auth.updateMe({ firstName?, lastName?, profilePhotoUrl?, dateOfBirth?, gender? })`                                  |
| Change password                                                                                                                                                                                                   | `api.auth.changePassword({ currentPassword, newPassword })`                                                                                           |
| Forgot / reset password                                                                                                                                                                                           | `api.auth.forgotPassword({ email? , phone? })` → `api.auth.resetPassword({ token, password })`                                                        |
| Sessions / Trusted Devices                                                                                                                                                                                        | list `api.auth`… sessions: **backend exists but not in api.ts yet** → add `GET /auth/sessions` if needed, else mark "Not available yet"               |
| Identity Verification (KYC)                                                                                                                                                                                       | status `api.kyc.get()`; start `api.kyc.start()`; submit `api.kyc.submit({ documentType, documentNumber?, frontImageUrl, backImageUrl?, selfieUrl? })` |
| Security Center (hub)                                                                                                                                                                                             | render hub; each sub-link that has no backend → **"Not available yet"**; "Lock my account" → `api.auth.logoutAll()`                                   |
| 2FA · Privacy · Consent · Language · Accessibility · Linked Accounts · Login Approvals · Recovery Codes · Security Questions · Account Transfer/Suspension · Connected Services · Emergency Protection · Username | **No backend** → keep screen, show "Not available yet". Do not fake.                                                                                  |
| Notification Preferences                                                                                                                                                                                          | **backend exists** (notification-center) — if not in api.ts, mark "Not available yet" until a method is added                                         |

---

## HOME + MARKETPLACE (already wired — reference)

Home `api.wallet.get` + `api.marketplace.getMerchants`; Marketplace `getMerchants`/`searchMerchants`; Store `api.marketplace.getMerchant(id)`; Product `api.marketplace.getProduct(id)`; Add-to-cart `api.cart.addItem`; Cart `api.cart.get/updateItem/removeItem`; Checkout `api.orders.checkout` + payment picker (CASH / MERCHANT_DIRECT via `api.orders.getMerchantBank`); Tracking `api.orders.get/getDelivery/getTracking/getEta`.

---

## RIDE (customer)

| Screen                                                                                           | Wire to                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ride Home / Home Extended                                                                        | `api.rides.getRideTypes()` · `api.rides.getNearbyDrivers({ latitude, longitude, rideType })`                                                                              |
| Destination Search / Pickup Confirm                                                              | local map input → produces pickup/dropoff lat/lng (Google Maps key = `VITE_GOOGLE_MAPS_KEY`)                                                                              |
| Fare Estimate                                                                                    | `api.rides.estimate({ rideType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude })`                                                                    |
| Finding Driver / Driver Assigned / En Route / Arrived / In Progress / Live Tracking              | book once: `api.rides.book({ rideType, pickup*, dropoff* })` → `ride.id`; drive UI from `ws.onRideStatus` + `ws.onDriverLocation`; fallback poll `api.rides.get(ride.id)` |
| Trip Completed                                                                                   | from `ws.onRideStatus === "COMPLETED"` or `api.rides.get`                                                                                                                 |
| Payment / Cash Payment / Pay Success                                                             | `api.rides.pay(ride.id, { method: "CASH" })` (WALLET also allowed)                                                                                                        |
| Rate Driver                                                                                      | `api.rides.rateDriver(ride.id, { rating, comment? })`                                                                                                                     |
| Tip Driver                                                                                       | `api.rides.tip(ride.id, amount)`                                                                                                                                          |
| Report Trip                                                                                      | `api.rides.report(ride.id, { category, description? })`                                                                                                                   |
| Ride History / Ride Detail / Trip Receipt                                                        | `api.rides.list({ page, limit })` · `api.rides.get(id)` · `api.rides.getReceipt(id)`                                                                                      |
| Cancel                                                                                           | `api.rides.cancel(id, reason?)`                                                                                                                                           |
| Saved Places · Schedule Ride · Promo Code · Referral · Emergency SOS · Share Trip · OPay Payment | **No backend in api.ts** → "Not available yet" (don't fake)                                                                                                               |

---

## WALLET (customer)

| Screen                               | Wire to                                                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet Home                          | `api.wallet.get()` (availableBalance, pendingBalance, currency)                                                                                                                                                                  |
| Transaction History                  | `api.wallet.getTransactions({ page, pageSize, type? })`                                                                                                                                                                          |
| Top Up                               | `api.wallet.fund({ amount, provider? })` → `{ authorizationUrl }` (open it); confirm `api.wallet.verifyFunding({ reference? })`                                                                                                  |
| Withdraw                             | banks `api.wallet.getBankAccounts()`; add `api.wallet.addBankAccount({ bankCode, accountNumber, bankName, accountName })`; request `api.wallet.requestWithdrawal({ amount, bankAccountId })`; list `api.wallet.getWithdrawals()` |
| Transfer                             | find `api.wallet.findRecipient(phone)`; send `api.wallet.transfer({ toUserId, amount, description? })`                                                                                                                           |
| Statement                            | `api.wallet.getStatement({ month, year })`                                                                                                                                                                                       |
| Security (PIN)                       | `api.wallet.getPinStatus()` · `api.wallet.setPin({ pin })` · `api.wallet.verifyPin({ pin })`                                                                                                                                     |
| Payment Methods / Rewards / Settings | Payment Methods = bank accounts (above). Rewards/loyalty → if no api.ts method, "Not available yet".                                                                                                                             |

---

## MERCHANT (Dx Resto)

| Screen                  | Wire to                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Dashboard               | `api.merchant.getBusiness()` + `api.merchant.getWallet()` + recent `api.merchant.getOrders({ pageSize: 10 })` |
| Orders (incoming)       | poll `api.merchant.getOrders({ status: "CONFIRMED" })`; then PREPARING/READY lists                            |
| Accept                  | `api.merchant.acceptOrder(orderId)` → PREPARING                                                               |
| Mark Ready              | `api.merchant.markReady(orderId)` → READY (auto-creates rider job)                                            |
| Reject / Cancel / Delay | `rejectOrder(id, reason)` · `cancelOrder(id, reason?)` · `delayOrder(id, { estimatedReadyAt })`               |
| Products                | `api.merchant.getProducts()`; create/update/delete `createProduct/updateProduct/deleteProduct`                |
| Store (pause/resume)    | `api.merchant.pauseStore()` / `resumeStore()`; profile `getBusiness/updateBusiness`                           |
| Earnings / Settlement   | `api.merchant.getSettlements()` + `api.merchant.getWallet()` + `getWalletTransactions()`                      |
| KYC                     | `api.merchant.getKyc()` · `submitKycDoc({ documentType, frontImageUrl, backImageUrl? })`                      |
| Bank                    | `api.merchant`… (merchant bank is managed via merchant endpoints; if not in api.ts, mark "Not available yet") |

---

## DRIVER (Drip)

| Screen                                                                 | Wire to                                                                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                                                              | `api.driverRides.getAvailability()`; toggle online `api.driverRides.setAvailability({ online, acceptingRides, vehicleType })`; active `api.driverRides.getActive()` |
| Incoming Request                                                       | poll `api.driverRides.getOffers()` + `ws.onRideOffered`; accept `api.driverRides.acceptOffer(offerId)`; decline `declineOffer(offerId)`                             |
| Nav to Pickup / Verify Passenger / Arrive                              | `api.driverRides.arrive(rideId)`                                                                                                                                    |
| Trip In Progress                                                       | `api.driverRides.start(rideId)`; push GPS via `ws.pushLocation(rideId, coords)`                                                                                     |
| Trip Completed                                                         | `api.driverRides.complete(rideId)`; cash `api.driverRides.confirmCash(rideId)`; rate `rateCustomer(id, {rating})`                                                   |
| Earnings                                                               | `api.driverRides.getWallet()` + `getWalletTransactions()`                                                                                                           |
| KYC Status / Upload Docs / Vehicle Reg / Emergency Contact / Agreement | driver onboarding — if not in api.ts, mark "Not available yet" (backend exists in SDK but not exposed in this api.ts)                                               |

---

## RIDER (Drippo) — already wired (reference)

`api.auth.loginRider`; `api.rider.setAvailability({ online, acceptingOrders })`; jobs `getJobs/getJob`; `acceptJob/pickup/arrived/deliver({proofType})/confirmCash(id, amount)`; `getWallet`.

---

## NOTIFICATIONS

`api.notifications.list({ unreadOnly?, page?, limit? })` · `markRead(id)` · `markAllRead()`.

---

## OUT OF SCOPE for the Super App

Admin / Operations console screens are **desktop** and stay in their own portals — do not wire them into the mobile Super App.

---

**When done:** export and hand back. I verify every wired screen against the contract, build, and deploy. **Report any screen that needs a field/endpoint not in `api.ts`** — that's a real backend gap to log (I'll add the endpoint), not something to invent.
