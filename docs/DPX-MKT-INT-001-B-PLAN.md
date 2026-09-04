# MKT-INT-001-B Implementation Plan

**Date:** 2026-09-04  
**Scope:** Integration credential system, API foundation, merchant isolation, idempotency  
**Not in scope:** Catalog sync, inventory sync, order sync, webhooks, adapters, Merchant Portal, dashboard

---

## 1. IMPLEMENTATION PHASES

### Phase 1: Integration Credential Infrastructure
- [ ] Extend `IntegrationCredential` schema with credential types
- [ ] Implement credential encryption for outbound tokens
- [ ] Create credential type enum and utility functions
- [ ] Add credential rotation/expiration logic
- [ ] Add credential list/revoke operations

### Phase 2: API Key Authentication
- [ ] Create `IntegrationApiKeyStrategy` (Passport strategy)
- [ ] Create API key guard for integration requests
- [ ] Wire up guard to integration endpoints
- [ ] Extract merchantId from authenticated integration

### Phase 3: Scoped Authorization
- [ ] Define integration permission codes
- [ ] Create `@IntegrationScoped()` decorator for merchant isolation
- [ ] Add integration-specific permission checks
- [ ] Document scoped authorization pattern

### Phase 4: API Endpoints
- [ ] Create IntegrationsController
- [ ] Implement GET /integrations (list merchant's integrations)
- [ ] Implement GET /integrations/:id (get one)
- [ ] Implement POST /integrations (create)
- [ ] Implement PATCH /integrations/:id (update status/webhook)
- [ ] Implement DELETE /integrations/:id (soft-delete via archivedAt)
- [ ] Implement POST /integrations/:id/disconnect (explicit soft-delete)
- [ ] Implement credential endpoints (rotate, revoke, list)

### Phase 5: Service Layer
- [ ] Create IntegrationsService for business logic
- [ ] Implement merchant-scoped queries throughout
- [ ] Implement idempotency pattern for operations
- [ ] Add audit logging for integration actions
- [ ] Add correlation ID tracking

### Phase 6: Testing & Validation
- [ ] Write unit tests for credential encryption/decryption
- [ ] Write integration tests for merchant isolation
- [ ] Write tests for idempotency
- [ ] Write tests for credential rotation
- [ ] Verify typecheck, lint, build
- [ ] Verify all 21 existing unit tests still pass

### Phase 7: Documentation & Delivery
- [ ] Add OpenAPI/Swagger documentation
- [ ] Update schema.prisma with integration documentation
- [ ] Create MKT-INT-001-B completion report
- [ ] Commit with detailed message

---

## 2. CREDENTIAL ENCRYPTION STRATEGY

### 2.1 Encryption Approach

**Algorithm:** AES-256-GCM
- Authenticated encryption (detects tampering)
- 256-bit key (32 bytes)
- Random IV (16 bytes)
- Authentication tag (16 bytes)

**Key Derivation:**
- Use app secret + credential ID + fixed salt
- Alternative: Use dedicated vault (deferred if not available)

**Storage:**
```
credentialHash (ciphertext) = base64(IV || ciphertext || authTag)
```

### 2.2 Credential Type Enum

```typescript
enum IntegrationCredentialType {
  INCOMING_API_KEY = 'INCOMING_API_KEY',      // e.g., POS webhook secret
  INCOMING_SIGNATURE = 'INCOMING_SIGNATURE',  // e.g., HMAC signing
  OUTGOING_API_KEY = 'OUTGOING_API_KEY',      // e.g., DrippleX calls POS
  OUTGOING_OAUTH_TOKEN = 'OUTGOING_OAUTH_TOKEN', // OAuth access token
  OUTGOING_OAUTH_REFRESH = 'OUTGOING_OAUTH_REFRESH', // OAuth refresh token
}
```

### 2.3 Storage & Retrieval

**Outgoing Credentials (must be decryptable):**
```typescript
// Store (encrypted)
const encrypted = encrypt(accessToken, credentialKey);
await prisma.integrationCredential.create({
  data: {
    integrationId,
    credentialType: 'OUTGOING_OAUTH_TOKEN',
    credentialHash: encrypted,  // encrypted value, NOT hashed
    expiresAt: tokenExpiresAt,
  },
});

// Retrieve (decrypted)
const credential = await prisma.integrationCredential.findFirst({
  where: { integrationId, credentialType: 'OUTGOING_OAUTH_TOKEN' },
});
const accessToken = decrypt(credential.credentialHash, credentialKey);
```

**Incoming Credentials (verify only):**
```typescript
// Store (hashed)
const hashed = bcryptHash(webhookSecret);
await prisma.integrationCredential.create({
  data: {
    integrationId,
    credentialType: 'INCOMING_API_KEY',
    credentialHash: hashed,  // bcrypt hash
  },
});

// Verify (no decryption)
const credential = await prisma.integrationCredential.findFirst({
  where: { integrationId, credentialType: 'INCOMING_API_KEY' },
});
const isValid = bcryptVerify(incomingSecret, credential.credentialHash);
```

---

## 3. MERCHANT ISOLATION PATTERN

### 3.1 Request Context

Extract merchantId from JWT at request time:

```typescript
// In IntegrationApiKeyStrategy or JWT extension
const merchantId = extractMerchantFromCredential(credential);
request.merchantId = merchantId;  // Attach to request context
```

### 3.2 Service-Layer Enforcement

Every integration query MUST include merchantId:

```typescript
// apps/backend/src/integrations/integrations.service.ts

async getIntegration(merchantId: string, integrationId: string) {
  const integration = await this.prisma.merchantIntegration.findFirst({
    where: {
      id: integrationId,
      merchantId,  // ← ALWAYS verify
    },
  });
  
  if (!integration) {
    // Return 403, not 404 (prevents enumeration)
    throw new ForbiddenDomainException('Access denied');
  }
  
  return integration;
}

async listIntegrations(merchantId: string) {
  // Query only this merchant's integrations
  return this.prisma.merchantIntegration.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' },
  });
}

async createIntegration(merchantId: string, data: CreateIntegrationDto) {
  // Explicitly set merchantId (cannot come from request)
  return this.prisma.merchantIntegration.create({
    data: {
      ...data,
      merchantId,  // ← Force from verified context
    },
  });
}
```

### 3.3 Decorator for Automatic Scoping

Create `@MerchantScoped()` decorator to extract merchantId:

```typescript
@Controller('api/v1/integrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationsController {
  @Get()
  @RequirePermissions('integrations:read')
  listIntegrations(@MerchantScoped() merchantId: string) {
    return this.service.listIntegrations(merchantId);
  }
}
```

---

## 4. IDEMPOTENCY PATTERN

### 4.1 Request Deduplication

When a request arrives with `idempotencyKey`:

```
GET /integrations/:id?idempotencyKey=<key>
POST /integrations?idempotencyKey=<key>
PATCH /integrations/:id?idempotencyKey=<key>
```

### 4.2 Service-Layer Implementation

```typescript
async createIntegration(
  merchantId: string,
  data: CreateIntegrationDto,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    // Check if we've already processed this
    const existing = await this.findByIdempotencyKey(
      merchantId,
      idempotencyKey,
      'integration.created',
    );
    if (existing) {
      return existing.result;  // Return cached result
    }
  }

  // Create the integration
  const integration = await this.prisma.merchantIntegration.create({
    data: { merchantId, ...data },
  });

  // Record idempotency result
  if (idempotencyKey) {
    await this.recordIdempotency(
      merchantId,
      idempotencyKey,
      'integration.created',
      integration,
    );
  }

  return integration;
}
```

### 4.3 Idempotency Record Schema

Add to Prisma schema (or reuse existing if available):

```prisma
model IdempotencyRecord {
  id                String    @id @default(uuid()) @db.Uuid
  merchantId        String    @db.Uuid
  idempotencyKey    String
  operation         String    // 'integration.created', etc.
  requestHash       String    // Hash of request body for conflict detection
  result            String    @db.Text  // JSON-encoded result
  status            String    // 'SUCCESS', 'PENDING', 'FAILED'
  expiresAt         DateTime  // TTL: 24 hours from creation
  createdAt         DateTime  @default(now())
  
  @@unique([merchantId, idempotencyKey, operation])
  @@index([merchantId, expiresAt])
  @@map("idempotency_records")
}
```

---

## 5. SOFT-DELETE DISCONNECT BEHAVIOR

### 5.1 Disconnect Operation

When merchant disconnects integration:

```typescript
async disconnectIntegration(merchantId: string, integrationId: string) {
  const integration = await this.getIntegration(merchantId, integrationId);
  
  // Soft-delete: set archivedAt
  await this.prisma.merchantIntegration.update({
    where: { id: integrationId },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
    },
  });
  
  // Archive credentials (prevent accidental reuse)
  await this.prisma.integrationCredential.updateMany({
    where: { integrationId },
    data: { archivedAt: new Date() },
  });
  
  // Audit the disconnect
  await this.auditService.record('integration.disconnected', context, {
    resource: 'integration',
    resourceId: integrationId,
    metadata: { merchantId },
  });
}
```

### 5.2 Query Filtering

All queries must exclude archived integrations (unless explicitly requested):

```typescript
async listIntegrations(merchantId: string, includeArchived = false) {
  const where: Prisma.MerchantIntegrationWhereInput = { merchantId };
  
  if (!includeArchived) {
    where.archivedAt = null;  // Only active
  }
  
  return this.prisma.merchantIntegration.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}
```

---

## 6. API ENDPOINT SPECIFICATION

### 6.1 List Integrations

```
GET /api/v1/integrations
Authorization: Bearer <jwt>
Permissions: integrations:read

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "merchantId": "uuid",
      "integrationName": "Square POS",
      "posProvider": "SQUARE",
      "status": "ACTIVE",
      "webhookUrl": "...",
      "lastSyncedAt": "2026-09-04T12:00:00Z",
      "createdAt": "2026-09-01T10:00:00Z"
    }
  ],
  "count": 1
}
```

### 6.2 Get Integration

```
GET /api/v1/integrations/:id
Authorization: Bearer <jwt>
Permissions: integrations:read

Response 200: (same as above)
Response 403: Forbidden (merchant mismatch)
Response 404: Not found
```

### 6.3 Create Integration

```
POST /api/v1/integrations
Authorization: Bearer <jwt>
Permissions: integrations:write
Content-Type: application/json
Idempotency-Key: <optional-key>

Request:
{
  "integrationName": "Square POS",
  "posProvider": "SQUARE",
  "webhookUrl": "https://..."
}

Response 201:
{
  "id": "uuid",
  "merchantId": "uuid",
  "integrationName": "Square POS",
  "posProvider": "SQUARE",
  "status": "ACTIVE",
  "webhookUrl": "https://...",
  "createdAt": "2026-09-04T14:30:00Z"
}

Response 409: (idempotency key already exists with different data)
Response 422: Validation error
```

### 6.4 Update Integration (Status / Webhook)

```
PATCH /api/v1/integrations/:id
Authorization: Bearer <jwt>
Permissions: integrations:write

Request:
{
  "status": "ACTIVE|PAUSED|ARCHIVED",
  "webhookUrl": "https://..."
}

Response 200: (updated integration)
Response 403: Forbidden
Response 404: Not found
```

### 6.5 Disconnect Integration (Soft-Delete)

```
DELETE /api/v1/integrations/:id
Authorization: Bearer <jwt>
Permissions: integrations:write

Response 204: No content (successfully archived)
Response 403: Forbidden
Response 404: Not found
```

### 6.6 Rotate Credential

```
POST /api/v1/integrations/:id/credentials/rotate
Authorization: Bearer <jwt>
Permissions: integrations:write

Request:
{
  "credentialType": "OUTGOING_OAUTH_TOKEN",
  "secret": "..."  // new token value
}

Response 201:
{
  "id": "credential-uuid",
  "credentialType": "OUTGOING_OAUTH_TOKEN",
  "expiresAt": "2026-09-05T14:30:00Z",
  "rotatedAt": "2026-09-04T14:30:00Z",
  "publicSuffix": "...***" // Last 4 chars of token for display
}
```

### 6.7 List Credentials

```
GET /api/v1/integrations/:id/credentials
Authorization: Bearer <jwt>
Permissions: integrations:read

Response 200:
{
  "data": [
    {
      "id": "uuid",
      "credentialType": "OUTGOING_OAUTH_TOKEN",
      "expiresAt": "2026-09-05T14:30:00Z",
      "rotatedAt": "2026-09-04T14:30:00Z",
      "publicSuffix": "***",
      "status": "ACTIVE"
    }
  ]
}
```

---

## 7. FILES TO CREATE / MODIFY

### Create:
- `apps/backend/src/integrations/integrations.module.ts`
- `apps/backend/src/integrations/integrations.controller.ts`
- `apps/backend/src/integrations/integrations.service.ts`
- `apps/backend/src/integrations/integrations.dto.ts`
- `apps/backend/src/integrations/credentials.service.ts`
- `apps/backend/src/integrations/encryption.service.ts`
- `apps/backend/src/integrations/decorators/merchant-scoped.decorator.ts`
- `apps/backend/src/integrations/strategies/api-key.strategy.ts`
- `apps/backend/src/integrations/guards/integration-api-key.guard.ts`
- `apps/backend/src/integrations/integrations.service.spec.ts`
- `apps/backend/src/integrations/credentials.service.spec.ts`
- `apps/backend/src/integrations/encryption.service.spec.ts`

### Modify:
- `apps/backend/prisma/schema.prisma` (extend IntegrationCredential with type enum)
- `apps/backend/src/app.module.ts` (import IntegrationsModule)
- `apps/backend/src/main.ts` (add integration module imports if needed)

---

## 8. TESTING CHECKLIST

### Unit Tests:
- [ ] Encryption/decryption for outgoing credentials
- [ ] BCRYPT hashing/verification for incoming credentials
- [ ] Idempotency key deduplication
- [ ] Merchant isolation enforcement
- [ ] Credential rotation logic
- [ ] Soft-delete filtering

### Integration Tests:
- [ ] Create integration (merchant A) → verify only A can see it
- [ ] Create integration (merchant B) → verify B cannot see A's
- [ ] List integrations → verify filtering by merchantId
- [ ] Disconnect integration → verify archivedAt is set
- [ ] Rotate credential → verify new credential works
- [ ] Idempotent create → verify same result on retry

### Security Tests:
- [ ] Cross-merchant access rejected (403)
- [ ] Deleted integration credentials cannot be used
- [ ] Outgoing token never logged in plaintext
- [ ] Audit trail captures all credential operations

---

## 9. QUALITY GATES

- [ ] `npm run typecheck -- -p apps/backend` — zero errors
- [ ] `npm run lint -- apps/backend` — zero errors
- [ ] `npm run build -- apps/backend` — successful build
- [ ] All existing tests still pass (21 existing + new integration tests)
- [ ] No hardcoded secrets in code or logs
- [ ] OpenAPI spec generated and valid

---

## 10. DELIVERABLES

When Phase 7 completes:
1. ✅ MKT-INT-001-B implementation on `claude/dripplex-healthcheck-failure-6o3vb8` branch
2. ✅ All tests passing (existing + new)
3. ✅ Commit message with detailed explanation
4. ✅ Architecture decisions documented
5. ✅ MKT-INT-001-B completion report (DPX-MKT-INT-001-B-REPORT.md)
6. ✅ Ready for founder review and approval before C

---

## NEXT STEP

Begin Phase 1: Extend schema with credential types.
