# @dripplex/backend

NestJS API for the Dripplex Super Platform.

## Stack

- NestJS 11 + TypeScript (strict)
- Prisma + PostgreSQL
- Redis (OTP + login brute-force protection only)
- JWT (session-bound access + refresh) + OTP + RBAC (`User`, `Role`, `Permission`)
- Pino logging, throttling, global validation/exception/logging

## Endpoints

### Sprint 0.1 (legacy scaffold)

| Method   | Path                       | Auth                 |
| -------- | -------------------------- | -------------------- |
| `GET`    | `/api/v1/health`           | Public               |
| `POST`   | `/api/v1/auth/register`    | Public (deprecated)  |
| `POST`   | `/api/v1/auth/otp/request` | Public               |
| `POST`   | `/api/v1/auth/otp/verify`  | Public               |
| `GET`    | `/api/v1/users`            | JWT + `users:read`   |
| `GET`    | `/api/v1/users/:id`        | JWT + `users:read`   |
| `DELETE` | `/api/v1/users/:id`        | JWT + `users:delete` |

### S1-C2 — Registration & verification

| Method | Path                             | Auth   | Notes                           |
| ------ | -------------------------------- | ------ | ------------------------------- |
| `POST` | `/api/v1/auth/register/customer` | Public | No JWT returned                 |
| `POST` | `/api/v1/auth/register/merchant` | Public | Initializes merchant onboarding |
| `POST` | `/api/v1/auth/register/rider`    | Public | Phone required                  |
| `POST` | `/api/v1/auth/register/driver`   | Public | Phone required                  |
| `POST` | `/api/v1/auth/verify/email`      | Public | Updates `emailVerifiedAt`       |
| `POST` | `/api/v1/auth/verify/phone`      | Public | Updates `phoneVerifiedAt`       |

### S1-C3 — Login & sessions

| Method | Path                          | Auth   | Notes                             |
| ------ | ----------------------------- | ------ | --------------------------------- |
| `POST` | `/api/v1/auth/login/customer` | Public | Portal login + session + JWT (C4) |
| `POST` | `/api/v1/auth/login/merchant` | Public | Portal role enforced + JWT (C4)   |
| `POST` | `/api/v1/auth/login/rider`    | Public | Phone/email login + JWT (C4)      |
| `POST` | `/api/v1/auth/login/driver`   | Public | Phone/email login + JWT (C4)      |

### S1-C4 — JWT, refresh & session rotation

| Method | Path                      | Auth   | Notes                         |
| ------ | ------------------------- | ------ | ----------------------------- |
| `POST` | `/api/v1/auth/refresh`    | Public | Refresh token rotation (body) |
| `POST` | `/api/v1/auth/logout`     | JWT    | Revokes current session       |
| `POST` | `/api/v1/auth/logout-all` | JWT    | Revokes all user sessions     |
| `GET`  | `/api/v1/auth/me`         | JWT    | Session-validated profile     |

### S1-C5 — Password management

| Method | Path                           | Auth   | Notes                                  |
| ------ | ------------------------------ | ------ | -------------------------------------- |
| `POST` | `/api/v1/auth/password/forgot` | Public | Anti-enumeration; rate limited 5/hour  |
| `POST` | `/api/v1/auth/password/reset`  | Public | Token + OTP; revokes all sessions      |
| `POST` | `/api/v1/auth/password/change` | JWT    | Verifies current password; revokes all |

**Password policy (DPX-013 §3.1):** 8–128 chars; at least one uppercase, lowercase, and digit; rejects a local common-password denylist.

Reset tokens are opaque UUIDs/hex values stored as SHA-256 hashes in `password_reset_tokens`. Notifications go through `NotificationService` (logging stub until email provider wiring).

### S1-C6 — Identity verification

| Method | Path                                   | Auth   | Notes                                        |
| ------ | -------------------------------------- | ------ | -------------------------------------------- |
| `POST` | `/api/v1/auth/email/send-verification` | Public | HMAC-signed token; anti-enumeration          |
| `POST` | `/api/v1/auth/email/verify`            | Public | One-time signed token                        |
| `POST` | `/api/v1/auth/email/resend`            | Public | Invalidates prior email challenge            |
| `POST` | `/api/v1/auth/phone/send-otp`          | Public | 6-digit OTP; SHA-256 in DB; anti-enumeration |
| `POST` | `/api/v1/auth/phone/verify`            | Public | Attempt limits + lockout                     |
| `POST` | `/api/v1/auth/phone/resend`            | Public | Invalidates prior phone OTP                  |

Challenges are stored in `identity_verifications` (hash-only). Redis is used only for hourly rate limits, resend cooldown, and phone OTP lockout. Legacy registration OTP verify endpoints (`/auth/verify/email|phone`) remain for S1-C2 compatibility.

### S1-C7 — Device management & session dashboard

| Method   | Path                               | Auth                         | Notes                               |
| -------- | ---------------------------------- | ---------------------------- | ----------------------------------- |
| `GET`    | `/api/v1/auth/sessions`            | JWT + `auth:sessions:read`   | List active sessions (newest first) |
| `DELETE` | `/api/v1/auth/sessions/:sessionId` | JWT + `auth:sessions:revoke` | Revoke one session; `204`           |
| `DELETE` | `/api/v1/auth/sessions`            | JWT + `auth:sessions:revoke` | Revoke all except current           |
| `POST`   | `/api/v1/auth/logout`              | JWT                          | Revokes current session             |

Device metadata (`browser`, `os`, `device`, `deviceType`) is parsed from `User-Agent` (no external APIs). `location` is always `null` in this sprint. Session `lastActiveAt` updates are throttled via Redis (`session:last-active:{sid}`, 60s).

**JWT access payload** (no permissions in token):

```json
{
  "sub": "<user-uuid>",
  "sid": "<auth-session-uuid>",
  "role": "customer",
  "portal": "customer",
  "typ": "access",
  "iat": 1720000000,
  "exp": 1720000900
}
```

Permissions are loaded from the database on each authenticated request. Refresh state is stored as `SHA-256(refreshToken)` in `auth_sessions.refresh_token_hash` — not in Redis.

**Removed in S1-C4:** `POST /api/v1/auth/login` (legacy Sprint 0.1 login).

See [DPX-013](../docs/DPX-013.md) for full Sprint 1 contracts.

## Local development

```bash
# from repo root
cp .env.example .env
pnpm install
pnpm --filter @dripplex/backend prisma:generate
pnpm --filter @dripplex/backend prisma:migrate:dev
pnpm --filter @dripplex/backend prisma:seed
pnpm --filter @dripplex/backend dev
```

Identity schema, migrations, and seed documentation: [prisma/README.md](prisma/README.md) (Sprint 1 / DPX-013).

## Quality gates

```bash
pnpm --filter @dripplex/backend lint
pnpm --filter @dripplex/backend typecheck
pnpm --filter @dripplex/backend test
pnpm --filter @dripplex/backend build
```

## Docker

```bash
docker build -f apps/backend/Dockerfile -t dripplex-backend .
```

### S1-C8 — Merchant & business onboarding

| Method  | Path                                        | Auth                               | Notes                        |
| ------- | ------------------------------------------- | ---------------------------------- | ---------------------------- |
| `POST`  | `/api/v1/merchant/business`                 | JWT + `merchant:business:manage`   | Create business (submitted)  |
| `GET`   | `/api/v1/merchant/business`                 | JWT + `merchant:business:manage`   | Own business profile         |
| `PATCH` | `/api/v1/merchant/business`                 | JWT + `merchant:business:manage`   | Update editable fields       |
| `POST`  | `/api/v1/merchant/kyc`                      | JWT + `merchant:kyc:manage`        | Submit KYC documents         |
| `GET`   | `/api/v1/merchant/kyc`                      | JWT + `merchant:kyc:manage`        | KYC status                   |
| `POST`  | `/api/v1/merchant/bank-account`             | JWT + `merchant:bank:manage`       | Add bank account             |
| `GET`   | `/api/v1/merchant/bank-account`             | JWT + `merchant:bank:manage`       | List bank accounts           |
| `PATCH` | `/api/v1/merchant/bank-account/:id/default` | JWT + `merchant:bank:manage`       | Set default                  |
| `GET`   | `/api/v1/admin/merchants`                   | JWT + `admin:merchants:review`     | Filter + paginate            |
| `GET`   | `/api/v1/admin/merchant/:id`                | JWT + `admin:merchants:review`     | Full profile + audit summary |
| `POST`  | `/api/v1/admin/merchant/:id/approve`        | JWT + `admin:merchants:approve`    | Requires verified KYC        |
| `POST`  | `/api/v1/admin/merchant/:id/reject`         | JWT + `admin:merchants:reject`     | Reason required              |
| `POST`  | `/api/v1/admin/merchant/:id/suspend`        | JWT + `admin:merchants:suspend`    | Suspend approved merchant    |
| `POST`  | `/api/v1/admin/merchant/:id/reactivate`     | JWT + `admin:merchants:reactivate` | Restore suspended merchant   |

#### Merchant onboarding flow

1. Register via `/auth/register/merchant` and verify email + phone (S1-C6).
2. `POST /merchant/business` — creates business, sets merchant `UNDER_REVIEW`.
3. `POST /merchant/kyc` — submit identity/business documents.
4. Optionally add bank accounts via `/merchant/bank-account`.
5. Admin verifies KYC, then `POST /admin/merchant/:id/approve`.

### S1-C9 — Customer addresses & saved locations

| Method   | Path                                     | Auth                              | Notes                |
| -------- | ---------------------------------------- | --------------------------------- | -------------------- |
| `POST`   | `/api/v1/customer/addresses`             | JWT + `customer:addresses:manage` | Create (max 20)      |
| `GET`    | `/api/v1/customer/addresses`             | JWT + `customer:addresses:manage` | List saved addresses |
| `GET`    | `/api/v1/customer/addresses/default`     | JWT + `customer:addresses:manage` | Get default          |
| `GET`    | `/api/v1/customer/addresses/:id`         | JWT + `customer:addresses:manage` | Get one (owned)      |
| `PATCH`  | `/api/v1/customer/addresses/:id`         | JWT + `customer:addresses:manage` | Update               |
| `DELETE` | `/api/v1/customer/addresses/:id`         | JWT + `customer:addresses:manage` | Soft delete          |
| `PATCH`  | `/api/v1/customer/addresses/:id/default` | JWT + `customer:addresses:manage` | Set default          |
| `GET`    | `/api/v1/admin/addresses/:id`            | JWT + `admin:addresses:read`      | Admin read-only      |

```bash
# Create
curl -X POST "$API/api/v1/customer/addresses" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"label":"HOME","recipientName":"Ada","phone":"+2348012345678","addressLine1":"12 Allen Avenue","city":"Ikeja","state":"Lagos","country":"Nigeria","latitude":6.6018,"longitude":3.3515,"isDefault":true}'

# List / default
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/customer/addresses"
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/customer/addresses/default"
```

### S1-C10 — Shopping cart & cart engine

| Method   | Path                                | Auth                         | Notes                 |
| -------- | ----------------------------------- | ---------------------------- | --------------------- |
| `GET`    | `/api/v1/customer/cart`             | JWT + `customer:cart:manage` | Active cart or `null` |
| `POST`   | `/api/v1/customer/cart/items`       | JWT + `customer:cart:manage` | Add / merge item      |
| `PATCH`  | `/api/v1/customer/cart/items/:id`   | JWT + `customer:cart:manage` | Update quantity       |
| `DELETE` | `/api/v1/customer/cart/items/:id`   | JWT + `customer:cart:manage` | Remove item           |
| `DELETE` | `/api/v1/customer/cart`             | JWT + `customer:cart:manage` | Clear + abandon       |
| `POST`   | `/api/v1/customer/cart/recalculate` | JWT + `customer:cart:manage` | Refresh totals        |
| `GET`    | `/api/v1/admin/carts/:id`           | JWT + `admin:cart:read`      | Admin read-only       |

```bash
curl -X POST "$API/api/v1/customer/cart/items" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"merchantId":"<uuid>","productId":"<uuid>","productName":"Jollof Rice","unitPrice":2500,"quantity":2}'
```

Pricing hooks: `NoCouponEngine`, `NigeriaTaxCalculator` (7.5% VAT), `FlatDeliveryFeeCalculator` (₦1500). Inventory stub always available.

### S1-C11 — Checkout & order creation

| Method | Path                                 | Auth                      | Notes                                              |
| ------ | ------------------------------------ | ------------------------- | -------------------------------------------------- |
| `POST` | `/api/v1/customer/checkout`          | JWT + `customer:checkout` | Create order, reserve inventory, lock cart         |
| `GET`  | `/api/v1/customer/orders`            | JWT + `customer:orders`   | Paginated, newest first                            |
| `GET`  | `/api/v1/customer/orders/:id`        | JWT + `customer:orders`   | Own orders only                                    |
| `POST` | `/api/v1/customer/orders/:id/cancel` | JWT + `customer:orders`   | Pending payment only; releases stock               |
| `GET`  | `/api/v1/admin/orders`               | JWT + `admin:orders:read` | Filters: status, merchant, customer, date, payment |
| `GET`  | `/api/v1/admin/orders/:id`           | JWT + `admin:orders:read` | Read-only                                          |

```bash
# Checkout (no payment gateway — S1-C12)
curl -X POST "$API/api/v1/customer/checkout" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fulfillmentType":"DELIVERY","deliveryAddressId":"<uuid>"}'

# List / cancel
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/customer/orders?page=1&pageSize=20"
curl -X POST "$API/api/v1/customer/orders/<orderId>/cancel" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Changed mind"}'
```

Checkout pricing hooks default to **0** tax / discount / delivery (`ZeroTaxCalculator`, `ZeroCouponCalculator`, `ZeroDeliveryCalculator`). Inventory is reserved for 30 minutes; cleanup runs every 5 minutes and marks unpaid expired orders `FAILED` while unlocking the cart.

### S1-C12 — Payment gateway integration

| Method | Path                                  | Auth                    | Notes                                     |
| ------ | ------------------------------------- | ----------------------- | ----------------------------------------- |
| `POST` | `/api/v1/customer/orders/:id/pay`     | JWT + `customer:orders` | Initialize provider checkout              |
| `POST` | `/api/v1/customer/orders/:id/verify`  | JWT + `customer:orders` | Verify with provider (never trust client) |
| `GET`  | `/api/v1/customer/orders/:id/payment` | JWT + `customer:orders` | Latest payment transaction                |
| `POST` | `/api/v1/webhooks/paystack`           | Public + HMAC signature | Paystack `x-paystack-signature`           |
| `POST` | `/api/v1/webhooks/flutterwave`        | Public + `verif-hash`   | Flutterwave webhook hash                  |

```bash
# Initialize payment
curl -X POST "$API/api/v1/customer/orders/<orderId>/pay" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"provider":"PAYSTACK"}'

# Verify after redirect
curl -X POST "$API/api/v1/customer/orders/<orderId>/verify" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reference":"DPX-PAY-..."}'
```

#### Webhook setup

1. Configure Paystack webhook URL: `https://<host>/api/v1/webhooks/paystack`
2. Configure Flutterwave webhook URL: `https://<host>/api/v1/webhooks/flutterwave` and set `FLUTTERWAVE_WEBHOOK_HASH`
3. Set `PAYSTACK_SECRET_KEY` / `FLUTTERWAVE_SECRET_KEY` in the environment
4. Invalid signatures are rejected and audited as `payment.webhook.rejected`

On success: transaction `SUCCESS`, order `PAID`, inventory deducted (reservation released), cart `CHECKED_OUT`, customer + merchant notifications.

### S1-C13 — Delivery fulfillment

Delivery jobs are created automatically for paid `DELIVERY` orders after payment verification/webhook processing marks the order `PAID`, deducts inventory, and archives the cart.

| Method | Path                                   | Auth                           | Notes                              |
| ------ | -------------------------------------- | ------------------------------ | ---------------------------------- |
| `GET`  | `/api/v1/customer/orders/:id/delivery` | JWT + `customer:delivery:read` | Own delivery job                   |
| `GET`  | `/api/v1/customer/orders/:id/tracking` | JWT + `customer:delivery:read` | Tracking history                   |
| `GET`  | `/api/v1/customer/orders/:id/eta`      | JWT + `customer:delivery:read` | Distance/duration estimate         |
| `GET`  | `/api/v1/rider/jobs`                   | JWT + `rider:delivery:manage`  | Assigned rider jobs                |
| `GET`  | `/api/v1/rider/jobs/:id`               | JWT + `rider:delivery:manage`  | Assigned rider job detail          |
| `POST` | `/api/v1/rider/jobs/:id/accept`        | JWT + `rider:delivery:manage`  | Accept assignment                  |
| `POST` | `/api/v1/rider/jobs/:id/reject`        | JWT + `rider:delivery:manage`  | Reject and retry auto-assignment   |
| `POST` | `/api/v1/rider/jobs/:id/pickup`        | JWT + `rider:delivery:manage`  | Mark picked up                     |
| `POST` | `/api/v1/rider/jobs/:id/location`      | JWT + `rider:delivery:manage`  | Record rider location              |
| `POST` | `/api/v1/rider/jobs/:id/arrived`       | JWT + `rider:delivery:manage`  | Mark arrived                       |
| `POST` | `/api/v1/rider/jobs/:id/deliver`       | JWT + `rider:delivery:manage`  | Complete with proof                |
| `POST` | `/api/v1/rider/jobs/:id/fail`          | JWT + `rider:delivery:manage`  | Mark failed                        |
| `POST` | `/api/v1/rider/jobs/:id/return`        | JWT + `rider:delivery:manage`  | Mark returned                      |
| `POST` | `/api/v1/rider/availability`           | JWT + `rider:delivery:manage`  | Update rider availability/location |
| `GET`  | `/api/v1/admin/delivery`               | JWT + `admin:delivery:manage`  | Filter + paginate jobs             |
| `GET`  | `/api/v1/admin/delivery/:id`           | JWT + `admin:delivery:manage`  | Admin job detail                   |
| `POST` | `/api/v1/admin/delivery/:id/assign`    | JWT + `admin:delivery:manage`  | Manual/auto rider assignment       |
| `POST` | `/api/v1/admin/delivery/:id/reassign`  | JWT + `admin:delivery:manage`  | Reassign rider                     |
| `POST` | `/api/v1/admin/delivery/:id/cancel`    | JWT + `admin:delivery:manage`  | Cancel active job                  |

```bash
# Customer tracking
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/customer/orders/<orderId>/delivery"
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/customer/orders/<orderId>/eta"

# Rider lifecycle
curl -X POST "$API/api/v1/rider/availability" \
  -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d '{"online":true,"acceptingOrders":true,"latitude":6.5244,"longitude":3.3792}'
curl -X POST "$API/api/v1/rider/jobs/<jobId>/deliver" \
  -H "Authorization: Bearer $RIDER_TOKEN" -H "Content-Type: application/json" \
  -d '{"proofType":"PHOTO","photoUrl":"https://cdn.example/proof.jpg"}'

# Admin assignment
curl -X POST "$API/api/v1/admin/delivery/<jobId>/assign" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"riderId":"<riderUserId>","method":"MANUAL"}'
```
