# DrippleX — Backend API Contract (for Figma Make)

> Machine-readable contract of the **real** DrippleX backend. Every endpoint below was
> extracted from actual code (NestJS controllers + the `@dripplex/sdk` client). Paths and
> shapes are cited to their source files. **Nothing here is invented.**

---

## READ THIS FIRST — for the Figma Make builder

1. **Base URL (production):** `https://api.dripplex.com/api/v1`
   The global prefix `api/v1` is set in `apps/backend/src/main.ts` (`app.setGlobalPrefix(appConfig.apiGlobalPrefix)`, default `api/v1` from `config/env.validation.ts`). **Every path in this document is relative to that base URL.**

2. **UNWRAP THE ENVELOPE.** Every success response is wrapped:

   ```json
   { "success": true, "data": <T> }
   ```

   Your API client MUST return `response.data`. The response shapes documented below are the **`data` payload `<T>`** — they are already unwrapped. (Source: `apps/backend/src/common/dto/api-response.dto.ts` → `ApiSuccessResponse<T>`.)

3. **Error envelope** (Source: `common/dto/api-response.dto.ts` → `ApiErrorResponse`, emitted by `common/filters/global-exception.filter.ts`):

   ```json
   {
     "success": false,
     "statusCode": 400,
     "errorCode": "VALIDATION_ERROR",
     "message": "human readable message",
     "details": {}, // optional
     "path": "/api/v1/...",
     "timestamp": "ISO-8601",
     "correlationId": "..." // optional
   }
   ```

   Detect errors with `success === false` (or non-2xx HTTP status), and surface `message` / `errorCode`.

4. **Auth = Bearer token.** After login, send `Authorization: Bearer <accessToken>` on every authenticated request. (Source: `packages/sdk/src/client/http-client.ts`.)

5. **DO NOT invent hosts or paths.** Ignore any earlier draft that used `api.dripplexapp.com`, `wss://api.dripplexapp.com/ws`, `/ride/trips`, or similar. **Those are fictional.** Use ONLY the endpoints in this document. If a capability isn't listed here, it does not exist — see the **GAPS** section at the end.

6. **Persona logins are separate endpoints.** There is no single `/auth/login`; each portal has its own (`/auth/login/customer`, `/driver`, `/rider`, `/merchant`, plus `admin`, `operations`).

7. **IDs are path params** (`/customer/orders/{id}`). **Filters/pagination are query strings** (`?page=1&pageSize=20`).

---

## Global conventions

- **Pagination (offset):** most authenticated lists return
  `PaginatedResult<T> = { items: T[]; total: number; page: number; pageSize: number; ... }`.
  Query params: `page`, `pageSize` (rides use `page` + `limit`).
- **Pagination (cursor):** public marketplace browse returns
  `CursorPaginatedResult<T> = { items: T[]; nextCursor: string | null; ... }`.
  Query params: `cursor`, `limit`.
- **Money:** integer/number minor-unit amounts with a sibling `currency` string (e.g. `"NGN"`). Do not assume a currency symbol.
- **Timestamps:** ISO-8601 strings.
- **`auth: false`** in the tables = public endpoint (no Bearer needed). Everything else needs the Bearer token.

---

## 1. AUTH

Source: `packages/sdk/src/auth/auth-api.ts`; controllers `apps/backend/src/auth/controllers/{login,registration,verification}.controller.ts`, `apps/backend/src/auth/auth.controller.ts`.

### Registration

| METHOD | PATH                      | auth | Request body                                                       | Response `data`                                              |
| ------ | ------------------------- | ---- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| POST   | `/auth/register/customer` | no   | CustomerRegistrationValues (name, phone, optional email, password) | `RegistrationResponse`                                       |
| POST   | `/auth/register/merchant` | no   | MerchantRegistrationValues                                         | `RegistrationResponse`                                       |
| POST   | `/auth/register/rider`    | no   | RiderRegistrationValues                                            | `RegistrationResponse`                                       |
| POST   | `/auth/register/driver`   | no   | DriverRegistrationValues                                           | `RegistrationResponse`                                       |
| POST   | `/auth/roles/driver`      | yes  | (none)                                                             | `AddRoleResponse` — "Become a Driver" on an existing account |
| POST   | `/auth/roles/merchant`    | yes  | (none)                                                             | `AddRoleResponse` — "Become a Merchant"                      |

`RegistrationResponse = { userId, email: string|null, status: UserStatus, verification: {...}, profileId?, onboardingId? }`.

### Login (persona-specific)

Body (all six) = **PortalLoginDto**: `{ email?: string, phone?: string, password: string }` — **either `email` OR `phone` is required.**

| METHOD | PATH                     | auth | Response `data`       |
| ------ | ------------------------ | ---- | --------------------- |
| POST   | `/auth/login/customer`   | no   | `PortalLoginResponse` |
| POST   | `/auth/login/driver`     | no   | `PortalLoginResponse` |
| POST   | `/auth/login/rider`      | no   | `PortalLoginResponse` |
| POST   | `/auth/login/merchant`   | no   | `PortalLoginResponse` |
| POST   | `/auth/login/admin`      | no   | `PortalLoginResponse` |
| POST   | `/auth/login/operations` | no   | `PortalLoginResponse` |

```
PortalLoginResponse = {
  user: AuthUserProfile,
  session: { ... },
  accessToken: string,
  refreshToken: string,
  expiresIn: string,
  tokenType: "Bearer"
}
AuthUserProfile = {
  id, email, phone: string|null, firstName, lastName,
  profilePhotoUrl: string|null, dateOfBirth: string|null, gender: string|null,
  status: UserStatus, roles: string[], permissions: string[]
}
```

### OTP / verification

| METHOD | PATH                        | auth | Request                                   | Response                        |
| ------ | --------------------------- | ---- | ----------------------------------------- | ------------------------------- |
| POST   | `/auth/verify/email`        | no   | `{ ...VerifyEmailValues }` (6-digit code) | `EmailVerificationResponse`     |
| POST   | `/auth/verify/phone`        | no   | `{ ...VerifyPhoneValues }` (6-digit code) | `PhoneVerificationResponse`     |
| POST   | `/auth/verify/email/resend` | no   | `SendVerificationDto`                     | `VerificationSubmittedResponse` |
| POST   | `/auth/verify/phone/resend` | no   | `SendOtpDto`                              | `VerificationSubmittedResponse` |
| POST   | `/auth/otp/request`         | no   | `{ email }`                               | `{ expiresInSeconds }`          |
| POST   | `/auth/otp/verify`          | no   | `VerifyOtpFormValues`                     | `AuthSessionPayload`            |

### Session / token / current user

| METHOD | PATH                         | auth | Request                                                                                    | Response                                                                    |
| ------ | ---------------------------- | ---- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| POST   | `/auth/refresh`              | no   | `{ refreshToken }`                                                                         | `AuthTokens = { accessToken, refreshToken, tokenType:"Bearer", expiresIn }` |
| POST   | `/auth/logout`               | yes  | (none)                                                                                     | `{ loggedOut: true }`                                                       |
| POST   | `/auth/logout-all`           | yes  | (none)                                                                                     | `{ loggedOut: true }`                                                       |
| GET    | `/auth/me`                   | yes  | —                                                                                          | `AuthUserProfile`                                                           |
| PATCH  | `/auth/me`                   | yes  | `UpdateProfileValues = { firstName?, lastName?, profilePhotoUrl?, dateOfBirth?, gender? }` | `AuthUserProfile`                                                           |
| GET    | `/auth/sessions`             | yes  | —                                                                                          | `ListSessionsResponse`                                                      |
| DELETE | `/auth/sessions/{sessionId}` | yes  | —                                                                                          | (empty)                                                                     |

**Refresh flow** (auto, in `http-client.ts`): on a `401` for an authed call, the client POSTs `/auth/refresh` with the stored `refreshToken`, swaps in the new `{accessToken, refreshToken}`, and retries the original request once. If refresh fails → session cleared. Build the same behavior into the generated client.

Password: `POST /auth/password/forgot`, `POST /auth/password/reset`, `POST /auth/password/change` (last is authed).
Phone/email change (authed): `POST /auth/me/phone/change` → `POST /auth/me/phone/change/confirm`; `POST /auth/me/email/change` → `.../confirm`.
Google OAuth: browser-redirect to `GET /auth/google`; exchange with `POST /auth/google/exchange { code }`.

---

## 2. WALLET

Source: SDK `packages/sdk/src/platform/platform-client.ts` (`WalletClient`); controllers `apps/backend/src/wallet/customer-wallet.controller.ts`, `.../merchant-wallet.controller.ts`, `.../rider-wallet.controller.ts`, `.../driver-wallet.controller.ts`. Types: `packages/types/src/platform/index.ts`.

| METHOD | PATH                                          | auth | Request                                         | Response `data`                                                     |
| ------ | --------------------------------------------- | ---- | ----------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/customer/wallet`                            | yes  | —                                               | `WalletDto`                                                         |
| GET    | `/customer/wallet/transactions`               | yes  | `?page&pageSize&type`                           | `PaginatedResult<WalletLedgerEntryDto>`                             |
| GET    | `/customer/wallet/transfer/recipients?phone=` | yes  | —                                               | `WalletRecipientDto[]`                                              |
| GET    | `/customer/wallet/transfer/recipients/recent` | yes  | —                                               | `WalletRecipientDto[]`                                              |
| POST   | `/customer/wallet/transfer`                   | yes  | `{ toUserId, amount, currency?, description? }` | `WalletTransferDto = { source: WalletDto, destination: WalletDto }` |
| POST   | `/customer/wallet/fund`                       | yes  | `{ amount, provider?, callbackUrl? }`           | `FundWalletResponse = { authorizationUrl, reference }`              |
| POST   | `/customer/wallet/fund/verify`                | yes  | `{ reference? }`                                | `WalletDto`                                                         |
| GET    | `/customer/wallet/statement?month&year`       | yes  | —                                               | `WalletStatementDto`                                                |
| GET    | `/customer/wallet/pin/status`                 | yes  | —                                               | `WalletPinStatusDto`                                                |
| POST   | `/customer/wallet/pin`                        | yes  | `{ pin }`                                       | `WalletPinStatusDto`                                                |
| POST   | `/customer/wallet/pin/verify`                 | yes  | `{ pin }`                                       | `{ valid: boolean }`                                                |
| PUT    | `/customer/wallet/limits`                     | yes  | `{ dailyLimit?, singleTransactionLimit? }`      | `WalletDto`                                                         |
| GET    | `/customer/wallet/bank-accounts`              | yes  | —                                               | `CustomerBankAccountDto[]`                                          |
| POST   | `/customer/wallet/bank-accounts`              | yes  | `AddBankAccountRequest`                         | `CustomerBankAccountDto`                                            |
| POST   | `/customer/wallet/withdrawals`                | yes  | `CreateWithdrawalRequest`                       | `WithdrawalRequestDto`                                              |
| GET    | `/customer/wallet/withdrawals`                | yes  | `?page&pageSize&status`                         | `PaginatedResult<WithdrawalRequestDto>`                             |
| GET    | `/merchant/wallet`                            | yes  | —                                               | `WalletDto`                                                         |
| GET    | `/merchant/wallet/transactions`               | yes  | `?page&pageSize&type`                           | `PaginatedResult<WalletLedgerEntryDto>`                             |
| GET    | `/rider/wallet`                               | yes  | —                                               | `WalletDto`                                                         |
| GET    | `/driver/wallet`                              | yes  | —                                               | `WalletDto`                                                         |
| GET    | `/driver/wallet/transactions`                 | yes  | `?page&pageSize`                                | `PaginatedResult<WalletLedgerEntryDto>`                             |

```
WalletDto = {
  id, ownerType, ownerId, currency,
  availableBalance: number, pendingBalance: number, version: number,
  dailyLimit: number|null, singleTransactionLimit: number|null,
  createdAt, updatedAt
}
WalletLedgerEntryDto = {
  id, walletId, type: WalletTransactionType, amount: number,
  direction: WalletDirection, balanceAfter: number,
  referenceType: string|null, referenceId: string|null,
  description: string|null, metadata: unknown, createdAt
}
```

**Enums:**
`WalletTransactionType = CREDIT | DEBIT | REFUND | SETTLEMENT | CASHBACK | WITHDRAWAL | TRANSFER`
`WalletDirection = CREDIT | DEBIT`
`WalletOwnerType = CUSTOMER | MERCHANT | RIDER | DRIVER | PLATFORM`
`WalletFundingProvider (fund) = PAYSTACK | FLUTTERWAVE | OPAY`

---

## 3. MARKETPLACE (public browse — no auth)

Source: SDK `packages/sdk/src/product/product-api.ts` (`CustomerProductsApi`), `packages/sdk/src/merchant/merchant-api.ts` (`CustomerMerchantsApi`); controllers `apps/backend/src/products/customer/customer-products.controller.ts`, `apps/backend/src/merchants/customer/customer-merchants.controller.ts`.

### Merchants

| METHOD | PATH                      | auth | Request                                                                              | Response `data`                             |
| ------ | ------------------------- | ---- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| GET    | `/merchants`              | no   | `BrowseMerchantsQuery` (`q, businessType, minRating, lat, lng, sort, cursor, limit`) | `CursorPaginatedResult<MerchantSummaryDto>` |
| GET    | `/merchants/smart-search` | no   | `{ query, lat?, lng?, cursor?, limit? }`                                             | `SmartSearchResult<MerchantSummaryDto>`     |
| GET    | `/merchants/{id}`         | no   | `?lat&lng` (optional)                                                                | `MerchantDetailDto`                         |

```
MerchantSummaryDto = {
  id, businessName, businessType: BusinessType,
  logoUrl: string|null, coverPhotoUrl: string|null,
  verificationStatus: BusinessVerificationStatus,
  city, state, rating: RatingSummaryDto,
  distanceKm: number|null,
  isOpenNow: boolean|null   // null = hours not set → render "Hours unavailable", NOT "Closed"
}
```

### Products

| METHOD | PATH                     | auth | Request                                  | Response `data`                            |
| ------ | ------------------------ | ---- | ---------------------------------------- | ------------------------------------------ |
| GET    | `/products`              | no   | `BrowseProductsQuery`                    | `CursorPaginatedResult<ProductSummaryDto>` |
| GET    | `/products/featured`     | no   | `BrowseProductsQuery`                    | `CursorPaginatedResult<ProductSummaryDto>` |
| GET    | `/products/new-arrivals` | no   | `BrowseProductsQuery`                    | `CursorPaginatedResult<ProductSummaryDto>` |
| GET    | `/products/trending`     | no   | `BrowseProductsQuery`                    | `CursorPaginatedResult<ProductSummaryDto>` |
| GET    | `/products/recommended`  | no   | `BrowseProductsQuery`                    | `CursorPaginatedResult<ProductSummaryDto>` |
| GET    | `/products/smart-search` | no   | `{ query, lat?, lng?, cursor?, limit? }` | `SmartSearchResult<ProductSummaryDto>`     |
| GET    | `/products/{id}`         | no   | —                                        | `ProductDetailDto`                         |
| GET    | `/products/{id}/similar` | no   | —                                        | `ProductSummaryDto[]`                      |
| GET    | `/categories`            | no   | —                                        | `CategoryDto[]`                            |
| GET    | `/brands`                | no   | —                                        | `BrandDto[]`                               |

`BrowseProductsQuery = { categoryId?, brandId?, merchantId?, minPrice?, maxPrice?, minRating?, inStock?, q?, sort?, cursor?, limit?, lat?, lng? }`

```
ProductSummaryDto = {
  id, merchantId, merchantName, categoryId: string|null, brandId: string|null,
  name, slug, basePrice: number, currency, primaryImageUrl: string|null,
  rating: RatingSummaryDto, inStock: boolean, isFeatured: boolean
}
CategoryDto = { id, name, slug, description: string|null, parentId: string|null, isActive, createdAt, updatedAt }
BrandDto    = { id, name, slug, logoUrl: string|null, isActive, createdAt, updatedAt }
```

---

## 4. CART

Source: SDK `packages/sdk/src/cart/cart-client.ts`; controller `apps/backend/src/cart/cart.controller.ts` (`@Controller('customer/cart')`). All authed (customer).

| METHOD | PATH                         | auth | Request             | Response `data`                                      |
| ------ | ---------------------------- | ---- | ------------------- | ---------------------------------------------------- |
| GET    | `/customer/cart`             | yes  | —                   | `CartDto \| null` (null when no active cart)         |
| POST   | `/customer/cart/items`       | yes  | `CreateCartItemDto` | `CartDto`                                            |
| PATCH  | `/customer/cart/items/{id}`  | yes  | `{ quantity }`      | `CartDto`                                            |
| DELETE | `/customer/cart/items/{id}`  | yes  | —                   | `CartDto`                                            |
| DELETE | `/customer/cart`             | yes  | —                   | `CartSummaryDto = { cleared: boolean, cartId: string | null }` |
| POST   | `/customer/cart/recalculate` | yes  | —                   | `CartDto`                                            |

```
CreateCartItemDto = { merchantId, productId, variantId?, productName, sku?, imageUrl?, unitPrice, quantity, currency? }
CartDto = {
  id, customerId, merchantId, currency, status: CartStatus,
  items: CartItemDto[],
  totals: { subtotal, discount, tax, deliveryFee, total, currency },
  createdAt, updatedAt
}
CartItemDto = { id, cartId, productId, variantId: string|null, productNameSnapshot, skuSnapshot: string|null, imageSnapshot: string|null, unitPriceSnapshot: number, quantity: number, subtotal: number, createdAt, updatedAt }
```

**Note:** a cart is single-merchant (`merchantId` on the cart). Adding an item from a different merchant is a backend concern; the SDK exposes no "switch merchant" call.

---

## 5. ORDERS / CHECKOUT (customer)

Source: SDK `packages/sdk/src/order/order-client.ts`; controller `apps/backend/src/orders/customer-orders.controller.ts` (`@Controller('customer')`).

| METHOD | PATH                            | auth | Request                                                                                | Response `data`                                                           |
| ------ | ------------------------------- | ---- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| POST   | `/customer/checkout`            | yes  | `CheckoutDto = { cartId?, fulfillmentType?, deliveryAddressId?, couponCode?, notes? }` | `CheckoutResponseDto = { order: OrderDto }`                               |
| GET    | `/customer/orders`              | yes  | `?page&pageSize`                                                                       | `PaginatedResult<OrderDto>`                                               |
| GET    | `/customer/orders/{id}`         | yes  | —                                                                                      | `OrderDto`                                                                |
| POST   | `/customer/orders/{id}/cancel`  | yes  | `{ reason? }`                                                                          | `OrderDto` (only while status `PENDING`)                                  |
| POST   | `/customer/orders/{id}/dispute` | yes  | `{ reason }`                                                                           | `OrderDto`                                                                |
| POST   | `/customer/orders/{id}/pay`     | yes  | `InitializePaymentDto` (`{ provider?, callbackUrl? }`)                                 | `InitializePaymentResponseDto` (`{ authorizationUrl?, reference?, ... }`) |
| POST   | `/customer/orders/{id}/verify`  | yes  | `{ reference? }`                                                                       | `PaymentVerificationDto`                                                  |
| GET    | `/customer/orders/{id}/payment` | yes  | —                                                                                      | `PaymentStatusDto`                                                        |

```
OrderDto = {
  id, customerId, merchantId, cartId: string|null, orderNumber,
  status: OrderStatus, paymentStatus: PaymentStatus, paymentMethod: OrderPaymentMethod|null,
  fulfillmentType: FulfillmentType,
  subtotal, discount, tax, deliveryFee, total, currency,
  couponCode: string|null, deliveryAddressId: string|null, notes: string|null,
  estimatedReadyAt, confirmedAt, readyAt, deliveredAt, completedAt, cancelledAt,
  cancelledBy: OrderCancelledBy|null, cancellationReason: string|null, refundedAt,
  items: OrderItemDto[], reservations: [...], disputes: [...],
  createdAt, updatedAt
}
OrderItemDto = { id, orderId, productId, variantId: string|null, merchantId, quantity, unitPrice, subtotal, snapshotName, snapshotImage: string|null, snapshotSku: string|null, createdAt }
```

**Enums:**
`OrderStatus = DRAFT | PENDING | CONFIRMED | PREPARING | READY | DRIVER_ASSIGNED | PICKED_UP | IN_TRANSIT | DELIVERED | COMPLETED | CANCELLED | REFUNDED | DISPUTED | FAILED` (`FAILED` is legacy/no longer produced)
`PaymentStatus = PENDING | PAID | FAILED | REFUNDED | PARTIAL_REFUND`
`OrderPaymentMethod = PAYSTACK | FLUTTERWAVE | OPAY | WALLET | CASH | MERCHANT_DIRECT`
`FulfillmentType = DELIVERY | PICKUP`
`OrderCancelledBy = CUSTOMER | MERCHANT | ADMIN | SYSTEM`

**Order lifecycle (verified in code):** `POST /customer/checkout` creates an order in **PENDING** → customer pays (`/pay` → `/verify`, or WALLET/CASH) which moves it to **CONFIRMED** (`payments/payment.service.ts`) → merchant accepts (**PREPARING**) → merchant marks ready (**READY**) → delivery job auto-created (see §8) → `DRIVER_ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED → COMPLETED`.

---

## 6. RIDES

Source: SDK `packages/sdk/src/rides/customer-ride-client.ts` (`CustomerRideClient`) + `driver-ride-client.ts` (`DriverRideClient`); controllers `apps/backend/src/rides/controllers/customer-rides.controller.ts` (`@Controller('customer/rides')`), `driver-rides.controller.ts` (`@Controller('driver/rides')`).

### Customer side

| METHOD | PATH                               | auth | Request                                                    | Response `data`                                                           |
| ------ | ---------------------------------- | ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/customer/rides/types`            | yes  | —                                                          | `RideTypeCatalogEntryDto[]`                                               |
| POST   | `/customer/rides/estimate`         | yes  | `EstimateRideFareRequest`                                  | `EstimateRideFareResponse`                                                |
| POST   | `/customer/rides`                  | yes  | `RequestRideRequest`                                       | `RideDto`                                                                 |
| GET    | `/customer/rides`                  | yes  | `?page&limit&status`                                       | `PaginatedResult<RideDto>`                                                |
| GET    | `/customer/rides/{id}`             | yes  | —                                                          | `RideDto` (poll this for status)                                          |
| GET    | `/customer/rides/nearby-drivers`   | yes  | `?latitude&longitude&rideType&radiusMeters`                | `NearbyDriverDto[]`                                                       |
| GET    | `/customer/rides/{id}/tracking`    | yes  | —                                                          | `RideTrackingPointDto[]`                                                  |
| POST   | `/customer/rides/{id}/cancel`      | yes  | `{ reason? }`                                              | `RideDto`                                                                 |
| POST   | `/customer/rides/{id}/pay`         | yes  | `{ method: RidePaymentMethod, callbackUrl? }`              | `InitiateRidePaymentResponse` (`{ ride, authorizationUrl?, reference? }`) |
| POST   | `/customer/rides/{id}/pay/verify`  | yes  | `{ reference? }`                                           | `RideDto`                                                                 |
| GET    | `/customer/rides/{id}/receipt`     | yes  | —                                                          | `RideReceiptDto`                                                          |
| POST   | `/customer/rides/{id}/rate-driver` | yes  | `RateRideRequest = { rating, comment?, categoryRatings? }` | `RideRatingDto`                                                           |
| POST   | `/customer/rides/{id}/tip`         | yes  | `{ amount }`                                               | `RideDto`                                                                 |
| POST   | `/customer/rides/{id}/report`      | yes  | `{ category: RideProblemCategory, description? }`          | `RideProblemReportDto`                                                    |

```
RequestRideRequest      = { rideType, pickupLatitude, pickupLongitude, pickupAddress?, dropoffLatitude, dropoffLongitude, dropoffAddress?, couponCode? }
EstimateRideFareRequest = { rideType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, couponCode? }
EstimateRideFareResponse= { distanceMeters, durationSeconds, baseFare, distanceFare, timeFare, totalFare, promotionId: string|null, promoDiscount, finalFare }
NearbyDriverDto         = { latitude, longitude, vehicleType: RideType }   // anonymized, no driverId
RideDto = {
  id, customerId, driverId: string|null, rideType: RideType, status: RideStatus,
  pickup{Latitude,Longitude,Address}, dropoff{Latitude,Longitude,Address},
  estimatedDistanceMeters, estimatedDurationSeconds,
  baseFare, distanceFare, timeFare, totalFare, promotionId, promoDiscount,
  paymentMethod: RidePaymentMethod|null, paymentStatus: RidePaymentStatus,
  platformCommission, driverEarning, tipAmount,
  requestedAt, assignedAt, arrivedAt, startedAt, completedAt, cancelledAt,
  cancelledBy, cancellationReason, createdAt, updatedAt
}
```

### Driver side

| METHOD | PATH                                     | auth | Request                                                                     | Response `data`                        |
| ------ | ---------------------------------------- | ---- | --------------------------------------------------------------------------- | -------------------------------------- |
| GET    | `/driver/rides`                          | yes  | `?page&limit&status`                                                        | `PaginatedResult<RideDto>`             |
| POST   | `/driver/rides/availability`             | yes  | `{ online, acceptingRides, vehicleType, latitude?, longitude?, deviceId? }` | `DriverAvailabilityDto`                |
| GET    | `/driver/rides/availability`             | yes  | —                                                                           | `DriverAvailabilityDto \| null`        |
| GET    | `/driver/rides/active`                   | yes  | —                                                                           | `RideDto \| null`                      |
| GET    | `/driver/rides/offers`                   | yes  | —                                                                           | `RideOfferDto[]` (poll for new offers) |
| GET    | `/driver/rides/offers/{offerId}`         | yes  | —                                                                           | `RideOfferPreviewDto`                  |
| POST   | `/driver/rides/offers/{offerId}/accept`  | yes  | —                                                                           | `RideDto`                              |
| POST   | `/driver/rides/offers/{offerId}/decline` | yes  | —                                                                           | `null`                                 |
| POST   | `/driver/rides/{id}/arrive`              | yes  | —                                                                           | `RideDto`                              |
| POST   | `/driver/rides/{id}/start`               | yes  | —                                                                           | `RideDto`                              |
| POST   | `/driver/rides/{id}/complete`            | yes  | —                                                                           | `RideDto`                              |
| POST   | `/driver/rides/{id}/cancel`              | yes  | `{ reason? }`                                                               | `RideDto`                              |
| POST   | `/driver/rides/{id}/cash-confirm`        | yes  | —                                                                           | `RideDto`                              |
| POST   | `/driver/rides/{id}/rate-customer`       | yes  | `RateRideRequest`                                                           | `RideRatingDto`                        |

**Enums:**
`RideType = ECONOMY | COMFORT | XL | TRICYCLE`
`RideStatus = REQUESTED | SEARCHING | DRIVER_ASSIGNED | ARRIVED | IN_PROGRESS | COMPLETED | CANCELLED | NO_DRIVERS_FOUND`
`RidePaymentMethod = WALLET | PAYSTACK | FLUTTERWAVE | OPAY | CASH`
`RidePaymentStatus = PENDING | PAID | FAILED | REFUNDED`
`RideOfferStatus = PENDING | ACCEPTED | DECLINED | EXPIRED`

**Ride lifecycle:** customer `POST /customer/rides` (status `REQUESTED`/`SEARCHING`) → backend dispatch creates offers → driver sees offer in `GET /driver/rides/offers`, accepts (`DRIVER_ASSIGNED`) → `arrive` (`ARRIVED`) → `start` (`IN_PROGRESS`) → `complete` (`COMPLETED`). Cash rides: driver `cash-confirm` after completion.

---

## 7. DELIVERY (rider)

Source: SDK `packages/sdk/src/delivery/rider-delivery-client.ts` (`RiderDeliveryClient`) + `delivery-client.ts` (customer view); controllers `apps/backend/src/delivery/rider-delivery.controller.ts` (`@Controller('rider')`), `customer-delivery.controller.ts`.

### Rider job lifecycle

| METHOD | PATH                            | auth | Request                                                                              | Response `data`                                       |
| ------ | ------------------------------- | ---- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| GET    | `/rider/jobs`                   | yes  | —                                                                                    | `DeliveryJobDto[]` (poll for available/assigned jobs) |
| GET    | `/rider/jobs/{id}`              | yes  | —                                                                                    | `DeliveryJobDto`                                      |
| POST   | `/rider/jobs/{id}/accept`       | yes  | —                                                                                    | `DeliveryJobDto`                                      |
| POST   | `/rider/jobs/{id}/reject`       | yes  | —                                                                                    | `DeliveryJobDto`                                      |
| POST   | `/rider/jobs/{id}/pickup`       | yes  | —                                                                                    | `DeliveryJobDto`                                      |
| POST   | `/rider/jobs/{id}/arrived`      | yes  | —                                                                                    | `DeliveryJobDto`                                      |
| POST   | `/rider/jobs/{id}/deliver`      | yes  | `DeliverOrderDto = { proofType: ProofType, photoUrl?, otp?, signatureUrl?, notes? }` | `DeliveryJobDto`                                      |
| POST   | `/rider/jobs/{id}/confirm-cash` | yes  | `{ amountCollected }`                                                                | `DeliveryJobDto`                                      |
| POST   | `/rider/jobs/{id}/location`     | yes  | `{ latitude, longitude, heading?, speed?, accuracy? }`                               | `DeliveryTrackingDto`                                 |
| POST   | `/rider/jobs/{id}/fail`         | yes  | `{ reason? }`                                                                        | `DeliveryJobDto`                                      |
| POST   | `/rider/jobs/{id}/return`       | yes  | `{ reason? }`                                                                        | `DeliveryJobDto`                                      |
| POST   | `/rider/availability`           | yes  | `{ online, acceptingOrders, latitude?, longitude? }`                                 | `RiderLocationDto`                                    |

### Customer view of a delivery

| METHOD | PATH                                  | auth | Response `data`                                                    |
| ------ | ------------------------------------- | ---- | ------------------------------------------------------------------ |
| GET    | `/customer/orders/{orderId}/delivery` | yes  | `CustomerDeliveryDto` (DeliveryJobDto + `riderName`, `riderPhone`) |
| GET    | `/customer/orders/{orderId}/tracking` | yes  | `DeliveryTrackingDto[]`                                            |
| GET    | `/customer/orders/{orderId}/eta`      | yes  | `DeliveryEtaDto`                                                   |

```
DeliveryJobDto = {
  id, orderId, riderId: string|null, merchantId, customerId,
  assignmentMethod: AssignmentMethod, status: DeliveryStatus,
  pickup{Latitude,Longitude}, dropoff{Latitude,Longitude},
  estimatedDistanceMeters, estimatedDurationSeconds, deliveryFee,
  assignedAt, acceptedAt, pickedUpAt, arrivedAt, deliveredAt, failedAt, cancelledAt, returnedAt,
  cancellationReason: string|null,
  cashCollectedAmount: number|null, cashConfirmedAt: string|null,
  createdAt, updatedAt
}
```

**Enums:**
`DeliveryStatus = PENDING | ASSIGNED | ACCEPTED | PICKED_UP | ON_THE_WAY | ARRIVED | DELIVERED | FAILED | RETURNED | CANCELLED`
`ProofType = PHOTO | OTP | SIGNATURE | PHOTO_AND_OTP`
`AssignmentMethod = AUTO | MANUAL`

---

## 8. MERCHANT ORDER MANAGEMENT

Source: SDK `packages/sdk/src/order/order-client.ts` (`merchant*` methods) + `packages/sdk/src/merchant/merchant-api.ts`; controllers `apps/backend/src/orders/merchant-orders.controller.ts` (`@Controller('merchant/orders')`), `apps/backend/src/merchants/controllers/merchant.controller.ts`.

| METHOD | PATH                           | auth | Request                                                 | Response `data`                        |
| ------ | ------------------------------ | ---- | ------------------------------------------------------- | -------------------------------------- |
| GET    | `/merchant/orders`             | yes  | `?page&pageSize&status`                                 | `PaginatedResult<OrderDto>`            |
| GET    | `/merchant/orders/{id}`        | yes  | —                                                       | `OrderDto`                             |
| PATCH  | `/merchant/orders/{id}/accept` | yes  | `AcceptOrderRequest` (optional `{ estimatedReadyAt? }`) | `OrderDto` (CONFIRMED → **PREPARING**) |
| PATCH  | `/merchant/orders/{id}/reject` | yes  | `RejectOrderRequest = { reason }`                       | `OrderDto` (CONFIRMED → CANCELLED)     |
| PATCH  | `/merchant/orders/{id}/ready`  | yes  | —                                                       | `OrderDto` (PREPARING → **READY**)     |
| PATCH  | `/merchant/orders/{id}/delay`  | yes  | `DelayOrderRequest`                                     | `OrderDto`                             |
| PATCH  | `/merchant/orders/{id}/cancel` | yes  | `MerchantCancelOrderRequest` (optional `{ reason? }`)   | `OrderDto`                             |

**How ORDER_READY dispatches delivery (verified):** `PATCH /merchant/orders/{id}/ready` sets `status=READY` and emits the internal `ORDER_READY` domain event (`orders/merchant-orders.service.ts`). The subscriber `delivery/order-ready.subscriber.ts` catches it and calls `deliveryService.createDeliveryJob(orderId)`, creating a `DeliveryJobDto` (status `PENDING`) that then surfaces to riders via `GET /rider/jobs`. **There is no explicit "dispatch" endpoint** — it is an automatic side-effect of marking an order ready. **There is also no separate "mark preparing" endpoint** — `accept` moves the order straight to `PREPARING`.

Storefront + merchant profile (same controller family): `POST /merchant/business/pause`, `POST /merchant/business/resume`, `GET/POST/PATCH /merchant/business`, merchant products CRUD under `/merchant/products*`, settlements `GET /merchant/settlements`, KYC `POST/GET /merchant/kyc`.

---

## 9. KYC (customer — Level 2 identity)

Source: SDK `packages/sdk/src/kyc/customer-kyc-client.ts`; controller `apps/backend/src/kyc/customer-kyc.controller.ts`. **Separate model from merchant/driver KYC.**

| METHOD | PATH             | auth | Request                                                                                                 | Response `data`        |
| ------ | ---------------- | ---- | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| GET    | `/kyc/me`        | yes  | —                                                                                                       | `CustomerKycStatusDto` |
| POST   | `/kyc/me/start`  | yes  | —                                                                                                       | `CustomerKycStatusDto` |
| POST   | `/kyc/me/submit` | yes  | `SubmitCustomerKycValues = { documentType, documentNumber?, frontImageUrl, backImageUrl?, selfieUrl? }` | `CustomerKycStatusDto` |

```
CustomerKycStatusDto = {
  level: CustomerKycLevel, status: CustomerKycStatus,
  documentType: KycDocumentType|null, documentNumber: string|null,
  frontImageUrl, backImageUrl, selfieUrl, remarks,
  startedAt, submittedAt, reviewStartedAt, reviewedAt, verifiedAt, rejectedAt, expiresAt,
  levelAccess: { level0: boolean, level1: boolean }   // read-only; derived from phone/email verification
}
```

**Enums (locked founder decision):**
`CustomerKycStatus = NOT_STARTED | IN_PROGRESS | PENDING_REVIEW | VERIFIED | REJECTED | EXPIRED | REQUIRES_RESUBMISSION`
`CustomerKycLevel = LEVEL_0 | LEVEL_1 | LEVEL_2`
(`REJECTED`/`REQUIRES_RESUBMISSION` re-enter `IN_PROGRESS`; `EXPIRED` terminal from `VERIFIED`.)

---

## 10. REAL-TIME

**There IS a real WebSocket gateway** (socket.io) — but it is **best-effort/optional** and covers **rides only**. Source: `apps/backend/src/rides/ride.gateway.ts`.

- **Transport:** socket.io, **namespace `rides`** (i.e. connect to `https://api.dripplex.com` with `{ path: <default socket.io path>, namespace: "/rides" }`). CORS: `origin: true, credentials: true`.
- **Auth:** pass the access token on the socket handshake — either `socket.handshake.auth.token = <accessToken>` **or** header `Authorization: Bearer <accessToken>`. Unauthorized handshakes get an `error` event then a disconnect.
- **Client → server messages:** `ride:join` `{ rideId }`, `ride:leave` `{ rideId }`, `driver:location` `{ latitude, longitude }` (drivers only; throttled server-side).
- **Server → client events:**
  - `ride:status` — ride state changed (payload includes ride state).
  - `ride:driver_location` — `{ rideId, latitude, longitude, at }` live driver position.
  - `ride:payment` — ride payment update.
  - `ride:offered` — sent to a **driver** room (`driver:{id}`) when a new ride offer is available.
  - `error` — `{ message }`.

**IMPORTANT for Figma Make:** The WebSocket is rides-only and best-effort. **Orders and deliveries have NO websocket.** For those (and as a fallback for rides), **poll the REST status endpoints**:

- Order status: `GET /customer/orders/{id}`
- Delivery status/tracking/ETA: `GET /customer/orders/{orderId}/delivery` · `/tracking` · `/eta`
- Ride status: `GET /customer/rides/{id}` and driver offers: `GET /driver/rides/offers`
- Notifications: `GET /customer/notifications` (see below)

**Do NOT invent `wss://api.dripplexapp.com/ws` or any other socket URL.** The only real socket is the `rides` namespace above.

Notifications (poll): `GET /customer/notifications?unreadOnly&page&limit` → `NotificationListDto`; `PATCH /customer/notifications/{id}/read`; `POST /customer/notifications/mark-all-read`. (Source: `platform-client.ts` `NotificationsClient`.)

---

## GAPS (no backend endpoint found — do NOT wire these)

These are things a demo/UI might expect but which **have no matching backend endpoint** in this repo. Show static/stubbed UI or omit — do not fabricate a call:

1. **No single unified `/auth/login`.** Persona-specific only (`/auth/login/{customer|driver|rider|merchant|admin|operations}`). (There is a generic `POST /auth/login` in the SDK returning `AuthSessionPayload`, but the founder-locked persona flow is the persona endpoints above.)
2. **No order/delivery WebSocket.** Real-time is rides-only (§10). Order and delivery UIs must poll.
3. **No customer-facing "track my rider on a live map via socket" for deliveries** — delivery tracking is REST poll only (`/customer/orders/{orderId}/tracking` + `/eta`); the rider pushes location via `POST /rider/jobs/{id}/location` (REST), not a socket.
4. **No "reorder" / "buy again" endpoint** — build a reorder by re-adding items to cart via `POST /customer/cart/items`.
5. **No merchant "mark preparing" step** — `accept` transitions directly to `PREPARING`; there is no separate preparing endpoint.
6. **No explicit delivery "dispatch"/"assign to me" call for the demo** — delivery jobs are created automatically on `ORDER_READY` and assigned by the backend; the rider only `accept`/`reject`s from `GET /rider/jobs`.
7. **File/image upload is a dependency, not shown inline here.** KYC/product/proof images are passed as **URLs** (`frontImageUrl`, `photoUrl`, etc.). The upload endpoint exists separately (`apps/backend/src/uploads/uploads.controller.ts`, SDK `uploads/uploads-client.ts`) — obtain a URL there first, then pass it into the KYC/product/delivery-proof body.
8. **No SMS/OTP delivery visibility** — `/auth/verify/*` verifies a code the backend sent out-of-band; the code itself is never returned in a response.

---

_Generated from repo code on 2026-08-10. Source of truth: `packages/sdk/src/**`, `apps/backend/src/**/*.controller.ts`, `packages/types/src/**`. If an endpoint is not in this document, it was not found in the code._
