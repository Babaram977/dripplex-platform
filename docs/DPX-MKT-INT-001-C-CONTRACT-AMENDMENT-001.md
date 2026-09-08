# MKT-INT-001-C Contract Amendment 001 — API Route Versioning

**Status**: Formal Contract Amendment  
**Date**: 2026-09-04  
**Phase**: MKT-INT-001-C (Integration CRUD API)  
**Scope**: API route path versioning only  
**Functional Impact**: None — endpoint behavior unchanged

---

## Amendment Summary

The MKT-INT-001-C specification previously documented integration API routes without the application's established API version prefix.

**Previous Documentation**:

```
POST   /api/integrations
GET    /api/integrations
GET    /api/integrations/{integrationId}
PUT    /api/integrations/{integrationId}
DELETE /api/integrations/{integrationId}
GET    /api/integrations/{integrationId}/test
```

**Amended to**:

```
POST   /api/v1/integrations
GET    /api/v1/integrations
GET    /api/v1/integrations/{integrationId}
PUT    /api/v1/integrations/{integrationId}
DELETE /api/v1/integrations/{integrationId}
GET    /api/v1/integrations/{integrationId}/test
```

---

## Rationale

### Context

The DrippleX platform has an established global API versioning architecture:

- All existing APIs use `/api/v1` as the global prefix (configured in `apps/backend/src/main.ts`)
- This prefix is applied to all controllers automatically via NestJS `app.setGlobalPrefix('api/v1')`
- All 20+ existing controllers follow the pattern: `@Controller('resource')` → produces `/api/v1/resource`
- The official OpenAPI specification declares `/api/v1` as the server base

### Finding

The previous MKT-INT-001-C contract specified `/api/integrations` without the `/v1` component.

Investigation determined:

- **No explicit architectural rationale** exists in locked specifications for unversioned routes
- **No precedent** in the codebase for special-case unversioned APIs
- **Architecture documentation** consistently uses `/api/v1` prefixed examples
- **All existing modules** (auth, users, referrals, delivery, etc.) use the `/api/v1` convention

### Decision

**Rationale for Amendment**: The `/api/integrations` paths represent a documentation omission rather than an intentional architectural exception.

**Consistent Versioning**: C routes will follow the platform's established convention to:

1. Maintain API consistency across all modules
2. Avoid creating special unversioned namespace
3. Eliminate routing complexity or special configuration
4. Preserve existing infrastructure stability
5. Allow standard NestJS controller pattern

---

## Canonical C Routes (Amended)

### Six Endpoints — All Versioned

| Method   | Path                                        | Purpose                                  |
| -------- | ------------------------------------------- | ---------------------------------------- |
| `POST`   | `/api/v1/integrations`                      | Create new integration + API key         |
| `GET`    | `/api/v1/integrations`                      | List merchant's integrations (paginated) |
| `GET`    | `/api/v1/integrations/{integrationId}`      | Get single integration details           |
| `PUT`    | `/api/v1/integrations/{integrationId}`      | Update integration metadata              |
| `DELETE` | `/api/v1/integrations/{integrationId}`      | Soft-delete (archive) integration        |
| `GET`    | `/api/v1/integrations/{integrationId}/test` | Test integration connectivity            |

---

## NestJS Implementation

### Correct Controller Pattern

```typescript
@Controller('integrations')  // ✅ Correct
// Global prefix 'api/v1' is applied automatically
// Final routes: /api/v1/integrations, /api/v1/integrations/{id}, etc.
```

### Incorrect Pattern (Do NOT use)

```typescript
@Controller('api/v1/integrations')  // ❌ Incorrect
// Would create: /api/v1/api/v1/integrations (double prefix)
```

---

## Functional Requirements Unchanged

This amendment affects **routing paths only**.

All functional requirements remain identical:

- ✅ 6 REST endpoints per contract
- ✅ Request/response DTOs and validation
- ✅ Merchant isolation and authorization
- ✅ Soft-delete pattern
- ✅ Audit logging
- ✅ Credential management integration (B.1 reuse)
- ✅ Error codes and status codes
- ✅ Response safety (no plaintext keys, credential masking)

---

## Documents Updated by This Amendment

The following canonical MKT-INT-001 documents will be updated to reflect `/api/v1/integrations` routes:

1. ✅ **C-PLAN.md** — Updated endpoint contract matrix
2. ✅ **DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md** — Update C phase endpoints section
3. ✅ **OpenAPI Specification** — Update when generated for C implementation

---

## No Impact on Other Modules

This amendment affects MKT-INT-001-C only.

- ❌ No changes to global API prefix
- ❌ No special routing configuration required
- ❌ No changes to existing modules (auth, users, referrals, delivery, etc.)
- ❌ No changes to D, E, F, G, H, I, J, K, L phases

---

## C/D Boundary Clarity

**C Exposes** (6 endpoints, all `/api/v1/integrations` prefix):

1. POST /api/v1/integrations
2. GET /api/v1/integrations
3. GET /api/v1/integrations/{integrationId}
4. PUT /api/v1/integrations/{integrationId}
5. DELETE /api/v1/integrations/{integrationId}
6. GET /api/v1/integrations/{integrationId}/test

**D Exposes** (future phase, different routes):

- POST /api/v1/integrations/{integrationId}/credentials
- GET /api/v1/integrations/{integrationId}/credentials
- PUT /api/v1/integrations/{integrationId}/credentials/{credentialId}
- DELETE /api/v1/integrations/{integrationId}/credentials/{credentialId}

---

## Quality Assurance

Before C implementation is marked complete, verify:

✅ **Route Verification**:

- [ ] All 6 C endpoints exist at `/api/v1/integrations` path
- [ ] No duplicate `/api/v1/api/v1/` prefix in actual routes
- [ ] No unversioned `/api/integrations` routes exposed
- [ ] Automated route test confirms correct paths

✅ **Phase Boundary**:

- [ ] D credential endpoints NOT exposed as part of C
- [ ] C routes are isolated from D implementation
- [ ] Shared services (CredentialsService, AuditService) reused correctly

✅ **Regression**:

- [ ] Existing unrelated routes unchanged (auth, users, referrals, etc.)
- [ ] Global API prefix still `/api/v1`
- [ ] OpenAPI spec alignment with actual routes

---

## Approval

**CTO Approval**: Pending (from separate CTO decision)

**Implementation Status**: Approved to proceed after amendment is committed and C-PLAN.md is updated.

---

## Amendment History

| Amendment | Date       | Change                                                         | Status              |
| --------- | ---------- | -------------------------------------------------------------- | ------------------- |
| 001       | 2026-09-04 | Route versioning: `/api/integrations` → `/api/v1/integrations` | 🟡 Pending Approval |

---

**End of Contract Amendment 001**
