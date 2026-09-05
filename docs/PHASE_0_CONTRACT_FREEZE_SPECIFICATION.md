# DPX-MKT-INT-001 — PHASE 0 CONTRACT FREEZE SPECIFICATION

**Status:** CTO Specification — IMPLEMENTATION BLOCKED  
**Authority:** Nora, Chief Technology Officer, DrippleX  
**Decision Date:** 2026-09-05  
**Branch:** `cto/phase-0-contract-freeze`  
**Applies to:** Merchant Integration Platform, POS/ERP/inventory integrations, D-phase credential rotation  

---

## 1. Purpose

Phase 0 is a **contract-freeze phase, not an implementation phase**.

Its purpose is to define the security, trust, data, protocol, reliability, and audit contracts that every later implementation must obey.

The existing Merchant Integration Platform is explicitly pre-implementation. The architecture currently describes a generic Merchant Integration API for POS, ERP, inventory, accounting, and other merchant systems; Phase 0 replaces implementation assumptions with enforceable contracts. 

**No Phase 1 implementation is authorized by this document.**

---

## 2. Governing Principles

1. POS/ERP systems are untrusted external systems.
2. All external input is hostile until authenticated, authorized, validated, and bounded.
3. DrippleX remains the financial authority.
4. POS integrations cannot create, alter, settle, reverse, or directly ledger money.
5. Integration traffic enters through the Integration Gateway; no direct POS-to-core-service connection is permitted.
6. PostgreSQL is authoritative for durable idempotency, inbox, and outbox state. Redis may accelerate operations but is never the sole correctness authority.
7. Sensitive credentials are never returned after their one-time issuance window, persisted in plaintext, logged, placed in telemetry, or embedded in replayable idempotency responses.
8. Data minimization is mandatory.
9. Every externally observable mutation is authenticated, authorized, idempotent where applicable, auditable, and traceable.
10. Security controls are fail-closed.

---

# 3. The 14 Locked Contracts

## Contract 01 — Threat Model

### Assets

- Merchant integration credentials
- OAuth tokens/API keys/webhook secrets
- Merchant and integration configuration
- Orders and order status
- Catalog and inventory data
- Webhook endpoints and delivery state
- Idempotency/inbox/outbox records
- Audit records
- Financial references and payment status

### Primary threats

- Credential theft/reuse
- Cross-merchant authorization
- Replay of signed requests
- Duplicate mutation processing
- Request tampering
- Webhook spoofing
- SSRF against merchant-configured endpoints
- Inventory/order race conditions
- Resource exhaustion from a failing integration
- Sensitive data leakage through logs/errors/idempotency
- Direct financial manipulation through integration APIs
- Stale event overwrites

### Security posture

The threat model assumes a malicious or compromised POS. A valid merchant credential authenticates an integration identity; it does not make the POS trusted with DrippleX internals.

**Freeze condition:** any new trust assumption requires CTO review and Phase 0 re-entry.

---

## Contract 02 — Trust Boundaries

```text
UNTRUSTED
POS / ERP / Merchant System
        |
        | HTTPS
        v
EDGE / WAF
        |
        v
INTEGRATION GATEWAY  <-- security boundary
        |
        +-- authentication
        +-- authorization / tenant binding
        +-- validation
        +-- replay defense
        +-- rate limiting
        +-- SSRF/egress policy
        |
        v
DURABLE INBOX / OUTBOX (PostgreSQL)
        |
        v
INTEGRATION WORKERS
        |
        v
DRIPPLEX DOMAIN SERVICES
        |
        +--> Orders / Catalog / Inventory
        +--> Payments / Wallet / Fulfillment
        +--> Financial Ledger
```

The POS cannot cross directly into domain services, wallet, ledger, Ride, KYC, or internal infrastructure.

---

## Contract 03 — Authentication

### Supported mechanisms

Phase 0 defines two integration authentication classes:

1. OAuth 2.0 access tokens for integrations capable of OAuth.
2. API keys for controlled simpler integrations.

Bearer access tokens must be validated for signature/issuer/audience/expiry and mapped to exactly one integration and merchant tenant. API keys must likewise resolve to exactly one integration identity.

### Authorization

Authentication establishes **who** is calling. Authorization establishes **what that integration may do**.

Scopes are deny-by-default and operation-specific. A token/key must never authorize access outside its integration's merchant tenant.

### Mandatory properties

- TLS required.
- Expired credentials rejected.
- Revoked credentials rejected.
- Disabled/suspended integrations rejected.
- No credential accepted solely because its format looks valid.
- Authentication failures must not reveal whether another merchant or credential exists.

---

## Contract 04 — Credential Lifecycle

Credential classes:

- Client ID: public identifier.
- Client secret: confidential credential.
- API key: confidential credential.
- Webhook secret: confidential signing key.
- OAuth access token: short-lived confidential bearer credential.

### Required lifecycle

```text
PROVISIONED -> ACTIVE -> ROTATING -> ACTIVE
                       |
                       +-> REVOKED
ACTIVE ----------------+-> REVOKED
```

Rotation must support controlled overlap only where explicitly required by the authentication protocol. Every credential has a unique identifier, status, creation time, activation time, revocation time, expiry policy where applicable, and audit trail.

### Secret handling

Plaintext secrets exist only in transient process memory during the one-time issuance/rotation operation. They must never be:

- returned in ordinary GET responses;
- written to application/database logs;
- persisted in plaintext;
- placed in idempotency response bodies;
- included in exceptions or telemetry;
- returned by a replay of an idempotent request.

Encrypted secret material must use a defined KMS-backed key hierarchy and explicit key versioning. The contract does not permit an ephemeral application-only encryption key as the durable root of protection.

### Emergency revocation

Security response must permit immediate revocation of a compromised credential, even if it leaves an integration temporarily disconnected.

---

## Contract 05 — HMAC / Replay / Signature

Webhook authentication uses **HMAC-SHA-256** with the actual webhook secret as the key.

The signed message is:

```text
timestamp + "." + event_id + "." + raw_request_body
```

The signature is verified against the exact bytes received on the wire. JSON must not be parsed and reserialized before verification.

### Replay defense

A request is accepted only when:

1. signature is valid;
2. timestamp is within the configured tolerance;
3. event ID has not already been consumed for that integration;
4. credential/secret is active according to the contract.

The event ID must be durably deduplicated. A cache-only replay check is insufficient.

Comparison must be constant-time.

---

## Contract 06 — Idempotency

All externally retried mutation operations must define idempotency behavior.

Required fields:

- integration ID
- merchant ID
- idempotency key
- operation identifier
- request fingerprint/hash
- processing status
- safe replay reference/response
- created/updated timestamps
- completion metadata

### Rules

**Same key + same fingerprint:** return the original operation result.

**Same key + different fingerprint:** return `409 IDEMPOTENCY_KEY_REUSED`.

Concurrent identical requests must produce exactly one logical operation and the same resulting response.

Concurrent different requests must not bypass uniqueness/fingerprint enforcement.

A secret-bearing first response must never become a durable replay body. One-time secret delivery must be explicitly separated from ordinary idempotent response replay.

PostgreSQL uniqueness/transactional locking is authoritative. Redis may reduce contention but cannot define correctness.

---

## Contract 07 — Tenant Isolation

Every integration request resolves to one immutable tenant identity before domain execution.

Tenant identity must come from authenticated integration credentials, never from an untrusted request body field.

A request attempting to reference another merchant's resource must fail authorization before domain mutation.

### Verification requirements

- Cross-merchant GET: denied.
- Cross-merchant mutation: denied.
- Cross-merchant webhook configuration: denied.
- Cross-merchant idempotency key collision: isolated.
- Cross-merchant audit access: denied.

Database queries must include tenant/integration ownership constraints at the authoritative data-access boundary; controller-level checks alone are insufficient.

---

## Contract 08 — PII / Data Minimization

POS receives only data necessary for merchant operational fulfillment.

The original architecture included customer name, phone, delivery address, coordinates, payment details, and instructions in an order payload. That payload is **not frozen as-is**; Phase 0 requires minimization before implementation.

POS must not receive:

- wallet balances;
- KYC data;
- driver-private information;
- unrelated customer profile data;
- internal financial ledger data;
- secrets or authentication credentials.

Every field in each external schema must have a documented business purpose.

PII must have explicit retention and access requirements. Logs must default to identifiers and metadata rather than raw PII.

---

## Contract 09 — Inbox / Outbox Event Envelope

All inbound external events are recorded in a durable **Inbox** before business processing is considered complete.

All outbound integration events use a durable **Outbox**.

### Required envelope

```json
{
  "event_id": "evt_...",
  "event_type": "order.created",
  "event_version": "1",
  "occurred_at": "2026-09-05T10:00:00Z",
  "correlation_id": "corr_...",
  "merchant_id": "merchant_...",
  "integration_id": "int_...",
  "source": "dripplex",
  "payload": {}
}
```

The exact JSON Schema is a Phase 0 artifact and must be frozen before Phase 1.

### Outbound delivery states

```text
PENDING -> DELIVERING -> DELIVERED
             |
             v
       RETRY_SCHEDULED -> DEAD_LETTER
```

Retries must be durable and bounded. Dead-lettered events require operational replay controls.

---

## Contract 10 — Event Schema

Every external event schema must define:

- event type;
- event version;
- required/optional fields;
- field types and bounds;
- identifier semantics;
- timestamp format;
- enum values;
- tenant binding;
- ordering expectations;
- idempotency/replay semantics;
- compatibility policy.

Schemas are versioned. Breaking changes require a new version; consumers must never be forced to infer incompatible meaning from an unchanged version.

The current architecture's order statuses are provisional and must be replaced by an explicit state-transition contract before implementation.

---

## Contract 11 — Error Model

Errors are stable machine-readable objects.

Required minimum shape:

```json
{
  "error": {
    "code": "IDEMPOTENCY_KEY_REUSED",
    "message": "The request conflicts with an existing operation.",
    "request_id": "req_..."
  }
}
```

Rules:

- No secrets in errors.
- No raw credential material.
- No stack traces to external clients.
- No cross-tenant existence disclosure.
- Validation errors may identify invalid caller-supplied fields but must not disclose protected internal state.
- Retryable errors must be explicitly distinguishable from permanent errors.
- Rate-limit responses include retry guidance without leaking internal capacity data.

---

## Contract 12 — Rate Limits

Rate limiting is enforced at the Integration Gateway and scoped at minimum by integration identity. High-cost operations may receive tighter limits.

A limit response is HTTP `429` with a machine-readable error code and `Retry-After` where applicable.

Limits must protect:

- authentication attempts;
- mutations;
- bulk catalog/inventory operations;
- webhook configuration;
- outbound webhook delivery resources.

Exact numeric thresholds are a Phase 0 freeze artifact and must be load-tested before Phase 1 authorization. Limits must be independently adjustable by operation class without weakening the security contract.

One merchant/POS failure must not consume shared worker capacity for other tenants.

---

## Contract 13 — SSRF / Egress

Merchant-configured webhook URLs are untrusted input.

Outbound delivery must enforce:

- HTTPS only unless an explicit non-production exception is CTO-approved;
- rejection of loopback addresses;
- rejection of private RFC1918 ranges;
- rejection of link-local addresses;
- rejection of cloud metadata/service-network addresses;
- DNS resolution validation;
- protection against DNS rebinding;
- redirect restrictions and revalidation;
- controlled outbound egress;
- no arbitrary protocols or ports;
- destination revalidation at delivery time.

The application must not permit a merchant to turn webhook configuration into arbitrary internal network access.

---

## Contract 14 — Audit Requirements

Security-sensitive and business-significant integration actions require immutable audit records.

At minimum audit:

- credential creation/rotation/revocation;
- authentication failures of security significance;
- authorization failures;
- integration connect/disconnect;
- webhook configuration changes;
- sensitive configuration changes;
- idempotency conflicts;
- replay rejection;
- dead-letter/replay operations;
- cross-tenant access attempts;
- administrative security actions.

Audit records must contain actor/integration identity, tenant, action, outcome, timestamp, correlation/request ID, and relevant resource identifiers.

Audit records must not contain plaintext credentials, webhook secrets, access tokens, or unnecessary PII.

Retention must be defined and approved before Phase 0 exit.

---

# 4. Security Acceptance Tests

These tests are mandatory and must execute against real persistence/security boundaries rather than mocked correctness layers.

| Test | Required result |
|---|---|
| Valid HMAC | Accepted |
| Invalid HMAC | Rejected |
| Expired signature timestamp | Rejected |
| Revoked signing credential | Rejected |
| Replayed event ID | Rejected/deduplicated |
| Same idempotency key + same fingerprint | One operation; same result |
| Same idempotency key + different fingerprint | `409 IDEMPOTENCY_KEY_REUSED` |
| Concurrent identical mutations | Exactly one logical mutation |
| Concurrent transaction failure | Lock/state released; safe retry |
| Cross-tenant read | Rejected |
| Cross-tenant mutation | Rejected |
| Rate limit exceeded | `429` |
| Private-IP webhook target | Rejected |
| Loopback webhook target | Rejected |
| Malicious redirect | Rejected/revalidated |
| Secret in error path | Must not appear |
| Secret in logs/telemetry | Must not appear |
| Audit event | Written with required metadata |

Phase 0 also requires executable tests for transaction races and durable replay semantics before implementation authorization.

---

# 5. Required Phase 0 Supporting Specifications

The 14 contracts above are the governing set. The following artifacts are required to make them executable without changing their authority:

1. JSON Schema for the event envelope.
2. Versioned event schemas for the first supported integration events.
3. Authentication/scopes matrix.
4. Credential state-transition table.
5. HMAC header/signature specification.
6. Idempotency database contract and concurrency test plan.
7. Tenant-isolation verification matrix.
8. PII field classification matrix.
9. Error-code registry.
10. Rate-limit threshold matrix.
11. SSRF destination classification and egress rules.
12. Audit event catalog and retention schedule.
13. Security acceptance test specification.
14. 30-finding remediation traceability matrix.

These are supporting artifacts, not additional governance gates.

---

# 6. Explicit Prohibitions Before Phase 0 Exit

Until CTO signs the Phase 0 exit gate, the repository must not receive implementation for:

- Integration Gateway endpoints;
- database migrations for integration runtime;
- Inbox/Outbox runtime;
- credential rotation runtime;
- POS authentication runtime;
- webhook delivery runtime;
- merchant integration UI;
- catalog/inventory/order integration endpoints;
- SDK implementation;
- deployment of integration runtime.

Documentation/specification commits are permitted.

---

# 7. Phase 0 Exit Gate

Phase 0 may exit only when all of the following are true:

- [ ] 14 contracts complete.
- [ ] Supporting schemas/specifications complete.
- [ ] Threat model reviewed.
- [ ] Trust boundaries reviewed.
- [ ] Security acceptance tests defined as executable requirements.
- [ ] 30-finding register reconciled.
- [ ] No unresolved contradiction between OpenAPI, architecture, D-phase credential plan, and this specification.
- [ ] CTO approval recorded explicitly.

### Required CTO authorization text

> **PHASE 0 COMPLETE — CONTRACTS FROZEN. PHASE 1 IMPLEMENTATION AUTHORIZED SUBJECT TO FROZEN CONTRACTS.**

Until that exact authorization is issued, implementation remains blocked.

---

# 8. Contract Change Control

The freeze means implementation cannot silently reinterpret a contract.

A proposed change after freeze must include:

1. affected contract;
2. reason;
3. security impact;
4. compatibility impact;
5. migration/rollback impact;
6. affected acceptance tests;
7. CTO decision.

A change that weakens a security boundary requires a new CTO decision and may require reopening Phase 0.

---

# 9. Current Status

**PHASE 0: ACTIVE — SPECIFICATION WORK AUTHORIZED**  
**PHASE 1+: BLOCKED**  
**D-PHASE CREDENTIAL ROTATION: BLOCKED**  
**PRODUCTION POS INTEGRATION: BLOCKED**

This document establishes the Phase 0 engineering contract baseline. It does not authorize runtime implementation.
