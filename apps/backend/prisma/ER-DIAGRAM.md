# Identity ER diagram (S1-C1)

```mermaid
erDiagram
  User ||--o{ UserRole : has
  Role ||--o{ UserRole : assigned
  Role ||--o{ RolePermission : grants
  Permission ||--o{ RolePermission : included
  User ||--o{ AuthSession : owns
  User ||--o| CustomerProfile : has
  User ||--o| MerchantProfile : has
  User ||--o| RiderProfile : has
  User ||--o| DriverProfile : has

  User {
    uuid id PK
    citext email UK
    varchar phone UK
    text password_hash
    varchar first_name
    varchar last_name
    UserStatus status
    RegistrationChannel registration_channel
    timestamptz email_verified_at
    timestamptz phone_verified_at
    timestamptz last_login_at
    timestamptz password_changed_at
    timestamptz blocked_at
    varchar blocked_reason
    timestamptz deleted_at
  }

  AuthSession {
    uuid id PK
    uuid user_id FK
    varchar refresh_token_hash UK
    varchar device_id
    timestamptz expires_at
    timestamptz revoked_at
  }

  CustomerProfile {
    uuid id PK
    uuid user_id FK_UK
    varchar locale
    varchar timezone
  }

  MerchantProfile {
    uuid id PK
    uuid user_id FK_UK
    boolean is_approved
    timestamptz approved_at
  }

  RiderProfile {
    uuid id PK
    uuid user_id FK_UK
    boolean is_approved
    timestamptz approved_at
  }

  DriverProfile {
    uuid id PK
    uuid user_id FK_UK
    boolean is_approved
    timestamptz approved_at
  }

  Role {
    uuid id PK
    varchar name UK
    boolean is_system
  }

  Permission {
    uuid id PK
    varchar code UK
  }
```

Tables deferred to **S1-C2+**: `audit_logs`, `password_reset_tokens`, onboarding detail, addresses, invitations.

Reference: [DPX-013](../../docs/DPX-013.md)
