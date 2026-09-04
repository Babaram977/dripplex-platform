# MKT-INT-001-B Authentication & Scoped-Credential Audit

**Date:** 2026-09-04  
**Scope:** Existing DrippleX authentication infrastructure relevant to MKT-INT-001-B  
**Status:** Audit complete — ready for integration credential implementation

---

## 1. EXISTING JWT AUTHENTICATION

### 1.1 JWT Strategy & Token Structure

**File:** `apps/backend/src/auth/strategies/jwt.strategy.ts`

JWT tokens are extracted via Bearer header and validated with the following requirements:
- `typ`: must be `'access'` (not `'refresh'`)
- `sub`: user ID (required)
- `sid`: session ID (required)
- `role`: current role name (required)
- `portal`: portal identifier ('CUSTOMER', 'DRIVER', 'ADMIN')
- `iat`, `exp`: issued-at and expiration timestamps (handled by passport)

**Validation Steps:**
1. JWT payload structure validation
2. Session lookup: `session.userId === payload.sub`
3. Session state checks:
   - NOT revoked (`session.revokedAt === null`)
   - NOT expired (`session.expiresAt > now()`)
4. Portal match: `session.portal === portalToRegistrationChannel(payload.portal)`
5. User account status: must be `ACTIVE` (not deleted, suspended, or blocked)
6. Role membership: user must have the role claimed in JWT
7. Permission aggregation: all permissions from all user roles are combined into a single set

**Session Management:**
- Sessions are stored in `auth_sessions` table with `userId`, `sid`, `portal`, `expiresAt`, `revokedAt`, `createdAt`
- Session activity is tracked (touch operation on each auth)
- Sessions can be revoked independently

### 1.2 JwtAuthGuard

**File:** `apps/backend/src/auth/guards/jwt-auth.guard.ts`

The `JwtAuthGuard` extends `AuthGuard('jwt')` and provides:
- Support for `@Public()` decorator to skip authentication
- Automatic extraction of Bearer token from Authorization header
- Conversion of passport errors to `UnauthorizedDomainException`

**Usage:**
```typescript
@Controller('api/v1/integrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntegrationsController {
  @Get(':id')
  @RequirePermissions('integrations:read')
  getIntegration(@Param('id') id: string) { ... }
}
```

---

## 2. ROLE-BASED ACCESS CONTROL (RBAC)

### 2.1 Data Model

**Files:** `apps/backend/prisma/schema.prisma` (lines 612-662)

```
User (1:M) → UserRole (M:M) → Role (1:M) → RolePermission (M:M) → Permission
```

**User Model (line 489+):**
- `id`, `email`, `phone`, `roles: UserRole[]`
- `status`: ACTIVE | SUSPENDED | BLOCKED | etc.
- `deletedAt`: soft-delete timestamp

**Role Model:**
- `id`, `name` (unique), `isSystem` (boolean)
- `users: UserRole[]`, `permissions: RolePermission[]`
- Soft-delete via `deletedAt`

**Permission Model:**
- `id`, `code` (unique, e.g., `"integrations:read"`)
- `description` (optional)
- Soft-delete via `deletedAt`

**UserRole (Junction Table):**
- `(userId, roleId)` composite primary key
- `assignedAt` timestamp
- Cascade delete: removing user/role removes assignment

**RolePermission (Junction Table):**
- `(roleId, permissionId)` composite primary key
- `grantedAt` timestamp
- Cascade delete: removing role/permission removes grant

### 2.2 Permission Code Convention

No centralized constant file yet. Existing permissions across codebase use convention:
- `"integrations:read"`, `"integrations:write"`
- `"drivers:manage"`, `"customers:manage"`
- Dot-separated hierarchies: `"resource:action"` or `"resource:subresource:action"`

### 2.3 Permission Aggregation

**File:** `apps/backend/src/auth/strategies/jwt.strategy.ts` (lines 73-79)

Permissions are aggregated from all assigned roles:
```typescript
const permissions = [
  ...new Set(
    user.roles.flatMap((assignment) =>
      assignment.role.permissions.map((grant) => grant.permission.code),
    ),
  ),
];
```

Returns deduplicated set of permission codes.

---

## 3. PERMISSIONS GUARD

**File:** `apps/backend/src/auth/guards/permissions.guard.ts`

The `PermissionsGuard` enforces permission checks via `@RequirePermissions(...)` decorator:

```typescript
@RequirePermissions('integrations:read', 'integrations:write')
async createIntegration(user: AuthenticatedUser) { ... }
```

**Behavior:**
- If no permissions required (decorator not present), request passes through
- If permissions required, compares `requiredPermissions` against `user.permissions`
- Requires ALL listed permissions (AND logic)
- Throws `ForbiddenDomainException` if any permission is missing
- Returns 403 status code

---

## 4. EXCEPTION HIERARCHY

**File:** `apps/backend/src/common/exceptions/domain.exception.ts`

Base class `DomainException` provides:
- `errorCode` (e.g., `'UNAUTHORIZED'`, `'FORBIDDEN'`)
- `message` (internal diagnostic)
- `statusCode` (HTTP status: 400, 401, 403, 404, 409, 422, 429)
- `details` (optional diagnostic object)
- `publicMessage` (optional safe version for client)

**Relevant Subclasses for Integration Auth:**

| Exception | Status | Error Code | Use Case |
| --- | --- | --- | --- |
| `UnauthorizedDomainException` | 401 | `UNAUTHORIZED` | Missing/invalid JWT, expired session |
| `ForbiddenDomainException` | 403 | `FORBIDDEN` | Permission denied, merchant isolation violation |
| `NotFoundDomainException` | 404 | `NOT_FOUND` | Resource not found (after auth check) |
| `ValidationDomainException` | 422 | `VALIDATION_ERROR` | Invalid input data |
| `ConflictDomainException` | 409 | `CONFLICT` | Idempotency key already exists |
| `RateLimitedDomainException` | 429 | `RATE_LIMITED` | API rate limit exceeded |

---

## 5. AUDIT SERVICE

**File:** `apps/backend/src/audit/audit.service.ts`

The `AuditService` records actions with:
- `action` (string, e.g., `'integration.created'`)
- `context: AuditContext` (userId, ipAddress, userAgent)
- `details?: AuditRecordDetails` (resource, resourceId, metadata)

**Audit Record Schema:**
```typescript
interface CreateAuditLogInput {
  action: string;
  userId?: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}
```

**Integration Logging Pattern (to implement in B):**
```typescript
await this.auditService.record('integration.created', context, {
  resource: 'integration',
  resourceId: integrationId,
  metadata: { merchantId, posProvider },
});
```

---

## 6. EXISTING API RESPONSE CONVENTIONS

No centralized response wrapper class found. Controllers return domain models directly. However, NestJS standard patterns apply:
- Success: 200 OK, 201 Created, 204 No Content
- Client errors: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 409 (conflict), 422 (validation error)
- Server errors: 500, 503

**No global request/response interceptor that wraps all responses** (each endpoint returns directly).

---

## 7. OPENAPI / SWAGGER INTEGRATION

**Status:** Not audited in detail. Controllers appear to support NestJS/Swagger decorators.

**Required for B:** Add `@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiBody` decorators to all integration endpoints and generate OpenAPI spec.

---

## 8. SESSION & CREDENTIAL ROTATION

### 8.1 Current Session Lifecycle

- Sessions created at login with `expiresAt` timestamp
- `revokedAt` timestamp marks revocation
- Logout revokes the session
- Session activity is tracked (touch operation)

### 8.2 No Current API Key / Service Credential System

DrippleX currently uses only JWT for authentication. No API key or service credential infrastructure exists yet.

**Needed for B:**
- API key generation and storage
- Credential types: incoming (hashed), outgoing (encrypted)
- Credential expiration and rotation
- Credential revocation

---

## 9. MERCHANT ISOLATION REQUIREMENT

**Current State:** RBAC enforces permission-level access, but does NOT enforce merchant-scoping.

**Critical for B:** Every integration-related query must:
1. Verify `merchantId` from authenticated user context
2. Filter by `merchant_id` in WHERE clause
3. Throw `ForbiddenDomainException` if merchantId doesn't match
4. Return 403, never 404 (prevents enumeration)

**Pattern to enforce in B:**
```typescript
// ✅ CORRECT
async getIntegration(merchantId: string, integrationId: string) {
  const integration = await prisma.merchantIntegration.findFirst({
    where: {
      id: integrationId,
      merchantId,  // ← Always verify
    },
  });
  if (!integration) throw new ForbiddenDomainException();
  return integration;
}

// ❌ WRONG
async getIntegration(integrationId: string) {
  const integration = await prisma.merchantIntegration.findUnique({
    where: { id: integrationId },
  });
  return integration;  // Anyone can see any integration!
}
```

---

## 10. AUDIT FINDINGS & RECOMMENDATIONS FOR B

### ✅ Can Reuse

1. **JWT Authentication Framework:**
   - `JwtStrategy` with Bearer token extraction
   - `JwtAuthGuard` with public/private routes
   - Session management with revocation support

2. **PermissionsGuard:**
   - Existing `@RequirePermissions(...)` decorator pattern
   - Permission aggregation from roles
   - 403 error handling

3. **Exception Hierarchy:**
   - Use existing `UnauthorizedDomainException`, `ForbiddenDomainException`, etc.
   - Add new integration-specific exceptions as needed

4. **Audit Service:**
   - Existing audit logging with context and metadata
   - Use for integration operation audit trail

5. **User/Role/Permission Models:**
   - Extend with integration-scoped permission codes
   - Leverage existing permission assignment infrastructure

### ⚠️ Must Implement for B

1. **Integration Credential Types:**
   - Incoming API key (hashable, verified via BCRYPT)
   - Outbound OAuth token (encrypted, must be retrievable)
   - Scoped credentials per integration

2. **API Key Authentication Strategy:**
   - Create `IntegrationApiKeyStrategy` or extend JWT strategy
   - Extract API key from header (e.g., `X-Integration-Key`)
   - Validate against `IntegrationCredential.credentialHash`

3. **Integration-Scoped Authorization:**
   - Define permission codes: `integrations:read`, `integrations:write`, `catalog:read`, `inventory:write`, `orders:read`, etc.
   - Enforce via `@RequirePermissions()` and `PermissionsGuard`

4. **Merchant Isolation Enforcement:**
   - Create `@MerchantScoped()` decorator or middleware
   - Inject `merchantId` into request context
   - Verify on every integration query

5. **Service-Layer Idempotency:**
   - Implement request deduplication pattern
   - Cache previous results for matching idempotency keys
   - Return same logical response on retry

6. **Credential Encryption:**
   - Implement AES-256-GCM encryption for outbound tokens
   - Key derivation from app config or vault
   - Decrypt only when needed for API calls

7. **OpenAPI / Swagger Spec:**
   - Define contract for all integration endpoints
   - Document request/response schemas
   - Include security requirements

---

## 11. CONCLUSION

**Summary:**
- ✅ JWT authentication framework is mature and suitable for extension
- ✅ RBAC infrastructure is comprehensive and reusable
- ✅ Exception hierarchy covers all needed error cases
- ✅ Audit service is ready for integration logging
- ⚠️ No API key / service credential system exists yet
- ⚠️ Merchant isolation must be enforced at service layer

**Risk Assessment:**
- LOW: JWT/RBAC extension to support integration credentials
- MEDIUM: Credential encryption and key management (requires secure config)
- MEDIUM: Merchant isolation enforcement (requires careful WHERE clause review on every query)

**Ready to proceed with MKT-INT-001-B implementation.**

---

**Next:** MKT-INT-001-B Implementation Plan
