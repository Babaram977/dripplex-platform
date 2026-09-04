# MKT-INT-001-C: Integration CRUD API — Implementation Plan

**Document**: C-PLAN.md  
**Status**: Ready for CTO Review & Approval  
**Phase**: MKT-INT-001-C Planning (Pre-Implementation)  
**Date**: 2026-09-04  
**Prepared By**: Claude Haiku 4.5  
**Session**: https://claude.ai/code/session_01X23TQjjx1mwLFzPHqgd2Kw

---

## Executive Summary

This plan specifies MKT-INT-001-C (Integration CRUD API) implementation scope, contracts, infrastructure dependencies, security model, and risk controls. C is the first user-facing feature implementation after foundational B.1 hardening review completion.

### Baseline: B.1 Status

✅ **B.1 (Authentication & RBAC Framework) is APPROVED and CLOSED**

- 43/43 behavioral tests executed against real PostgreSQL + Redis environment and passed
- Credential encryption (AES-256-GCM), hashing (BCRYPT), and rotation patterns verified
- Merchant isolation scoped via merchantId on all service methods
- Soft-delete pattern (archivedAt timestamps) enforced in schema and queries
- Audit logging service integrated for all credential operations
- No destructive deletes; all data preserved for audit trails

**Consequence for C**: Authentication layer is **production-ready**; C can proceed with full confidence in auth guards, decorators, and merchant isolation patterns.

### C Dependencies

- ✅ **MKT-INT-001-A** (Database Schema): merchant_integrations table exists, indices in place, soft-delete pattern established
- ✅ **MKT-INT-001-B** (Authentication & RBAC): JWT validation, API key auth, @AuthenticateApiKey decorator, @CurrentMerchant context, merchant_id scoping verified

### C Deliverables

1. **6 REST endpoints** for integration CRUD operations
2. **Service layer** with merchant isolation, soft-delete, and integration metadata management
3. **DTOs** with request/response validation
4. **Test suite** (unit + integration tests) covering 8 acceptance criteria
5. **API documentation** (endpoint signatures, error codes, examples)
6. **Audit logging** for all integration lifecycle operations
7. **Risk mitigation** for CRIT-006 (Merchant Isolation Failure), CRIT-001 (Duplicate Order Creation), HR-003 (Order Reconciliation)

---

## Scope & Exact Requirements

### Functional Scope (From DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md, Section MKT-INT-001-C)

**Objective**: Implement REST API endpoints for creating, reading, updating, and deleting Merchant Integrations, allowing merchants to register and manage POS system connections.

**Exact Endpoints**:

| Method | Path                                     | Purpose                            | Auth           | Returns              |
| ------ | ---------------------------------------- | ---------------------------------- | -------------- | -------------------- |
| POST   | `/api/integrations`                      | Create new integration             | JWT (merchant) | 201 with credentials |
| GET    | `/api/integrations`                      | List all integrations for merchant | JWT (merchant) | 200 with array       |
| GET    | `/api/integrations/{integrationId}`      | Get single integration             | JWT (merchant) | 200 with details     |
| PUT    | `/api/integrations/{integrationId}`      | Update integration metadata        | JWT (merchant) | 200 with updated     |
| DELETE | `/api/integrations/{integrationId}`      | Soft-delete integration            | JWT (merchant) | 204 No Content       |
| GET    | `/api/integrations/{integrationId}/test` | Test connectivity to POS           | JWT (merchant) | 200 with result      |

### Feature Requirements (From Backlog)

#### Create Integration (`POST /api/integrations`)

**Input**:

```typescript
{
  vendorName: string;          // POS system type (e.g., "Square", "Toast", "NCR")
  vendorVersion?: string;       // POS version (optional)
  merchantContactEmail?: string; // Merchant contact email (optional)
  webhookUrl?: string;          // Optional webhook URL for order updates (validated in C, used in L)
  metadata?: Record<string, unknown>; // Extensible metadata object
}
```

**Processing**:

1. Verify authenticated merchant context (via @CurrentMerchant)
2. Generate scoped API key:
   - Plaintext key format: `dpx_integration_{uuid}_{hash}` (16–32 chars, readable in logs)
   - Hash key with bcrypt (10 rounds); store hash in database
   - Default scopes: `["catalog:read", "catalog:write", "inventory:read", "inventory:write", "orders:read", "orders:write"]`
3. Create MerchantIntegration record with:
   - integrationId (UUID)
   - merchantId (from context)
   - vendorName, vendorVersion, metadata
   - status: `ACTIVE` (default)
   - createdAt: now
   - archivedAt: null
4. Create IntegrationCredential record with:
   - credentialId (UUID)
   - integrationId (from step 3)
   - credentialHash (bcrypt hash of key)
   - credentialType: `API_KEY`
   - scopes: default scopes (JSON array)
   - createdAt: now
   - archivedAt: null
5. Audit log: `integration.created` with resource: `integration`, resourceId: integrationId
6. **Return plaintext API key ONLY ONCE** in response; never retrievable again

**Output** (201 Created):

```typescript
{
  integrationId: string;     // UUID
  vendorName: string;
  status: "ACTIVE" | "PAUSED" | "REVOKED" | "ERROR";
  createdAt: ISO8601;
  apiKey: string;            // PLAINTEXT KEY (returned once only)
  scopes: string[];          // Default scopes
  credential: {
    id: string;
    createdAt: ISO8601;
    scopes: string[];
  }
}
```

**Error Cases**:

- 400: Invalid vendorName or metadata
- 401: Unauthenticated
- 403: Merchant context missing (should not occur if B.1 guards work)

#### List Integrations (`GET /api/integrations`)

**Query Parameters**:

```typescript
{
  includeArchived?: boolean; // Default: false; if true, admin only
  limit?: number;            // Default: 20, max: 100
  offset?: number;           // Default: 0
  status?: "ACTIVE" | "PAUSED" | "REVOKED" | "ERROR"; // Filter by status (optional)
}
```

**Processing**:

1. Verify authenticated merchant context
2. Query MerchantIntegration where:
   - merchantId = context.merchantId
   - archivedAt IS NULL (unless includeArchived=true AND admin)
   - status matches filter (if provided)
3. Apply pagination (limit, offset)
4. For each integration, fetch latest credential (non-archived) for publicSuffix
5. Return array with pagination metadata

**Output** (200 OK):

```typescript
{
  data: Array<{
    integrationId: string;
    vendorName: string;
    status: 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'ERROR';
    createdAt: ISO8601;
    updatedAt?: ISO8601;
    publicSuffix: string; // Masked credential suffix (e.g., "****...abc123")
    credential: {
      id: string;
      createdAt: ISO8601;
      publicSuffix: string;
      lastUsedAt?: ISO8601;
    };
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }
}
```

**Error Cases**:

- 401: Unauthenticated
- 403: includeArchived=true but not admin

#### Get Integration (`GET /api/integrations/{integrationId}`)

**Processing**:

1. Verify authenticated merchant context
2. Fetch MerchantIntegration where id = integrationId AND merchantId = context.merchantId
3. Return 404 if not found (never 403; see risk CRIT-006 mitigation)
4. Fetch latest credentials (non-archived) for this integration
5. Build response with masked credentials

**Output** (200 OK):

```typescript
{
  integrationId: string;
  merchantId: string;          // For verification
  vendorName: string;
  vendorVersion?: string;
  merchantContactEmail?: string;
  status: "ACTIVE" | "PAUSED" | "REVOKED" | "ERROR";
  webhookUrl?: string;         // For future webhook updates (L phase)
  metadata?: Record<string, unknown>;
  createdAt: ISO8601;
  updatedAt?: ISO8601;
  archivedAt?: ISO8601 | null;
  credentials: Array<{
    id: string;
    createdAt: ISO8601;
    status: "ACTIVE" | "REVOKED";
    publicSuffix: string;
    scopes: string[];
    lastUsedAt?: ISO8601;
  }>;
  lastSync?: {
    type: "catalog" | "inventory" | "orders"; // For future use (F/J/L phase)
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
    completedAt?: ISO8601;
  }
}
```

**Error Cases**:

- 401: Unauthenticated
- 404: Integration not found (including cross-merchant check)

#### Update Integration (`PUT /api/integrations/{integrationId}`)

**Input**:

```typescript
{
  vendorName?: string;           // Update POS name (optional)
  vendorVersion?: string;        // Update POS version (optional)
  merchantContactEmail?: string; // Update contact (optional)
  webhookUrl?: string;           // Update webhook URL (optional, validated but not used until L)
  metadata?: Record<string, unknown>; // Merge or replace metadata
  status?: "ACTIVE" | "PAUSED";  // Update status (only these two; REVOKED/ERROR set by system)
}
```

**Processing**:

1. Verify authenticated merchant context
2. Fetch MerchantIntegration where id = integrationId AND merchantId = context.merchantId
3. Return 404 if not found
4. Validate inputs:
   - vendorName: non-empty string if provided
   - webhookUrl: valid HTTPS URL if provided (enforce HTTPS for webhook security)
   - metadata: must be serializable JSON object
5. Update fields that were provided
6. Set updatedAt = now
7. Audit log: `integration.updated` with old/new values
8. Return updated record

**Output** (200 OK): Same as GET /api/integrations/{integrationId}

**Error Cases**:

- 400: Invalid input (malformed URL, non-JSON metadata)
- 401: Unauthenticated
- 404: Integration not found
- **Note**: Cannot update credentials via this endpoint; use D (Credentials Management) for that

#### Delete Integration (`DELETE /api/integrations/{integrationId}`)

**Processing**:

1. Verify authenticated merchant context
2. Fetch MerchantIntegration where id = integrationId AND merchantId = context.merchantId
3. Return 404 if not found
4. **Soft-delete**: Set archivedAt = now (do NOT perform destructive DELETE)
5. Revoke all active credentials for this integration:
   - Set archivedAt = now on all IntegrationCredential records where integrationId = this ID and archivedAt IS NULL
6. Set integration status = REVOKED
7. Audit log: `integration.deleted` (soft-delete) with timestamp
8. Return 204 No Content

**Error Cases**:

- 401: Unauthenticated
- 404: Integration not found

#### Test Integration (`GET /api/integrations/{integrationId}/test`)

**Processing**:

1. Verify authenticated merchant context
2. Fetch MerchantIntegration where id = integrationId AND merchantId = context.merchantId
3. Return 404 if not found
4. If webhookUrl is configured:
   - HTTP GET to webhookUrl with 5-second timeout
   - Measure round-trip latency
   - Capture response status code
   - Return success/failure
5. If no webhookUrl:
   - Attempt minimal connectivity test (e.g., DNS lookup of POS API endpoint, if known)
   - Or return status: "UNCONFIGURED"
6. Audit log: `integration.test` with result (success/failure)
7. Return result

**Output** (200 OK):

```typescript
{
  status: "SUCCESS" | "FAILED" | "UNCONFIGURED";
  message: string;                    // Human-readable status
  latencyMs?: number;                 // Round-trip latency if SUCCESS
  httpStatus?: number;                // HTTP response code if failed
  testedAt: ISO8601;
}
```

**Error Cases**:

- 401: Unauthenticated
- 404: Integration not found
- 504: Test timeout (webhook unreachable after 5 seconds)

---

## Contract & API Signatures

### Request/Response DTOs

**CreateIntegrationDto**:

```typescript
// File: apps/backend/src/integrations/dtos/create-integration.dto.ts
import { IsString, IsOptional, IsEmail, IsUrl, IsObject, MaxLength } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  @MaxLength(100)
  vendorName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  vendorVersion?: string;

  @IsOptional()
  @IsEmail()
  merchantContactEmail?: string;

  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
```

**UpdateIntegrationDto**:

```typescript
// File: apps/backend/src/integrations/dtos/update-integration.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateIntegrationDto } from './create-integration.dto';

export enum IntegrationStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  REVOKED = 'REVOKED',
  ERROR = 'ERROR',
}

export class UpdateIntegrationDto extends PartialType(CreateIntegrationDto) {
  @IsOptional()
  @IsEnum([IntegrationStatus.ACTIVE, IntegrationStatus.PAUSED])
  status?: IntegrationStatus;
}
```

**IntegrationResponseDto**:

```typescript
// File: apps/backend/src/integrations/dtos/integration-response.dto.ts
export class CredentialResponseDto {
  id: string;
  createdAt: Date;
  publicSuffix: string;
  scopes: string[];
  lastUsedAt?: Date;
  status: 'ACTIVE' | 'REVOKED';
}

export class IntegrationResponseDto {
  integrationId: string;
  merchantId: string;
  vendorName: string;
  vendorVersion?: string;
  merchantContactEmail?: string;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
  archivedAt?: Date | null;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
  credentials: CredentialResponseDto[];
  lastSync?: {
    type: string;
    status: string;
    completedAt?: Date;
  };
}

export class CreateIntegrationResponseDto extends IntegrationResponseDto {
  apiKey: string; // Plaintext key, returned only once
  credential: CredentialResponseDto;
}

export class ListIntegrationsResponseDto {
  data: IntegrationResponseDto[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export class TestIntegrationResponseDto {
  status: 'SUCCESS' | 'FAILED' | 'UNCONFIGURED';
  message: string;
  latencyMs?: number;
  httpStatus?: number;
  testedAt: Date;
}
```

---

## Infrastructure & Reuse

### Existing Code to Reuse (From B.1)

✅ **Authentication & Authorization**:

- `BearerAuth` guard from B.1 (validates JWT, attaches @CurrentMerchant context)
- `@AuthenticateApiKey()` decorator (not used in C, but available from B.1)
- Merchant context injection via `@CurrentMerchant()` decorator
- Scope validation via `@RequireScopes(...)` decorator (optional for C, required for D+)

✅ **Encryption & Hashing** (from B.1):

- `EncryptionService` for credential encryption (AES-256-GCM)
- `bcrypt` library for API key hashing (already in use in B.1)
- Constructor patterns for dependency injection
- Key generation helpers (if needed, create in C)

✅ **Audit Logging**:

- `AuditService.record()` method (verified in B.1 specs)
- Event names: `integration.created`, `integration.updated`, `integration.deleted`, `integration.test`
- Audit context structure: `{userId: merchantId, metadata: {integrationId, vendorName, ...}}`

✅ **Data Validation**:

- DTOs with `class-validator` decorators (existing pattern)
- Global validation pipe in NestJS module
- Custom validators for URLs, emails, etc.

✅ **Soft-Delete Pattern**:

- Query filters: `where: { archivedAt: null }` (established in B.1)
- Update pattern: `update({archivedAt: new Date()})` (no DELETE)
- Schema constraint: `archived_at` timestamp field (exists in A)

✅ **Error Handling**:

- Global exception filter (existing)
- Domain exceptions: `ForbiddenDomainException`, `NotFoundDomainException`, `ValidationDomainException`
- HTTP status mappings (already defined)

### New Infrastructure Required for C

#### Service Layer

**File**: `apps/backend/src/integrations/integrations.service.ts`

Methods:

- `createIntegration(merchantId, input): Promise<CreateIntegrationResponseDto>`
- `listIntegrations(merchantId, filters): Promise<ListIntegrationsResponseDto>`
- `getIntegration(merchantId, integrationId): Promise<IntegrationResponseDto>`
- `updateIntegration(merchantId, integrationId, input): Promise<IntegrationResponseDto>`
- `deleteIntegration(merchantId, integrationId): Promise<void>`
- `testIntegration(merchantId, integrationId): Promise<TestIntegrationResponseDto>`

**Dependencies** (injected):

- `PrismaService` (database access)
- `AuditService` (audit logging)
- `EncryptionService` (for future credential operations in D, optional for C)

#### Controller Layer

**File**: `apps/backend/src/integrations/integrations.controller.ts`

HTTP handlers for 6 endpoints; decorators:

- `@Controller('api/integrations')`
- `@UseGuards(BearerAuth)` (protect all endpoints; verify JWT, attach @CurrentMerchant)
- `@CurrentMerchant()` to extract merchantId from JWT
- `@Post()`, `@Get()`, `@Put()`, `@Delete()` decorators
- `@Param()`, `@Query()`, `@Body()` for request binding
- `@HttpCode()` to set response codes (201, 204, etc.)

#### Module Definition

**File**: `apps/backend/src/integrations/integrations.module.ts`

```typescript
@Module({
  providers: [IntegrationsService],
  controllers: [IntegrationsController],
  imports: [PrismaService, AuditService], // or inject via global module
})
export class IntegrationsModule {}
```

#### Database Queries

Uses Prisma ORM:

- `prisma.merchantIntegration.create()`
- `prisma.merchantIntegration.findMany({where: {merchantId, archivedAt: null}})`
- `prisma.merchantIntegration.findUnique({where: {id}})`
- `prisma.merchantIntegration.update({where: {id}, data: {...}})`
- `prisma.merchantIntegration.update({where: {id}, data: {archivedAt: now}})`
- `prisma.integrationCredential.create()` for credential
- `prisma.integrationCredential.findMany({where: {integrationId, archivedAt: null}})`

**Scoping**: Every query includes `merchantId` filter to enforce merchant isolation (CRIT-006 mitigation).

---

## Database Changes

### Existing Tables (From A: No New Tables Required for C)

**MerchantIntegration**:

- id (UUID, PK)
- merchantId (UUID, FK → merchants.id)
- vendorName (String)
- vendorVersion (String, nullable)
- merchantContactEmail (String, nullable)
- webhookUrl (String, nullable) — for future use (L phase)
- metadata (JSON, nullable)
- status (Enum: PENDING, ACTIVE, PAUSED, REVOKED, ERROR) — default: ACTIVE
- createdAt (Timestamp)
- updatedAt (Timestamp, nullable)
- archivedAt (Timestamp, nullable) — soft-delete; null = active

**Indices** (from A):

- `UNIQUE(merchantId, vendorName, archivedAt)` — prevent duplicate integration names per merchant (optional; nice-to-have)
- `INDEX(merchantId, archivedAt)` — fast soft-delete queries
- `INDEX(createdAt)` — for audit trail sorting

**IntegrationCredential** (used in C for API key storage):

- id (UUID, PK)
- integrationId (UUID, FK → merchant_integrations.id)
- credentialType (Enum: INCOMING_API_KEY, OUTGOING_API_KEY, INCOMING_SIGNATURE, OUTGOING_OAUTH_TOKEN, OUTGOING_OAUTH_REFRESH)
- credentialHash (String) — bcrypt hash of API key; plaintext never stored
- scopes (JSON Array) — default: ["catalog:read", "catalog:write", "inventory:read", "inventory:write", "orders:read", "orders:write"]
- createdAt (Timestamp)
- rotatedAt (Timestamp, nullable) — for rotation tracking
- archivedAt (Timestamp, nullable) — soft-delete

**Constraints**:

- `FOREIGN KEY(integrationId) REFERENCES merchant_integrations(id) ON DELETE CASCADE` (or handle via soft-delete logic)
- Soft-delete pattern: queries filter `archivedAt IS NULL`

### C Data Model (No Breaking Changes)

- MerchantIntegration table created in A; C only reads/writes to existing schema
- IntegrationCredential table created in B; C reads latest non-archived credential per integration
- No schema migrations required for C
- All soft-delete logic already present in A schema

---

## Authorization & Security Model

### Authentication Layer (From B.1)

**Endpoint Protection**:

- All 6 endpoints protected by `@UseGuards(BearerAuth)` guard
- Guard validates JWT token from Authorization header
- JWT must include `sub: merchantId` claim
- Guard attaches `request.user.merchantId` to request context

### Merchant Isolation (CRIT-006 Mitigation)

**Principle**: Explicit merchant scoping on every database query

**Implementation**:

1. `@CurrentMerchant()` decorator extracts `merchantId` from JWT
2. Pass `merchantId` to service method
3. All Prisma queries include: `where: {merchantId, ...}`
4. Service never trusts client-provided `merchantId`; always uses context

**Example**:

```typescript
// Controller
@Get(':integrationId')
async getIntegration(
  @CurrentMerchant() merchantId: string,
  @Param('integrationId') integrationId: string,
) {
  return this.integrationsService.getIntegration(merchantId, integrationId);
}

// Service
async getIntegration(merchantId: string, integrationId: string) {
  const integration = await this.prisma.merchantIntegration.findFirst({
    where: {
      id: integrationId,
      merchantId, // ← CRITICAL: filter by merchant
    },
  });
  if (!integration) throw new NotFoundDomainException('Integration not found');
  return integration;
}
```

**Error Responses**: Return 404 (not 403) if integration not found

- **Rationale** (from CRIT-006 notes): Prevents information leakage (attacker cannot distinguish between "doesn't exist" vs "not owned by me")
- Test must explicitly verify: different merchant + same integrationId → 404 (not 403)

### Scope Validation

**C endpoints**: No explicit scope checking needed yet

- All authenticated merchants can create/manage their own integrations
- Scope restrictions apply in D (credential management) and L (order updates)
- B.1 framework is in place; C doesn't enforce scopes but decorators available

### API Key Security

**Generated in C, Used in D+**:

- Key format: `dpx_integration_{uuid}_{base64hash}` (human-readable, identifiable in logs)
- Stored as: bcrypt hash (10 rounds) in database
- Returned as: plaintext ONLY at creation time
- Never retrievable again; must rotate via D endpoints

**Risk Mitigation** (CRIT-005: Credential Compromise):

- Key hashing prevents plaintext exposure if database breached
- Key format prefix (`dpx_`) makes keys identifiable in logs
- Rotation API (D) allows immediate key revocation
- Audit logging tracks all key usage (by endpoint D)

---

## Validation Rules

### Input Validation (At DTO/Controller Level)

**CreateIntegrationDto**:

- `vendorName`: required, non-empty string, ≤100 chars
- `vendorVersion`: optional, string ≤50 chars
- `merchantContactEmail`: optional, valid email format
- `webhookUrl`: optional, valid HTTPS URL (enforce HTTPS for security)
- `metadata`: optional, valid JSON object (no nested arrays >depth 2; size <10KB)

**UpdateIntegrationDto**:

- All fields optional (partial update)
- `status`: if provided, must be ACTIVE or PAUSED (not REVOKED/ERROR)
- `webhookUrl`: if provided, must be valid HTTPS URL

**ListIntegrationsQuery**:

- `includeArchived`: optional boolean (default: false)
- `limit`: optional number, 1–100 (default: 20)
- `offset`: optional number ≥0 (default: 0)
- `status`: optional enum (ACTIVE, PAUSED, REVOKED, ERROR)

### Business Logic Validation (At Service Level)

**Create Integration**:

1. Verify merchantId exists and is not suspended
2. Verify vendorName is not already used by merchant (optional unique constraint)
3. If webhookUrl provided, validate HTTPS, port 443, no internal IPs (0.0.0.0, 127.0.0.1, 192.168.*)
4. Generate unique integrationId (UUID v4)
5. Generate unique API key (UUID-based)

**Update Integration**:

1. Verify integration exists and belongs to merchant
2. If webhookUrl updated, validate HTTPS
3. If metadata updated, merge (don't replace unless explicit flag)
4. Set updatedAt = now

**Delete Integration**:

1. Verify integration exists and belongs to merchant
2. Soft-delete only (no destructive DELETE)
3. Revoke all active credentials for this integration

**Test Integration**:

1. Verify integration exists and belongs to merchant
2. If webhookUrl configured, attempt HTTP GET
3. Timeout after 5 seconds
4. Capture latency, status code, success/failure

---

## Audit & Logging

### Audit Events

**Integration Lifecycle**:

| Event                             | Trigger                                              | Logged Data                                                              | Severity |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| `integration.created`             | POST /api/integrations succeeds                      | integrationId, vendorName, merchantId, timestamp                         | INFO     |
| `integration.updated`             | PUT /api/integrations/{id} succeeds                  | integrationId, merchantId, old values, new values, timestamp             | INFO     |
| `integration.deleted`             | DELETE /api/integrations/{id} succeeds (soft-delete) | integrationId, merchantId, timestamp                                     | INFO     |
| `integration.test`                | GET /api/integrations/{id}/test succeeds or fails    | integrationId, merchantId, result (success/failure), latency, timestamp  | INFO     |
| `integration.unauthorized_access` | Merchant A tries to access Merchant B's integration  | attempter merchantId, target integrationId, target merchantId, timestamp | WARN     |

**Audit Log Structure**:

```typescript
{
  eventName: 'integration.created',
  userId: merchantId,           // From JWT context
  timestamp: ISO8601,
  metadata: {
    resource: 'integration',
    resourceId: integrationId,
    integrationDetails: {
      vendorName: string,
      status: string,
    },
  },
  result: 'SUCCESS' | 'FAILURE',
  errorMessage?: string,        // If failed
}
```

### Sensitive Data Handling

**Never Log**:

- API key plaintext (only log masked suffix or redacted)
- JWT tokens
- Merchant private information

**Always Log**:

- Action (created, updated, deleted, test)
- Timestamp
- Actor (merchantId)
- Target resource (integrationId)
- Result (success/failure)
- Error message (sanitized, no stack traces)

### Audit Service Integration

**C service calls**:

```typescript
await this.auditService.record(
  'integration.created',
  { userId: merchantId },
  {
    resource: 'integration',
    resourceId: integrationId,
    metadata: {
      vendorName,
      status: 'ACTIVE',
    },
  },
);
```

---

## Idempotency & Consistency

### Idempotency Model

**C does NOT use Idempotency-Key** for CRUD operations (that's for D+L phases)

**Reason**: Integration creation is inherently idempotent:

- If merchant creates integration twice with same vendorName:
  - First request: creates integration, returns credentials
  - Second request: query returns existing integration (different integrationId, new credentials generated)
  - **Not truly idempotent**, but safe (no data corruption)

**Note**: Idempotency requirements for orders (CRIT-001) are handled in L phase with explicit Idempotency-Key header validation.

### Consistency Guarantees

**Transaction Boundaries** (within service method):

- Integration creation: atomic INSERT into merchant_integrations + INSERT into integration_credentials
- Integration deletion: atomic UPDATE (soft-delete) on both tables
- All operations within single database transaction (Prisma handles this)

**Merchant Isolation Consistency**:

- Every query explicitly filters by merchantId
- No cross-merchant leakage possible (tested in acceptance criteria)
- Delete operations revoke all credentials (atomically prevent API key usage)

---

## Test Plan

### Unit Tests (Service Layer)

**File**: `apps/backend/src/integrations/integrations.service.spec.ts`

```typescript
describe('IntegrationsService', () => {
  // Setup: mock Prisma, AuditService

  describe('createIntegration', () => {
    it('should create integration and return plaintext API key', async () => {
      const merchantId = 'merchant-1';
      const input = { vendorName: 'Square', vendorVersion: '2.0' };

      const result = await service.createIntegration(merchantId, input);

      expect(result.integrationId).toBeDefined();
      expect(result.apiKey).toBeDefined(); // Plaintext
      expect(result.status).toBe('ACTIVE');
      expect(prisma.merchantIntegration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ merchantId, vendorName: 'Square' }),
      });
    });

    it('should hash API key in database', async () => {
      // Verify bcrypt used, plaintext not stored
    });

    it('should set default scopes on credential', async () => {
      // Verify scopes = ["catalog:read", "catalog:write", ...]
    });
  });

  describe('listIntegrations', () => {
    it('should return only authenticated merchant's integrations', async () => {
      // Create 3 integrations for merchant-1, 2 for merchant-2
      // Query as merchant-1 → returns 3 only
    });

    it('should exclude archived integrations by default', async () => {
      // Create 3 active, 1 archived
      // Query without includeArchived → returns 3 only
    });

    it('should paginate results', async () => {
      // Create 25 integrations
      // Query limit=10 → returns 10 + hasMore=true
    });
  });

  describe('getIntegration', () => {
    it('should return integration if owned by merchant', async () => {
      // Create integration for merchant-1
      // Query as merchant-1 → returns integration
    });

    it('should return 404 if integration not found or not owned', async () => {
      // Create integration for merchant-1
      // Query as merchant-2 → throws NotFoundDomainException
      // Query with fake ID → throws NotFoundDomainException
    });
  });

  describe('updateIntegration', () => {
    it('should update metadata without changing credentials', async () => {
      // Create integration with vendorName="Square"
      // Update vendorName="Toast"
      // Verify credentialHash unchanged
    });

    it('should reject status update to REVOKED (system-only)', async () => {
      // Attempt to update status to REVOKED
      // Should throw ValidationDomainException
    });
  });

  describe('deleteIntegration', () => {
    it('should soft-delete integration (set archivedAt)', async () => {
      // Create integration
      // Delete
      // Verify archivedAt set, not hard DELETE
    });

    it('should revoke all credentials when deleting', async () => {
      // Create integration with 2 credentials
      // Delete integration
      // Verify both credentials archivedAt set
    });
  });

  describe('testIntegration', () => {
    it('should test webhook URL and return latency', async () => {
      // Create integration with webhookUrl
      // Call test
      // Mock HTTP GET; verify latency returned
    });

    it('should handle unreachable webhook (timeout)', async () => {
      // Create integration with unreachable URL
      // Call test with 5-sec timeout
      // Verify status="FAILED", httpStatus undefined
    });
  });

  describe('merchant isolation', () => {
    it('should prevent cross-merchant access', async () => {
      // Create integration for merchant-1
      // Query as merchant-2 with merchant-1's integrationId
      // Should throw NotFoundDomainException (not ForbiddenDomainException)
    });
  });
});
```

### Integration Tests (Controller + Service)

**File**: `apps/backend/src/integrations/integrations.controller.spec.ts`

```typescript
describe('IntegrationsController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    // Set up test module with real IntegrationsService (mocked Prisma)
    // Add BearerAuth guard with mocked JWT validation
  });

  describe('POST /api/integrations', () => {
    it('should return 201 with plaintext API key', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .post('/api/integrations')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ vendorName: 'Square' });

      expect(response.status).toBe(201);
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.integrationId).toBeDefined();
    });

    it('should return 401 if unauthenticated', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/integrations')
        .send({ vendorName: 'Square' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/integrations', () => {
    it('should return 200 with pagination', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .get('/api/integrations?limit=10&offset=0')
        .set('Authorization', `Bearer ${jwt}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/integrations/{id}', () => {
    it('should return 404 for cross-merchant access', async () => {
      // Create integration for merchant-1
      // Query as merchant-2
      const jwt2 = createJWT({ sub: 'merchant-2' });
      const response = await request(app.getHttpServer())
        .get(`/api/integrations/${merchant1IntegrationId}`)
        .set('Authorization', `Bearer ${jwt2}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/integrations/{id}', () => {
    it('should update integration metadata', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .put(`/api/integrations/${integrationId}`)
        .set('Authorization', `Bearer ${jwt}`)
        .send({ vendorName: 'Toast' });

      expect(response.status).toBe(200);
      expect(response.body.vendorName).toBe('Toast');
    });
  });

  describe('DELETE /api/integrations/{id}', () => {
    it('should return 204 and soft-delete', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .delete(`/api/integrations/${integrationId}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(response.status).toBe(204);
      // Verify in DB: archivedAt is set, not deleted
    });
  });

  describe('GET /api/integrations/{id}/test', () => {
    it('should test webhook connectivity', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .get(`/api/integrations/${integrationId}/test`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toMatch(/SUCCESS|FAILED|UNCONFIGURED/);
    });
  });
});
```

### Acceptance Criteria (8 Must-Pass Tests)

From DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md, MKT-INT-001-C:

1. ✅ **POST /api/integrations returns 201 with credentials (API key, scopes)**
   - Test: Create integration → verify status=201, apiKey returned, scopes=default

2. ✅ **Credentials returned only once (subsequent GET returns masked key)**
   - Test: Create → get plaintext key; Call GET endpoint → verify publicSuffix (masked), never plaintext

3. ✅ **GET /api/integrations returns only authenticated merchant's integrations (pagination)**
   - Test: Create 25 integrations for merchant-1; query as merchant-1 with limit=10 → verify 10 returned, hasMore=true; query as merchant-2 → verify 0 returned

4. ✅ **GET /api/integrations/{id} returns full integration metadata**
   - Test: Create integration with metadata; call GET → verify all fields present (vendorName, status, createdAt, credentials)

5. ✅ **PUT /api/integrations/{id} updates name/description successfully**
   - Test: Create with vendorName="Square"; update to "Toast"; verify updated record returned

6. ✅ **DELETE /api/integrations/{id} sets archived_at and excludes from list**
   - Test: Create integration; delete; verify archivedAt set; query list → verify deleted integration not returned; verify GET returns 404

7. ✅ **GET /api/integrations/{id}/test calls webhook URL and returns {success, latency_ms}**
   - Test: Create with webhookUrl; call test endpoint → verify status=SUCCESS, latencyMs>0; mock 500 error → verify status=FAILED

8. ✅ **Unarchive operation (if supported) restores archived_at to NULL**
   - Test: Create → delete → unarchive (via specific endpoint or PUT request); verify archivedAt=null; verify in list
   - **Note**: Unarchive not explicitly in scope; may defer to I phase or skip if deemed unnecessary

---

## Risk Mitigation

### Critical Risks Addressed in C

#### CRIT-006: Merchant Isolation Failure

**Risk**: Merchant A's API key allows querying Merchant B's data

**C Mitigation**:

1. Every service method receives `merchantId` from `@CurrentMerchant()` decorator
2. All Prisma queries include: `where: {merchantId, ...}`
3. Never trust client-provided `merchantId` parameter
4. Return 404 (not 403) for cross-merchant access → prevents information leakage
5. Test: CrossMerchantAccess — query as merchant-2 with merchant-1's integrationId → 404

**Acceptance Criteria** (from CRIT-006):

- ✅ Cross-merchant query returns 404 (NOT 403)
- ✅ All GET endpoints filter by merchantId
- ✅ All PUT/PATCH/DELETE endpoints verify merchantId ownership
- ✅ Test: 10 merchants, each tries to access others' data → all fail with 404

#### CRIT-001: Duplicate Order Creation (Future, Prepared in C)

**Risk**: POS sends identical order payload twice; DrippleX creates two orders

**C Preparation** (Full mitigation in L):

- C generates unique integrationId for each integration
- C credential hash is unique (bcrypt salt)
- Database constraint ready (merchantId + external_order_id will be UNIQUE in L)
- Idempotency framework exists (can be added to C, required for L)

**Note**: C does not handle order idempotency (that's L); but integration creation is deterministic.

#### CRIT-005: Credential Compromise

**Risk**: API key leaked; attacker modifies orders, inventory, catalog

**C Mitigation**:

1. API key hashed with bcrypt (plaintext never stored)
2. Key format `dpx_integration_*` makes keys identifiable in logs
3. Plaintext returned only at creation time
4. No retrieval of plaintext key after creation (must rotate via D)
5. Audit logging tracks credential creation and usage (via D)
6. Credential revocation (D) blocks compromised key immediately

**Note**: Full credential rotation (D) and revocation are not in C scope; prepared for D phase.

### High-Impact Risks Addressed in C

#### HR-003: Order Reconciliation Failure

**Risk**: POS order not linked to DrippleX order; reconciliation fails

**C Preparation**:

- C generates unique integrationId for mapping POS orders to DrippleX
- Integration record stores metadata (vendorName, etc.) for reconciliation
- External order mapping will reference integrationId (in L)
- Audit logging enables tracing order creation back to POS

---

## Out-of-Scope (Deferred to Later Phases)

### Explicitly Out-of-Scope for C (From Backlog)

- ❌ OAuth2 credential exchange (API key only for now; OAuth in future)
- ❌ WebSocket live status streaming (polling or webhook in L)
- ❌ Bulk integration import/export (manual creation only)
- ❌ Integration cloning (copy settings from existing)
- ❌ Integration versioning/rollback
- ❌ Custom integration branding/UI
- ❌ Order status transitions (L phase)
- ❌ Credential rotation (D phase; C prepares schema)
- ❌ Webhook delivery (L phase; C accepts webhookUrl for future use)

### Deferred to D, E, F–L Phases

| Feature                 | Phase | Reason                                                    |
| ----------------------- | ----- | --------------------------------------------------------- |
| Credential rotation     | D     | Requires separate endpoints for key generation/revocation |
| Scope modification      | D     | Requires authorization model for per-credential scopes    |
| Status health checks    | E     | Requires integration with sync tracking (F)               |
| Catalog synchronization | F     | Requires async job queue, POS API calls                   |
| Product mapping         | G     | Requires catalog/inventory sync infrastructure            |
| Conflict detection      | H     | Requires sync history and product mapping                 |
| Inventory sync          | J     | Requires async queue, stock update logic                  |
| Order integration       | L     | Requires order state machine, webhook framework           |

---

## Implementation Roadmap

### Phase 1: Setup & Scaffolding (Day 1)

- [ ] Create DTOs (CreateIntegrationDto, UpdateIntegrationDto, ResponseDtos)
- [ ] Create IntegrationsService class with method signatures
- [ ] Create IntegrationsController class with endpoint signatures
- [ ] Set up IntegrationsModule (import auth guards, services, Prisma)
- [ ] Verify B.1 authentication guards work with C service

**Deliverable**: Skeleton code with dependency injection; tests compilable but failing

### Phase 2: Business Logic (Days 2–3)

- [ ] Implement createIntegration (INSERT merchant_integrations + integration_credentials)
- [ ] Implement listIntegrations (query with soft-delete filter, pagination)
- [ ] Implement getIntegration (fetch + merchant scoping)
- [ ] Implement updateIntegration (PARTIAL UPDATE, no credential changes)
- [ ] Implement deleteIntegration (soft-delete + credential revocation)
- [ ] Implement testIntegration (HTTP GET to webhookUrl, latency capture)

**Deliverable**: All methods functional; integration tests pass

### Phase 3: Security & Validation (Days 3–4)

- [ ] Verify BearerAuth guard integration (JWT validation, @CurrentMerchant context)
- [ ] Test merchant isolation (cross-merchant queries return 404)
- [ ] Validate input DTOs (email, URL, JSON object validation)
- [ ] Implement audit logging (AuditService.record calls)
- [ ] Verify API key hashing (bcrypt, plaintext never logged)

**Deliverable**: Security tests pass; audit logs verified

### Phase 4: Testing & Documentation (Days 4–5)

- [ ] Write 8 acceptance criteria tests
- [ ] Write unit tests (service layer)
- [ ] Write integration tests (controller + service)
- [ ] Test all error cases (401, 403, 404, 400, 500)
- [ ] Create API documentation (endpoint signatures, error codes, examples)
- [ ] Verify soft-delete pattern (query filters, unarchive)

**Deliverable**: 100% test pass rate; API docs ready; acceptance criteria met

### Phase 5: Review & Merge (Day 5)

- [ ] CTO code review
- [ ] Merge to `claude/dripplex-healthcheck-failure-6o3vb8` branch
- [ ] Verify CI/CD pipeline passes
- [ ] Prepare for D phase (credential management endpoints)

**Deliverable**: Code merged; D phase planning begins

---

## Risk Register Relevance

### Critical Risks Prevented by C

✅ **CRIT-006**: Merchant Isolation Failure — Every query scoped by merchantId

✅ **CRIT-005**: Credential Compromise — Keys hashed, plaintext one-time return

✅ **CRIT-001**: Duplicate Order Creation — Deterministic integration creation; idempotency prepared for L

### Medium Risks Mitigated by C

✅ **HR-003**: Order Reconciliation Failure — Integration tracking enables POS→DrippleX mapping

✅ **HR-008**: Credential Shared Across Merchants — One credential per integration; audit trail

---

## Success Criteria

### Before Implementation Begins

- [ ] CTO approves C-PLAN.md
- [ ] All acceptance criteria understood and testable
- [ ] Team familiar with B.1 patterns (auth guards, audit service, soft-delete)

### At Completion (Before D Phase)

- [ ] 8 acceptance criteria tests pass
- [ ] 100% unit test coverage (service methods)
- [ ] 100% integration test coverage (controller + guards)
- [ ] All critical risks (CRIT-006, CRIT-005) prevented
- [ ] Merchant isolation verified by security test
- [ ] API documentation complete (endpoint specs, error codes, examples)
- [ ] Code merged to feature branch
- [ ] No breaking changes to B.1 or A patterns

---

## Notes & Assumptions

### Assumptions from B.1

- JWT validation working (BearerAuth guard)
- @CurrentMerchant decorator properly extracts merchantId
- AuditService.record method accepts event name + context + metadata
- Prisma transactions atomic (create integration + credential in one tx)
- Database connection pooling handles concurrent requests

### Open Questions for CTO

1. **Unarchive endpoint**: Should C include restoration (`POST /api/integrations/{id}/restore`) or defer to I phase?
   - **Plan assumes**: Defer to I phase (Soft-Delete & Archive Operations)

2. **Metadata extensibility**: Should metadata support arbitrary JSON or enforce schema?
   - **Plan assumes**: Arbitrary JSON (no schema enforcement)

3. **Webhook URL validation**: Should we allow non-HTTPS URLs for testing?
   - **Plan assumes**: Enforce HTTPS only (security best practice)

4. **API key rotation**: Should C support multiple active keys per integration (for rotation windows)?
   - **Plan assumes**: D phase handles multiple credentials; C creates one per integration

5. **Integration discovery**: Should merchants see other merchants' integrations (anonymized)?
   - **Plan assumes**: No; each merchant sees only their own

---

## Appendix: Reference to Locked Specifications

### Foundational Documents

- **DPX-MKT-INT-001-ARCHITECTURE-REVIEW.md** (Section: MKT-INT-001-C) — Architecture decisions, soft-delete vs CASCADE, credential models
- **DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md** (Section: MKT-INT-001-C) — Exact requirements, dependencies, acceptance criteria
- **DPX-MKT-INT-001-RISK-MITIGATION-REGISTER.md** (Sections: CRIT-006, CRIT-005, CRIT-001, HR-003) — Risk controls for integration CRUD

### B.1 Evidence (Completed & Approved)

- **B1-EXECUTION-EVIDENCE.md** — 43/43 tests passed; encryption, hashing, credential management verified
- **CLAUDE.md** (Project Instructions) — No username, soft-delete pattern, merchant isolation, test-driven development

---

## Sign-Off

**Plan Status**: ✅ **Ready for CTO Review**

**Deliverable Files**:

1. C-PLAN.md (this document)
2. Ready for implementation once CTO approves

**Next Step**: Submit C-PLAN.md to CTO for review and approval before beginning implementation.

**Estimated Timeline** (after approval):

- Implementation: 4–5 business days
- Testing: 1 day
- Code review & merge: 1 day
- **Total: 5–7 business days**

---

**End of C-PLAN.md**
