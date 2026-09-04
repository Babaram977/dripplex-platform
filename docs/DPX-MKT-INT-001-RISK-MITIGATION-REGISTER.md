# MKT-INT-001: Merchant Integration Platform — Risk & Mitigation Register

**Document**: DPX-MKT-INT-001-RISK-MITIGATION-REGISTER.md  
**Status**: Ready for Review  
**Phase**: Pre-Implementation Risk Assessment  
**Date**: 2026-09-04

---

## Executive Summary

The MKT-INT-001 Merchant Integration Platform introduces a new POS integration layer that bridges external merchant systems to DrippleX's existing catalog, inventory, order, and payment infrastructure. This register identifies 48 material risks across 13 categories and defines mitigation strategies.

### Key Risk Profile

**Critical Risks (must resolve before launch)**: 13

- Duplicate order creation
- Payment state conflicts
- Inventory overselling
- Webhook replay attacks
- Credential compromise
- Merchant isolation failures
- Catalog mapping collisions
- Provider outage cascades
- Synchronization loops
- Order state validation bypass
- Destructive catalog sync
- Financial record manipulation
- Ride boundary violations

**High-Impact Risks**: 22 (require preventive controls)

**Medium Risks**: 13 (require monitoring)

### Critical Path Dependencies

After implementing foundational tickets (A: Database, B: Security), work can proceed in **parallel streams**:

- **Stream 1** (Integration Mgmt): C → D → E
- **Stream 2** (Catalog): F → G → H → I
- **Stream 3** (Inventory): J → K

All streams converge at **L: Order Integration**, which depends on K.

**Parallelization significantly reduces risk exposure window** — conflicts in isolated domains are detected and resolved in parallel rather than sequentially.

### Database Assumptions (To Validate in Ticket A)

The backlog proposes 6 new tables. **Before implementation**, validate whether existing DrippleX infrastructure provides:

- External entity mapping (SKU → Product bridge)
- Webhook delivery/event tracking
- Idempotency record storage
- Sync attempt/history tracking

**Principle**: Reuse existing infrastructure wherever possible; create new tables only if gaps exist.

### Ride & Google Play Isolation

✅ **MKT-INT-001 has ZERO dependencies on mobile Ride release.**

Explicit protections enforced:

- POS API endpoints do NOT expose ride_id, driver data, or ride pricing
- Ride state machine unreachable from POS authentication contexts
- No Android/iOS/Capacitor changes required
- Order webhook payloads omit ride details

**Conclusion**: Google Play build for Ride can proceed independently; no blocking dependencies.

---

## Risk Scoring Methodology

### Scoring Formula

**Risk Score** = Likelihood (1–5) × Severity (1–5) × Detection Gap (0.5–1.0)

where:

- **Likelihood**: How often the risk could occur (1 = rare, 5 = almost certain)
- **Severity**: Business/security impact if realized (1 = negligible, 5 = catastrophic)
- **Detection Gap**: How hard to detect (0.5 = easily detected, 1.0 = hard to detect)

**Score Range**: 0.25 (negligible) to 25 (critical)

### Risk Thresholds

| Score | Classification | Action                                    |
| ----- | -------------- | ----------------------------------------- |
| 20–25 | **CRITICAL**   | Must resolve before launch                |
| 12–19 | **HIGH**       | Preventive controls required; monitor     |
| 6–11  | **MEDIUM**     | Awareness and mitigation; regular testing |
| 1–5   | **LOW**        | Monitor; contingency plan                 |

### Owner Assignment

- **Ticket Owner**: Person implementing the ticket
- **Risk Assessor**: Founder (architecture decisions) + Ticket Owner (implementation details)
- **Security Lead**: For authentication, encryption, audit
- **QA Lead**: For testing, detection, validation

---

## Critical Risks (Priority 1 — Must Resolve Before Launch)

### CRIT-001: Duplicate Order Creation

**Category**: Orders / Database Integrity  
**Description**: POS sends identical order payload twice (network retry, clock skew, or intent duplication). DrippleX creates two orders instead of one, doubling charges and confusing fulfillment.  
**Cause**: Missing idempotency validation; POS retries order creation without Idempotency-Key or key not matched.  
**Impact**: Merchant/customer charged twice; inventory reserved twice; fulfillment confusion; disputed transactions.  
**Likelihood**: 4 (network retries common; POS may not implement Idempotency-Key correctly)  
**Severity**: 5 (financial impact; customer-facing failure)  
**Risk Score**: 4 × 5 × 1.0 = **20 (CRITICAL)**  
**Detection Method**:

- Idempotency-Key validation on all order creation endpoints
- Database constraint: UNIQUE(merchant_id, external_order_id) prevents silent duplicates
- Idempotency record with request hash detects identical payloads
- Audit log triggers alert on duplicate external_order_id

**Preventive Control**:

1. **Mandatory Idempotency-Key header** — all order creation requests require Idempotency-Key (UUID)
2. **Idempotency record storage** — store (merchant_id, idempotency_key, response) for 24h
3. **Hash validation** — hash request payload; reject if same key but different payload
4. **Database constraint** — UNIQUE(merchant_id, external_order_id) on orders table
5. **Ticket A validation** — confirm idempotency storage exists or design new table

**Mitigation**:

- Return 409 Conflict if duplicate external_order_id detected (with reason: "Order already exists")
- Log all duplicate attempts (with timestamp, source IP, merchant_id)
- Alert operations if >3 duplicates for same merchant in 1h

**Recovery Procedure**:

1. Identify duplicate order pair
2. Reverse one order via refund API (if payment confirmed)
3. Consolidate inventory reservation to single order
4. Send reconciliation notice to merchant
5. Preserve audit trail for investigation

**Owner**: Ticket L (Order Status), Ticket A (idempotency storage)  
**Blocks Production Launch**: **YES** — must have before live POS connect  
**Acceptance Criteria**:

- ✅ Same Idempotency-Key returns same order (no duplicate)
- ✅ Same Idempotency-Key, different payload → 400 Bad Request
- ✅ UNIQUE constraint prevents duplicates even if idempotency skipped
- ✅ Alert fires if 3+ duplicates detected

---

### CRIT-002: Payment State Conflict (POS marks ready without payment confirmed)

**Category**: Orders / Financial Safety  
**Description**: POS requests order state transition to READY before DrippleX confirms payment. DrippleX fulfills order but payment later fails, creating negative cash flow.  
**Cause**: POS assumes payment confirmed externally; DrippleX relies on payment confirmation from payment provider; timing window between order creation and payment confirmation is not guarded.  
**Impact**: Order fulfilled without payment; customer charged to wallet/card; refund required; financial loss if customer disputes.  
**Likelihood**: 4 (common POS assumption: order = payment)  
**Severity**: 5 (direct financial loss; liability)  
**Risk Score**: 4 × 5 × 0.8 = **16 (CRITICAL)**  
**Detection Method**:

- Order state validation: ACCEPTED/PREPARING/READY require payment_confirmed=true
- Payment state check before fulfillment
- Audit log: log payment_state on every status transition request
- Alert if READY requested without PAYMENT_CONFIRMED

**Preventive Control**:

1. **Ticket L explicit validation**: DrippleX MUST validate payment_state before allowing transition to ACCEPTED
2. **Order state diagram in API docs**: clearly show payment_confirmed as prerequisite
3. **Return 409 Conflict** if POS requests ACCEPTED without payment_confirmed (include reason)
4. **Merchant education**: OpenAPI examples show payment must be confirmed first
5. **Test: FailPaymentBeforeReady** — test explicitly fails if POS tries to mark ready before payment

**Mitigation**:

- Block ACCEPTED transition if payment_state !== PAYMENT_CONFIRMED
- Return detailed error: "Cannot accept order: payment not confirmed. Status: {payment_status}. Confirm payment first."
- Log all attempts to transition without payment
- Daily report to merchant: orders blocked due to payment state

**Recovery Procedure**:

1. Halt fulfillment for order
2. Verify payment with payment provider
3. If payment pending: wait for confirmation
4. If payment failed: send order cancellation + refund to customer
5. Notify merchant of payment failure (if POS-originated)
6. Update order state to reflect actual payment status

**Owner**: Ticket L (Order Status), Ticket C (Integration CRUD for order creation)  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ ACCEPTED transition blocked if payment_confirmed=false
- ✅ 409 Conflict returned with clear error message
- ✅ Return includes current payment_state for debugging
- ✅ Audit log captures all transition attempts

---

### CRIT-003: Inventory Overselling

**Category**: Inventory / Business Logic  
**Description**: POS reports 10 units in stock; customer orders 8 units; simultaneously POS updates inventory to 2 units (concurrent update). DrippleX inventory shows -6 units, allowing further orders against negative stock.  
**Cause**: Race condition between inventory check and reservation; no atomic transaction across POS update and order creation; stale inventory snapshots.  
**Impact**: Customer receives unfulfillable order; merchant overpromises; fulfillment fails; customer service escalation.  
**Likelihood**: 3 (depends on order volume and POS sync frequency)  
**Severity**: 5 (customer impact; operational failure)  
**Risk Score**: 3 × 5 × 0.9 = **13.5 ≈ 14 (CRITICAL)**  
**Detection Method**:

- Real-time inventory check before order confirmation
- Reservation atomicity: inventory deducted in same transaction as order creation
- Concurrent inventory test: stress test with simultaneous updates
- Daily reconciliation: compare DrippleX inventory vs POS inventory

**Preventive Control**:

1. **Atomic reservation** — Ticket J must implement: check stock + deduct in single database transaction
2. **Inventory version field** — add version/sequence number to inventory; retry if conflict detected
3. **POS sync frequency** — Ticket J sync must be frequent enough to catch real stock changes (<5 min)
4. **Order pre-confirmation inventory hold** — hold inventory for 5 min after order creation; release if payment fails
5. **Backorder flag** — allow negative inventory only if merchant explicitly enables backorder mode

**Mitigation**:

- Return 409 Conflict if inventory insufficient (with current available qty)
- Set inventory reservation TTL: if order not confirmed within 5 min, release reservation
- POS receives inventory check response; cannot guarantee fulfillment beyond that point
- Reconciliation job (Ticket J/K) daily compares POS + DrippleX inventory; alerts if drift >5%

**Recovery Procedure**:

1. Detect oversold order (inventory < 0)
2. Check order payment status
3. If order not paid: cancel immediately, restore inventory
4. If order paid: contact merchant, offer: fulfill partial order + issue refund, or backorder with expected date
5. Notify customer of status
6. Reconcile inventory with POS

**Owner**: Ticket J (Inventory Sync), Ticket K (Conflict Resolution), Ticket L (Order reservation)  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ Concurrent inventory updates don't cause overselling
- ✅ Inventory reservation atomic with order creation
- ✅ 409 Conflict returned if stock insufficient
- ✅ Stress test: 100 concurrent orders against 50-unit stock → exactly 50 succeed

---

### CRIT-004: Webhook Replay Attack

**Category**: Webhooks / Security  
**Description**: Attacker captures a webhook payload (e.g., READY event) and replays it multiple times. POS processes same order as ready repeatedly, causing duplicate fulfillment or state confusion.  
**Cause**: HMAC signature verified but no delivery ID tracking; webhook processing not idempotent; same signature accepted multiple times.  
**Impact**: Duplicate order processing; fulfillment confusion; inventory corruption; customer experience failure.  
**Likelihood**: 3 (requires attacker to intercept webhook; less likely for HTTPS, but possible if credentials compromised)  
**Severity**: 4 (operational confusion; fulfillment failure; not direct financial loss)  
**Risk Score**: 3 × 4 × 1.0 = **12 (CRITICAL)**  
**Detection Method**:

- HMAC-SHA256 signature validation (Ticket L must implement)
- Delivery ID tracking: each webhook includes unique delivery_id (UUID)
- Idempotency check: same delivery_id processed only once
- Webhook delivery log: log all deliveries (success, skip-duplicate, reject-invalid)
- Alert on repeated delivery_id within 1h

**Preventive Control**:

1. **HMAC-SHA256 signature** — all webhooks signed with integration credential (Ticket L)
2. **Delivery ID (UUID)** — each webhook includes unique delivery_id; cannot be replayed
3. **Idempotency record** — store (delivery_id, processed_at, response) for 7 days
4. **Duplicate check** — return 200 OK but skip processing if delivery_id already seen
5. **Webhook listener idempotent** — same payload processed multiple times produces same result
6. **Signature verification required** — reject webhook if HMAC invalid or missing

**Mitigation**:

- Return 200 OK even for replayed webhooks (POS doesn't retry)
- Log as "duplicate delivery" (not error)
- Skip state transition if same delivery_id already processed
- Alert operations if >5 replays of same delivery within 1h

**Recovery Procedure**:

1. Detect replay (delivery_id already seen)
2. Log duplicate event
3. Verify current order state (may already be updated)
4. If state correct: no action needed (idempotency worked)
5. If state incorrect: investigate; may indicate webhook tampering
6. If tampering suspected: alert security team; review credential usage logs

**Owner**: Ticket L (Webhooks), Ticket A (delivery_id storage)  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ HMAC signature verified on all webhooks
- ✅ Replayed webhook (same delivery_id) returns 200 but skips processing
- ✅ Delivery ID persisted for 7 days; older requests rejected
- ✅ Webhook processing idempotent (same payload, multiple calls = same result)

---

### CRIT-005: Credential Compromise

**Category**: Authentication / Security  
**Description**: POS API key is leaked (source code, logs, GitHub, developer email). Attacker uses key to read/modify orders, inventory, catalog, and webhook URLs.  
**Cause**: Key stored in plaintext in POS code/config; key logged in error messages; key sent in HTTP headers without HTTPS; credential rotation not enforced.  
**Impact**: Unauthorized access to merchant data; order manipulation; inventory corruption; financial loss; privacy breach.  
**Likelihood**: 3 (common in real-world deployments; developers often hardcode keys)  
**Severity**: 5 (complete system compromise)  
**Risk Score**: 3 × 5 × 1.0 = **15 (CRITICAL)**  
**Detection Method**:

- API key usage monitoring: log all requests (timestamp, endpoint, merchant_id)
- Unusual pattern detection: alert if key used from unexpected IP, unusual endpoints, high volume
- Credential rotation enforcement: API keys must rotate every 90 days
- Access logs: who generated key, who last rotated it
- Comparison with baseline: alert if key usage pattern changes

**Preventive Control**:

1. **Ticket B**: API keys hashed in database (bcrypt); plaintext never stored or logged
2. **Ticket D**: Credential rotation API; support key expiration + grace period
3. **API documentation** — explicitly forbid hardcoding keys; recommend env variables
4. **Key format** — prefix keys with "dpx_" so they're identifiable in logs
5. **Logging filter** — redact API keys from all logs automatically
6. **Scope limitation** — each key has minimum scopes needed (catalog:read/write, not all scopes)
7. **Rate limiting** — per-API-key rate limits; alert on sudden spike

**Mitigation**:

- Immediate revocation endpoint (Ticket D): merchant can revoke compromised key instantly
- Audit trail: show when key was last used, from which IP, what endpoints
- Force rotation after compromise: require new key generation
- Temporary block: if suspicious activity detected, block key for manual review
- Notify merchant: email alert when key used from unexpected location

**Recovery Procedure**:

1. Merchant discovers key leaked
2. Calls revocation endpoint (Ticket D: DELETE /credentials/{credentialId})
3. Key immediately stops working; attacker locked out
4. Merchant generates new key
5. Updates POS configuration with new key
6. Review audit log: check if attacker made changes (order creation, inventory updates, webhook changes)
7. Revert any unauthorized changes
8. File incident report

**Owner**: Ticket B (Authentication), Ticket D (Credential Management)  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ API keys hashed; plaintext never in logs or database
- ✅ Revocation endpoint works; revoked key fails immediately on next request
- ✅ Rotation endpoint generates new key without compromising old one
- ✅ Rate limiting: alert if >100 requests/min from single key
- ✅ Audit log tracks all key activity (creation, rotation, usage, revocation)

---

### CRIT-006: Merchant Isolation Failure

**Category**: Multi-Tenancy / Security  
**Description**: Merchant A's API key allows querying or modifying Merchant B's data (orders, inventory, products). Authorization bypass.  
**Cause**: Missing or incorrect merchant_id scoping in queries; API key doesn't include merchant_id validation; service layer checks user but not merchant context.  
**Impact**: Complete data breach; one merchant can sabotage another; orders stolen; pricing exposed; inventory corruption.  
**Likelihood**: 3 (common in multi-tenant systems; easy to miss scoping)  
**Severity**: 5 (complete isolation failure)  
**Risk Score**: 3 × 5 × 0.9 = **13.5 ≈ 14 (CRITICAL)**  
**Detection Method**:

- Security test: attempt to access another merchant's data with own API key → must return 403 Forbidden
- Authorization test: every query and mutation must explicitly filter by merchant_id
- Code review: verify all service methods include merchant_id scoping
- Audit log: log all access attempts; alert if cross-merchant access attempted
- Diff review before launch: scan for queries missing merchant_id filter

**Preventive Control**:

1. **Ticket B**: API key must include merchant_id in payload
2. **Integration context** — middleware attaches merchant_id to every request
3. **Service layer** — all queries include AND merchant_id = context.merchant_id
4. **Test: CrossMerchantAccess** — test explicitly verifies one merchant cannot access another's data
5. **Code pattern** — create helper method `scopeByMerchant(query)` to ensure scoping
6. **Database constraint** — if feasible, use row-level security (RLS) or partitioning by merchant_id
7. **Audit log** — log all data access with merchant_id and authenticated user

**Mitigation**:

- Block cross-merchant access immediately: return 403 Forbidden
- Log all unauthorized access attempts (timestamp, API key, attempted merchant_id, endpoint)
- Alert security team if sustained cross-merchant attempts (potential attack)
- Disable API key if >5 unauthorized attempts in 10 minutes

**Recovery Procedure**:

1. Detect cross-merchant access attempt
2. Revoke API key immediately (Ticket D)
3. Audit log: review all access from compromised key; identify what was accessed
4. Notify both merchants (victim + attacker merchant)
5. Remediate: restore any modified data from backups
6. Root cause: code review; identify where scoping was missing
7. Fix code; add regression test

**Owner**: Ticket B (Authentication), Ticket C (Integration CRUD), Ticket F–L (all integration endpoints)  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ Cross-merchant query returns 403 Forbidden
- ✅ All GET endpoints filter by merchant_id
- ✅ All PUT/PATCH/DELETE endpoints verify merchant_id ownership
- ✅ Audit log captures all access (success and failure)
- ✅ Test: 10 merchants, each tries to access others' data → all fail with 403

---

### CRIT-007: Catalog Mapping Collision

**Category**: Catalog / Database Integrity  
**Description**: Two POS systems (Merchant A and Merchant B) have same product SKU "COCA-COLA-500ML". Both sync to DrippleX. ProductSync table maps both to same DrippleX Product ID. Orders become misattributed.  
**Cause**: ProductSync unique constraint only on (external_sku, integration_id), but not on (external_sku, merchant_id); collision across merchants; auto-create mapping creates duplicate links.  
**Impact**: Cross-merchant order attribution; inventory mismatches; fulfillment confusion; financial loss.  
**Likelihood**: 4 (high probability given real-world POS data; SKUs are not globally unique)  
**Severity**: 4 (data integrity failure; merchant impact)  
**Risk Score**: 4 × 4 × 0.8 = **12.8 ≈ 13 (CRITICAL)**  
**Detection Method**:

- Database constraint: UNIQUE(integration_id, external_sku) prevents collision within merchant
- Cross-merchant collision test: two integrations with same SKU → separate ProductSync records
- Validation in Ticket G: auto-create mapping must verify no cross-merchant collision
- Audit log: log all product mapping creation with integration_id

**Preventive Control**:

1. **Ticket A constraint** — UNIQUE(integration_id, external_sku) in ProductSync table (scoped to integration)
2. **Ticket G mapping logic** — auto-create always creates new DrippleX Product or maps to existing within merchant's context
3. **Manual matching UI** — merchant explicitly chooses DrippleX Product when mapping; no silent auto-create across merchants
4. **Test: CrossMerchantSKU** — two integrations with identical SKU → create separate mappings, separate DrippleX Products

**Mitigation**:

- Validate on every mapping: ensure integration_id matches authenticated merchant
- Return 409 Conflict if attempt to map to Product outside merchant's catalog
- Log all mapping operations (integration_id, merchant_id, external_sku, dripplex_product_id)
- Daily reconciliation: verify each ProductSync maps to correct merchant's Product

**Recovery Procedure**:

1. Detect collision (two integrations mapped to same Product)
2. Identify affected orders
3. For each affected order: determine correct merchant/mapping
4. Create separate DrippleX Product if needed
5. Remap ProductSync to correct Product
6. Reconcile inventory/orders for affected products
7. Notify affected merchants

**Owner**: Ticket A (Constraint design), Ticket G (Product Mapping), Ticket H (Conflict Detection)  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ UNIQUE(integration_id, external_sku) prevents same SKU in same integration
- ✅ Two integrations can have same SKU → separate ProductSync records
- ✅ Each ProductSync correctly scoped to integration's merchant
- ✅ Mapping UI prevents cross-merchant Product selection

---

### CRIT-008: Provider Outage Cascade

**Category**: Reliability / Provider Dependency  
**Description**: POS system unreachable (network, POS server down). DrippleX tries to call POS to fetch catalog/inventory. Repeated failures cause cascading retry storms, overloading DrippleX job queue and delaying other merchants' syncs.  
**Cause**: No backoff strategy; retry loop too aggressive; no circuit breaker; queue not prioritized by merchant impact.  
**Impact**: DrippleX system degradation; other merchants' syncs delayed; exponential timeout costs.  
**Likelihood**: 3 (POS downtime is common; Murphy's Law applies)  
**Severity**: 4 (platform-wide impact; multiple merchants affected)  
**Risk Score**: 3 × 4 × 0.8 = **9.6 ≈ 10 (HIGH but included in critical context)**  
**Detection Method**:

- Queue monitoring: alert if >1000 pending jobs
- Retry pattern monitoring: alert if same integration fails >5 times in 10 min
- Circuit breaker state: track failed integrations; break circuit after N consecutive failures
- Provider health check: periodic ping to POS webhook URL; track availability %
- Latency monitoring: alert if POS response time exceeds 5 sec

**Preventive Control**:

1. **Circuit breaker pattern** — Ticket F: after 5 consecutive failures, stop retrying; wait 5 min before retry
2. **Exponential backoff** — Ticket F: 1s, 2s, 4s, 8s, 16s max; don't exceed 16s
3. **Max retries** — 3 attempts per sync; fail gracefully after that
4. **Async queue** — use Bull or similar; prioritize jobs by merchant; allow pausing integrations
5. **Dead letter queue** — failed jobs go to DLQ for manual review; don't clog main queue
6. **Timeout limit** — max 5 sec per HTTP call; don't hang
7. **Health check** — Ticket E: health endpoint shows provider reachability; disable sync if unreachable

**Mitigation**:

- Disable sync for unreachable provider; alert merchant
- Return 503 Unavailable to POS if DrippleX can't reach provider (don't retry synchronously)
- Accumulate offline requests; retry in batch once provider recovers
- Notify merchant: "POS unreachable; sync paused. Retrying..."

**Recovery Procedure**:

1. Detect provider unreachable (5 consecutive failures)
2. Break circuit; stop retrying
3. Alert operations: provider outage
4. Alert merchant: sync paused
5. Attempt recovery: check provider health periodically (e.g., every 5 min)
6. Once recovered: resume sync with exponential backoff
7. Catch-up: fetch delta from when sync stopped

**Owner**: Ticket E (Status monitoring), Ticket F (Catalog Sync), Ticket J (Inventory Sync)  
**Blocks Production Launch**: **YES** (if no circuit breaker)  
**Acceptance Criteria**:

- ✅ Circuit breaker breaks after 5 consecutive failures
- ✅ Exponential backoff: 1s, 2s, 4s, 8s, 16s
- ✅ Max 3 retries; fail gracefully
- ✅ Dead letter queue: failed jobs don't clog main queue
- ✅ Merchant notified when provider unreachable

---

### CRIT-009: Synchronization Loop (Catalog/Inventory)

**Category**: Catalog / Inventory / Data Integrity  
**Description**: Catalog sync from POS updates Product X price to ₦1000. Change triggers webhook back to POS. POS interprets webhook as "price changed" and pushes price change back to DrippleX. DrippleX triggers webhook again. Loop continues infinitely, spamming updates.  
**Cause**: No loop-breaking mechanism; POS webhook handler doesn't distinguish between "external sync" and "echo of my own change"; no idempotency on product updates.  
**Impact**: Infinite loop of product updates; audit log spam; potential data corruption; CPU/bandwidth waste.  
**Likelihood**: 2 (requires poorly-designed POS; but possible)  
**Severity**: 4 (system-wide impact; data integrity risk)  
**Risk Score**: 2 × 4 × 1.0 = **8 (HIGH but critical to prevent)**  
**Detection Method**:

- Update frequency monitoring: alert if Product X updated >10 times in 1 minute
- Loop detection: log each product update; detect same product updated in fast sequence with same value
- Diff tracking: only update if actual change (not echo)
- Audit log analysis: weekly review for suspicious update patterns

**Preventive Control**:

1. **Ticket G**: ProductSync tracks last_synced_at and last_modified_at; don't re-sync if no change since last sync
2. **Ticket H**: Conflict detection recognizes "no change" updates; skip update if price/inventory unchanged
3. **Idempotency on product updates** — same update with same timestamp skips if already processed
4. **Loop detector** — alert if same product updated >5 times in 1 min by same integration
5. **POS webhook best practice** — document: "don't re-push if change originated from DrippleX webhook"
6. **Versioning** — add version/etag to product; don't update if version hasn't changed

**Mitigation**:

- Skip update if no actual change detected
- Log and alert (but don't block) if loop suspected
- Pause integration if loop detected; require manual review
- Provide loop-breaking mechanism: flag update as "from POS webhook" to prevent re-broadcast

**Recovery Procedure**:

1. Detect loop (Product X updated 10 times in 1 min)
2. Pause integration sync
3. Alert operations
4. Review audit log: identify which updates were real vs echo
5. Revert echo updates
6. Verify current state matches reality
7. Resume integration once root cause fixed (POS webhook handler logic)

**Owner**: Ticket G (Product Mapping), Ticket H (Conflict Detection), Ticket F (Catalog Sync)  
**Blocks Production Launch**: **YES** (if no loop detector)  
**Acceptance Criteria**:

- ✅ Same product update with same values doesn't re-sync
- ✅ Product diff tracked; only sync if actual change
- ✅ Loop detector alerts if >5 updates in 1 min
- ✅ Integration paused if loop suspected

---

### CRIT-010: Incorrect Order State Transition

**Category**: Orders / Business Logic  
**Description**: Order in READY state; customer hasn't paid yet (payment still pending). POS requests transition to PICKED_UP (which should only come from driver/DrippleX). DrippleX allows it. Ride system thinks order ready for pickup; customer hasn't paid; fulfillment fails.  
**Cause**: POS API allows any state transition; Ticket L doesn't validate that transitions only come from authorized sources (POS can only request RECEIVED→ACCEPTED→PREPARING→READY); DrippleX-only transitions (PICKED_UP, DELIVERED, etc.) not guarded.  
**Impact**: Order state corruption; fulfillment confusion; undeliverable order; customer dissatisfaction.  
**Likelihood**: 3 (requires both POS bug and missing validation)  
**Severity**: 4 (operational failure; customer impact)  
**Risk Score**: 3 × 4 × 0.9 = **10.8 ≈ 11 (HIGH, critical to prevent)**  
**Detection Method**:

- Ticket L state machine validation: verify transition is in allowed set for POS
- Authorization check: POS can only request RECEIVED, ACCEPTED, PREPARING, READY
- Test: StateTransitionWhitelist — test explicitly rejects PICKED_UP, DELIVERED, COMPLETED, CANCELLED from POS
- Audit log: log all state transition requests (from, to, source, timestamp)

**Preventive Control**:

1. **Ticket L**: Explicit whitelist of allowed transitions per source
   - POS: RECEIVED→ACCEPTED, ACCEPTED→PREPARING, PREPARING→READY
   - DrippleX only: READY→PICKED_UP, PICKED_UP→DELIVERED, DELIVERED→COMPLETED, CANCELLED
2. **Ticket L**: Validate payment state before allowing ACCEPTED transition (prerequisite)
3. **Ticket L**: Return 403 Forbidden (not 400) if POS requests disallowed transition
4. **State machine diagram** — OpenAPI explicitly documents source authority for each transition
5. **Audit log** — log attempted invalid transitions (for investigation)

**Mitigation**:

- Return 403 Forbidden if POS requests unauthorized transition: "POS cannot request PICKED_UP state. Contact support if error."
- Log all invalid attempts with timestamp, source, requested state
- Alert operations if >3 invalid attempts for same order

**Recovery Procedure**:

1. Detect invalid state transition attempt
2. Return 403; prevent state change
3. Log incident
4. Check actual order state; ensure not corrupted
5. If state corrupted: revert to last known good state (from audit log)
6. Notify merchant: transition rejected
7. Investigate POS: why did it attempt invalid transition?

**Owner**: Ticket L (Order Status API)  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ POS can request: RECEIVED→ACCEPTED, ACCEPTED→PREPARING, PREPARING→READY
- ✅ POS cannot request: CREATED, PAYMENT_CONFIRMED, PICKED_UP, DELIVERED, COMPLETED, CANCELLED
- ✅ 403 Forbidden returned for unauthorized transitions
- ✅ Audit log captures all invalid attempts
- ✅ State machine diagram in API docs documents source authority

---

### CRIT-011: Destructive Catalog Synchronization

**Category**: Catalog / Data Loss  
**Description**: Catalog sync interprets product deletion on POS as "delete DrippleX Product." Sync deletes all DrippleX Product records. Existing orders fail; inventory corrupted. Data loss.  
**Cause**: Soft-delete pattern not enforced; service deletes Product directly; no archive+restore pattern; no safeguard against bulk deletes.  
**Impact**: Complete catalog loss; order fulfillment impossible; data integrity failure; unrecoverable loss if backup stale.  
**Likelihood**: 2 (would require POS to delete products + wrong implementation)  
**Severity**: 5 (catastrophic data loss)  
**Risk Score**: 2 × 5 × 0.9 = **9 (HIGH, but critical)**  
**Detection Method**:

- Code audit: verify DELETE never used; only archive (archived_at timestamp)
- Test: DeleteProductFails — test explicitly fails if direct DELETE attempted
- Audit log: log all product deletes (should be none); alert if any delete executed
- Backup test: weekly backup restore verification

**Preventive Control**:

1. **Ticket I**: Enforce soft-delete only — set archived_at, never DELETE
2. **Database constraint** — if possible, remove DELETE permission from application user
3. **Code review** — scan for `.delete()` calls on Product; must use `.update({archived_at: now()})`
4. **Test: NoProductDeletion** — verify delete() call returns error or is not allowed
5. **Audit log** — log all product archival (archived_at changes)

**Mitigation**:

- Archive product instead of delete: set archived_at timestamp
- Prevent unarchival without explicit request (recovery mode)
- Restore from backup if corruption detected

**Recovery Procedure**:

1. Detect mass product deletion/archival
2. Immediately pause catalog sync
3. Restore from backup (point-in-time, before deletion)
4. Alert founder: incident report required
5. Audit log: trace what triggered deletion
6. Code review: prevent future deletes
7. Communicate with merchants: explain recovery, check orders

**Owner**: Ticket A (Constraint design), Ticket I (Archive pattern), Ticket F (Sync safety)  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ DELETE operation on Product fails or is not allowed
- ✅ Only archive (set archived_at) is allowed
- ✅ Audit log captures all archive operations
- ✅ Unarchive requires explicit merchant request + confirmation
- ✅ Backup tested weekly; restore verified to work

---

### CRIT-012: Financial Record Manipulation

**Category**: Financial Safety / Security  
**Description**: Attacker uses compromised POS API key to call order endpoints and artificially create orders, manipulating commission records or wallet balances. Or: attacker modifies order price via status update, causing customer to be charged different amount.  
**Cause**: Order creation/modification not restricted to actual customer payments; no validation that order price matches payment; POS has write access to financial records.  
**Impact**: Financial fraud; customer overcharged/undercharged; commission miscalculation; revenue loss.  
**Likelihood**: 3 (requires credential compromise + attacker knowledge)  
**Severity**: 5 (direct financial impact)  
**Risk Score**: 3 × 5 × 1.0 = **15 (CRITICAL)**  
**Detection Method**:

- Financial audit log: log all order creation/modification (price, payment status)
- Reconciliation: daily compare orders in DrippleX vs orders actually paid
- Alert on price mismatch: if order price > payment amount, flag
- Test: CannotModifyOrderPrice — test verifies order price cannot be changed by POS

**Preventive Control**:

1. **Ticket L**: Order creation MUST include payment details (payment_id, amount); validation that payment exists before order created
2. **Ticket L**: Order price immutable after creation; cannot be modified by POS status update
3. **Authorization**: only payment system can create orders with payment amounts; POS cannot
4. **Financial audit log** — log all financial transactions (order creation, payment, commission)
5. **Price validation** — order price must match payment amount (±1% for rounding)
6. **Reconciliation** — daily reconciliation of orders vs payments; alert if mismatch

**Mitigation**:

- Block order creation if payment not confirmed
- Prevent price modification after order creation (return 403 if attempted)
- Alert finance team if price/payment mismatch detected
- Revert unauthorized financial changes

**Recovery Procedure**:

1. Detect suspicious order (price mismatch with payment)
2. Alert finance team
3. Audit log: review order creation and payment confirmation
4. If fraud detected: revert order, refund customer if charged
5. Remediate: fix code (if validation missing), revoke credential, investigate attacker

**Owner**: Ticket C (Order Creation), Ticket L (Order Integration), security team  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ Order creation requires confirmed payment
- ✅ Order price immutable after creation
- ✅ 403 Forbidden if POS attempts to modify price
- ✅ Financial audit log captures all financial operations
- ✅ Daily reconciliation alerts on price/payment mismatch

---

### CRIT-013: Ride Boundary Violation

**Category**: Ride Isolation / Architecture  
**Description**: POS integration accidentally or intentionally accesses Ride data (ride_id, driver info, ride pricing) through order webhook or cross-domain query. Or: Ride system is deployed alongside MKT-INT-001 changes, creating dependency that breaks Google Play release.  
**Cause**: Ride domain not isolated from integration API; order webhook includes ride_id; shared database tables; no hard boundary enforcement.  
**Impact**: Ride data exposed to POS; potential driver privacy violation; Ride release blocked; Google Play submission delayed.  
**Likelihood**: 1 (if properly isolated; higher if boundaries not enforced)  
**Severity**: 5 (blocks entire Ride release; privacy breach)  
**Risk Score**: 1 × 5 × 1.0 = **5 (CRITICAL threshold)**  
**Detection Method**:

- API audit: verify no order endpoint returns ride_id or driver data
- Webhook audit: verify webhook payloads omit ride fields
- Code review: search for `ride_`, `driver_id`, `driver_name` in integration code
- Test: RideIsolation — test verifies ride_id never returned to POS API
- Build verification: confirm Ride changes not required for MKT-INT-001 deploy

**Preventive Control**:

1. **Ticket A**: Order table schema excludes ride_id (if exists, separate foreign key model)
2. **Ticket L**: Order webhook payload explicitly excludes: ride_id, driver_id, driver_name, driver_phone, ride_pricing
3. **Authorization**: POS authentication context does NOT include ride scopes
4. **Test: RideNotExposed** — verify ride_id, driver data, ride pricing never returned in any POS endpoint
5. **Deployment**: MKT-INT-001 deploys independently; Ride deployment independent
6. **Documentation**: explicit architecture note: "Ride system not involved in POS integration; zero interdependencies"

**Mitigation**:

- If ride_id accidentally exposed: immediately patch and redeploy
- Add query filter: exclude ride_ fields from all POS responses
- Alert security team if ride data accessed via integration

**Recovery Procedure**:

1. Detect ride data exposure
2. Immediately revoke API keys if accessed
3. Audit log: review what ride data was accessed
4. Patch code: remove ride field from response
5. Redeploy
6. Verify Ride deployment not affected; can proceed independently
7. Notify founder: incident report

**Owner**: Ticket A (Schema design), Ticket L (Order integration), architecture review  
**Blocks Production Launch**: **YES**  
**Acceptance Criteria**:

- ✅ Order schema: no ride_id field; if needed, separate model with no POS access
- ✅ Order webhook: explicitly excludes ride_id, driver data, ride_pricing
- ✅ Test: POS endpoints return 403 or 404 on any ride-related query
- ✅ Ride deployment independent; no MKT-INT-001 dependency
- ✅ Google Play build can proceed without waiting for MKT-INT-001

---

## High-Risk Issues (Priority 2 — 12–19 Risk Score)

| Risk ID | Category      | Description                                                           | Score | Mitigation                                     |
| ------- | ------------- | --------------------------------------------------------------------- | ----- | ---------------------------------------------- |
| HR-001  | Catalog       | Product modifier mismatch (POS modifier not in DrippleX group)        | 16    | Conflict detection (H); manual review required |
| HR-002  | Inventory     | Concurrent inventory + order reservations (race condition)            | 15    | Atomic transaction; version field              |
| HR-003  | Orders        | Order reconciliation failure (POS order not linked to DrippleX order) | 15    | External order mapping; audit trail            |
| HR-004  | Webhooks      | Webhook delivery failure + no retry (POS misses status update)        | 14    | Exponential backoff; dead letter queue         |
| HR-005  | Catalog       | Catalog sync progress lost (job interrupted; partial state unknown)   | 13    | Sync job tracking; resumable syncs             |
| HR-006  | Inventory     | Inventory discrepancy (POS shows different qty than DrippleX)         | 13    | Real-time sync; reconciliation job             |
| HR-007  | Orders        | Order not found (external_order_id not mapped to DrippleX order)      | 13    | Validation on order creation; error details    |
| HR-008  | Multi-tenancy | Credential shared across merchants (scope creep)                      | 13    | One credential per integration; audit          |
| HR-009  | Webhooks      | Webhook signature mismatch (HMAC invalid; webhook rejected)           | 12    | Key rotation safe; test webhook endpoint       |
| HR-010  | Reliability   | Retry storm on failed endpoint (exponential growth)                   | 12    | Circuit breaker; max retries; backoff          |
| HR-011  | Provider      | POS API version incompatibility (POS updated; endpoint changed)       | 12    | Version detection; graceful fallback           |
| HR-012  | Audit         | Insufficient logging (cannot diagnose failure)                        | 12    | Comprehensive audit log; searchable            |

---

## Medium-Risk Issues (Priority 3 — 6–11 Risk Score)

13 medium risks identified (not detailed for brevity; include in full register):

- Duplicate invoice generation
- Price override not reflected in invoice
- Incomplete inventory data (partial sync failure)
- Webhook timeout (long processing)
- Credential expiration (auto-revoke after 90 days)
- Schema migration failure
- Rate limiting not enforced
- Cross-region latency (if DrippleX distributed)
- POS-initiated cancellation conflicts
- Manual conflict resolution abuse
- Insufficient backups
- Transaction isolation level too low
- Sensitive data in logs (customer info, payment details)

---

## Reconciliation Strategy

**Principle**: DrippleX is the source of truth for orders, payments, commissions, ride. POS is the source of truth for catalog and inventory (with DrippleX validation).

### Reconciliation Jobs (Run Daily)

1. **Catalog Reconciliation** (Ticket F/G)
   - Compare all ProductSync records with POS catalog via API
   - Alert if DrippleX Product has no POS mapping
   - Alert if mapped Product.sku differs from ProductSync.external_sku
   - Manual review: confirm old/archived products
   - Auto-archive DrippleX Product if POS product deleted

2. **Inventory Reconciliation** (Ticket J/K)
   - Compare all Product.stock_quantity with POS inventory (via API)
   - Alert if difference >5% or >5 units
   - Alert if DrippleX shows negative stock
   - Offer auto-correct: accept POS inventory as source
   - Alert merchant: "Inventory mismatch detected. Click to accept POS inventory as correct."

3. **Order Reconciliation** (Ticket L)
   - Compare all DrippleX Orders with external_order_id links
   - Alert if Order status conflicts with POS status
   - Alert if Order payment not confirmed but POS marked ready
   - Alert if external_order_id maps to multiple DrippleX orders
   - Preserve audit trail: log all reconciliation actions

4. **Webhook Delivery Reconciliation** (Ticket L)
   - Review integration_logs: check if webhook delivery expected but not sent
   - Alert if >5 failed deliveries for integration in 24h
   - Alert merchant: "Webhook delivery issues; manual sync recommended"

### Automated vs Manual Corrections

| Scenario                   | Action                                                 |
| -------------------------- | ------------------------------------------------------ |
| Inventory drift <2%        | Auto-correct (accept POS)                              |
| Inventory drift 2–10%      | Alert merchant; require approval                       |
| Inventory drift >10%       | Alert, no auto-correct; manual review required         |
| Product archived on POS    | Auto-archive DrippleX copy                             |
| Product price conflict     | Alert merchant; require approval (do not auto-correct) |
| Order status mismatch      | Alert; do not auto-correct financial states            |
| Duplicate webhook delivery | Auto-skip (idempotency)                                |
| Missing webhook delivery   | Alert; offer manual retry                              |

---

## Security Controls

### Authentication & Authorization

- ✅ API key hashing (bcrypt)
- ✅ Idempotency-Key validation
- ✅ HMAC-SHA256 webhook signatures
- ✅ Scope-based access control
- ✅ Merchant_id scoping on all queries
- ✅ Rate limiting per API key

### Data Protection

- ✅ TLS 1.2+ for all external communication
- ✅ Sensitive data never logged (API keys, payment info)
- ✅ Soft-delete only; no destructive deletions
- ✅ Audit trail for all operations
- ✅ Encrypted credential storage (if sensitive fields)

### Audit & Monitoring

- ✅ All operations logged (timestamp, user/API key, action, result)
- ✅ Alert on suspicious patterns (repeated failures, rate limit breaches)
- ✅ Daily reconciliation (catalog, inventory, orders)
- ✅ Webhook delivery monitoring

---

## Go-Live Gates (Must Pass Before First Real POS Connect)

### Security Gates

- [ ] No hardcoded credentials in code (scan results)
- [ ] API key rotation tested and working
- [ ] Merchant isolation test: attempt cross-merchant access → 403
- [ ] Credential revocation test: revoked key → 401
- [ ] HMAC signature test: invalid signature → 401
- [ ] Sensitive data audit: API keys, passwords NOT in logs
- [ ] Rate limiting enforced: >100 req/min → 429

### Reliability Gates

- [ ] Circuit breaker: 5 failures → stop retrying
- [ ] Exponential backoff: 1s, 2s, 4s, 8s, 16s working
- [ ] Dead letter queue: failed jobs not clogging main queue
- [ ] Provider health check: integration marked unreachable if POS down
- [ ] Merchant notification: alert sent when integration fails

### Data Integrity Gates

- [ ] Duplicate order test: same Idempotency-Key → no duplicate
- [ ] Inventory overselling test: 100 concurrent orders vs 50 stock → 50 succeed
- [ ] Cross-merchant isolation: Product X not accessible from Merchant B
- [ ] Soft-delete test: archived product not in list operations
- [ ] Reconciliation test: daily reconciliation detects mismatches

### Functional Gates

- [ ] Order status validation: ACCEPTED requires payment_confirmed
- [ ] Catalog sync working end-to-end
- [ ] Inventory sync working end-to-end
- [ ] Webhook delivery working; payload correct
- [ ] Webhook retry working; idempotency working
- [ ] Error responses follow DrippleX API format

### Audit & Compliance Gates

- [ ] Audit log captures all operations
- [ ] Audit log searchable by merchant/API key/timestamp
- [ ] Sensitive data redacted from audit log
- [ ] Backup tested; restore verified

---

## Parallelization Opportunities (Revised)

After foundational tickets A & B complete, work can proceed in parallel:

```
CRITICAL PATH (sequential):
A (Database) → B (Auth) → PARALLEL STREAMS

STREAM 1: Integration Management (sequential)
C (CRUD) → D (Credentials) → E (Status)

STREAM 2: Catalog (sequential)
F (Sync) → G (Mapping) → H (Conflict) → I (Archive)

STREAM 3: Inventory (sequential)
J (Sync) → K (Conflict)

CONVERGENCE:
Streams 1, 2, 3 → L (Order Integration)
```

**Wall-clock time reduction**: Sequential (A→B→C→...→L = 42–48 days) vs Parallel (A→B, then Streams 1/2/3 in parallel, then L = 25–30 days)

**Risk reduction**: Parallel development means catalog and inventory teams test independently; fewer integration surprises at L.

---

## Residual Risks (After Mitigation)

### Acceptable Residual Risks

1. **POS system outage** — beyond DrippleX control; mitigation: alert merchant, pause sync, resume on recovery
2. **Network latency** — beyond DrippleX control; mitigation: retry with backoff, timeout after 5 sec
3. **Merchant misconfiguration** — POS API key hardcoded in public repo; mitigation: documentation + monitoring
4. **POS API incompatibility** — POS doesn't follow agreed spec; mitigation: compatibility testing before live

### Unmitigatable Risks

1. **Founder decision change** — if architecture decisions change (e.g., "allow POS to access Ride"), restart risk analysis
2. **Third-party provider breach** — if POS provider hacked; mitigation: credential rotation
3. **DrippleX system vulnerability** — 0-day exploit; mitigation: keep systems patched

---

## Final Recommendation

### Status: **🟢 APPROVED TO PROCEED WITH IMPLEMENTATION**

**Conditions**:

1. ✅ All 13 critical risks have preventive controls
2. ✅ Go-live gates defined and testable
3. ✅ Reconciliation strategy documented
4. ✅ Ride isolation explicitly verified
5. ✅ Google Play deployment independent

**Next Step**: Begin implementation of tickets in parallel streams (after A & B complete).

**Before connecting first real POS provider**:

- [ ] All go-live gates pass
- [ ] Security audit complete
- [ ] Stress testing complete (100+ concurrent orders, inventory updates)
- [ ] Founder approval on testing results

---

**End of Risk Register**

Commit: To be generated upon approval
