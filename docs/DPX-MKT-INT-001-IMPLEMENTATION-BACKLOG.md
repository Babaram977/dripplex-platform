# MKT-INT-001: Merchant Integration Platform — Implementation Backlog

**Document**: DPX-MKT-INT-001-IMPLEMENTATION-BACKLOG.md  
**Status**: Approved for review  
**Phase**: Backlog Definition (no production code yet)  
**Date**: 2026-09-04

---

## Overview

This document defines a structured implementation backlog for the DrippleX Merchant Integration Platform (MKT-INT-001). The backlog contains 12 tickets (MKT-INT-001-A through MKT-INT-001-L) ordered by implementation dependencies, with each ticket specifying: Objective, Scope, Existing code to reuse, Files/modules affected, Database changes, API endpoints, Security/RBAC requirements, Tests, Dependencies, Acceptance criteria, and OUT OF SCOPE items.

**No production code has been implemented yet.** This backlog serves as the specification for the implementation phase following founder review.

---

## Dependency Order & Phases

```
PHASE 1: FOUNDATION (2 tickets)
  │
  ├─ MKT-INT-001-A: Database Schema & Migrations
  └─ MKT-INT-001-B: Authentication & RBAC Framework
     │
     PHASE 2: INTEGRATION MANAGEMENT (3 tickets)
     │
     ├─ MKT-INT-001-C: Integration CRUD API
     ├─ MKT-INT-001-D: Integration Credentials Management
     └─ MKT-INT-001-E: Integration Status & Validation API
        │
        PHASE 3: CATALOG SYNCHRONIZATION (4 tickets)
        │
        ├─ MKT-INT-001-F: Catalog Sync Trigger & Status API
        ├─ MKT-INT-001-G: Product & Modifier Mapping (SKU Bridge)
        ├─ MKT-INT-001-H: Catalog Conflict Detection & Resolution
        └─ MKT-INT-001-I: Soft-Delete & Archive Operations
           │
           PHASE 4: INVENTORY MANAGEMENT (2 tickets)
           │
           ├─ MKT-INT-001-J: Inventory Sync API (Real-time Updates)
           └─ MKT-INT-001-K: Inventory Conflict Resolution
              │
              PHASE 5: ORDER INTEGRATION (1 ticket)
              │
              └─ MKT-INT-001-L: Order Status Update API & Order Fulfillment Webhook
```

---

## Ticket Definitions

---

### **MKT-INT-001-A: Database Schema & Migrations**

**Dependency**: None (Phase 1 foundation)

**Objective**  
Create database schema and Prisma migrations for the Merchant Integration Platform, establishing tables for integrations, credentials, logs, and conflict tracking.

**Scope**

- Design and implement Prisma schema models for:
  - `MerchantIntegration` (integration record, metadata, status, credentials link)
  - `IntegrationCredential` (API key, OAuth2 token, scopes, rotation history)
  - `IntegrationLog` (audit trail: timestamps, endpoint, method, request/response)
  - `IntegrationConflict` (conflict records: domain, source data, conflict type, resolution status)
  - `CatalogSyncJob` (sync job tracking: status, progress, sync start/end times)
  - `ProductSync` (mapping of POS SKU → DrippleX Product, including modifiers)
- Create up/down migrations for Postgres
- Ensure soft-delete support (archived_at timestamp, not destructive deletion)
- Add indices for: merchant_id, integration_id, external_order_id, sku, status, created_at
- Support multi-tenant isolation (tenant_id or merchant_id scoping)

**Existing Code to Reuse**

- Prisma schema patterns from existing `apps/backend/prisma/schema.prisma`
- Migration tooling already in place (`npx prisma migrate dev`)
- Timestamp conventions (createdAt, updatedAt) from existing models
- Soft-delete pattern (e.g., `deletedAt`) used elsewhere in codebase

**Files/Modules Affected**

- `apps/backend/prisma/schema.prisma` — add new models
- `apps/backend/prisma/migrations/` — new migration files
- `apps/backend/src/migrations/` — TypeScript migration utilities (if any)

**Database Changes**

- New tables: `merchant_integrations`, `integration_credentials`, `integration_logs`, `integration_conflicts`, `catalog_sync_jobs`, `product_syncs`
- Foreign keys: merchant_id → merchants, integration_id → merchant_integrations
- Soft-delete fields: archived_at (nullable timestamp)
- Status enums: integration_status (PENDING, ACTIVE, PAUSED, REVOKED, ERROR), sync_status (PENDING, IN_PROGRESS, COMPLETED, FAILED)
- Indices on: merchant_id, integration_id, external_order_id, sku, status, created_at

**API Endpoints Involved**
None (schema only; endpoints will consume these tables)

**Security/RBAC Requirements**

- Credentials table must never expose full API keys or OAuth tokens in logs/responses
- Soft-delete: archived integrations remain queryable for audit but inaccessible for normal operations
- Credential rotation must support multiple active credentials during transition

**Tests Required**

- Migration up/down correctness (can run migrations forward and backward)
- Schema validation (Prisma schema compiles, types generated)
- Multi-tenant isolation (queries scoped by merchant_id return only merchant's records)
- Soft-delete queries (archived records excluded from default queries)
- Index creation verification (indices exist and optimize query plans)

**Acceptance Criteria**

- ✅ Prisma schema compiles without errors
- ✅ `prisma migrate dev` successfully creates all tables and indices
- ✅ `prisma studio` shows all models and relationships correctly
- ✅ Soft-delete pattern works: archived_at filters rows from standard queries
- ✅ Multi-tenant queries work: filtering by merchant_id returns only that merchant's integrations
- ✅ Credential table schema prevents full keys in logs (e.g., hashed keys only in audit)

**OUT OF SCOPE**

- Integration with webhook delivery/retry logic (handled later)
- Actual webhook payload storage
- Real-time event streaming (async job tracking only, no event sourcing)
- Data migration from any existing POS integration system (if any)
- Backup/restore procedures (handled by DevOps)

---

### **MKT-INT-001-B: Authentication & RBAC Framework**

**Dependency**: MKT-INT-001-A (schema must exist first)

**Objective**  
Implement authentication and authorization layer for Merchant Integration APIs, supporting OAuth2 JWT for Merchant Portal + Admin, and API Key authentication for POS systems.

**Scope**

- Create or extend Guards for:
  - BearerAuth (validate JWT from Merchant Portal/Admin sessions)
  - ApiKeyAuth (validate API key from POS systems)
- Implement scope validation for integrations:read/write, catalog:read/write, inventory:read/write, orders:read/write
- Create custom decorators:
  - `@AuthenticateApiKey()` — validate API key and attach integration context
  - `@AuthenticateBearerToken()` — validate JWT and attach merchant/user context
  - `@RequireScopes(...scopes)` — validate claimed scopes match request
- Implement credential generation/validation service for API keys
- Ensure credentials include merchant_id and scopes in token payload
- Create integration context middleware to attach integration metadata to requests

**Existing Code to Reuse**

- JWT verification logic from existing auth (`apps/backend/src/auth/`)
- BearerAuth pattern already used in merchant portal endpoints
- Guard pattern from existing `apps/backend/src/common/decorators/` and NestJS auth module
- Merchant context resolution from existing `CurrentMerchant` or similar decorator
- Scoped permission pattern (similar to existing role-based permissions)

**Files/Modules Affected**

- `apps/backend/src/auth/` — extend auth service
- `apps/backend/src/common/guards/` — new API key guard, extend bearer guard
- `apps/backend/src/common/decorators/` — new auth decorators
- `apps/backend/src/integrations/` — new integrations auth service

**Database Changes**

- Credential table fields (created in A):
  - `api_key_hash` (bcrypt hash of key, never store plaintext)
  - `scopes` (JSON array or enum)
  - `last_used_at` (timestamp for rotation tracking)
  - `revoked_at` (soft-revoke)

**API Endpoints Involved**

- None directly (foundational; other endpoints will use decorators)

**Security/RBAC Requirements**

- API keys must be hashed in database (bcrypt or similar); plaintext keys returned only at creation time
- Scopes must be validated on every request (no blanket access)
- POS API keys must not grant access to sensitive endpoints (payments, wallet, commissions, ride)
- Integration context must verify merchant_id matches the authenticated merchant
- Rate limiting should be configured per API key (to be enforced in middleware)

**Tests Required**

- JWT validation succeeds for valid merchant/admin tokens
- JWT validation fails for expired/invalid/tampered tokens
- API key validation succeeds for valid keys
- API key validation fails for invalid/revoked keys
- Scope validation succeeds for requests with matching scopes
- Scope validation fails for requests without required scopes
- Integration context correctly attaches merchant_id and integration_id to request
- POS API key cannot access restricted endpoints (payment, wallet, ride endpoints)

**Acceptance Criteria**

- ✅ Valid JWT passes BearerAuth guard and attaches merchant context
- ✅ Invalid JWT fails BearerAuth guard with 401
- ✅ Valid API key passes ApiKeyAuth guard and attaches integration context
- ✅ Invalid/revoked API key fails with 401
- ✅ Request with scopes [catalog:read] succeeds for GET /catalogs but fails for PUT /catalogs (write)
- ✅ POS API key cannot call merchant-only endpoints (e.g., admin operations)
- ✅ API keys are hashed in database (plaintext never stored)
- ✅ Scope validation works in @RequireScopes decorator

**OUT OF SCOPE**

- Full OAuth2 Authorization Code flow implementation (deferred to later phase)
- Single Sign-On (SSO) integration with external identity providers
- Multi-factor authentication (MFA) for merchants
- API key expiration/rotation automation (manual rotation supported, no auto-expiration)
- Rate limiting enforcement (framework set up; limit thresholds defined elsewhere)

---

### **MKT-INT-001-C: Integration CRUD API**

**Dependency**: MKT-INT-001-B (auth must be in place)

**Objective**  
Implement REST API endpoints for creating, reading, updating, and deleting Merchant Integrations, allowing merchants to register and manage POS system connections.

**Scope**

- Implement endpoints:
  - `POST /api/integrations` — create new integration, return credentials
  - `GET /api/integrations` — list all integrations for authenticated merchant
  - `GET /api/integrations/{integrationId}` — get single integration
  - `PUT /api/integrations/{integrationId}` — update integration metadata (name, config)
  - `DELETE /api/integrations/{integrationId}` — soft-delete (archive) integration
  - `GET /api/integrations/{integrationId}/test` — test integration connectivity (ping POS)
- Integration creation must:
  - Generate scoped API key with default scopes (catalog:read/write, inventory:read/write, orders:read/write)
  - Return credentials only once (never retrievable again)
  - Record integration metadata: POS vendor name, POS version, merchant contact
- Integration updates must:
  - Allow name, description, webhook URL changes
  - Not allow direct credential changes (use separate credential rotation endpoint)
- Soft-delete must:
  - Set archived_at timestamp
  - Exclude archived integrations from list operations unless explicitly requested
  - Prevent API key usage for archived integrations
- Test endpoint must:
  - Call POS webhook URL (or healthcheck endpoint if provided)
  - Return success/failure and latency
  - Log attempt for audit

**Existing Code to Reuse**

- Controller patterns from existing `apps/backend/src/*/controllers/`
- Service patterns from existing business logic services
- Pagination utilities (if any) for list endpoint
- Dto validation patterns from existing dto files
- Merchant context injection from existing `@CurrentMerchant` decorator
- HTTP exception patterns from global exception filter

**Files/Modules Affected**

- `apps/backend/src/integrations/` (new module if not existing)
  - `integrations.controller.ts` — HTTP handlers
  - `integrations.service.ts` — business logic
  - `integrations.dto.ts` — request/response DTOs
  - `integrations.module.ts` — NestJS module definition

**Database Changes**

- INSERT: new row in merchant_integrations when creating
- UPDATE: set archived_at when soft-deleting
- SELECT: filter by merchant_id and archived_at IS NULL for list operations

**API Endpoints Involved**

- POST /api/integrations
- GET /api/integrations
- GET /api/integrations/{integrationId}
- PUT /api/integrations/{integrationId}
- DELETE /api/integrations/{integrationId}
- GET /api/integrations/{integrationId}/test

**Security/RBAC Requirements**

- Merchant can only view/edit/delete their own integrations (merchant_id scoping)
- Admin can view all integrations
- Credentials returned only at creation time (subsequent calls return masked keys)
- Test endpoint must not expose internal error details to POS (generic failure message)

**Tests Required**

- Create integration: returns credentials and correct merchant_id
- List integrations: returns only authenticated merchant's integrations
- Get integration: returns correct metadata
- Update integration: changes name/description, credentials unchanged
- Delete integration: sets archived_at, excludes from list
- Test endpoint: calls webhook URL and returns latency
- Test endpoint: handles POS unreachable/timeout gracefully
- Authorization: non-owner merchant cannot access other merchant's integrations

**Acceptance Criteria**

- ✅ POST /api/integrations returns 201 with credentials (API key, scopes)
- ✅ Credentials returned only once (subsequent GET returns masked key)
- ✅ GET /api/integrations returns only authenticated merchant's integrations (pagination)
- ✅ GET /api/integrations/{id} returns full integration metadata
- ✅ PUT /api/integrations/{id} updates name/description successfully
- ✅ DELETE /api/integrations/{id} sets archived_at and excludes from list
- ✅ GET /api/integrations/{id}/test calls webhook URL and returns {success, latency_ms}
- ✅ Unarchive operation (if supported) restores archived_at to NULL

**OUT OF SCOPE**

- OAuth2 credential exchange (API key only for now)
- WebSocket live status streaming
- Bulk integration import/export
- Integration cloning (copy settings from existing)
- Integration versioning/rollback
- Custom integration branding/UI

---

### **MKT-INT-001-D: Integration Credentials Management**

**Dependency**: MKT-INT-001-C (integrations must exist)

**Objective**  
Implement API for managing integration credentials (API keys), including generation, rotation, revocation, and scope modification.

**Scope**

- Implement endpoints:
  - `POST /api/integrations/{integrationId}/credentials` — generate new API key (rotation)
  - `GET /api/integrations/{integrationId}/credentials` — list credential history (masked keys)
  - `PUT /api/integrations/{integrationId}/credentials/{credentialId}` — modify scopes on existing credential
  - `DELETE /api/integrations/{integrationId}/credentials/{credentialId}` — revoke credential
- Credential generation must:
  - Create new credential record (not replace old one)
  - Return plaintext key only at creation
  - Hash key in database
  - Allow gradual rotation (old key still works during transition period)
- Credential revocation must:
  - Set revoked_at timestamp
  - Invalidate key for all future requests
  - Preserve revocation audit trail
- Scope modification must:
  - Update scopes on existing credential
  - Take effect immediately
  - Log scope change for audit

**Existing Code to Reuse**

- Credential generation logic (if any exists in auth service)
- Bcrypt/hashing library already used in password hashing
- Audit logging patterns from existing audit service
- Controller and service patterns from MKT-INT-001-C

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - `credentials.controller.ts` — HTTP handlers
  - `credentials.service.ts` — credential operations (generate, revoke, rotate)
  - `credentials.dto.ts` — DTOs for credential requests/responses

**Database Changes**

- INSERT: new integration_credentials row on generation
- UPDATE: set revoked_at on revocation
- UPDATE: modify scopes on scope change
- SELECT: filter by revoked_at IS NULL for validation

**API Endpoints Involved**

- POST /api/integrations/{integrationId}/credentials
- GET /api/integrations/{integrationId}/credentials
- PUT /api/integrations/{integrationId}/credentials/{credentialId}
- DELETE /api/integrations/{integrationId}/credentials/{credentialId}

**Security/RBAC Requirements**

- Only merchant owner of integration (or admin) can manage credentials
- Plaintext keys returned only at creation; never in subsequent GET
- Scope changes must be explicit (no silent privilege escalation)
- Credential list must show last_used_at and created_at (but not key itself)
- Revoked credentials must immediately fail authentication

**Tests Required**

- Generate new credential: returns plaintext key once, hashed in DB
- List credentials: shows masked keys, last_used_at, created_at
- Modify scopes: changes credential scopes immediately
- Revoke credential: future requests with revoked key fail 401
- Old credential still works during rotation (if not revoked)
- Authorization: non-owner cannot manage other integration's credentials

**Acceptance Criteria**

- ✅ POST /api/integrations/{id}/credentials returns plaintext key (single return)
- ✅ GET /api/integrations/{id}/credentials returns masked keys with audit metadata
- ✅ PUT /api/integrations/{id}/credentials/{credId} modifies scopes
- ✅ DELETE /api/integrations/{id}/credentials/{credId} sets revoked_at
- ✅ Revoked credential fails subsequent requests with 401
- ✅ Old credential still works until explicitly revoked

**OUT OF SCOPE**

- Automatic credential expiration/rotation
- Credential usage analytics (beyond last_used_at)
- Credential templates or presets
- Multi-credential validation (simultaneous validation of multiple keys)

---

### **MKT-INT-001-E: Integration Status & Validation API**

**Dependency**: MKT-INT-001-D (credentials must be managed)

**Objective**  
Implement status reporting and health-check endpoints for integrations, providing real-time operational visibility.

**Scope**

- Implement endpoints:
  - `GET /api/integrations/{integrationId}/status` — current integration health (last sync, last error, credential validity)
  - `POST /api/integrations/{integrationId}/validate` — validate integration (ping, connectivity check)
  - `GET /api/integrations/health` — admin endpoint: overall platform health across all integrations
- Status endpoint returns:
  - status (ACTIVE, ERROR, CREDENTIAL_REVOKED, LAST_SYNC_OLD)
  - last_sync_at (last successful catalog/inventory/order sync)
  - last_error_at (last operation failure)
  - last_error_message (truncated, sanitized for merchant visibility)
  - credential_status (ACTIVE, REVOKED, EXPIRING_SOON)
  - health_score (0-100, based on sync frequency and error rate)
- Validate endpoint:
  - Checks credential validity (hash and compare)
  - Pings POS webhook endpoint if configured
  - Attempts minimal test operation (e.g., list products)
  - Returns detailed errors for debugging
- Health dashboard (admin):
  - Count active/inactive integrations
  - List integrations with errors in last 24h
  - Aggregated sync statistics

**Existing Code to Reuse**

- Health check patterns (if any exist in observability module)
- Metrics/monitoring patterns from existing observability service
- Logging from existing logger
- Time/date utilities for last_sync_at calculations

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - `status.controller.ts` — status endpoints
  - `status.service.ts` — status calculation logic
  - `status.dto.ts` — response DTOs

**Database Changes**

- No schema changes (reads from existing tables)
- Queries: SELECT from merchant_integrations, integration_credentials, integration_logs to calculate status

**API Endpoints Involved**

- GET /api/integrations/{integrationId}/status
- POST /api/integrations/{integrationId}/validate
- GET /api/integrations/health (admin only)

**Security/RBAC Requirements**

- Merchant can view their own integration status
- Admin can view all status
- Error messages must not expose internal system details (sanitized for POS visibility)
- Health dashboard (admin) must be rate-limited (prevent DoS from repeated calls)

**Tests Required**

- Status endpoint returns correct health_score based on sync frequency
- Status endpoint reflects CREDENTIAL_REVOKED when credential revoked
- Validate endpoint detects invalid credentials
- Validate endpoint pings webhook URL and returns latency
- Validate endpoint handles unreachable POS gracefully
- Health dashboard returns accurate counts and recent errors
- Error messages are sanitized (no stack traces)

**Acceptance Criteria**

- ✅ GET /api/integrations/{id}/status returns status, last_sync_at, health_score
- ✅ Status reflects CREDENTIAL_REVOKED when credential revoked
- ✅ POST /api/integrations/{id}/validate checks credential and POS connectivity
- ✅ GET /api/integrations/health returns aggregated stats (admin only)
- ✅ Error messages are sanitized (no internal details leaked)

**OUT OF SCOPE**

- Automatic remediation (alerting/fixing integrations)
- Machine learning-based health prediction
- Custom health metrics per integration
- Status change webhooks/notifications (can be added later)

---

### **MKT-INT-001-F: Catalog Sync Trigger & Status API**

**Dependency**: MKT-INT-001-E (status framework in place)

**Objective**  
Implement endpoints for triggering and monitoring catalog synchronization jobs, allowing merchants to request full or incremental catalog pulls from POS.

**Scope**

- Implement endpoints:
  - `POST /api/integrations/{integrationId}/catalog/sync` — trigger catalog sync job
  - `GET /api/integrations/{integrationId}/catalog/sync-jobs` — list sync job history
  - `GET /api/integrations/{integrationId}/catalog/sync-jobs/{jobId}` — get single job status
- Catalog sync job must:
  - Create CatalogSyncJob record with status PENDING
  - Enqueue async job (using Bull or similar queue) to fetch catalog from POS
  - Support incremental syncs (delta from last_synced_at or full if first time)
  - Poll POS for product data via integration's webhook/API endpoint
- Sync job tracking must:
  - Record: products_added, products_updated, products_skipped, products_failed
  - Calculate: started_at, completed_at, total_duration_ms
  - Store error details for failed products (will be surfaced in conflict endpoint)
- Status endpoint returns:
  - status (PENDING, IN_PROGRESS, COMPLETED, FAILED)
  - progress_percent (0-100, based on products processed)
  - summary (products_added, products_updated, products_skipped, products_failed)

**Existing Code to Reuse**

- Async job queue (Bull or existing job service) from codebase
- HTTP client for calling POS endpoints
- Pagination utilities for product listing
- Timestamp patterns from schema (A)
- Error logging patterns from global exception filter

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - `catalog-sync.controller.ts` — sync trigger endpoints
  - `catalog-sync.service.ts` — sync orchestration
  - `catalog-sync.processor.ts` — async job processor
  - `catalog-sync.dto.ts` — DTOs
- `apps/backend/src/integrations/jobs/` — async job handlers

**Database Changes**

- INSERT: catalog_sync_jobs row on trigger
- UPDATE: set status, progress_percent, completed_at as sync progresses
- INSERT: product_syncs rows for each product processed

**API Endpoints Involved**

- POST /api/integrations/{integrationId}/catalog/sync
- GET /api/integrations/{integrationId}/catalog/sync-jobs
- GET /api/integrations/{integrationId}/catalog/sync-jobs/{jobId}
- (Async): Call POS webhook/API to fetch catalog data

**Security/RBAC Requirements**

- Only merchant owner or admin can trigger sync
- Sync scope must be limited to authenticated merchant's products
- POS API calls must use integration's API key for authentication
- Error details must be sanitized (no internal details in response)

**Tests Required**

- POST /api/integrations/{id}/catalog/sync creates job and returns jobId
- GET /api/integrations/{id}/catalog/sync-jobs lists job history with pagination
- GET /api/integrations/{id}/catalog/sync-jobs/{jobId} shows accurate progress
- Async sync processor calls POS, processes products, updates job status
- Incremental sync fetches only products modified since last_synced_at
- Full sync fetches all products
- Error handling: failed products logged, job marked FAILED, not COMPLETED
- Authorization: non-owner cannot trigger sync for other merchant

**Acceptance Criteria**

- ✅ POST /api/integrations/{id}/catalog/sync returns 202 ACCEPTED with jobId
- ✅ GET /api/integrations/{id}/catalog/sync-jobs/{jobId} shows progress (0-100%)
- ✅ Sync completes successfully, updates product_syncs with count summary
- ✅ Incremental sync (if last_synced_at set) fetches delta
- ✅ Full sync (if first time) fetches all products
- ✅ Job status transitions: PENDING → IN_PROGRESS → COMPLETED

**OUT OF SCOPE**

- Webhook-driven catalog push (POS pushes updates to DrippleX) — only pull model
- Real-time product change notifications
- Catalog versioning/rollback
- Product image/media sync
- Multi-language catalog support
- Scheduled automatic syncs (manual trigger only for now)

---

### **MKT-INT-001-G: Product & Modifier Mapping (SKU Bridge)**

**Dependency**: MKT-INT-001-F (catalog sync in place)

**Objective**  
Implement product mapping logic that bridges POS SKUs to DrippleX Product Catalog, creating stable identifiers for catalog synchronization and order processing.

**Scope**

- Implement mapping service:
  - Receive POS product data (from catalog sync in F)
  - Create or retrieve ProductSync record mapping POS SKU → DrippleX Product
  - Handle product modifiers (e.g., sizes, add-ons) → DrippleX Modifier groups
  - Support three mapping modes:
    1. **Auto-create**: POS product auto-creates new DrippleX Product if no match found
    2. **Manual match**: Merchant manually maps POS SKU to existing DrippleX Product
    3. **Skip**: POS product skipped (not synced to DrippleX)
- Product mapping must:
  - Store POS SKU as external identifier in ProductSync
  - Store DrippleX Product ID for order fulfillment lookups
  - Support price override (POS price may differ from DrippleX list price)
  - Store modifier mapping (POS modifier → DrippleX Modifier group)
- Endpoints:
  - `GET /api/integrations/{integrationId}/products` — list product mappings with status
  - `POST /api/integrations/{integrationId}/products/{externalProductId}/match` — manually map POS SKU to DrippleX Product
  - `DELETE /api/integrations/{integrationId}/products/{externalProductId}` — remove mapping (archive)
  - `PUT /api/integrations/{integrationId}/products/{externalProductId}` — update price/modifier mapping

**Existing Code to Reuse**

- Product service/repository from existing catalog module
- Modifier service (if existing) or Prisma Product.modifiers relationship
- SKU pattern from existing Product schema
- Manual mapping UI patterns (if any exist)

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - `product-mapping.controller.ts` — mapping endpoints
  - `product-mapping.service.ts` — mapping logic
  - `product-mapping.dto.ts` — DTOs
- `apps/backend/src/catalog/` — extend Product service to support SKU lookup

**Database Changes**

- ProductSync table (created in A):
  - external_sku (POS SKU)
  - product_id (DrippleX Product ID)
  - price_override (nullable; if set, use for orders instead of Product price)
  - modifier_mapping (JSON mapping POS modifier → DrippleX Modifier group)
  - mapping_status (AUTO_CREATED, MANUALLY_MATCHED, SKIPPED, UNMATCHED)
  - archived_at (soft-delete)
- Potential: extend Product model with `externalSkus` relationship (if not present)

**API Endpoints Involved**

- GET /api/integrations/{integrationId}/products
- POST /api/integrations/{integrationId}/products/{externalProductId}/match
- DELETE /api/integrations/{integrationId}/products/{externalProductId}
- PUT /api/integrations/{integrationId}/products/{externalProductId}

**Security/RBAC Requirements**

- Only merchant owner can map their own products
- Manual mapping requires catalog:write scope
- POS products not leaked to other merchants (scoped by merchant_id)

**Tests Required**

- Auto-create mapping: creates new DrippleX Product and ProductSync record
- Manual match: maps existing POS SKU to existing DrippleX Product
- Price override: order uses override price instead of Product price
- Modifier mapping: POS modifier correctly mapped to DrippleX Modifier group
- List products: returns all mapped products with status
- Delete mapping: soft-deletes ProductSync record
- Update mapping: modifies price_override and modifiers

**Acceptance Criteria**

- ✅ Auto-create mapping: POS product without match creates new DrippleX Product
- ✅ Manual match: can map POS SKU to existing DrippleX Product
- ✅ Price override: orders use override price when set
- ✅ Modifier mapping: POS modifiers correctly linked to DrippleX Modifier groups
- ✅ List products: returns all mappings with status (UNMATCHED, AUTO_CREATED, MANUALLY_MATCHED)

**OUT OF SCOPE**

- Image/media synchronization
- Multi-language product names/descriptions
- Dynamic SKU generation (use POS-provided SKU)
- Bulk mapping import from CSV
- Automatic matcher (AI/ML SKU suggestion)
- Product variant versioning

---

### **MKT-INT-001-H: Catalog Conflict Detection & Resolution**

**Dependency**: MKT-INT-001-G (product mapping in place)

**Objective**  
Implement conflict detection for catalog synchronization, identifying mismatches between POS and DrippleX (e.g., price changes, product deletions, modifier mismatches), and resolution workflows.

**Scope**

- Detect conflicts:
  - **Price conflict**: POS product price differs from DrippleX Product price by >5% (threshold configurable)
  - **Modifier conflict**: POS modifier not found in DrippleX Modifier group or mismatch
  - **SKU conflict**: POS SKU maps to multiple DrippleX Products (ambiguity)
  - **Orphan conflict**: DrippleX Product has no active POS mapping (product deleted on POS?)
  - **Duplicate conflict**: POS SKU maps to same DrippleX Product multiple times
- Conflict resolution strategies:
  - **Automatic**: apply safe default (e.g., keep DrippleX price if POS price change is <5%)
  - **Manual**: merchant reviews and approves conflict resolution
  - **Ignore**: merchant marks conflict as non-critical (for monitoring only)
- Endpoints:
  - `GET /api/integrations/{integrationId}/conflicts` — list conflicts
  - `POST /api/integrations/{integrationId}/conflicts/{conflictId}/resolve` — resolve conflict manually
  - `PUT /api/integrations/{integrationId}/conflicts/{conflictId}` — update conflict status (ignore/escalate)

**Existing Code to Reuse**

- Conflict detection patterns from existing modules (if any)
- Product and Modifier services from catalog module
- Logging patterns from global exception filter
- Notification/alerting (if exists) for merchant visibility

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - `conflict-detection.service.ts` — conflict identification
  - `conflict-resolution.service.ts` — conflict resolution logic
  - `conflicts.controller.ts` — endpoints
  - `conflicts.dto.ts` — DTOs
- `apps/backend/src/jobs/` — async conflict detection job (runs after sync)

**Database Changes**

- IntegrationConflict table (created in A):
  - conflict_type (PRICE, MODIFIER, SKU, ORPHAN, DUPLICATE)
  - source_data (JSON: POS data, DrippleX data)
  - resolution_status (UNRESOLVED, AUTO_RESOLVED, MANUALLY_RESOLVED, IGNORED)
  - resolved_by (nullable, user ID who resolved)
  - resolved_at (nullable, timestamp)
  - resolution_details (JSON: what was decided)

**API Endpoints Involved**

- GET /api/integrations/{integrationId}/conflicts
- POST /api/integrations/{integrationId}/conflicts/{conflictId}/resolve
- PUT /api/integrations/{integrationId}/conflicts/{conflictId}

**Security/RBAC Requirements**

- Merchant can view conflicts for their integrations
- Manual conflict resolution requires catalog:write scope
- Admin can override merchant resolution
- Conflict resolution must be audited (resolved_by and resolved_at tracked)
- **Financial conflicts NOT resolvable via manual override** (e.g., if price conflict involves payment, escalate to admin)

**Tests Required**

- Price conflict detected when POS price differs from DrippleX price by >threshold
- Modifier conflict detected when POS modifier not in DrippleX group
- SKU conflict detected when POS SKU maps to multiple DrippleX Products
- Orphan conflict detected when DrippleX Product has no active POS mapping
- Auto-resolution applies safe defaults (e.g., keep DrippleX price for small changes)
- Manual resolution: merchant can override conflict with decision
- Ignore resolution: conflict marked as non-critical but logged
- Conflicts list includes pagination and filtering by type/status

**Acceptance Criteria**

- ✅ Conflict detection runs after catalog sync, identifies mismatches
- ✅ GET /api/integrations/{id}/conflicts lists conflicts with type and severity
- ✅ POST /api/integrations/{id}/conflicts/{conflictId}/resolve allows manual resolution
- ✅ Auto-resolution applies for safe decisions (e.g., <5% price change)
- ✅ Conflict resolution audited (resolved_by, resolved_at tracked)

**OUT OF SCOPE**

- Automatic conflict resolution for financial/payment conflicts (always manual review)
- Machine learning-based conflict prediction
- Conflict severity scoring/prioritization
- Bulk conflict resolution
- Conflict notification to merchant (handled by separate notification service)

---

### **MKT-INT-001-I: Soft-Delete & Archive Operations**

**Dependency**: MKT-INT-001-H (all catalog operations in place)

**Objective**  
Implement and enforce soft-delete/archive patterns for all catalog operations, ensuring no destructive deletion of historical data and maintaining audit trails.

**Scope**

- Archive operations for:
  - ProductSync: when POS product deleted or unmapped
  - Integration: when merchant disconnects or pauses integration
  - Credential: when rotated or revoked
  - CatalogSyncJob: (no delete; retain full history)
- Archive behavior:
  - Set archived_at timestamp (no row deletion)
  - Exclude archived records from default queries (archived_at IS NULL)
  - Allow restoration (set archived_at to NULL) with audit log
  - Preserve all historical audit data
- Endpoints:
  - `POST /api/integrations/{integrationId}/restore` — unarchive integration
  - `POST /api/integrations/{integrationId}/products/{externalProductId}/restore` — unarchive product mapping
- Query patterns:
  - Default: exclude archived records
  - Admin: include flag to show archived records (with archived_at and archived_by metadata)

**Existing Code to Reuse**

- Soft-delete pattern from existing models (if any)
- Audit logging from existing audit service
- Timestamp utilities

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - Extend all services to filter archived_at IS NULL
  - `archive.service.ts` — centralized archive/restore logic
- Prisma schema (if not already present): soft-delete filters in find operations
- Database: existing indices on archived_at (created in A)

**Database Changes**

- No new tables (archive uses archived_at field in existing tables)
- Queries: add `archived_at IS NULL` filters to default SELECT statements
- Audit: log archived_by and archived_reason on archive operations

**API Endpoints Involved**

- POST /api/integrations/{integrationId}/restore
- POST /api/integrations/{integrationId}/products/{externalProductId}/restore

**Security/RBAC Requirements**

- Only merchant owner or admin can restore their records
- Archive operations logged with authenticated user ID
- Admin can see archived records (when admin:view flag set)
- Regular users see only active records

**Tests Required**

- Archive: sets archived_at timestamp
- Default queries: exclude archived records
- Restore: sets archived_at to NULL
- List with admin flag: includes archived records with metadata
- Archive audit log: records user, timestamp, and reason
- Authorization: non-owner cannot restore other merchant's records

**Acceptance Criteria**

- ✅ Archive operations set archived_at, not DELETE
- ✅ Default queries filter archived_at IS NULL
- ✅ Restore sets archived_at to NULL
- ✅ Admin queries can include archived records
- ✅ All archive/restore operations logged with user ID

**OUT OF SCOPE**

- Automatic purging of old archived records
- Hard-delete operations (never delete, only archive)
- Backup/restore procedures
- Version control of archived state changes
- Time-based archive retention policies

---

### **MKT-INT-001-J: Inventory Sync API (Real-time Updates)**

**Dependency**: MKT-INT-001-I (archive operations in place)

**Objective**  
Implement inventory synchronization endpoints allowing POS systems to push real-time stock level updates to DrippleX.

**Scope**

- Implement endpoints:
  - `PUT /api/integrations/{integrationId}/inventory` — bulk inventory update
  - `PUT /api/integrations/{integrationId}/inventory/{externalProductId}` — single product inventory update
  - `GET /api/integrations/{integrationId}/inventory` — list current inventory levels
- Inventory update must:
  - Accept stock quantity, availability status (in_stock, low_stock, out_of_stock)
  - Update DrippleX Product stock via SKU mapping
  - Support idempotency via Idempotency-Key header
  - Return 202 ACCEPTED for async processing (validate, update stock)
  - Log all updates for audit trail
- Inventory validation:
  - Reject negative stock (unless explicitly allowed for backorder)
  - Detect stock conflicts (POS shows stock but DrippleX reserved/committed)
  - Check merchant quota/limits
- Stock level update must:
  - Update Product.stock_quantity in DrippleX
  - Trigger availability state change (e.g., out_of_stock when quantity=0)
  - NOT affect existing orders (historical orders preserve price/product state)

**Existing Code to Reuse**

- Idempotency pattern from existing endpoints (if any)
- Product service for stock updates
- Async job queue from MKT-INT-001-F
- HTTP client for any dependent services

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - `inventory.controller.ts` — inventory endpoints
  - `inventory.service.ts` — stock update logic
  - `inventory.processor.ts` — async processor for stock updates
  - `inventory.dto.ts` — DTOs
- `apps/backend/src/catalog/` — extend Product service with stock update method

**Database Changes**

- Inventory updates trigger:
  - UPDATE products SET stock_quantity = ? WHERE id = (mapped from external_product_id)
  - INSERT INTO integration_logs (audit trail)
- Idempotency tracking:
  - Use Idempotency-Key header to prevent duplicate updates (insert idempotency record)

**API Endpoints Involved**

- PUT /api/integrations/{integrationId}/inventory
- PUT /api/integrations/{integrationId}/inventory/{externalProductId}
- GET /api/integrations/{integrationId}/inventory

**Security/RBAC Requirements**

- Only integration's API key (POS system) can update inventory
- Inventory updates scoped to integration's products only (via SKU mapping)
- Idempotency: prevent replay attacks (same Idempotency-Key returns same result)
- Stock updates must validate merchant quota (e.g., cannot exceed max items per merchant)

**Tests Required**

- PUT /api/integrations/{id}/inventory updates multiple products and returns 202
- PUT /api/integrations/{id}/inventory/{productId} updates single product
- Idempotent: same Idempotency-Key returns same result
- Stock conflict: rejects negative stock unless backorder allowed
- Stock update: reflects in GET /api/integrations/{id}/inventory
- Availability state: out_of_stock when quantity=0, in_stock when >0
- Authorization: POS API key required, cannot access other merchant's inventory
- Audit: all updates logged in integration_logs

**Acceptance Criteria**

- ✅ PUT /api/integrations/{id}/inventory returns 202 ACCEPTED
- ✅ Stock updates async, reflected in GET within seconds
- ✅ Idempotency: same Idempotency-Key returns same result (no duplicate updates)
- ✅ Negative stock rejected (or allowed if backorder flag set)
- ✅ GET /api/integrations/{id}/inventory returns current levels

**OUT OF SCOPE**

- Real-time stock reservations (orders pre-reserve stock; handled elsewhere)
- Stock alerts/notifications to merchant
- Multi-warehouse inventory (single warehouse per merchant for now)
- Inventory forecasting/demand prediction
- Reserved/committed stock tracking (reserve stock via order fulfillment, not inventory sync)
- Backorder workflows beyond simple quantity handling

---

### **MKT-INT-001-K: Inventory Conflict Resolution**

**Dependency**: MKT-INT-001-J (inventory sync in place)

**Objective**  
Implement conflict detection for inventory synchronization, identifying stock discrepancies between POS and DrippleX, and resolution workflows.

**Scope**

- Detect conflicts:
  - **Stock mismatch**: POS stock differs from DrippleX stock by >threshold (e.g., >5 units or >10%)
  - **Availability conflict**: POS shows in_stock but DrippleX shows out_of_stock (or vice versa)
  - **Reserved conflict**: POS shows available stock but DrippleX has reserved units (from uncommitted orders)
  - **Negative stock**: POS attempted update with negative quantity (without backorder flag)
- Conflict resolution strategies:
  - **Accept POS**: use POS stock as source of truth (override DrippleX)
  - **Accept DrippleX**: use DrippleX stock as source of truth (reject POS update)
  - **Manual review**: escalate to merchant for decision
  - **Merge**: reserve POS stock as available, preserve DrippleX reservations
- Endpoints:
  - `GET /api/integrations/{integrationId}/inventory-conflicts` — list conflicts
  - `POST /api/integrations/{integrationId}/inventory-conflicts/{conflictId}/resolve` — resolve conflict
  - `PUT /api/integrations/{integrationId}/inventory-conflicts/{conflictId}` — update conflict status

**Existing Code to Reuse**

- Conflict detection and resolution patterns from MKT-INT-001-H
- Product service for stock queries
- Logging patterns from global exception filter

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - `inventory-conflict-detection.service.ts` — conflict identification
  - `inventory-conflict-resolution.service.ts` — resolution logic
  - `inventory-conflicts.controller.ts` — endpoints
  - `inventory-conflicts.dto.ts` — DTOs
- `apps/backend/src/jobs/` — async conflict detection job (runs after inventory update)

**Database Changes**

- IntegrationConflict table (reuse from H):
  - conflict_type includes: STOCK_MISMATCH, AVAILABILITY_CONFLICT, RESERVED_CONFLICT, NEGATIVE_STOCK
  - resolution_status: UNRESOLVED, AUTO_RESOLVED, MANUALLY_RESOLVED, IGNORED

**API Endpoints Involved**

- GET /api/integrations/{integrationId}/inventory-conflicts
- POST /api/integrations/{integrationId}/inventory-conflicts/{conflictId}/resolve
- PUT /api/integrations/{integrationId}/inventory-conflicts/{conflictId}

**Security/RBAC Requirements**

- Merchant can view conflicts for their integrations
- Manual conflict resolution requires inventory:write scope
- Admin can override merchant resolution
- Conflict resolution audited (resolved_by, resolved_at)
- **Stock conflicts affecting reserved orders must escalate to merchant review** (cannot auto-resolve)

**Tests Required**

- Stock mismatch detected when difference >threshold
- Availability conflict detected when POS/DrippleX status differs
- Reserved conflict detected when reserved units exist
- Auto-resolution applies for safe decisions (accept one source of truth)
- Manual resolution: merchant chooses source of truth or manual adjustment
- Conflicts list includes pagination and filtering by type/status
- Conflict resolution audited (resolved_by, resolved_at)

**Acceptance Criteria**

- ✅ Conflict detection runs after inventory update, identifies mismatches
- ✅ GET /api/integrations/{id}/inventory-conflicts lists conflicts with type
- ✅ POST /api/integrations/{id}/inventory-conflicts/{conflictId}/resolve allows resolution
- ✅ Auto-resolution applies for safe decisions
- ✅ Manual resolution requires merchant approval for reserved stock conflicts

**OUT OF SCOPE**

- Automatic stock reconciliation without merchant review
- Stock forecasting or demand-based adjustments
- Multi-location inventory management
- Stock transfer between locations
- Inventory aging/FIFO tracking

---

### **MKT-INT-001-L: Order Status Update API & Order Fulfillment Webhook**

**Dependency**: MKT-INT-001-K (inventory conflicts in place, all setup complete)

**Objective**  
Implement order integration endpoints for POS systems to request order status transitions (RECEIVED→ACCEPTED→PREPARING→READY) and webhook notifications for DrippleX to inform POS of order events (PICKED_UP, DELIVERED, COMPLETED, CANCELLED).

**Scope**

- Implement endpoints:
  - `PUT /api/integrations/{integrationId}/orders/{externalOrderId}/status` — POS requests order status transition
  - `GET /api/integrations/{integrationId}/orders/{externalOrderId}` — retrieve order details
  - `GET /api/integrations/{integrationId}/orders` — list orders for integration
- Order status transition validation:
  - DrippleX owns canonical order state machine: CREATED, PAYMENT_CONFIRMED, ACCEPTED, PREPARING, READY, PICKED_UP, DELIVERED, COMPLETED, CANCELLED
  - POS permitted transitions: RECEIVED → ACCEPTED → PREPARING → READY
  - POS cannot request: CREATED, PAYMENT_CONFIRMED, PICKED_UP, DELIVERED, COMPLETED, CANCELLED (these are DrippleX-only)
  - Preconditions must be met before transition:
    - ACCEPTED: payment_confirmed must be true
    - PREPARING: accepted_at must exist
    - READY: preparing_at must exist
  - Return 409 Conflict if precondition fails (with details of missing precondition)
- Idempotency:
  - Support Idempotency-Key header for all status updates
  - Prevent duplicate status transitions
- Order fulfillment webhook (DrippleX→POS):
  - Webhook config stored in merchant integration settings
  - Triggered for events: READY, PICKED_UP, DELIVERED, COMPLETED, CANCELLED
  - Include HMAC-SHA256 signature for verification (using integration credential)
  - Payload format: standardized event envelope with order details
  - Retry policy: exponential backoff (3 retries, max 24h)
  - Log all webhook deliveries (success, failure, retry)
- Endpoints for webhook management (part of integration settings from C):
  - `PUT /api/integrations/{integrationId}` — update webhook URL
  - `POST /api/integrations/{integrationId}/webhook-test` — test webhook delivery

**Existing Code to Reuse**

- Order service and repository from existing orders module
- Webhook pattern (if exists in codebase, e.g., Stripe webhooks)
- HTTP client for webhook delivery
- Async job queue for webhook retries
- HMAC signature verification pattern (if exists)
- Idempotency pattern from MKT-INT-001-J

**Files/Modules Affected**

- `apps/backend/src/integrations/`
  - `order-status.controller.ts` — order status endpoints
  - `order-status.service.ts` — status transition validation
  - `order-status.dto.ts` — DTOs
  - `webhook-delivery.service.ts` — webhook orchestration
  - `webhook.processor.ts` — async webhook delivery with retries
- `apps/backend/src/orders/` — extend order service with status update method
- `apps/backend/src/jobs/` — webhook delivery job handler

**Database Changes**

- INSERT: integration_logs row for each status update
- UPDATE: Order.status field (existing Order model)
- Webhook delivery tracking:
  - IntegrationLog can include webhook_delivery_status
  - Or new table: webhook_deliveries (event_type, payload, status, retry_count, next_retry_at, delivered_at)

**API Endpoints Involved**

- PUT /api/integrations/{integrationId}/orders/{externalOrderId}/status
- GET /api/integrations/{integrationId}/orders/{externalOrderId}
- GET /api/integrations/{integrationId}/orders
- POST /api/integrations/{integrationId}/webhook-test (for testing)

**Security/RBAC Requirements**

- POS API key can only update orders belonging to integration's merchant
- Order status transitions validated to prevent bypassing financial checks (must have payment_confirmed before ACCEPTED)
- Webhook URL must be HTTPS (enforce secure delivery)
- Webhook signatures must be verified by POS (HMAC-SHA256 included in X-Dripplex-Signature header)
- Webhook payloads must not expose sensitive data (omit payment details, wallet transactions)
- Idempotency keys prevent replay attacks (same key = same operation, no duplicate effect)
- **Ride data never exposed to POS** (order webhook excludes ride_id, driver info, ride pricing)

**Tests Required**

- PUT /api/integrations/{id}/orders/{externalOrderId}/status updates order status
- Status transition validates preconditions (payment_confirmed before ACCEPTED, etc.)
- Return 409 Conflict if precondition missing, with error details
- Idempotent: same Idempotency-Key returns same result (no duplicate status changes)
- GET /api/integrations/{id}/orders/{externalOrderId} returns order details (excluding ride)
- GET /api/integrations/{id}/orders lists all orders for integration (paginated)
- Webhook delivery: triggered for READY, PICKED_UP, DELIVERED, COMPLETED, CANCELLED
- Webhook signature: HMAC-SHA256 signed with credential, verified by POS
- Webhook retry: exponential backoff (1s, 2s, 4s...), max 3 retries
- Webhook test: POST /api/integrations/{id}/webhook-test sends test event
- Authorization: POS API key cannot access other merchant's orders
- Audit: all status updates and webhook deliveries logged

**Acceptance Criteria**

- ✅ PUT /api/integrations/{id}/orders/{externalOrderId}/status transitions order status
- ✅ Status validation enforces preconditions (payment_confirmed, etc.)
- ✅ Return 409 Conflict with details if precondition fails
- ✅ Idempotency: same Idempotency-Key prevents duplicate transitions
- ✅ GET /api/integrations/{id}/orders/{externalOrderId} returns order (no ride data)
- ✅ Webhook triggered for READY, PICKED_UP, DELIVERED, COMPLETED, CANCELLED
- ✅ Webhook signed with HMAC-SHA256, verifiable by POS
- ✅ Webhook retries with exponential backoff (max 3 retries, 24h max)
- ✅ Webhook delivery logged (success, failure, retry attempts)
- ✅ Order status updates audited (timestamp, user/API key, details)

**OUT OF SCOPE**

- Partial order fulfillment (entire order transitions state, not individual items)
- Kitchen display system (KDS) integration (future feature)
- Multi-vendor order splits (handled at order placement, not here)
- Reverse logistics/returns workflow
- Refund processing from POS (handled via payments module, not here)
- Order modification after ACCEPTED (no modifications allowed, must cancel/reorder)

---

## Dependency Graph (Visual)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            MKT-INT-001 Implementation Dependencies                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

         ┌────────────┐
         │ MKT-INT-A  │  Database Schema & Migrations
         │            │  (no deps)
         └─────┬──────┘
               │
               ├─────────────────────────────────────────────────────────────────┐
               │                                                                 │
         ┌─────▼──────┐                                                  ┌──────▼──────┐
         │ MKT-INT-B  │  Authentication & RBAC Framework               │              │
         │            │  (depends: A)                                  │              │
         └─────┬──────┘                                                │              │
               │                                                       │              │
         ┌─────▼─────────────────────────────────────────────────────────────┬──────────────────┐
         │                                                                    │                  │
    ┌────▼─────┐                                                      ┌──────▼──────┐           │
    │MKT-INT-C │  Integration CRUD API                               │              │           │
    │           │  (depends: B)                                      │              │           │
    └────┬──────┘                                                    │              │           │
         │                                                            │              │           │
    ┌────▼──────┐                                                   │              │           │
    │MKT-INT-D  │  Integration Credentials Management               │              │           │
    │            │  (depends: C)                                    │              │           │
    └────┬───────┘                                                  │              │           │
         │                                                           │              │           │
    ┌────▼───────┐                                                  │              │           │
    │MKT-INT-E   │  Integration Status & Validation API             │              │           │
    │             │  (depends: D)                                   │              │           │
    └────┬────────┘                                                 │              │           │
         │                                                           │              │           │
    ┌────▼────────┐                                                 │              │           │
    │MKT-INT-F    │  Catalog Sync Trigger & Status API              │              │           │
    │              │  (depends: E)                                  │              │           │
    └────┬─────────┘                                                │              │           │
         │                                                           │              │           │
    ┌────▼─────────┐                                                │              │           │
    │MKT-INT-G     │  Product & Modifier Mapping (SKU Bridge)       │              │           │
    │               │  (depends: F)                                 │              │           │
    └────┬──────────┘                                               │              │           │
         │                                                           │              │           │
    ┌────▼──────────┐                                               │              │           │
    │MKT-INT-H      │  Catalog Conflict Detection & Resolution      │              │           │
    │                │  (depends: G)                                │              │           │
    └────┬───────────┘                                              │              │           │
         │                                                           │              │           │
    ┌────▼───────────┐                                              │              │           │
    │MKT-INT-I       │  Soft-Delete & Archive Operations            │              │           │
    │                 │  (depends: H)                               │              │           │
    └────┬────────────┘                                             │              │           │
         │                                                           │              │           │
    ┌────▼─────────────┐                                            │              │           │
    │MKT-INT-J         │  Inventory Sync API (Real-time Updates)    │              │           │
    │                   │  (depends: I)                             │              │           │
    └────┬──────────────┘                                           │              │           │
         │                                                           │              │           │
    ┌────▼──────────────┐                                           │              │           │
    │MKT-INT-K          │  Inventory Conflict Resolution            │              │           │
    │                    │  (depends: J)                            │              │           │
    └────┬───────────────┘                                          │              │           │
         │                                                           │              │           │
         └──────────────────────┬──────────────────────────────────────────────────────────┘
                                │
                           ┌────▼──────────────┐
                           │  MKT-INT-L        │  Order Status Update API
                           │                    │  & Order Fulfillment Webhook
                           │  (depends: K)     │
                           └────────────────────┘

IMPLEMENTATION PHASES:

Phase 1 (Foundation):        A → B
Phase 2 (Integration Mgmt):  C → D → E
Phase 3 (Catalog):           F → G → H → I
Phase 4 (Inventory):         J → K
Phase 5 (Orders):            L

CRITICAL PATH: A → B → C → D → E → F → G → H → I → J → K → L (12 sequential tickets)

Parallelization Opportunities (within dependencies):
  - Once A complete: B can run in parallel with any subsequent tickets (but B blocks everything)
  - Once B complete: C, D, E form a chain (C→D→E)
  - F, G, H, I form a chain (F→G→H→I)
  - J, K form a chain (J→K)
  - L depends on K, can start once K complete
  - **No true parallelization (all phases have linear dependencies)**
```

---

## Summary Table

| Ticket    | Title                                   | Deps | Phase | Estimated LOC | Est. Time      |
| --------- | --------------------------------------- | ---- | ----- | ------------- | -------------- |
| A         | Database Schema & Migrations            | —    | 1     | 300–500       | 2–3 days       |
| B         | Authentication & RBAC Framework         | A    | 1     | 400–600       | 3–4 days       |
| C         | Integration CRUD API                    | B    | 2     | 500–800       | 3–4 days       |
| D         | Integration Credentials Management      | C    | 2     | 400–600       | 2–3 days       |
| E         | Integration Status & Validation API     | D    | 2     | 300–500       | 2–3 days       |
| F         | Catalog Sync Trigger & Status API       | E    | 3     | 600–900       | 4–5 days       |
| G         | Product & Modifier Mapping (SKU Bridge) | F    | 3     | 500–800       | 3–4 days       |
| H         | Catalog Conflict Detection & Resolution | G    | 3     | 600–900       | 4–5 days       |
| I         | Soft-Delete & Archive Operations        | H    | 3     | 300–500       | 2–3 days       |
| J         | Inventory Sync API (Real-time Updates)  | I    | 4     | 500–800       | 3–4 days       |
| K         | Inventory Conflict Resolution           | J    | 4     | 400–600       | 2–3 days       |
| L         | Order Status Update API & Webhook       | K    | 5     | 700–1000      | 5–6 days       |
| **TOTAL** | —                                       | —    | —     | **6000–9000** | **42–48 days** |

---

## Implementation Principles (For Dev Phase)

When implementing from this backlog:

1. **No speculative code** — implement only what these tickets specify
2. **Existing code first** — reuse patterns from existing codebase (e.g., auth, logging, DTOs)
3. **Test-driven** — write tests as part of each ticket (acceptance criteria)
4. **Audit trail** — all operations logged (integrations/logs)
5. **Soft-delete only** — never destructive DELETE; use archived_at timestamps
6. **Idempotency** — support Idempotency-Key header for all mutations
7. **HMAC signatures** — all webhooks signed with integration credential
8. **Ride independence** — POS cannot access/influence ride transactions or driver data
9. **Domain authority** — respect source-of-truth boundaries (POS→catalog/inventory; DrippleX→orders/payments/commissions/ride)
10. **Error handling** — standardized error responses per global exception filter

---

## Next Steps (After Backlog Approval)

1. **Founder review** — review backlog tickets, dependencies, and dependency graph
2. **Risk & Mitigation Register** — map failure modes to tickets (identify where risks are mitigated)
3. **Production implementation** — begin ticket work in dependency order, following CLAUDE.md principles
4. **Continuous verification** — confirm actual code against ticket specifications

---

**End of Document**
