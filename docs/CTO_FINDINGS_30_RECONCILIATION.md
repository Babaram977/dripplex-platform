# CTO FINDINGS — 30-ITEM RECONCILIATION

**Authority:** Nora, CTO, DrippleX  
**Date:** 2026-09-05  
**Status:** Phase 0 remediation register  
**Implementation:** BLOCKED pending Phase 0 exit

This register reconciles the CTO review into exactly **30 unique findings**. The items are implementation requirements, not optional recommendations.

## P0 — Blocking Findings

1. **HMAC key contradiction** — the credential rotation plan must use the actual secret as the HMAC key; a hash/fingerprint cannot substitute for the secret.
2. **Secret-bearing idempotency replay** — generated secrets must never be stored inside durable idempotency response bodies.
3. **Plaintext secret response policy** — ordinary API responses and subsequent GET/replay operations must never expose plaintext credentials.
4. **Credential encryption/key management gap** — durable encrypted secrets require an explicit KMS-backed key hierarchy, nonce/authentication-tag handling, and key versioning.
5. **Durable inbox/outbox missing** — external events require PostgreSQL-backed durable Inbox/Outbox state and recovery semantics.
6. **Durable idempotency authority** — Redis cannot be the sole correctness mechanism for idempotency.
7. **Request fingerprinting** — idempotency keys must be bound to a deterministic request fingerprint; same key with different payload is a conflict.
8. **Replay protection** — signed webhook requests require timestamp validation and durable event-ID deduplication.
9. **Tenant isolation** — authenticated integration identity must bind every operation to exactly one merchant tenant.
10. **SSRF/egress controls** — merchant webhook destinations require private-network blocking, DNS/rebinding protection, redirect controls, and controlled egress.
11. **Order state machine** — order status updates require explicit legal transitions and rejection of backwards/impossible transitions.
12. **Inventory versioning/order protection** — stale inventory updates must not overwrite newer state.
13. **Financial authority boundary** — POS integrations cannot directly create, alter, settle, reverse, or ledger financial state.
14. **Webhook retry/DLQ architecture** — outbound failures require durable retry state, bounded backoff, circuit protection, and dead-letter recovery.

## P1 — Required Before Production

15. **Integration event model** — all integration events require stable IDs, types, versions, timestamps, source, tenant/integration binding, and correlation data.
16. **Per-integration circuit breakers** — one failing merchant/provider must not exhaust shared worker resources.
17. **Integration health model** — connection state, last success, failure counts, retry state, and suspension/degradation must be observable.
18. **Correlation identifiers** — request, correlation, event, delivery, merchant, integration, and domain identifiers must be traceable across the lifecycle.
19. **Dedicated SKU mapping** — external POS SKUs require a dedicated mapping model rather than assuming one global Product field can represent every integration.
20. **API/event versioning** — externally consumed contracts require explicit versioning and compatibility rules.
21. **POS certification gate** — a provider must pass authentication, security, reliability, integrity, and recovery tests before production access.
22. **Observability/metrics** — integration SLOs, error rates, latency, queue depth, retries, DLQ counts, and circuit state must be measurable.
23. **Disaster recovery/replay** — durable integration state must support recovery, replay, and operational reconstruction without duplicating business effects.
24. **Credential lifecycle/key governance** — credential states, overlap, expiry, emergency revocation, rotation concurrency, and encryption-key versioning require explicit operational rules.

## P2 — Evolution / Hardening Findings

25. **Partner SDK** — SDKs should encapsulate authentication, signing, retry, idempotency, and protocol correctness after the contract is stable.
26. **Advanced conflict-resolution tooling** — merchant-facing conflict diagnosis and resolution should be added after the core consistency model is proven.
27. **Automated reconciliation dashboards** — operational reconciliation views should follow durable event and domain-state foundations.
28. **Additional POS providers** — provider expansion must follow certification rather than bypassing the common contract.
29. **Advanced integration analytics** — deeper business analytics are deferred until operational telemetry is reliable.
30. **SLO/latency contract** — integration performance must be defined using measurable P50/P95/P99 SLOs rather than unsupported hard latency guarantees.

## Traceability to Phase 0

| Findings | Primary Phase 0 contract |
|---|---|
| 1–4, 24 | Credential Lifecycle; HMAC/Replay |
| 5–8, 14, 23 | Inbox/Outbox; Idempotency; Event Schema |
| 9 | Tenant Isolation |
| 10 | SSRF/Egress |
| 11–12 | Event Schema / domain transition contracts |
| 13 | Threat Model / Trust Boundaries |
| 15, 18, 20, 30 | Event Envelope / Event Schema |
| 16–17, 22 | Rate Limits / Audit / operational supporting specification |
| 19 | Event Schema / supporting SKU contract |
| 21, 25–29 | Phase 0 acceptance criteria and post-freeze roadmap |

**Count verification: 30 unique findings, numbered 1–30 with no gaps.**
