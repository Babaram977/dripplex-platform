# DPX-MKT-INT-001-P1-POS-RULINGS-001 — the POS integration rulings

**Recorded:** 2026-09-14
**Source:** the MKT-INT-001 read-only POS contract audit and the founder/architecture rulings
that followed it.
**Status of this document:** a record of what was decided, and of what the code actually does
about it today. The two are not the same everywhere, and where they differ this document says so.

---

## How to read the status column

Every "implemented" claim below was checked against the repository when this record was written,
not taken from a prior report. That is the standing rule in `CLAUDE.md` §1: a report doc is a
claim, the code is the ground truth. Two rulings are **not** implemented and are marked as such —
recording them as done would be the exact failure that rule exists to prevent.

---

## 1 · Rulings

| #      | Ruling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Status                 | Evidence                                                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **POS does not originate DrippleX orders.** DrippleX is the system of record for order creation; a POS is an operational/fulfilment integration that receives and fulfils orders DrippleX created. This is closed, not deferred — reopening it means deliberately redesigning the customer, pricing, payment, settlement, commission, refund and attribution model, and needs explicit founder approval.                                                                                         | ✅ Implemented         | `POST /integrations/orders/create` is 404 in production; `E2E-056`                                                                                                                                                                                                                    |
| **R2** | **Order polling is the guaranteed integration mechanism.** `GET /integrations/orders/list` and `…/detail/:orderNumber` are the reliable path. DrippleX does not promise guaranteed or 24-hour webhook delivery in this increment, and introduces no queue or background-job infrastructure to satisfy it. A signed HTTPS outbound webhook may follow in Phase 2, **gated on an explicitly approved event and payload contract** — no payload is assumed, including reuse of the §5.2 allow-list. | ✅ Holds               | There is no webhook delivery path anywhere in the backend. Established while scoping B3: the webhook URL is stored, echoed back and GET-tested, and nothing else.                                                                                                                     |
| **R3** | **CRIT-002 is superseded as written.** `CONFIRMED` is the sole precondition for a POS-driven fulfilment transition. `paymentStatus` stays visible to the POS as order-level state, but `PAID` is **not** required — `CASH` and `MERCHANT_DIRECT` orders are legitimately `CONFIRMED` while `paymentStatus = PENDING`. No new payment semantics are introduced; this restates behaviour already in the code. CRIT-002 does not block launch.                                                      | ✅ Implemented         | `E2E-058`, `E2E-059`                                                                                                                                                                                                                                                                  |
| **R4** | **The POS scope vocabulary is exactly six scopes:** `catalog:read`, `catalog:write`, `inventory:read`, `inventory:write`, `orders:read`, `orders:write`. No `integrations:*`.                                                                                                                                                                                                                                                                                                                    | ✅ Implemented         | `integrations-c.controller.ts` — the six defaults, verified                                                                                                                                                                                                                           |
| **R5** | **POS credentials are platform-generated machine credentials.** The merchant does not choose the secret: DrippleX generates it, prefixes it, returns it once, and retains only a one-way hash. **Amended** to record the actual defect rather than a milder version of it — the `OUTGOING_API_KEY` credentials were not merely filtered incorrectly; their AES-GCM storage format is _incompatible_ with the incoming bcrypt verification path, so they could never have authenticated.          | ✅ Implemented         | PR #389 (the "dead POS credential" correction)                                                                                                                                                                                                                                        |
| **R6** | **Authentication responses distinguish authentication from authorization.** A valid credential lacking the required scope receives **403**; an invalid or unknown credential receives **401**. The existing **404** for an unknown or another merchant's order is preserved unchanged — it prevents enumeration by callers who have proved nothing, and is a different control.                                                                                                                  | ❌ **Not implemented** | `E2E-040` in `pos-order-flow.http.spec.ts` is an `it.failing` marker, "[PENDING B6]". A read-only credential is currently refused a transition as **401**, where R6 requires **403**. The marker is self-announcing: it passes while the defect stands and fails the day it is fixed. |
| **R7** | **Deliberately undecided — the POS rate limit.** Today's behaviour is the generic global limit of 100 requests / 60 s **per client IP**. CRIT-005's _">100 requests/min per key"_ is an **alert** criterion, not a limit, and the two must not be conflated. To be decided after the credential model settles.                                                                                                                                                                                   | ⏸ Open by design       | PR #396 documented the limit that actually exists, its IP keying, and the gap below — without choosing a number, which is R7 honoured rather than pre-empted.                                                                                                                         |

### R7's open question has since been sharpened

Correcting the two P1 contracts (PR #396) established two properties of the limit that does exist,
neither of which was documented before:

- **The bucket is keyed on source IP**, not on the credential or integration. Several tills behind
  one restaurant NAT share a single 100/60 s allowance, so a busy merchant can throttle
  themselves — and it would present as the POS integration breaking.
- **It does not deliver what the D plan assigns to rate limiting.**
  `docs/integration-api/DPX-MKT-INT-001-D-IMPLEMENTATION-PLAN.md` §1 requires rate limiting to
  "prevent credential enumeration attacks". An IP-keyed bucket does not: an attacker rotating
  source IPs gets a fresh allowance each time. Meeting that requirement needs a credential-keyed
  limit, which does not exist.

Whoever closes R7 is therefore choosing **two** things — a threshold and a keying — not one.

---

## 2 · Credential policy

| #      | Ruling                                                                                                                                 | Status                                        | Evidence                                                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | 256-bit entropy, via the project's existing `randomBytes(32)` convention rather than a newly invented standard.                        | ✅ Implemented                                | `integrations-c.controller.ts`                                                                                                                                      |
| **P2** | Format `dpx_integration_<random>`, with the misleading zero-entropy suffix removed.                                                    | ✅ Implemented                                | same call site; the superseded format is documented in the comment above it                                                                                         |
| **P3** | 90-day expiry, enforced.                                                                                                               | ✅ Implemented                                | `CREDENTIAL_LIFETIME_DAYS = 90` / `credentialExpiry()` in `credentials.service.ts`                                                                                  |
| **P4** | **Inventory first**, then decide the migration/expiry treatment of existing credentials. Do not automatically invalidate working ones. | ⏸ **Open — the inventory has not been taken** | The four counts in §4 remain ungated-and-unrun. P4 is a decision _to look before deciding_; recording it as settled would assert something untrue about production. |
| **P5** | Explicit rotation only. Never silently replace a live credential.                                                                      | ✅ Implemented                                | `credentials.service.ts` — a second active credential of the same type is refused with 409                                                                          |

---

## 3 · The compatibility rule

Existing working `INCOMING_API_KEY` credentials must keep working until the migration policy is
explicitly decided. Until then, do not:

- automatically convert them,
- silently replace them,
- impose the new prefix on them,
- impose the 90-day expiry on them,
- or invalidate merchant-chosen credentials.

And the dead `OUTGOING_API_KEY` credentials must **not** be treated as working POS credentials
merely because the integration-creation endpoint generated them — per R5, they could never have
authenticated at all.

No credential migration should be designed around the assumption that existing
`OUTGOING_API_KEY` plaintext can safely be recovered and re-hashed. Whether that is even possible
has to be established from the actual storage and decryption path, and from the inventory, before
P4 is chosen.

---

## 4 · The four production counts (read-only, not yet run)

P4 depends on these, and they are deliberately gated. They are aggregate counts only — no
credential hashes, plaintext secrets, or merchant-identifying values are selected by any of them.

1. existing `http://` webhook URLs
2. active `INCOMING_API_KEY` vs `OUTGOING_API_KEY`
3. credentials carrying scopes outside the six approved by R4
4. credentials with no `expiresAt`

The agreed mechanism is that an authorized operator runs the four statements and returns only the
four integers — no new production code, no new privileged endpoint, no exposed database
credentials, no Operations Console change, no deployment and no migration.

**The statement is now written, and verified against the real schema, in
`docs/ops/DPX-MKT-INT-001-P1-POS-P4-INVENTORY-RUNBOOK.md`.** It has been executed only against a
local database migrated to the same schema and seeded to make each predicate prove itself — which
establishes that it is schema-correct and that its filters discriminate, and establishes **nothing
whatever about production's contents**. P4 stays open until an authorized operator runs it there.
No tooling available to an engineering session can reach the production database, and the routes
that would create such access are the ones this mechanism rules out.

**Count 1 has since acquired a second consumer.** PR #398 enforces HTTPS on every webhook write
path while grandfathering existing `http://` rows, and recorded that those rows must be migrated
or explicitly handled _before_ webhook delivery is built. That is the same question as count 1,
arriving from the other direction.

---

## 5 · What is still open

| Item   | Nature                        | Blocked on                                                                    |
| ------ | ----------------------------- | ----------------------------------------------------------------------------- |
| **R6** | Ruled, not implemented        | Engineering work. Pinned by `E2E-040`, which will announce itself when fixed. |
| **R7** | Deliberately undecided        | A founder decision on threshold **and** keying — see §1.                      |
| **P4** | Decision taken, input missing | The four counts in §4.                                                        |
