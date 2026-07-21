# Identity schema reference (S1-C1)

Aligned with [DPX-013](../../docs/DPX-013.md) §11.

## Enums

### `UserStatus`

| Value                  | Description                        |
| ---------------------- | ---------------------------------- |
| `PENDING_VERIFICATION` | Awaiting required OTP verification |
| `ACTIVE`               | Operational account                |
| `INACTIVE`             | User-initiated deactivation        |
| `SUSPENDED`            | Temporary admin suspension         |
| `BLOCKED`              | Security or fraud block            |

Deleted users use `User.deletedAt`, not a status value.

### `RegistrationChannel`

| Value             | Description                    |
| ----------------- | ------------------------------ |
| `CUSTOMER_WEB`    | Registered via customer-web    |
| `MERCHANT_PORTAL` | Registered via merchant-portal |
| `RIDER_PORTAL`    | Registered via rider-portal    |
| `DRIVER_PORTAL`   | Registered via driver-portal   |
| `OPS_INVITE`      | Invited operations staff       |
| `ADMIN_INVITE`    | Invited administrator          |
| `SEED`            | Bootstrap / migration backfill |

## Core models

### `User`

Central identity record. Existing Sprint 0.1 fields retained.

| Field                                 | Type                   | Notes                                        |
| ------------------------------------- | ---------------------- | -------------------------------------------- |
| `id`                                  | UUID                   | Primary key                                  |
| `email`                               | citext                 | Unique                                       |
| `phone`                               | varchar(32)?           | Unique, optional                             |
| `passwordHash`                        | text                   | bcrypt hash                                  |
| `firstName`, `lastName`               | varchar(100)           |                                              |
| `status`                              | `UserStatus`           | Default `PENDING_VERIFICATION`               |
| `registrationChannel`                 | `RegistrationChannel`? | Backfilled to `CUSTOMER_WEB` for legacy rows |
| `emailVerifiedAt`                     | timestamp?             |                                              |
| `phoneVerifiedAt`                     | timestamp?             |                                              |
| `lastLoginAt`                         | timestamp?             |                                              |
| `lastActiveAt`                        | timestamp?             | Updated on login (S1-C3)                     |
| `passwordChangedAt`                   | timestamp?             | New in S1-C1                                 |
| `blockedAt`                           | timestamp?             | Set when `status = BLOCKED`                  |
| `blockedReason`                       | varchar(500)?          | Admin notes                                  |
| `createdAt`, `updatedAt`, `deletedAt` | timestamps             | Soft delete via `deletedAt`                  |

**Indexes:** `status`, `deletedAt`, `registrationChannel`, `emailVerifiedAt`, `phoneVerifiedAt`

### `AuthSession`

Server-side session bound to a refresh token hash (DPX-013 §1.6, §4).

| Field                    | Type                  | Notes                                      |
| ------------------------ | --------------------- | ------------------------------------------ |
| `refreshTokenHash`       | varchar(64)?          | Null until refresh token issued (S1-C3/C4) |
| `portal`                 | `RegistrationChannel` | Portal that created the session (S1-C3)    |
| `deviceId`, `deviceName` | optional              | Client metadata                            |
| `ipAddress`, `userAgent` | optional              | Request metadata                           |
| `rememberMe`             | boolean               | Extended refresh TTL when true             |
| `expiresAt`              | timestamp             | Session expiry                             |
| `revokedAt`              | timestamp?            | Null when active                           |
| `lastSeenAt`             | timestamp             | Updated on refresh                         |
| `lastActiveAt`           | timestamp             | Updated on login activity (S1-C3)          |

**Cascade:** `ON DELETE CASCADE` from `User`

**Indexes:** `userId`, `(userId, revokedAt)`, `portal`, `expiresAt`, unique `refreshTokenHash`

## Profile stubs (1:1 with `User`)

### `CustomerProfile`

| Field      | Default        |
| ---------- | -------------- |
| `locale`   | `en_NG`        |
| `timezone` | `Africa/Lagos` |

Extended fields (avatar, date of birth, preferences) land in S1-C11.

### `MerchantProfile`, `RiderProfile`, `DriverProfile`

| Field        | Default |
| ------------ | ------- |
| `isApproved` | `false` |
| `approvedAt` | `null`  |

Onboarding workflow state is tracked in S1-C2 onboarding tables (`DRAFT` at registration). Business detail fields land in S1-C13–C15.

## S1-C2 models

### `OnboardingStatus`

| Value          | Description               |
| -------------- | ------------------------- |
| `DRAFT`        | Initial state at register |
| `SUBMITTED`    | Submitted for review      |
| `UNDER_REVIEW` | Ops review in progress    |
| `APPROVED`     | Approved                  |
| `REJECTED`     | Rejected; may revise      |

### `AuditLog`

Immutable security audit trail (DPX-013 §13.6).

| Field        | Type          | Notes                     |
| ------------ | ------------- | ------------------------- |
| `userId`     | UUID?         | Actor (null if anonymous) |
| `action`     | varchar(150)  | e.g. `auth.otp.verified`  |
| `resource`   | varchar(100)? | Affected resource type    |
| `resourceId` | UUID?         | Affected resource ID      |
| `metadata`   | JSONB         | Non-sensitive context     |

**Indexes:** `(userId, createdAt DESC)`, `(action, createdAt DESC)`

### `PasswordResetToken` (S1-C5)

Opaque password-reset tokens. Only SHA-256 hashes are stored.

| Field        | Type        | Notes                                |
| ------------ | ----------- | ------------------------------------ |
| `id`         | UUID        | Primary key                          |
| `userId`     | UUID        | Owner                                |
| `tokenHash`  | varchar(64) | Unique SHA-256 of opaque reset token |
| `expiresAt`  | timestamp   | Token expiry (default 15 minutes)    |
| `consumedAt` | timestamp?  | Set when used or superseded          |
| `createdAt`  | timestamp   | Issuance time                        |

**Indexes:** `tokenHash` unique, `(userId)`, `(userId, consumedAt)`, `(expiresAt)`

### `IdentityVerification` (S1-C6)

Email signed-token and phone OTP challenges. Plaintext values are never stored.

| Field          | Type                       | Notes                                |
| -------------- | -------------------------- | ------------------------------------ |
| `id`           | UUID                       | Primary key                          |
| `userId`       | UUID                       | Owner                                |
| `type`         | `IdentityVerificationType` | `EMAIL` or `PHONE`                   |
| `tokenHash`    | varchar(64)?               | Unique SHA-256 of signed email token |
| `otpHash`      | varchar(64)?               | SHA-256 of phone OTP                 |
| `expiresAt`    | timestamp                  | Challenge expiry                     |
| `consumedAt`   | timestamp?                 | Set when used or superseded          |
| `attemptCount` | int                        | Failed verify attempts               |
| `createdAt`    | timestamp                  | Issuance time                        |
| `updatedAt`    | timestamp                  | Last update                          |

**Indexes:** `tokenHash` unique, `(userId, type)`, `(userId, type, consumedAt)`, `(otpHash)`, `(expiresAt)`

### `MerchantOnboarding`, `RiderOnboarding`, `DriverOnboarding`

1:1 with respective profile. Initialized at `DRAFT` during portal registration.

## RBAC (unchanged structure, expanded seed)

| Model            | Purpose                                     |
| ---------------- | ------------------------------------------- |
| `Role`           | Named role slug (`customer`, `merchant`, …) |
| `Permission`     | Permission code (`users:read`, …)           |
| `UserRole`       | User ↔ role assignment                      |
| `RolePermission` | Role ↔ permission grant                     |

## Relations summary

```text
User 1───* UserRole *───1 Role
Role 1───* RolePermission *───1 Permission
User 1───* AuthSession
User 1───* PasswordResetToken
User 1───* IdentityVerification
User 1───0..1 CustomerProfile
User 1───0..1 MerchantProfile
User 1───0..1 RiderProfile
User 1───0..1 DriverProfile
User 1───* AuditLog
MerchantProfile 1───0..1 MerchantOnboarding
RiderProfile 1───0..1 RiderOnboarding
DriverProfile 1───0..1 DriverOnboarding
```

All profile and session relations cascade on user delete.

## S1-C8 models

### `MerchantStatus`

| Value          | Description                          |
| -------------- | ------------------------------------ |
| `PENDING`      | Registered; onboarding not submitted |
| `UNDER_REVIEW` | Business/KYC under ops review        |
| `APPROVED`     | Live merchant                        |
| `REJECTED`     | Onboarding rejected                  |
| `SUSPENDED`    | Temporarily suspended                |

### `Business`

One business profile per merchant user (`merchant_id` unique). Editable fields exclude `status`, `verificationStatus`, and `approvedBy`.

### `MerchantKyc`

Document submissions (`NATIONAL_ID`, `PASSPORT`, `DRIVER_LICENSE`, `CAC_CERTIFICATE`, `BUSINESS_REGISTRATION`). Only one `PENDING` submission allowed at a time.

### `BankAccount`

Merchant settlement accounts. Account numbers are unique per merchant. First account (or explicit flag) becomes default.

```text
User 1───0..1 Business
User 1───* MerchantKyc
User 1───* BankAccount
Business 1───* MerchantKyc
```

## S1-C9 models

### `AddressLabel`

| Value   | Description    |
| ------- | -------------- |
| `HOME`  | Home address   |
| `WORK`  | Work address   |
| `OTHER` | Custom / other |

### `CustomerAddress`

Saved delivery locations for a customer user (`customer_id` → `users.id`). Soft-deleted via `deleted_at`. At most one `is_default = true` among non-deleted rows.

```text
User 1───* CustomerAddress
```

## S1-C10 models

### `CartStatus`

| Value         | Description                                 |
| ------------- | ------------------------------------------- |
| `ACTIVE`      | Current mutable customer cart               |
| `LOCKED`      | Checkout created; pending payment (S1-C11)  |
| `CHECKED_OUT` | Converted after successful payment (future) |
| `ABANDONED`   | Cleared or replaced lifecycle               |

### `Cart` / `CartItem`

One open cart per customer (`ACTIVE` or `LOCKED`). Cart is single-merchant. Item unit prices are snapshotted at add/update time. Locked carts reject mutations until cancel or reservation expiry.

```text
User 1───* Cart
Cart 1───* CartItem
```

## S1-C11 models

### `OrderStatus` / `PaymentStatus` / `FulfillmentType`

Orders start as `PENDING_PAYMENT` / `PENDING`. Payment gateway transitions arrive in S1-C12.

### `Order` / `OrderItem` / `InventoryReservation`

Checkout snapshots product name, SKU, image, and unit price onto `order_items`. Reservations hold quantity for 30 minutes without deducting inventory.

```text
User 1───* Order
Order 1───* OrderItem
Order 1───* InventoryReservation
```

## S1-C12 models

### `PaymentProvider` / `TransactionStatus`

Supported providers: Paystack, Flutterwave, Moniepoint (stub). Transactions start `PENDING` and move to `SUCCESS` / `FAILED` after provider verification.

### `PaymentTransaction`

Stores provider reference, authorization URL, gateway payloads, and verification timestamps. `providerReference` is unique for idempotency.

```text
Order 1───* PaymentTransaction
User 1───* PaymentTransaction
```
