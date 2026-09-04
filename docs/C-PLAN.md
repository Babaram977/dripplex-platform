# MKT-INT-001-C: Integration CRUD API — Implementation Plan

**Document**: C-PLAN.md  
**Status**: 🟡 APPROVED WITH AMENDMENTS (CTO Review Round 2)  
**Phase**: MKT-INT-001-C Planning (Pre-Implementation)  
**Date**: 2026-09-04  
**Prepared By**: Claude Haiku 4.5  
**Session**: https://claude.ai/code/session_01X23TQjjx1mwLFzPHqgd2Kw  
**Amendments Applied**: 10 CTO-required changes (see below)

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

## CTO Amendments (Round 2) — Required Changes Before Implementation

✅ **AMENDMENT 1: EXACT API CONTRACT**

- Endpoints verified against locked backlog (DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md, Section MKT-INT-001-C)
- HTTP methods: 6 endpoints, all exact paths confirmed
- PUT (not PATCH) for update endpoint
- `/test` endpoint confirmed in C scope (per backlog: "GET /api/v1/integrations/{integrationId}/test")

✅ **AMENDMENT 2: C vs D BOUNDARY — CREDENTIAL LIFECYCLE CLARIFICATION**

- **C Responsibility**: Create integration record + call existing `CredentialsService.createCredential()` from B.1
- **D Responsibility**: Provide endpoints for credential rotation, revocation, scope modification (calls `CredentialsService.rotateCredential()`, etc.)
- **Critical**: C does NOT reimplement credential hashing, rotation, or secret lifecycle. Reuse B.1 infrastructure only.

✅ **AMENDMENT 3: CROSS-MERCHANT ACCESS RESPONSE — 403 vs 404**

- **Decision**: Return **403 Forbidden** (not 404) for cross-merchant access attempts
- **Rationale**: Per locked CRIT-006 acceptance criteria: "Cross-merchant query returns 403 Forbidden"
- **Behavior**: All GET/PUT/DELETE endpoints verify merchantId ownership; unauthorized access returns 403, not 404
- **Audit**: All 403 responses logged for security investigation

✅ **AMENDMENT 4: TESTING REQUIREMENT UPDATED**

- Removed phrase: "100% test coverage"
- Replaced with: "All defined C acceptance criteria and security-critical behavioral scenarios must execute successfully"
- **Emphasis**: Tests must execute against real PostgreSQL + Redis (not stub/mock), per B.1 verification model

✅ **AMENDMENT 5: UNARCHIVE ENDPOINT — REMOVED FROM C**

- **Decision**: DO NOT add unarchive endpoint to C
- **Rationale**: Keep C scope tight to CRUD operations only; archival/restoration belongs to I phase if needed
- **C includes**: create, read, list, update, delete (soft-delete); does NOT include restore

✅ **AMENDMENT 6: MULTIPLE ACTIVE KEYS — REMOVED FROM C**

- **Decision**: DO NOT introduce multiple-active-credential semantics in C
- **Rationale**: Credential lifecycle (rotation windows, multiple keys, gradual rollover) is D's responsibility
- **C behavior**: Create integration → generate single initial API key; D handles subsequent credential management

✅ **AMENDMENT 7: WEBHOOK URL CONFIGURATION SCOPE CLARIFIED**

- **webhookUrl IS part of C contract** (per backlog: "Allow... webhook URL changes")
- **C Responsibility**: Accept webhookUrl in create/update; store in MerchantIntegration record; validate format (HTTPS in production)
- **L Responsibility**: Webhook delivery, retry logic, payload signing, delivery tracking
- **Validation**: webhookUrl must be valid HTTPS URL for production deployments (enforce per deployment environment)

✅ **AMENDMENT 8: SCOPE — C IS INTEGRATION CRUD ONLY**

- **C includes**: Create, read, list, update, delete (soft-archive) integrations; test connectivity; audit logging
- **C does NOT include**: OAuth, catalog sync, inventory sync, order integration, webhook processing, POS adapters, marketplace UI, Ride, Wallet, payments, mobile, Google Play, marketplace, billing
- **Clear Boundary**: C manages integration metadata and status; credentials are managed via B/D; sync/order logic deferred to F/J/L

✅ **AMENDMENT 9: ACCEPTANCE GATES — 9 EXPLICIT GATES**
Listed explicitly in "Acceptance Gates" section below

✅ **AMENDMENT 10: AMENDED ENDPOINT MATRIX ADDED**
See "Exact Endpoint Contract Matrix" section below with all HTTP methods, paths, DTOs, authentication, error responses

---

## Scope & Exact Requirements

### Functional Scope (From DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md, Section MKT-INT-001-C)

**Objective**: Implement REST API endpoints for creating, reading, updating, and deleting Merchant Integrations, allowing merchants to register and manage POS system connections.

---

## Exact Endpoint Contract Matrix

### Endpoint 1: Create Integration

| Attribute               | Value                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Method**         | `POST`                                                                                                                     |
| **Exact Path**          | `/api/v1/integrations`                                                                                                     |
| **Authentication**      | JWT Bearer token (BearerAuth guard)                                                                                        |
| **Authorization**       | Authenticated merchant (extracted via @CurrentMerchant)                                                                    |
| **Request DTO**         | `CreateIntegrationDto` (vendorName, vendorVersion?, merchantContactEmail?, webhookUrl?, metadata?)                         |
| **Request Validation**  | vendorName: required, non-empty, ≤100 chars; webhookUrl: optional, valid HTTPS; email: valid format                        |
| **Response DTO**        | `CreateIntegrationResponseDto` (integrationId, vendorName, status, createdAt, apiKey, scopes, credential)                  |
| **Response Code**       | 201 Created                                                                                                                |
| **Error: 400**          | Invalid vendorName, malformed webhookUrl, invalid email format, metadata not JSON-serializable                             |
| **Error: 401**          | Missing or invalid JWT token                                                                                               |
| **Error: 403**          | Merchant context missing (should not occur if B.1 guards working)                                                          |
| **Idempotency**         | Not applicable for create; C relies on UUID generation for uniqueness                                                      |
| **Credential Behavior** | Calls `CredentialsService.createCredential()` with default scopes; returns plaintext API key ONCE; never retrievable after |
| **Audit Log**           | `integration.created` event; resource: integration, resourceId: integrationId                                              |

### Endpoint 2: List Integrations

| Attribute                | Value                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Method**          | `GET`                                                                                                                                          |
| **Exact Path**           | `/api/v1/integrations`                                                                                                                         |
| **Query Parameters**     | includeArchived? (bool, default: false); limit? (1–100, default: 20); offset? (≥0, default: 0); status? (enum: ACTIVE, PAUSED, REVOKED, ERROR) |
| **Authentication**       | JWT Bearer token (BearerAuth guard)                                                                                                            |
| **Authorization**        | Authenticated merchant; can only list own integrations; includeArchived=true requires admin role                                               |
| **Response DTO**         | `ListIntegrationsResponseDto` (data: IntegrationResponseDto[], pagination: {total, limit, offset, hasMore})                                    |
| **Response Code**        | 200 OK                                                                                                                                         |
| **Error: 401**           | Missing or invalid JWT token                                                                                                                   |
| **Error: 403**           | includeArchived=true but not admin                                                                                                             |
| **Soft-Delete Behavior** | Excludes archivedAt IS NOT NULL by default; only includes if includeArchived=true AND admin                                                    |
| **Pagination**           | Offset-based; returns hasMore flag for client; max 100 items per page                                                                          |
| **Audit Log**            | Not logged per se; but access auditable via request logging                                                                                    |

### Endpoint 3: Get Single Integration

| Attribute              | Value                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Method**        | `GET`                                                                                                                        |
| **Exact Path**         | `/api/v1/integrations/{integrationId}`                                                                                       |
| **Path Parameter**     | integrationId: UUID                                                                                                          |
| **Authentication**     | JWT Bearer token (BearerAuth guard)                                                                                          |
| **Authorization**      | Authenticated merchant; can only access own integrations                                                                     |
| **Response DTO**       | `IntegrationResponseDto` (integrationId, merchantId, vendorName, status, createdAt, credentials, metadata, webhookUrl, etc.) |
| **Response Code**      | 200 OK                                                                                                                       |
| **Error: 401**         | Missing or invalid JWT token                                                                                                 |
| **Error: 403**         | **Cross-merchant access attempt** (per CRIT-006: "Cross-merchant query returns 403 Forbidden")                               |
| **Error: 404**         | Integration not found within authenticated merchant's scope                                                                  |
| **Merchant Isolation** | Query includes explicit filter: `where: {id: integrationId, merchantId: context.merchantId}`                                 |
| **Audit Log**          | Access logged on 403 (unauthorized attempt); on 404 could indicate attack pattern                                            |

### Endpoint 4: Update Integration

| Attribute                   | Value                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Method**             | `PUT` (not PATCH)                                                                                                           |
| **Exact Path**              | `/api/v1/integrations/{integrationId}`                                                                                      |
| **Path Parameter**          | integrationId: UUID                                                                                                         |
| **Authentication**          | JWT Bearer token (BearerAuth guard)                                                                                         |
| **Authorization**           | Authenticated merchant; can only update own integrations                                                                    |
| **Request DTO**             | `UpdateIntegrationDto` (all fields optional: vendorName, vendorVersion, merchantContactEmail, webhookUrl, metadata, status) |
| **Request Validation**      | status: if provided, must be ACTIVE or PAUSED only (REVOKED/ERROR set by system, not client)                                |
| **Response DTO**            | `IntegrationResponseDto` (updated record)                                                                                   |
| **Response Code**           | 200 OK                                                                                                                      |
| **Error: 400**              | Invalid input (malformed webhookUrl, non-JSON metadata, invalid enum for status)                                            |
| **Error: 401**              | Missing or invalid JWT token                                                                                                |
| **Error: 403**              | Cross-merchant update attempt                                                                                               |
| **Error: 404**              | Integration not found                                                                                                       |
| **Credential Immutability** | Cannot update credentials via this endpoint; credential management is D's scope                                             |
| **Audit Log**               | `integration.updated` event; includes old/new values for modified fields                                                    |

### Endpoint 5: Delete Integration (Soft-Delete)

| Attribute                 | Value                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **HTTP Method**           | `DELETE`                                                                                                    |
| **Exact Path**            | `/api/v1/integrations/{integrationId}`                                                                      |
| **Path Parameter**        | integrationId: UUID                                                                                         |
| **Authentication**        | JWT Bearer token (BearerAuth guard)                                                                         |
| **Authorization**         | Authenticated merchant; can only delete own integrations                                                    |
| **Request Body**          | None                                                                                                        |
| **Response Code**         | 204 No Content                                                                                              |
| **Error: 401**            | Missing or invalid JWT token                                                                                |
| **Error: 403**            | Cross-merchant delete attempt                                                                               |
| **Error: 404**            | Integration not found                                                                                       |
| **Soft-Delete Behavior**  | Sets archivedAt = now; does NOT perform destructive DELETE                                                  |
| **Credential Revocation** | Also revokes all active credentials for this integration (sets archivedAt on IntegrationCredential records) |
| **Audit Log**             | `integration.deleted` event (soft-delete, not hard delete); includes integrationId, timestamp               |

### Endpoint 6: Test Integration Connectivity

| Attribute          | Value                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **HTTP Method**    | `GET`                                                                                                  |
| **Exact Path**     | `/api/v1/integrations/{integrationId}/test`                                                            |
| **Path Parameter** | integrationId: UUID                                                                                    |
| **Authentication** | JWT Bearer token (BearerAuth guard)                                                                    |
| **Authorization**  | Authenticated merchant; can only test own integrations                                                 |
| **Request Body**   | None                                                                                                   |
| **Response DTO**   | `TestIntegrationResponseDto` (status: SUCCESS                                                          | FAILED | UNCONFIGURED, message, latencyMs?, httpStatus?, testedAt) |
| **Response Code**  | 200 OK                                                                                                 |
| **Error: 401**     | Missing or invalid JWT token                                                                           |
| **Error: 403**     | Cross-merchant test attempt                                                                            |
| **Error: 404**     | Integration not found                                                                                  |
| **Error: 504**     | Test timeout (webhook unreachable after 5 seconds)                                                     |
| **Test Behavior**  | If webhookUrl configured: HTTP GET with 5-second timeout, measure latency, capture status code         |
| **Fallback**       | If webhookUrl not configured: return status=UNCONFIGURED, message describing need to configure webhook |
| **Audit Log**      | `integration.test` event; includes result (SUCCESS/FAILED/UNCONFIGURED), latency if applicable         |

---

### Feature Requirements (From Backlog)

#### Create Integration (`POST /api/v1/integrations`)

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
2. Create MerchantIntegration record with:
   - integrationId (UUID)
   - merchantId (from context)
   - vendorName, vendorVersion, metadata
   - webhookUrl (optional; validated for HTTPS)
   - status: `ACTIVE` (default)
   - createdAt: now
   - archivedAt: null
3. **Call CredentialsService.createCredential()** (reusing B.1 infrastructure):
   - Pass: integrationId, credentialType: OUTGOING_API_KEY, secret: generated API key
   - Service generates plaintext key, hashes with bcrypt, stores in IntegrationCredential
   - Default scopes: `["catalog:read", "catalog:write", "inventory:read", "inventory:write", "orders:read", "orders:write"]`
4. Audit log: `integration.created` with resource: `integration`, resourceId: integrationId
5. **Return plaintext API key ONLY ONCE** in response; never retrievable after
   - **Note**: Subsequent credential management (rotation, revocation, scope modification) is D's responsibility
6. **Critical Boundary**: C does NOT reimplement credential hashing, rotation, or lifecycle. All credential operations delegate to CredentialsService from B.1

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

#### List Integrations (`GET /api/v1/integrations`)

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

#### Get Integration (`GET /api/v1/integrations/{integrationId}`)

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

#### Update Integration (`PUT /api/v1/integrations/{integrationId}`)

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

**Output** (200 OK): Same as GET /api/v1/integrations/{integrationId}

**Error Cases**:

- 400: Invalid input (malformed URL, non-JSON metadata)
- 401: Unauthenticated
- 404: Integration not found
- **Note**: Cannot update credentials via this endpoint; use D (Credentials Management) for that

#### Delete Integration (`DELETE /api/v1/integrations/{integrationId}`)

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

#### Test Integration (`GET /api/v1/integrations/{integrationId}/test`)

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

## C vs D Boundary (Critical Clarification)

**C Responsibility** (Integration CRUD):

- Create integration record + call `CredentialsService.createCredential()` to generate initial API key
- Manage integration metadata (vendorName, webhookUrl, status)
- Return plaintext API key once at creation time; never retrievable again
- Soft-delete integrations and revoke associated credentials
- Audit all integration lifecycle operations

**D Responsibility** (Credential Management — NOT in C scope):

- Provide endpoints for credential rotation, revocation, listing
- Modify scopes on existing credentials
- Track credential usage and last-used timestamps
- Implement credential rotation windows

**CRITICAL**: C does NOT reimplement credentials. C reuses `CredentialsService` from B.1 infrastructure only.

---

## Infrastructure & Reuse

### Existing Code to Reuse (From B.1)

✅ **Authentication & Authorization**:

- `BearerAuth` guard from B.1 (validates JWT, attaches @CurrentMerchant context)
- `@AuthenticateApiKey()` decorator (not used in C, but available from B.1)
- Merchant context injection via `@CurrentMerchant()` decorator
- Scope validation via `@RequireScopes(...)` decorator (optional for C, required for D+)

✅ **Credential Management** (from B.1):

- `CredentialsService.createCredential()` method for API key generation + hashing
- C calls this service to generate initial credential; does NOT do bcrypt directly
- `EncryptionService` for future credential encryption (AES-256-GCM) — not used in C
- Plaintext key generation and hashing handled by CredentialsService
- C returns plaintext key once; CredentialsService stores hashed version

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

**Error Responses** (per locked CRIT-006):

- **403 Forbidden**: Integration exists but authenticated merchant does not own it
- **404 Not Found**: Integration does not exist
- **Test**: Cross-merchant access attempt returns 403 Forbidden (per locked acceptance criteria in CRIT-006)

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

| Event                             | Trigger                                                 | Logged Data                                                              | Severity |
| --------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| `integration.created`             | POST /api/v1/integrations succeeds                      | integrationId, vendorName, merchantId, timestamp                         | INFO     |
| `integration.updated`             | PUT /api/v1/integrations/{id} succeeds                  | integrationId, merchantId, old values, new values, timestamp             | INFO     |
| `integration.deleted`             | DELETE /api/v1/integrations/{id} succeeds (soft-delete) | integrationId, merchantId, timestamp                                     | INFO     |
| `integration.test`                | GET /api/v1/integrations/{id}/test succeeds or fails    | integrationId, merchantId, result (success/failure), latency, timestamp  | INFO     |
| `integration.unauthorized_access` | Merchant A tries to access Merchant B's integration     | attempter merchantId, target integrationId, target merchantId, timestamp | WARN     |

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

  describe('POST /api/v1/integrations', () => {
    it('should return 201 with plaintext API key', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ vendorName: 'Square' });

      expect(response.status).toBe(201);
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.integrationId).toBeDefined();
    });

    it('should return 401 if unauthenticated', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations')
        .send({ vendorName: 'Square' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/integrations', () => {
    it('should return 200 with pagination', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations?limit=10&offset=0')
        .set('Authorization', `Bearer ${jwt}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/v1/integrations/{id}', () => {
    it('should return 404 for cross-merchant access', async () => {
      // Create integration for merchant-1
      // Query as merchant-2
      const jwt2 = createJWT({ sub: 'merchant-2' });
      const response = await request(app.getHttpServer())
        .get(`/api/v1/integrations/${merchant1IntegrationId}`)
        .set('Authorization', `Bearer ${jwt2}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/integrations/{id}', () => {
    it('should update integration metadata', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .put(`/api/v1/integrations/${integrationId}`)
        .set('Authorization', `Bearer ${jwt}`)
        .send({ vendorName: 'Toast' });

      expect(response.status).toBe(200);
      expect(response.body.vendorName).toBe('Toast');
    });
  });

  describe('DELETE /api/v1/integrations/{id}', () => {
    it('should return 204 and soft-delete', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/integrations/${integrationId}`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(response.status).toBe(204);
      // Verify in DB: archivedAt is set, not deleted
    });
  });

  describe('GET /api/v1/integrations/{id}/test', () => {
    it('should test webhook connectivity', async () => {
      const jwt = createJWT({ sub: 'merchant-1' });
      const response = await request(app.getHttpServer())
        .get(`/api/v1/integrations/${integrationId}/test`)
        .set('Authorization', `Bearer ${jwt}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toMatch(/SUCCESS|FAILED|UNCONFIGURED/);
    });
  });
});
```

### Acceptance Criteria (8 Must-Pass Tests)

From DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md, MKT-INT-001-C:

1. ✅ **POST /api/v1/integrations returns 201 with credentials (API key, scopes)**
   - Test: Create integration → verify status=201, apiKey returned, scopes=default

2. ✅ **Credentials returned only once (subsequent GET returns masked key)**
   - Test: Create → get plaintext key; Call GET endpoint → verify publicSuffix (masked), never plaintext

3. ✅ **GET /api/v1/integrations returns only authenticated merchant's integrations (pagination)**
   - Test: Create 25 integrations for merchant-1; query as merchant-1 with limit=10 → verify 10 returned, hasMore=true; query as merchant-2 → verify 0 returned

4. ✅ **GET /api/v1/integrations/{id} returns full integration metadata**
   - Test: Create integration with metadata; call GET → verify all fields present (vendorName, status, createdAt, credentials)

5. ✅ **PUT /api/v1/integrations/{id} updates name/description successfully**
   - Test: Create with vendorName="Square"; update to "Toast"; verify updated record returned

6. ✅ **DELETE /api/v1/integrations/{id} sets archived_at and excludes from list**
   - Test: Create integration; delete; verify archivedAt set; query list → verify deleted integration not returned; verify GET returns 404

7. ✅ **GET /api/v1/integrations/{id}/test calls webhook URL and returns {success, latency_ms}**
   - Test: Create with webhookUrl; call test endpoint → verify status=SUCCESS, latencyMs>0; mock 500 error → verify status=FAILED
   - **Note**: /test endpoint confirmed in C scope (per DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md)

---

## Risk Mitigation

### Critical Risks Addressed in C

#### CRIT-006: Merchant Isolation Failure

**Risk**: Merchant A's API key allows querying Merchant B's data

**C Mitigation**:

1. Every service method receives `merchantId` from `@CurrentMerchant()` decorator
2. All Prisma queries include: `where: {merchantId, ...}`
3. Never trust client-provided `merchantId` parameter
4. Return 403 Forbidden (per locked CRIT-006 spec) for cross-merchant access
5. Test: CrossMerchantAccess — query as merchant-2 with merchant-1's integrationId → 403

**Acceptance Criteria** (from CRIT-006):

- ✅ Cross-merchant query returns 403 Forbidden (per locked spec)
- ✅ All GET endpoints filter by merchantId
- ✅ All PUT/PATCH/DELETE endpoints verify merchantId ownership
- ✅ Test: 10 merchants, each tries to access others' data → all fail with 403

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
- ❌ Credential rotation endpoints (D phase; credential CREATION uses B.1 CredentialsService)
- ❌ Credential revocation endpoints (D phase)
- ❌ Multiple-credential management (D phase)
- ❌ Webhook delivery (L phase; C accepts webhookUrl for future use)
- ❌ Webhook processing framework (L phase)

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
- [ ] Verify soft-delete pattern (query filters, archive behavior)

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

## C Acceptance Gates (9 Explicit Requirements)

C is **COMPLETE and READY for D phase** only when ALL 9 gates pass:

### Gate 1: Endpoint Contract Implementation

- [ ] All 6 endpoints implemented per exact contract (POST, GET list, GET single, PUT, DELETE, GET /test)
- [ ] HTTP methods correct (PUT not PATCH; GET not POST)
- [ ] Paths exact (e.g., `/api/v1/integrations/{integrationId}`, not `/api/integrations/{id}`)
- [ ] Request/response DTOs match contract
- [ ] All error codes implemented (401, 403, 404, 400, 500)

### Gate 2: Merchant Isolation (CRIT-006)

- [ ] Every query explicitly filters by merchantId
- [ ] Cross-merchant access returns 403 Forbidden (not 404)
- [ ] Test: 10 merchants, each attempts to access others' integrations → all return 403
- [ ] Unauthorized access logged with 403 status

### Gate 3: CRUD Lifecycle

- [ ] Create integration generates unique integrationId, calls CredentialsService.createCredential, returns plaintext key once
- [ ] List integrations returns paginated results for authenticated merchant only
- [ ] Get integration returns full details if owned, 403 if not
- [ ] Update integration modifies metadata, preserves credentials (no credential changes via this endpoint)
- [ ] Delete integration soft-deletes (sets archivedAt), revokes all credentials

### Gate 4: Archive/Soft-Delete Behavior

- [ ] Deletion sets archivedAt timestamp (no destructive DELETE)
- [ ] Default queries filter `archivedAt IS NULL`
- [ ] Soft-deleted integrations excluded from list unless includeArchived=true AND admin
- [ ] All deleted integrations' credentials also archived (archivedAt set)

### Gate 5: Idempotency

- [ ] Integration creation deterministic (same input → same integrationId)
- [ ] No duplicate integrations created from concurrent identical requests
- [ ] (Full idempotency-key validation is L's responsibility; C prepares infrastructure)

### Gate 6: Audit Logging

- [ ] `integration.created` event logged on create
- [ ] `integration.updated` event logged on update (includes old/new values)
- [ ] `integration.deleted` event logged on soft-delete
- [ ] `integration.test` event logged on connectivity test
- [ ] All 403 (unauthorized access) attempts logged
- [ ] AuditService.record called with correct event name, userId (merchantId), metadata

### Gate 7: Response Safety

- [ ] No API key plaintext in GET/LIST/UPDATE responses (only masked suffix)
- [ ] No database passwords, secrets, or internal error details in error responses
- [ ] Cross-merchant integration data NEVER exposed (even in error messages)

### Gate 8: Validation Tests (PostgreSQL/Redis)

- [ ] Tests execute against real PostgreSQL + Redis (per B.1 model), not mocks
- [ ] Input validation tests: email format, URL format, HTTPS enforcement, JSON serialization
- [ ] Business logic tests: merchantId verification, soft-delete filters, credential revocation
- [ ] All 8 acceptance criteria execute successfully
- [ ] No test stubs or mocks for database layer

### Gate 9: Code Quality & Scope

- [ ] TypeScript compilation: 0 errors
- [ ] ESLint: 0 errors
- [ ] No credential management endpoints (those are D)
- [ ] No catalog/inventory/order sync logic (those are F/J/L)
- [ ] No OAuth implementation (future)
- [ ] Code scoped to Integration CRUD only
- [ ] OpenAPI spec generated and aligned with exact endpoints
- [ ] git diff confirms only integration-related files changed (no B.1, A, or unrelated code touched)

---

## Success Criteria

### Before Implementation Begins

- [ ] CTO approves amended C-PLAN.md
- [ ] All acceptance criteria understood and testable
- [ ] Team familiar with B.1 patterns (auth guards, audit service, soft-delete, CredentialsService)
- [ ] 9 acceptance gates understood and measurable

### At Completion (Before D Phase)

- [ ] 8 acceptance criteria tests pass (executed against real PostgreSQL + Redis, per B.1 model)
- [ ] All defined C acceptance criteria and security-critical behavioral scenarios execute successfully
- [ ] All critical risks (CRIT-006: merchant isolation, CRIT-005: credential compromise) prevented and tested
- [ ] Merchant isolation verified by security test (cross-merchant access returns 403)
- [ ] API documentation complete (6 exact endpoints, DTOs, error codes, examples)
- [ ] Code merged to feature branch
- [ ] No breaking changes to B.1 or A patterns
- [ ] TypeScript compilation: 0 errors
- [ ] ESLint: 0 errors
- [ ] PostgreSQL behavioral tests execute successfully (not stubs/mocks)
- [ ] OpenAPI alignment verified against locked contract
- [ ] Scope isolation confirmed (only CRUD, no credential mgmt, no catalog/inventory/order sync)

---

## Notes & Assumptions

### Assumptions from B.1

- JWT validation working (BearerAuth guard)
- @CurrentMerchant decorator properly extracts merchantId
- AuditService.record method accepts event name + context + metadata
- CredentialsService.createCredential() method available (from B.1) for API key generation
- Prisma transactions atomic (create integration + credential in one tx)
- Database connection pooling handles concurrent requests

### Amendments Applied (CTO Round 2)

Per CTO-required amendments, the following decisions are now FIRM and not open questions:

1. ✅ **No unarchive endpoint in C** — Decision made: C includes CRUD only; defer restoration to I phase if needed
2. ✅ **No multiple active keys in C** — Credential lifecycle managed by D; C creates one initial key via B.1 CredentialsService
3. ✅ **Cross-merchant response is 403** — Per locked CRIT-006 acceptance criteria
4. ✅ **Webhook URL is part of C contract** — Stored in integration record; validation/processing deferred to L
5. ✅ **Test requirement updated** — "All defined C acceptance criteria and security-critical behavioral scenarios must execute successfully" (PostgreSQL/Redis)
6. ✅ **C/D boundary clarified** — C calls CredentialsService from B.1; D provides credential management endpoints

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
