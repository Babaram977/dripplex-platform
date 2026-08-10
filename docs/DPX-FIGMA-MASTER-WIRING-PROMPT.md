# DrippleX — ONE-SHOT Wiring Prompt (all outstanding screens)

Paste everything below into Figma Make in a single run. It covers every screen still on mock data. Already-wired screens (Home, Ride booking, Driver, Order Tracking, Store, Product, Cart, Checkout, Rider) are **done — do not touch them.**

---

## GLOBAL RULES (apply to every screen)

1. **Connect data only. No redesign. No invented endpoints. No silent mock fallback.** Every `api.*` below already exists and is verified against the real backend.
2. Import `{ api }` from `../lib/api`, `{ ws }` from `../lib/ws`, `{ auth }` from `../lib/auth`. Never re-implement fetch.
3. **Three states everywhere:** loading (spinner/skeleton) → error (real message + Retry showing `err.message`) → success. Empty list = real empty state. **Delete the mock arrays once wired.**
4. **Persona login** → `auth.setTokens(resp.accessToken, resp.refreshToken); auth.setUser(resp.user)` → then navigate.
5. **Money:** render `₦{n.toLocaleString()}`.
6. **Orders/deliveries/merchant = REST poll** every 5–8s (no socket). **Rides = socket** (`ws.*`).
7. **"No backend" actions** → show an honest **"Not available yet"** state. Never fake.

---

## 1. MERCHANT — `merchantScreen.tsx` (Dx Resto) — TOP PRIORITY, closes the food loop

**ADD a merchant login screen first** (the portal currently has none). Mirror the Rider/Driver login: email + password, prefilled `dxresto@dripplex.demo` / `Dripplex#Demo1` → `api.auth.loginMerchant({ email, password })` → persist → dashboard. Guard the portal so pages only load with a merchant session.

- **Dashboard:** `api.merchant.getBusiness()` + `api.merchant.getWallet()` + recent `api.merchant.getOrders({ pageSize: 10 })`.
- **Orders (poll `getOrders({ status: "CONFIRMED" })` every 5–8s; also PREPARING + READY tabs).** Row → `getOrder(id)` for items/total.
  - **Accept** → `api.merchant.acceptOrder(orderId)` → becomes **PREPARING** (accept _is_ preparing — no separate call).
  - **Mark Ready** → `api.merchant.markReady(orderId)` → **READY** (auto-dispatches the rider).
  - Reject `rejectOrder(orderId, reason)` · Cancel `cancelOrder(orderId, reason?)` · Delay `delayOrder(orderId, { estimatedReadyAt })`.
- **Products:** `getProducts()` · `createProduct/updateProduct/deleteProduct`.
- **Store:** `pauseStore()` / `resumeStore()`. **Earnings:** `getSettlements()` + `getWallet()` + `getWalletTransactions({ page, pageSize })`. **KYC:** `getKyc()` · `submitKycDoc({ documentType, frontImageUrl, backImageUrl? })`.

**Done when:** Dx Resto sees Mr D's real CONFIRMED order and Accept → Mark Ready advances it.

---

## 2. WALLET — `walletScreen.tsx` (customer)

- **Home:** `api.wallet.get()` (availableBalance, pendingBalance, currency). **Transactions:** `api.wallet.getTransactions({ page, pageSize })`.
- **Top Up:** `api.wallet.fund({ amount })` → open `authorizationUrl`; confirm `api.wallet.verifyFunding({ reference })`.
- **Withdraw:** `getBankAccounts()` · `addBankAccount({ bankCode, accountNumber, bankName, accountName })` · `requestWithdrawal({ amount, bankAccountId })` · `getWithdrawals()`.
- **Transfer:** `findRecipient(phone)` → `transfer({ toUserId, amount, description? })`.
- **Statement:** `getStatement({ month, year })`. **PIN:** `getPinStatus()` · `setPin({ pin })` · `verifyPin({ pin })`.

**Done when:** wallet home shows the real balance and a real transactions list.

---

## 3. MARKETPLACE — `marketplaceScreen.tsx` (customer)

Currently hardcoded `MERCHANTS` with fake ids. Wire it:

- Featured/list → `api.marketplace.getMerchants({ sort, limit })`. Search → `api.marketplace.searchMerchants({ q })`.
- Change `onStore` to `onStore?: (merchantId: string) => void` and pass the **real** `m.id`. **Delete the mock `MERCHANTS` array.**

**Done when:** tapping any merchant on Marketplace opens that merchant's real store.

---

## 4. AUTH / ACCOUNT / KYC / NOTIFICATIONS — `screensA.tsx`–`screensD.tsx`

- **Register** → `api.auth.registerCustomer({ firstName, lastName, phone, email?, password })` → **OTP** `api.auth.verifyPhone({...})` / `verifyEmail({...})`; resend `resendPhoneVerification/resendEmailVerification`.
- **Account/Profile:** load `api.auth.me()`; edit → `api.auth.updateMe({ firstName?, lastName?, profilePhotoUrl?, dateOfBirth?, gender? })`.
- **Password:** `changePassword({ currentPassword, newPassword })`; forgot → `forgotPassword({ email? , phone? })` → `resetPassword({ token, password })`.
- **KYC:** `api.kyc.get()` · `start()` · `submit({ documentType, documentNumber?, frontImageUrl, backImageUrl?, selfieUrl? })`.
- **Notifications:** `api.notifications.list({ unreadOnly?, page?, limit? })` · `markRead(id)` · `markAllRead()`.
- **Security Center hub:** "Lock my account" → `api.auth.logoutAll()`. All other sub-screens with no backend (2FA, Privacy, Consent, Language, Linked Accounts, Login Approvals, Recovery Codes, Security Questions, etc.) → **"Not available yet"**.

**Done when:** Account shows the real signed-in profile; KYC + notifications are real.

---

## 5. RIDE POLISH (light) — `rideScreen.tsx`

Booking is already live. Only add: on **Driver Assigned / En Route / Arrived / In Progress**, drive the driver card + map marker from realtime — `ws.onRideStatus` (driver name/phone) and `ws.onDriverLocation` (live lat/lng), with fallback poll `api.rides.get(rideId)`. History/receipt: `api.rides.list({ page, limit })` · `api.rides.get(id)` · `api.rides.getReceipt(id)`.

**Done when:** the assigned/en-route screens show the real driver + live position instead of placeholder.

---

**Priority if you must split:** 1 (Merchant) → 2 (Wallet) → 3 (Marketplace) → 4 (Auth/Account) → 5 (Ride polish).
When finished, just say **"done"** — Claude reads your Figma file directly, verifies every call, builds, and deploys. Report any screen needing a field/endpoint not listed here (that's a real backend gap to log, not something to invent).
