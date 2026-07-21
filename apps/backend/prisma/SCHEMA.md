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
| `passwordChangedAt`                   | timestamp?             | New in S1-C1                                 |
| `blockedAt`                           | timestamp?             | Set when `status = BLOCKED`                  |
| `blockedReason`                       | varchar(500)?          | Admin notes                                  |
| `createdAt`, `updatedAt`, `deletedAt` | timestamps             | Soft delete via `deletedAt`                  |

**Indexes:** `status`, `deletedAt`, `registrationChannel`, `emailVerifiedAt`, `phoneVerifiedAt`

### `AuthSession`

Server-side session bound to a refresh token hash (DPX-013 §1.6, §4).

| Field                    | Type        | Notes                          |
| ------------------------ | ----------- | ------------------------------ |
| `refreshTokenHash`       | varchar(64) | SHA-256 hex, unique            |
| `deviceId`, `deviceName` | optional    | Client metadata                |
| `ipAddress`, `userAgent` | optional    | Request metadata               |
| `rememberMe`             | boolean     | Extended refresh TTL when true |
| `expiresAt`              | timestamp   | Session expiry                 |
| `revokedAt`              | timestamp?  | Null when active               |
| `lastSeenAt`             | timestamp   | Updated on refresh             |

**Cascade:** `ON DELETE CASCADE` from `User`

**Indexes:** `userId`, `(userId, revokedAt)`, `expiresAt`, unique `refreshTokenHash`

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
