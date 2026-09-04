# DPX-MKT-INT-001-D — Credential Rotation & Lifecycle Management

**Status:** 🟡 **PLAN ONLY — AWAITING CTO REVIEW & APPROVAL**

**Document Purpose:** Detailed implementation plan for D-phase credential rotation and lifecycle management, identifying all architectural decisions, API contracts, database changes, test strategy, and interactions with C-phase functionality.

---

## 1. Problem Statement

C-phase established credential generation, masking, and basic lifecycle (creation → use → delete). D-phase extends this to support **rotation without downtime**, **revocation**, **lifecycle state management**, and **secure outbound credential delivery**.

### Key Requirements

- Merchants must rotate integration credentials without downtime (old + new valid simultaneously during transition)
- Credentials must have explicit lifecycle states (ACTIVE, ROTATED, REVOKED, EXPIRED)
- Outbound API calls to integrations must use encrypted/padded credentials (not plaintext)
- Revocation must be immediate (no grace period for revoked keys)
- Rotation history must be auditable (audit trail of all rotations and revocations)
- Authorization must enforce merchant isolation (can't rotate another merchant's credential)
- Rate limiting must prevent credential enumeration attacks
- Failure recovery must support rollback to previous credential without data loss

---

## 2. Architecture Overview

### 2.1 Credential Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────┐
│ Credential Lifecycle States (new enum: CredentialStatus)    │
└─────────────────────────────────────────────────────────────┘

CREATED (initial)
   ↓
ACTIVE (ready for use)
   ↓
ROTATED (new credential generated; old still valid during overlap)
   ↓
REVOKED (explicit revocation; immediate invalidity)
   ↓
EXPIRED (past retention window; can be deleted)

Parallel path from ACTIVE/ROTATED:
   → REVOKED (can happen at any time)

Transition Rules:
- CREATED → ACTIVE: happens at first successful test or after rotation setup
- ACTIVE → ROTATED: when new credential generated, old stays ACTIVE during overlap
- ACTIVE/ROTATED → REVOKED: immediate, explicit action
- ROTATED → ACTIVE: after overlap period, old credential becomes EXPIRED
- EXPIRED: eligible for hard deletion (not soft-delete)
- REVOKED: cannot transition back; can be hard-deleted per retention policy
```

### 2.2 Credential Overlap & Rotation Window

**Rotation Overlap Period:** 7 days (configurable per environment)

When rotation occurs:

1. New credential generated and marked CREATED
2. Merchant notified (email) with new credential and rotation deadline
3. During overlap period (7 days):
   - Old credential marked ROTATED (still valid for incoming webhook validation)
   - New credential marked ACTIVE (ready for outbound calls)
   - Both credentials accepted for webhook signature validation
4. After overlap expires:
   - Old credential transitions to EXPIRED
   - If old credential still in use after deadline, it becomes REVOKED (hard cut-off)
5. Hard-delete eligible after retention period (30 days post-EXPIRED)

**Rationale:**

- 7-day overlap: enough time for merchant to deploy new credential
- Email notification: merchant can track rotation status
- Hard cut-off: ensures old credentials don't linger indefinitely
- Auditability: timestamp each transition

### 2.3 Encrypted Outbound Credentials

When DrippleX makes outbound API calls to merchant integrations (e.g., webhook retries, sync requests), credentials must be encrypted in transit and stored in logs.

**Approach:**

1. Credentials stored in memory as plaintext only during request setup
2. Request headers include encrypted credential (AES-256-GCM)
3. Encryption key = per-integration ephemeral key (not stored)
4. Decryption on webhook validation happens with original credential hash (not plaintext)
5. No plaintext credential appears in request logs, error traces, or audit logs

**Example:**

```typescript
// Outbound request with encrypted credential
const credential = await this.credentialsService.getActiveCredential(integrationId);
const encryptedHeader = this.encrypt(credential.plaintext);
const response = await http.post(webhookUrl, payload, {
  headers: { 'x-dripplex-credential': encryptedHeader },
});
// After request, plaintext credential memory cleared
```

### 2.4 Revocation Mechanism

**Immediate Revocation:**

- Merchant clicks "Revoke" on credential detail page
- Credential status transitions to REVOKED immediately
- Any in-flight requests using this credential fail (hard validation check)
- Webhook validation against REVOKED credential returns 401 (was using this credential)
- No grace period; no queued operations allowed to complete

**Revocation Audit:**

- Event logged: `credential_revoked` with merchant ID, credential ID, actor (user), timestamp
- Stored in `credential_audit_events` table
- Visible to merchant in credential history

**Failure Scenario:**

- Merchant revokes credential by mistake
- Old credential REVOKED immediately
- Webhook calls start failing (401 Unauthorized — credential revoked)
- Merchant can rotate immediately to new credential (fast-path)
- Or restore from backup (if implemented; not in D scope)

---

## 3. Database Schema Changes

### 3.1 New Enum: CredentialStatus

```prisma
enum CredentialStatus {
  CREATED
  ACTIVE
  ROTATED
  REVOKED
  EXPIRED
}
```

### 3.2 Extended MerchantIntegrationCredential Model

**Current Schema (from C):**

```prisma
model MerchantIntegrationCredential {
  id                    String    @id @default(uuid()) @db.Uuid
  integrationId         String    @map("integration_id") @db.Uuid
  type                  String    // "api_key"
  plaintextHash         String    @map("plaintext_hash") @db.VarChar(64)
  publicSuffix          String    @map("public_suffix") @db.VarChar(32)
  encryptedValue        String    @map("encrypted_value") // encrypted plaintext
  encryptionIv          String    @map("encryption_iv") @db.VarChar(32)
  encryptionAuthTag     String?   @map("encryption_auth_tag") @db.VarChar(32)
  isActive              Boolean   @map("is_active") @default(true)
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")
  createdBy             String    @map("created_by") @db.Uuid // which merchant user created

  integration           MerchantIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  @@index([integrationId])
  @@index([isActive])
  @@map("merchant_integration_credentials")
}
```

**Extended Schema (for D):**

```prisma
model MerchantIntegrationCredential {
  id                    String                    @id @default(uuid()) @db.Uuid
  integrationId         String                    @map("integration_id") @db.Uuid
  type                  String                    // "api_key"
  plaintextHash         String                    @map("plaintext_hash") @db.VarChar(64) @unique
  publicSuffix          String                    @map("public_suffix") @db.VarChar(32)
  encryptedValue        String                    @map("encrypted_value")
  encryptionIv          String                    @map("encryption_iv") @db.VarChar(32)
  encryptionAuthTag     String?                   @map("encryption_auth_tag") @db.VarChar(32)

  // D-phase additions
  status                CredentialStatus          @default(CREATED)  // NEW
  isActive              Boolean                   @map("is_active") @default(true)
  previousCredentialId  String?                   @map("previous_credential_id") @db.Uuid  // rotation chain
  rotationReason        String?                   @map("rotation_reason") @db.VarChar(500)  // why it was rotated
  expiresAt             DateTime?                 @map("expires_at")  // rotation deadline
  revokedAt             DateTime?                 @map("revoked_at")  // when revoked (if ever)
  revokedBy             String?                   @map("revoked_by") @db.Uuid  // who revoked it

  createdAt             DateTime                  @default(now()) @map("created_at")
  updatedAt             DateTime                  @updatedAt @map("updated_at")
  createdBy             String                    @map("created_by") @db.Uuid
  deletedAt             DateTime?                 @map("deleted_at")  // soft-delete after expiry

  integration           MerchantIntegration       @relation(fields: [integrationId], references: [id], onDelete: Cascade)
  previousCredential    MerchantIntegrationCredential? @relation("CredentialChain", fields: [previousCredentialId], references: [id])
  nextCredential        MerchantIntegrationCredential? @relation("CredentialChain")
  auditEvents           CredentialAuditEvent[]

  @@unique([integrationId, plaintextHash])
  @@index([integrationId])
  @@index([status])
  @@index([isActive])
  @@index([expiresAt])
  @@index([revokedAt])
  @@map("merchant_integration_credentials")
}
```

### 3.3 New Table: CredentialAuditEvent

```prisma
model CredentialAuditEvent {
  id                    String    @id @default(uuid()) @db.Uuid
  credentialId          String    @map("credential_id") @db.Uuid
  integrationId         String    @map("integration_id") @db.Uuid
  action                String    // "created", "rotated", "revoked", "expired", "tested"
  actor                 String    @map("actor") @db.Uuid  // user ID who performed action
  reason                String?   @map("reason") @db.VarChar(500)  // why (for revocation)
  ipAddress             String?   @map("ip_address") @db.VarChar(45)
  userAgent             String?   @map("user_agent") @db.VarChar(512)
  createdAt             DateTime  @default(now()) @map("created_at")

  credential            MerchantIntegrationCredential @relation(fields: [credentialId], references: [id], onDelete: Cascade)

  @@index([credentialId])
  @@index([integrationId])
  @@index([action])
  @@index([createdAt])
  @@map("credential_audit_events")
}
```

### 3.4 Migration Strategy

**Migration File:** `apps/backend/prisma/migrations/[timestamp]_add_credential_rotation.sql`

**Steps:**

1. Add new columns to `merchant_integration_credentials`:
   - `status` (default ACTIVE for existing credentials)
   - `previous_credential_id` (nullable)
   - `rotation_reason` (nullable)
   - `expires_at` (nullable)
   - `revoked_at` (nullable)
   - `revoked_by` (nullable)
   - `deleted_at` (nullable, for future hard-delete)

2. Create new `credential_audit_events` table

3. Backfill existing credentials:

   ```sql
   UPDATE merchant_integration_credentials
   SET status = 'ACTIVE'::credential_status
   WHERE deleted_at IS NULL AND is_active = true;

   UPDATE merchant_integration_credentials
   SET status = 'REVOKED'::credential_status
   WHERE deleted_at IS NOT NULL;
   ```

4. Create indexes for new columns

5. Add audit events for all existing credentials (creation event with action='created')

---

## 4. API Changes

### 4.1 Existing Endpoints (C-phase) — No Breaking Changes

All C-phase endpoints (`POST`, `GET`, `PUT`, `DELETE /integrations/{id}`) continue unchanged. Credentials in responses show masked `publicSuffix` (as in C).

### 4.2 New Endpoints (D-phase)

#### POST /integrations/{integrationId}/credentials/{credentialId}/rotate

**Purpose:** Initiate credential rotation (generate new credential).

**Request:**

```json
{
  "rotationReason": "routine maintenance" // optional
}
```

**Response (201 Created):**

```json
{
  "old": {
    "credentialId": "cred-001",
    "status": "ROTATED",
    "publicSuffix": "Ab1Cd2Ef3G4h",
    "expiresAt": "2026-09-11T00:00:00Z" // overlap deadline
  },
  "new": {
    "credentialId": "cred-002",
    "apiKey": "dpx_integration_[uuid]_[hash]", // plaintext, only on rotation
    "status": "ACTIVE",
    "publicSuffix": "Yz9Mn0Pq1Rs2"
  },
  "overlapPeriodEndsAt": "2026-09-11T00:00:00Z",
  "nextSteps": "Update your integration to use the new credential by the deadline."
}
```

**Authorization:** `integrations:write` + merchant owns integration

**Merchant Isolation:** Only merchant who owns the integration can rotate its credentials

**Rate Limiting:** Max 1 rotation per credential per 24 hours (prevent abuse)

**Behavior:**

- Old credential status → ROTATED
- New credential generated, status = ACTIVE
- Both credentials valid for webhook signature validation (overlap)
- Merchant receives notification email with deadline
- Audit event: `credential_rotated`

---

#### POST /integrations/{integrationId}/credentials/{credentialId}/revoke

**Purpose:** Immediately revoke a credential.

**Request:**

```json
{
  "reason": "credential leaked" // optional
}
```

**Response (204 No Content):**

**Authorization:** `integrations:write` + merchant owns integration

**Behavior:**

- Credential status → REVOKED immediately
- `revokedAt` timestamp set
- `revokedBy` = current user ID
- Audit event: `credential_revoked`
- In-flight requests using this credential fail (401)

**Error Cases:**

- 404: Credential not found
- 403: Merchant doesn't own integration
- 400: Cannot revoke if it's the only ACTIVE credential (must rotate first)

---

#### GET /integrations/{integrationId}/credentials

**Purpose:** List all credentials for an integration (with status and history).

**Response (200 OK):**

```json
{
  "integration": "integration-uuid",
  "credentials": [
    {
      "credentialId": "cred-001",
      "status": "ROTATED",
      "type": "api_key",
      "publicSuffix": "Ab1Cd2Ef3G4h",
      "createdAt": "2026-08-04T00:00:00Z",
      "expiresAt": "2026-09-11T00:00:00Z",
      "rotationReason": null,
      "createdBy": "user-uuid"
    },
    {
      "credentialId": "cred-002",
      "status": "ACTIVE",
      "type": "api_key",
      "publicSuffix": "Yz9Mn0Pq1Rs2",
      "createdAt": "2026-09-04T00:00:00Z",
      "expiresAt": null,
      "rotationReason": "routine maintenance",
      "createdBy": "user-uuid"
    }
  ],
  "activeCredential": "cred-002"
}
```

**Authorization:** `integrations:read` + merchant owns integration

**Merchant Isolation:** Only merchant's own credentials visible

**Notes:**

- Includes all non-deleted credentials (CREATED, ACTIVE, ROTATED, REVOKED, EXPIRED)
- Plaintext keys never exposed (only masked publicSuffix)
- Shows rotation history (oldCredentialId chain)

---

#### GET /integrations/{integrationId}/credentials/{credentialId}/audit

**Purpose:** Audit trail for a specific credential.

**Response (200 OK):**

```json
{
  "credentialId": "cred-001",
  "events": [
    {
      "id": "event-001",
      "action": "created",
      "actor": "user-uuid",
      "timestamp": "2026-08-04T12:30:00Z",
      "ipAddress": "203.0.113.42",
      "userAgent": "Mozilla/5.0..."
    },
    {
      "id": "event-002",
      "action": "tested",
      "actor": "system",
      "timestamp": "2026-08-04T12:35:00Z",
      "result": "SUCCESS"
    },
    {
      "id": "event-003",
      "action": "rotated",
      "actor": "user-uuid",
      "reason": "routine maintenance",
      "timestamp": "2026-09-04T00:00:00Z",
      "ipAddress": "203.0.113.42"
    }
  ]
}
```

**Authorization:** `integrations:read` + merchant owns integration

---

#### POST /integrations/{integrationId}/credentials/{credentialId}/test

**Purpose:** Test webhook connectivity with a specific credential.

**Request:** (body optional)

**Response (200 OK):**

```json
{
  "credentialId": "cred-001",
  "status": "SUCCESS", // SUCCESS | FAILED | TIMEOUT
  "testedAt": "2026-09-04T21:00:00Z",
  "responseTime": 145, // ms
  "httpStatus": 200,
  "message": "Webhook responded with HTTP 200"
}
```

**Behavior:**

- Uses the specific credential to sign test request
- Validates webhook signature with that credential's hash
- Logs audit event: `credential_tested`

---

### 4.3 Webhook Signature Validation (Updated for D)

**Change to existing C functionality:**

When validating incoming webhook signature, check all non-REVOKED credentials:

```typescript
async validateWebhookSignature(integrationId: string, signature: string, payload: string): Promise<boolean> {
  // Get all non-revoked credentials for this integration
  const credentials = await this.credentialsService.getValidCredentials(integrationId);
  // Valid credentials: ACTIVE, ROTATED, CREATED (but not REVOKED or EXPIRED)

  for (const cred of credentials) {
    const isValid = crypto.timingSafeEqual(
      crypto.createHash('sha256').update(payload + cred.plaintextHash).digest(),
      Buffer.from(signature, 'hex')
    );
    if (isValid) return true;
  }
  return false;
}
```

**Rationale:** During rotation overlap, both old (ROTATED) and new (ACTIVE) credentials must validate incoming webhooks.

---

## 5. Authorization & Merchant Isolation

### 5.1 Authorization Requirements

**For Credential Operations:**

| Operation                    | Permission           | Scope                            |
| ---------------------------- | -------------------- | -------------------------------- |
| Create credential (via POST) | `integrations:write` | own merchant's integrations only |
| Rotate credential            | `integrations:write` | own merchant's integrations only |
| Revoke credential            | `integrations:write` | own merchant's integrations only |
| List credentials             | `integrations:read`  | own merchant's integrations only |
| View audit                   | `integrations:read`  | own merchant's integrations only |
| Test credential              | `integrations:write` | own merchant's integrations only |

### 5.2 Merchant Isolation Implementation

**All credential operations check:**

```typescript
async rotateCredential(integrationId: string, credentialId: string, merchantId: string) {
  // 1. Verify integration exists and belongs to merchant
  const integration = await this.integrations.getByIdAndMerchant(integrationId, merchantId);
  if (!integration) throw new ForbiddenException('Integration not found');

  // 2. Verify credential belongs to this integration
  const credential = await this.credentials.getByIdAndIntegration(credentialId, integrationId);
  if (!credential) throw new ForbiddenException('Credential not found');

  // 3. Proceed with rotation
  // ...
}
```

**Error Responses:**

- 404: If credential/integration not found (no information disclosure)
- 403: If merchant doesn't own the integration (explicit rejection)

---

## 6. Rate Limiting

### 6.1 Credential Rotation Rate Limit

**Rule:** Max 1 rotation per credential per 24 hours

**Rationale:** Prevents abuse/enumeration, ensures planned rotation windows

**Implementation:**

```typescript
async rotateCredential(integrationId: string, credentialId: string) {
  const lastRotation = await this.auditEvents.getLastRotation(credentialId);
  if (lastRotation && Date.now() - lastRotation < 86400000) {
    throw new TooManyRequestsException('Can only rotate once per 24 hours');
  }
  // Proceed
}
```

### 6.2 Test Credential Rate Limit

**Rule:** Max 10 tests per credential per minute

**Rationale:** Prevents enumeration attacks, excessive webhook calls

---

## 7. Secret Exposure Prevention

### 7.1 Plaintext Handling

**When plaintext key is exposed:**

- Only at POST /integrations creation (C-phase)
- Only at POST /integrations/{id}/credentials/rotate (D-phase)
- In both cases, merchant receives one-time plaintext; we do NOT store it

**Plaintext never stored, never logged, never cached:**

- Store only `plaintextHash` (SHA256 of plaintext + random salt)
- Encrypt the plaintext with AES-256-GCM before storage
- Decryption requires encryption key (not stored; ephemeral per request)

### 7.2 Error Messages

**Never expose in error messages:**

- Plaintext credential
- Plaintext hash (could be used for precomputation)
- Integration webhook URL (could leak merchant endpoints)
- Previous rotation timestamps (timing attacks)

**Example safe error:**

```
❌ "Credential validation failed: hash doesn't match stored hash ab1cd2ef3"
✅ "Credential validation failed: invalid signature"
```

### 7.3 Logging & Audit Trail

**Safe to log:**

- Credential ID (UUID, not plaintext)
- Status changes (CREATED, ACTIVE, ROTATED, REVOKED)
- Actions (created, rotated, revoked, tested)
- Actor (user ID)
- Timestamps
- IP address, user agent

**Never log:**

- Plaintext credential or hash
- Encrypted values (unless explicitly for debugging in staging)

---

## 8. Rotation Without Downtime

### 8.1 Zero-Downtime Rotation Flow

**Before Rotation:**

```
Merchant uses: cred-001 (ACTIVE)
Webhooks validate against: cred-001
```

**Step 1: Rotate (Day 0)**

```
POST /integrations/{id}/credentials/{cred-001}/rotate
Response: old=cred-001 (now ROTATED), new=cred-002 (ACTIVE)
Merchant notified via email
```

**Step 2: Overlap Period (Days 0-7)**

```
Merchant uses: cred-001 (ROTATED) → cred-002 (ACTIVE) transition
Webhooks validate against: cred-001 (ROTATED) OR cred-002 (ACTIVE)
Both credentials work for incoming webhooks (no downtime)
```

**Step 3: Deadline Approaches (Day 7)**

```
Merchant deadline: Deploy new credential (cred-002)
Grace period ends; old credential (cred-001) transitions to EXPIRED
```

**Step 4: Post-Overlap (Day 8+)**

```
Merchant using: cred-002 (ACTIVE)
Webhooks validate against: cred-002 only
Old credential (cred-001) eligible for hard deletion after retention window
```

### 8.2 Handling Slow Merchant Deployment

**If merchant doesn't deploy new credential by deadline:**

Option A (Lenient):

- Old credential (cred-001) stays ROTATED, doesn't auto-expire
- Webhooks continue validating against both for compliance
- Merchant receives reminder email before each retry
- Soft deadline (no hard cutoff)

Option B (Strict):

- After deadline, old credential (cred-001) transitions to EXPIRED
- Webhooks no longer validate against cred-001
- Merchant's integrations fail if still using old credential
- Requires immediate rotation or hard cutoff

**CTO Decision Required:** Lenient vs. Strict policy?

---

## 9. Failure & Rollback Behavior

### 9.1 Failed Rotation

**Scenario:** Rotation initiated but something goes wrong (e.g., DB error mid-transaction)

**Protection:** Database transaction atomicity

- Either full rotation succeeds or entire operation rolls back
- No partial states (e.g., new credential created but old not marked ROTATED)

**Implementation:**

```typescript
async rotateCredential(integrationId: string, credentialId: string) {
  return this.db.transaction(async (trx) => {
    // 1. Mark old credential as ROTATED
    await trx.update(...).where(...);
    // 2. Create new credential as ACTIVE
    await trx.insert(...);
    // 3. Log audit event
    await trx.insert(...);
    // If any step fails, entire transaction rolls back
  });
}
```

### 9.2 Accidental Revocation Recovery

**Scenario:** Merchant revokes a credential by mistake, breaks production

**Recovery Options:**

Option A (Revert within grace period):

- Add 15-minute grace period before revocation takes effect
- Merchant can "undo revoke" within grace period
- Audit event: `revocation_undone`

Option B (Restore from backup):

- Not in D scope; requires separate backup/restore system
- Manual CTO action to restore credential

Option C (Fast rotation):

- No grace period; revocation immediate
- Merchant must rotate immediately to recover
- Old credential can be "un-revoked" if still within rotation overlap

**CTO Decision Required:** Which recovery option?

### 9.3 Cascade Delete Safety

**When integration is deleted (via DELETE /integrations/{id}):**

- Integration soft-deleted (archivedAt timestamp set)
- All credentials should also be soft-deleted (marked deletedAt)
- Audit events preserved for compliance

**Implementation:**

```prisma
model MerchantIntegration {
  // ... existing fields
  credentials MerchantIntegrationCredential[]  // relation
}

model MerchantIntegrationCredential {
  // ... existing fields
  integration MerchantIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)
}
```

Cascade ensures no orphaned credentials when integration deleted.

---

## 10. Test Strategy

### 10.1 Credential Rotation Tests

**Unit Tests:** (not requiring backend)

- State machine transitions (ACTIVE → ROTATED → EXPIRED)
- Overlap period calculation
- Credential chain validation (previousCredentialId)

**Integration Tests:** (against PostgreSQL + Redis)

```typescript
describe('Credential Rotation', () => {

  test('POST /rotate generates new credential with ACTIVE status', async () => {
    // 1. Create integration + credential (C-phase)
    // 2. POST /rotate
    // 3. Verify: old status = ROTATED, new status = ACTIVE
    // 4. Verify: both credentials valid for webhook validation
  });

  test('POST /revoke makes credential invalid immediately', async () => {
    // 1. Create + rotate credential
    // 2. POST /revoke
    // 3. Verify: status = REVOKED
    // 4. Webhook validation against revoked credential fails (401)
  });

  test('Overlap period: both old and new credentials validate webhooks', async () => {
    // 1. Rotate credential
    // 2. Generate webhook payload signed with old credential
    // 3. Send webhook
    // 4. Verify: validation succeeds (old credential still valid)
    // 5. Generate payload signed with new credential
    // 6. Send webhook
    // 7. Verify: validation succeeds (new credential valid)
  });

  test('After overlap expires, old credential no longer validates', async () => {
    // 1. Rotate credential
    // 2. Advance time past overlap deadline (7 days)
    // 3. Mark old credential as EXPIRED (cron job or manual)
    // 4. Generate webhook payload signed with old credential
    // 5. Send webhook
    // 6. Verify: validation fails (401)
  });

  test('Rate limit: cannot rotate same credential twice in 24 hours', async () => {
    // 1. Rotate credential
    // 2. Attempt second rotation immediately
    // 3. Verify: 429 Too Many Requests
  });

  test('Merchant isolation: cannot rotate another merchant's credential', async () => {
    // 1. Create integration as Merchant A
    // 2. Attempt rotate as Merchant B
    // 3. Verify: 403 Forbidden
  });

  test('Authorization: cannot rotate without integrations:write permission', async () => {
    // 1. Create user with integrations:read only
    // 2. Attempt rotate
    // 3. Verify: 403 Forbidden
  });

  test('Audit trail: all rotations logged with actor and reason', async () => {
    // 1. Rotate credential with reason
    // 2. GET /audit
    // 3. Verify: audit event includes action, actor, reason, timestamp
  });

  test('Failed rotation rolls back atomically', async () => {
    // 1. Simulate DB error during rotation (mock)
    // 2. Verify: transaction rolls back
    // 3. Verify: old credential still ACTIVE, no new credential created
  });

});
```

### 10.2 Encrypted Outbound Credentials Tests

**Scenario:** DrippleX makes outbound API call with encrypted credential

```typescript
describe('Outbound Credential Encryption', () => {
  test('Outbound request encrypts credential in header', async () => {
    // 1. Create mock webhook endpoint
    // 2. Request outbound call from DrippleX
    // 3. Verify: request includes encrypted credential header
    // 4. Verify: plaintext never exposed in logs
  });

  test('Webhook validation decrypts and validates signature', async () => {
    // 1. Simulate webhook call with encrypted credential
    // 2. Verify: signature validation succeeds
  });
});
```

### 10.3 Acceptance Tests (D-Phase)

**Full behavioral test suite (like C-phase):**

```
D1: Credential Rotation
  ✓ POST /rotate generates new credential with ACTIVE status
  ✓ Old credential marked ROTATED
  ✓ Overlap period configured correctly
  ✓ Merchant notified (email or in-app)

D2: Credential Revocation
  ✓ POST /revoke marks credential REVOKED
  ✓ Revocation is immediate (no grace period)
  ✓ Revoked credential fails webhook validation
  ✓ Cannot revoke only ACTIVE credential

D3: Credential Status Lifecycle
  ✓ CREATED → ACTIVE transition
  ✓ ACTIVE → ROTATED transition
  ✓ ROTATED → EXPIRED transition
  ✓ REVOKED stays REVOKED (no transition)

D4: Merchant Isolation
  ✓ Cannot rotate another merchant's credential
  ✓ Cannot view another merchant's credentials
  ✓ Cannot list audit events for another merchant's credential

D5: Rate Limiting
  ✓ Cannot rotate same credential twice in 24 hours
  ✓ Cannot test credential more than 10 times per minute

D6: Webhook Validation During Overlap
  ✓ Both old (ROTATED) and new (ACTIVE) credentials validate webhooks
  ✓ After overlap, old credential no longer validates

D7: Audit Trail
  ✓ All rotations logged with actor, reason, timestamp
  ✓ All revocations logged with actor, reason
  ✓ All tests logged with result

D8: Authorization
  ✓ integrations:write required for rotate/revoke
  ✓ integrations:read required for list/view
  ✓ Missing permission returns 403

D9: Secret Exposure Prevention
  ✓ Plaintext credential never logged
  ✓ Plaintext credential never cached
  ✓ Plaintext credential never appears in audit trail
```

---

## 11. Migration Impact

### 11.1 Data Migration

**Existing Credentials (from C):**

- All existing credentials in DB must be backfilled with status = ACTIVE
- All existing credentials treated as created during initial implementation (audit events backfilled)

**No Data Loss:**

- All existing plaintext values continue working
- Encrypted values not affected
- Soft-delete semantics unchanged

### 11.2 API Compatibility

**Backward Compatibility:**

- All C-phase endpoints continue unchanged
- New D-phase endpoints are additions, not modifications
- Existing clients see no breaking changes

**Migration Path for Merchants:**

1. D launches; merchants can optionally use new rotation APIs
2. C functionality continues unchanged (old credential model works)
3. Merchants gradually migrate to D rotation endpoints as needed
4. No forced migration; optional adoption

### 11.3 Deployment Order

1. **Database Migration:** Apply new schema (credentials table extended)
2. **Code Deployment:** New D endpoints live, but gated behind feature flag
3. **Feature Flag:** Enable D endpoints for canary merchants (1%)
4. **Monitoring:** 24-48 hours in canary
5. **Rollout:** Gradual 25% → 50% → 100%
6. **Grace Period:** C-phase functionality available in parallel for 30 days minimum

---

## 12. Interaction with C-Phase

### 12.1 No Breaking Changes to C

All C-phase functionality continues unchanged:

- `POST /integrations` still returns plaintext key
- `GET /integrations` still shows masked credential
- `PUT /integrations` still updates integration metadata
- `DELETE /integrations` still soft-deletes
- JWT authentication still enforced
- SSRF validation still active
- Merchant isolation still enforced

### 12.2 C Credentials in D Context

C-phase credentials are immediately compatible with D:

- Existing credentials automatically get status = ACTIVE
- Existing credentials can be rotated via D endpoints
- Existing credentials visible in D credential list
- No migration required; opt-in to rotation features

### 12.3 Overlapping Concerns

**Webhook Signature Validation:**

- C: Validates against single ACTIVE credential
- D: Validates against all non-REVOKED credentials (enables overlap)

**Credential Masking:**

- C: publicSuffix shown in GET responses
- D: publicSuffix shown in credential list; no change

**Authorization:**

- C: `integrations:read/write` enforced
- D: Same permissions apply to credential operations

---

## 13. Configuration & Deployment Parameters

### 13.1 Environment Variables (New for D)

```bash
# Rotation overlap period (days)
CREDENTIAL_ROTATION_OVERLAP_DAYS=7

# Hard-delete retention window (days after EXPIRED)
CREDENTIAL_RETENTION_DAYS=30

# Test rate limit (tests per minute)
CREDENTIAL_TEST_RATE_LIMIT=10

# Rotation rate limit (rotations per 24 hours per credential)
CREDENTIAL_ROTATION_RATE_LIMIT=1

# Lenient vs strict deadline enforcement
CREDENTIAL_DEADLINE_POLICY=lenient  # or "strict"

# Grace period for accidental revocation (minutes, 0 = no grace period)
CREDENTIAL_REVOCATION_GRACE_PERIOD_MINUTES=0  # or 15
```

### 13.2 Feature Flags (Initial Rollout)

```typescript
// In code, gate D endpoints behind feature flag
if (featureFlags.isEnabled('credential_rotation_beta', merchantId)) {
  // D endpoints available
} else {
  // D endpoints return 404 (not implemented for this merchant)
}
```

---

## 14. Open Questions for CTO Review

1. **Deadlines:** Lenient (old credential stays valid) or Strict (hard cutoff after 7 days)?
2. **Revocation Recovery:** Grace period, backup restore, or fast rotation only?
3. **Retention Policy:** Hard-delete after 30 days, or indefinite retention?
4. **Rate Limits:** Proposed limits (1 rotation/24h, 10 tests/min) sufficient? Too restrictive?
5. **Overlap Period:** 7 days sufficient for merchant deployment? Too long?
6. **Merchant Notification:** Email, in-app notification, or both?
7. **Encryption:** AES-256-GCM sufficient? HSM storage required for keys?
8. **Audit Retention:** How long keep audit logs? Compliance requirements?
9. **Backward Compat:** C-phase credentials visible in D list? Or separate?
10. **Rollout:** Canary 1% → 25% → 50% → 100% timeline?

---

## 15. Success Criteria (for CTO Approval)

Before D implementation begins, this plan must address:

- ✅ Credential rotation without downtime (zero-downtime swap)
- ✅ Revocation mechanism (immediate, not grace-period)
- ✅ Lifecycle states (CREATED, ACTIVE, ROTATED, REVOKED, EXPIRED)
- ✅ Outbound encrypted credentials (plaintext not exposed in transit)
- ✅ Old/new overlap rules (both valid during transition)
- ✅ Audit trail (full history of all operations)
- ✅ Authorization (integrations:write/read enforced)
- ✅ Merchant isolation (cannot access/modify others' credentials)
- ✅ Rate limiting (prevents abuse and enumeration)
- ✅ Secret exposure prevention (plaintext only at generation)
- ✅ Failure/rollback (atomic transactions, recovery options)
- ✅ Tests (unit, integration, acceptance)
- ✅ Migration (backward compatible, no data loss)
- ✅ C interaction (no breaking changes)

---

## 16. Estimated Effort

**Implementation (after CTO approval):**

- Database schema + migration: 2-4 hours
- Credential service (rotate, revoke, list, audit): 8-12 hours
- API endpoints (POST rotate, revoke, GET list, audit): 4-6 hours
- Webhook validation updates: 2-3 hours
- Authorization & merchant isolation: 2-3 hours
- Rate limiting: 2-3 hours
- Tests (unit, integration, acceptance): 12-16 hours
- Feature flags & deployment: 2-3 hours
- **Total: 36-50 hours**

**Assumes:**

- CTO decisions made (open questions resolved)
- C-phase already approved and tested
- OpenAPI/SDK specs available

---

## Next Steps

1. **CTO Review:** Submit this plan for review and approval
2. **Open Questions:** Resolve the 10 open questions (§ 14)
3. **Design Approval:** CTO signs off on architecture before implementation
4. **Implementation:** Begin D-phase coding once approval received
5. **Testing:** Full acceptance test harness (like C-phase)
6. **Rollout:** Staged canary deployment with monitoring

---

**Status:** 🟡 **AWAITING CTO REVIEW AND APPROVAL**  
**Do NOT implement D until CTO approves this plan.**
