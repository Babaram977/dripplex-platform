# DrippleX — Figma Make Screen-Wiring Brief

Paste this into Figma Make's builder. It wires each screen to the **already-built**
`src/lib/api.ts` + `src/lib/ws.ts` integration layer. **Do not create a new API client,
do not invent endpoints, do not redesign any screen.** Connect data only.

---

## 0. FIRST — apply this fix to `src/lib/ws.ts`

Two lines are wrong and will break realtime against the real backend:

1. Send the **raw** access token (NOT `"Bearer " + token`). The backend reads
   `handshake.auth.token` verbatim.
2. Put the namespace in the **URL** — socket.io-client has no `namespace` option.

```ts
// getSocket():
const token = auth.getAccessToken();
_socket = io(`${SOCKET_URL}/rides`, {
  path: '/socket.io',
  transports: ['websocket'],
  auth: { token: token ?? '' }, // RAW token, no "Bearer "
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});

// updateAuth():
_socket.auth = { token: token ?? '' }; // RAW token, no "Bearer "
```

---

## 1. Global rules for every screen

- Import from the existing layer: `import { api } from "../lib/api"` and `import { ws } from "../lib/ws"` (paths as they resolve in your tree). Never re-implement fetch.
- **On mount**, call the relevant `api.*` method inside the screen's data hook (use `useApiCall` if present, or `useEffect`).
- **Three explicit states, no silent mock:** loading → skeleton/spinner; error → the screen's real error/retry UI (show `err.message`); success → render the real data. **Never fall back to mock data as if it were real.** If a list is empty, show the real empty state.
- **Auth persistence:** on any login screen, call the persona login, then persist via the ApiProvider (`loginWithResponse(resp)`) or `auth.setTokens(resp.accessToken, resp.refreshToken); auth.setUser(resp.user)`, then navigate. Guard authed screens on `auth.isLoggedIn()`.
- **Money:** amounts are numbers in minor units? No — they are plain numbers with a sibling `currency` (e.g. `"NGN"`). Render `₦{amount.toLocaleString()}`.
- **Polling** (no socket for orders/deliveries): re-call the status endpoint every 5–10s while a screen is active; clear the interval on unmount.
- **Realtime** (rides only): `ws.joinRide(rideId)` on entering an active-ride screen; subscribe with `ws.onRideStatus`, `ws.onDriverLocation`, `ws.onRideOffered`; call the returned unsubscribe on unmount.

---

## 2. LOGIN screens → persona-specific

| Screen           | Call                                          |
| ---------------- | --------------------------------------------- |
| Customer Sign In | `api.auth.loginCustomer({ email, password })` |
| Driver Login     | `api.auth.loginDriver({ email, password })`   |
| Rider Login      | `api.auth.loginRider({ email, password })`    |
| Merchant Login   | `api.auth.loginMerchant({ email, password })` |

On success persist tokens+user (see rule above) and route to that persona's home. `email` OR `phone` accepted.

**Demo accounts** (password `Dripplex#Demo1`): Mr D `mrd@dripplex.demo` · Drip `drip@dripplex.demo` · Drippo `drippo@dripplex.demo` · Dx Resto `dxresto@dripplex.demo`.

---

## 3. CUSTOMER — FOOD loop (Mr D → Dx Resto → CASH)

| Screen           | Wire to                                                                                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home             | balance `api.wallet.get()` · nearby merchants `api.marketplace.getMerchants({ sort: "recommended", limit: 6 })` (Dx Resto appears here) · recommended `api.marketplace.getFeaturedProducts({ limit: 8 })` · categories `api.marketplace.getCategories()`                            |
| Marketplace      | `api.marketplace.getMerchants(params)` · search `api.marketplace.searchMerchants(query)`                                                                                                                                                                                            |
| Store (Dx Resto) | `api.marketplace.getMerchant(merchantId)` (returns merchant + its products)                                                                                                                                                                                                         |
| Product Detail   | `api.marketplace.getProduct(productId)`                                                                                                                                                                                                                                             |
| Add to cart      | `api.cart.addItem({ merchantId, productId, productName, unitPrice, quantity })`                                                                                                                                                                                                     |
| Cart             | load `api.cart.get()` · qty `api.cart.updateItem(itemId, qty)` · remove `api.cart.removeItem(itemId)`                                                                                                                                                                               |
| Checkout         | 1) `api.orders.checkout({ cartId, fulfillmentType: "DELIVERY", deliveryAddressId })` → get `order.id` 2) let the customer pick a payment method (see **§3a**) → `api.orders.pay(order.id, { provider })` → order becomes **CONFIRMED**. Show confirmation with `order.orderNumber`. |
| Order Tracking   | poll `api.orders.get(orderId)` (status) + `api.orders.getDelivery(orderId)` (rider name/phone once assigned) + `api.orders.getTracking(orderId)` + `api.orders.getEta(orderId)`                                                                                                     |

---

## 3a. Checkout — payment method options

At checkout, after `api.orders.checkout(...)` returns the `order`, show a payment-method
picker, then call `api.orders.pay(order.id, { provider })` with the chosen `provider`.
**For the demo, offer these two (card gateways stay dormant):**

| Option shown to customer | `provider`          | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cash on Delivery**     | `"CASH"`            | Order → CONFIRMED, `paymentStatus` PENDING; the rider collects cash at delivery; settlement fires on delivery. Nothing else to show.                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Pay to Merchant Bank** | `"MERCHANT_DIRECT"` | 1) Before paying, call `api.orders.getMerchantBank(order.id)` → `{ bankName, accountName, accountNumber, currency }` and **display it** so the customer can transfer. 2) After they confirm they've transferred, call `api.orders.pay(order.id, { provider: "MERCHANT_DIRECT" })` → order CONFIRMED. **DrippleX does not verify the transfer** — `paymentStatus` stays PENDING for the order's life; commission is accrued to the merchant. Show a "we've marked your order as placed; the merchant will confirm your transfer" note. |

(Wallet is also available via `provider: "WALLET"` — `api.wallet.get()` shows the balance — but Cash and Merchant-Bank are the two the founder asked to surface.)

`api.orders.getMerchantBank(orderId)` is a **new** method — add it to `src/lib/api.ts` under the
`orders` namespace:

```ts
getMerchantBank: (orderId: string) =>
  dx<{ bankName: string; accountName: string; accountNumber: string; currency: string }>(
    "GET", `/customer/orders/${orderId}/merchant-bank`),
```

---

## 4. MERCHANT — Dx Resto

| Screen                | Wire to                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Orders (incoming)     | poll `api.merchant.getOrders({ status: "CONFIRMED" })` (new cash orders land here)                |
| Accept                | `api.merchant.acceptOrder(orderId)` → moves order to **PREPARING** (no separate "preparing" call) |
| Mark Ready            | `api.merchant.markReady(orderId)` → **READY**; backend auto-creates the rider delivery job        |
| Reject                | `api.merchant.rejectOrder(orderId, reason)`                                                       |
| Products              | `api.merchant.getProducts()`                                                                      |
| Earnings / Settlement | `api.merchant.getSettlements()` · wallet `api.merchant.getWallet()`                               |

---

## 5. RIDER — Drippo (delivery)

| Screen              | Wire to                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Availability toggle | `api.rider.setAvailability({ online: true, acceptingOrders: true })` (send only these — omit lat/lng so seeded location is kept) |
| Jobs list           | poll `api.rider.getJobs()` (the Dx Resto job appears after merchant marks READY)                                                 |
| Accept              | `api.rider.acceptJob(jobId)`                                                                                                     |
| Picked up           | `api.rider.pickup(jobId)`                                                                                                        |
| Arrived             | `api.rider.arrived(jobId)`                                                                                                       |
| Deliver             | `api.rider.deliver(jobId, { proofType: "PHOTO", photoUrl })` **or** `{ proofType: "OTP", otp }`                                  |
| Confirm cash        | `api.rider.confirmCash(jobId, amountCollected)`                                                                                  |
| Earnings            | `api.rider.getWallet()`                                                                                                          |

---

## 6. CUSTOMER — RIDE loop (Mr D → Drip)

| Screen                       | Wire to                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ride Home                    | ride types `api.rides.getRideTypes()` · nearby drivers `api.rides.getNearbyDrivers({ latitude, longitude, rideType })`                                                         |
| Fare Estimate                | `api.rides.estimate({ rideType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude })`                                                                         |
| Book / Finding driver        | `api.rides.book({ rideType, pickup*, dropoff* })` → `ride.id`; then `ws.joinRide(ride.id)` + `ws.onRideStatus` + `ws.onDriverLocation`; fallback poll `api.rides.get(ride.id)` |
| Trip in progress / completed | driven by `ws.onRideStatus` (DRIVER_ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED)                                                                                              |
| Pay (cash)                   | `api.rides.pay(ride.id, { method: "CASH" })`                                                                                                                                   |
| Rate driver                  | `api.rides.rateDriver(ride.id, { rating, comment })`                                                                                                                           |

---

## 7. DRIVER — Drip

| Screen                 | Wire to                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard / go online  | `api.driverRides.setAvailability({ online: true, acceptingRides: true, vehicleType: "ECONOMY" })` · current `api.driverRides.getAvailability()` |
| Incoming request       | poll `api.driverRides.getOffers()` + `ws.onRideOffered`; preview then `api.driverRides.acceptOffer(offerId)`                                    |
| Nav to pickup / arrive | `api.driverRides.arrive(rideId)`                                                                                                                |
| Start trip             | `api.driverRides.start(rideId)`                                                                                                                 |
| Complete               | `api.driverRides.complete(rideId)`                                                                                                              |
| Cash confirm           | `api.driverRides.confirmCash(rideId)`                                                                                                           |
| Earnings               | `api.driverRides.getWallet()`                                                                                                                   |

---

## 8. Acceptance loops these must satisfy

**Ride:** Mr D books → Drip (online) gets offer → accepts → arrive → start → complete → cash confirm → 10% commission/settlement → Mr D sees completion.

**Food (cash):** Mr D orders from Dx Resto → checkout `provider: "CASH"` (CONFIRMED) → Dx Resto accept (PREPARING) → ready (READY, auto-dispatch) → Drippo sees job → accept → pickup → deliver → confirm cash → merchant settlement → Mr D sees completion.

When each screen is wired: export the project and hand it back — I verify against this contract, build, and deploy for the live run. **Report if any screen needs a field/endpoint not in `api.ts`** — that's a real gap to log, not something to invent.
