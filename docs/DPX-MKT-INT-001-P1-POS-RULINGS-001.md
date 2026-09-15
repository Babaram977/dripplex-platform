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

| #      | Ruling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status                                      | Evidence                                                                                                                                                                                                                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | **POS does not originate DrippleX orders.** DrippleX is the system of record for order creation; a POS is an operational/fulfilment integration that receives and fulfils orders DrippleX created. This is closed, not deferred — reopening it means deliberately redesigning the customer, pricing, payment, settlement, commission, refund and attribution model, and needs explicit founder approval.                                                                                                                                                                                                                                                                                                                                                                                                                                 | ✅ Implemented                              | `POST /integrations/orders/create` is 404 in production; `E2E-056`                                                                                                                                                                                                                                         |
| **R2** | **Order polling is the guaranteed integration mechanism.** `GET /integrations/orders/list` and `…/detail/:orderNumber` are the reliable path. DrippleX does not promise guaranteed or 24-hour webhook delivery in this increment, and introduces no queue or background-job infrastructure to satisfy it. A signed HTTPS outbound webhook may follow in Phase 2, **gated on an explicitly approved event and payload contract** — no payload is assumed, including reuse of the §5.2 allow-list.                                                                                                                                                                                                                                                                                                                                         | ✅ Holds                                    | There is no webhook delivery path anywhere in the backend. Established while scoping B3: the webhook URL is stored, echoed back and GET-tested, and nothing else.                                                                                                                                          |
| **R3** | **CRIT-002 is superseded as written.** `CONFIRMED` is the sole precondition for a POS-driven fulfilment transition. `paymentStatus` stays visible to the POS as order-level state, but `PAID` is **not** required — `CASH` and `MERCHANT_DIRECT` orders are legitimately `CONFIRMED` while `paymentStatus = PENDING`. No new payment semantics are introduced; this restates behaviour already in the code. CRIT-002 does not block launch.                                                                                                                                                                                                                                                                                                                                                                                              | ✅ Implemented                              | `E2E-058`, `E2E-059`                                                                                                                                                                                                                                                                                       |
| **R4** | **The POS scope vocabulary is exactly six scopes:** `catalog:read`, `catalog:write`, `inventory:read`, `inventory:write`, `orders:read`, `orders:write`. No `integrations:*`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | ✅ Implemented                              | `integrations-c.controller.ts` — the six defaults, verified                                                                                                                                                                                                                                                |
| **R5** | **POS credentials are platform-generated machine credentials.** The merchant does not choose the secret: DrippleX generates it, prefixes it, returns it once, and retains only a one-way hash. **Amended** to record the actual defect rather than a milder version of it — the `OUTGOING_API_KEY` credentials were not merely filtered incorrectly; their AES-GCM storage format is _incompatible_ with the incoming bcrypt verification path, so they could never have authenticated.                                                                                                                                                                                                                                                                                                                                                  | ✅ Implemented                              | PR #389 (the "dead POS credential" correction)                                                                                                                                                                                                                                                             |
| **R6** | **Authentication responses distinguish authentication from authorization.** A valid credential lacking the required scope receives **403**; an invalid or unknown credential receives **401**. The existing **404** for an unknown or another merchant's order is preserved unchanged — it prevents enumeration by callers who have proved nothing, and is a different control.                                                                                                                                                                                                                                                                                                                                                                                                                                                          | ✅ Implemented                              | PR #401, merged `681f74db`, deployed `c6a668c5` (2026-09-14). The three `it.failing` markers are now plain `it()`. `E2E-041b` additionally asserts that an unknown integration and a wrong key answer **identically — same status and same body** — so the narrowing cannot become an enumeration channel. |
| **R7** | **Ruled 2026-09-14 — the POS rate limit is 500 requests / 60 s, keyed by client IP.** The threshold is set for the intended scale rather than today's merchant count. IP keying is **retained deliberately** as a Phase-1 trade-off, with its consequence accepted and stated rather than discovered later: merchants and tills behind one public IP or CGNAT **share a single bucket**, so this is _500 requests per client IP_, **not** 500 per merchant and not 500 per credential. Rate limiting is an abuse/availability control and is **not** part of the authentication boundary — the POS credential remains that. CRIT-005's _">100 requests/min per key"_ stays an **alert** criterion, not a limit; the two must not be conflated. Do not reopen threshold or keying without concrete evidence of a launch-critical problem. | ✅ Ruled · ⚠️ threshold not yet implemented | PR #396 established the limit that actually exists (100/60 s, IP-keyed). The **code still enforces 100**; raising it to 500 is engineering work this ruling authorises but does not itself perform.                                                                                                        |

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

| Item                | Nature                            | Blocked on                                                                                                                                     |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **R6**              | ✅ Closed                         | — Implemented, merged `681f74db`, deployed `c6a668c5` on 2026-09-14.                                                                           |
| **R7**              | ✅ Ruled · implementation pending | Engineering work only: the ruling sets 500/60 s, the code still enforces **100**. Threshold and keying are settled and should not be reopened. |
| **P4**              | Decision taken, input missing     | The production inventory in §4. **Five output values** — see §4. Requires an authorized operator; unreachable from an engineering session.     |
| **P3 → superseded** | ✅ **Ruled 2026-09-14**           | Superseded by the 99-year lifetime — see §6. Implemented in PR #406. **Existing credentials remain an open decision.**                         |

---

## 6 · P3 superseded — the 99-year credential lifetime

**Ruled 2026-09-14: P3 is superseded by a 99-year credential lifetime.** The conflict and its
resolution are both kept here, because the reasoning is what makes `c4_no_expiry` readable.

|                                       | Position                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P3 (ruled, implemented, deployed)** | Platform-generated integration credentials carry a **90-day expiry**, enforced.                                                                                                                                                                                                      |
| **Ruling 2026-09-14 — supersedes P3** | Credentials are issued with a **99-year validity period**. They remain active unless explicitly revoked or rotated, or the merchant relationship/contract is terminated. **Long-lived, deliberately — not unbounded:** every issued credential still carries a concrete `expiresAt`. |

**99 years is an expiry; `NULL` is not.** That was chosen deliberately and is load-bearing — see
the c4 reading below. Implemented in PR #406; **existing credentials remain a separate open
decision.**

### Where the 90-day rule was encoded (all changed by PR #406 unless noted)

This is not a documentation-only conflict. It is in shipped, deployed code:

| Location                                                           | What it does                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/integrations/services/credentials.service.ts:64` | `export const CREDENTIAL_LIFETIME_DAYS = 90`                                                              |
| `…/credentials.service.ts:66-68`                                   | `credentialExpiry()` — `now + 90 days`                                                                    |
| `…/credentials.service.ts:~225`                                    | **rotation** issues a fresh 90-day expiry                                                                 |
| `…/controllers/integrations-c.controller.ts:167`                   | **issuance** (the C contract path) applies `credentialExpiry()`                                           |
| `…/credentials.service.ts:50-52`                                   | the docstring justifying 90 days, citing CRIT-005                                                         |
| `apps/backend/src/integrations/pos-onboarding.http.spec.ts:367`    | `E2E-004b · a generated credential carries a 90-day expiry` — a test that **fails** if the policy changes |

Supporting documents that would also need reconciling: this file's **P3** row, §2's "impose the
90-day expiry on them", `DPX-MKT-INT-001-P1-POS-LAUNCH-GATE-8H.md:119`, and
`DPX-MKT-INT-001-RISK-MITIGATION-REGISTER.md:343` and `:843` (CRIT-005, "API keys must rotate
every 90 days" / "auto-revoke after 90 days"). CRIT-005 is a **risk-register control**, so
superseding P3 also means restating that control rather than silently contradicting it.

### What this changes about reading c4

**Enforcement already tolerates a null expiry.** Authentication matches
`OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]`, so a credential with no expiry
authenticates today. The new policy is therefore _expressible_ without changing the auth path —
it is **issuance** that forces 90 days.

That has a direct consequence for interpreting the inventory:

- Under P3, every credential issued through the C contract path carries an expiry, so
  **`c4_no_expiry` should be near zero**.
- A materially non-zero `c4_no_expiry` therefore does **not** measure "credentials that predate a
  policy". It measures credentials created through a path that **never applied the expiry** —
  the legacy `createCredential` route, which defaults `expiresAt` to `null`.

So `c4` is a more specific signal than it looks: under P3 it counts policy **bypass**, and under
the new policy it counts the intended steady state. **The same number means opposite things
depending on which ruling governs** — which is precisely why the conflict must be resolved
_before_ the inventory is interpreted, not after.

### How c4 reads under the 99-year ruling

Because issuance still stamps a concrete expiry, **`c4_no_expiry` keeps its meaning**: a row with
`expiresAt = NULL` was not issued under policy — it came through the legacy `createCredential`
path, which defaults the field to `null`. So `c4` counts **policy bypass**, both before and after
the ruling.

Had the ruling been "no expiry at all", `c4` would have become uninterpretable: the intended
state and the bypassed state would count identically. It stays readable precisely because
99 years was chosen over `NULL`.

### Still open: existing credentials

The ruling governs **issuance**. It says nothing about credentials already issued, which keep
their original 90-day expiry. Whether those are left to lapse, extended, or handled
conditionally is a **separate decision**, and extending them would be a production write against
live credentials. PR #406 deliberately changes no existing row.

CRIT-005 (`DPX-MKT-INT-001-RISK-MITIGATION-REGISTER.md:343`, `:843`) still states a 90-day
rotation control. It needs **restating rather than silently contradicting** — not yet done.
