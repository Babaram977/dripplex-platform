# DPX-P1-B8 — Authoritative Audit Failure Semantics

**Status: POLICY PROPOSAL FOR FOUNDER DECISION. Evidence and recommendation only. No code
changes. B8 remains HOLD 🔴.**

Third in the series: `…-CLASS-A-AUDIT-WRITE-INVENTORY.md` (`246bdc0`) established the
population, `…-UNBLOCK-DECISION-MATRIX.md` (`53117f0`) recommended phased enforcement. This
answers the question both deferred.

Measured on `b8-sync` @ `002feaf`.

---

## The question

> Should a business operation be considered failed and rolled back when its authoritative
> audit record cannot be committed?

The engineering recommendation from architecture review was **yes for genuinely Class-A
events** — otherwise the audit is best-effort logging wearing an authoritative label. That
reasoning is sound and this proposal accepts it.

**But a single platform-wide "yes" cannot be implemented as stated, and the reason is not
cost.** It is that 79 of the 361 call sites audit events for which atomicity is not merely
expensive but meaningless.

---

## The finding that shapes the policy

Classifying all 361 production call sites by what they record:

| Class | Sites | Examples |
| --- | --- | --- |
| **Success-path events** — something happened and committed | **282** | `ADDRESS_CREATED`, `EMAIL_VERIFIED`, `PAYMENT_INITIALIZED`, `RIDE_CANCELLED`, `ORDER_CANCELLED` |
| **Failure / security events** — something was refused, expired, revoked or failed | **79** | `EMAIL_VERIFICATION_FAILED`, `PHONE_VERIFICATION_FAILED`, `OTP_FAILED`, `REFRESH_FAILED`, `PASSWORD_CHANGE_FAILED`, `VERIFICATION_EXPIRED`, `SESSION_REVOKED` |

### Why the 79 cannot take the same policy

For a failure event **there is no business mutation to be atomic with.** The operation already
failed; nothing was committed. So:

- Binding the audit to "the transaction" is impossible — there isn't one.
- Creating a transaction *solely* to carry the audit write delivers no atomicity guarantee at
  all. Nothing else is in it. That is exactly the "Class-A in form only" pattern already
  rejected, arrived at from the opposite direction.
- Worse, if such an event were ever recorded inside a business transaction that then aborts —
  the natural implementation when auditing a rejected operation — **the audit of the failure
  would roll back with it, erasing the record.** A security audit that deletes its own evidence
  of failed authentication attempts is worse than no audit.

The largest single domain is `auth` at 68 sites, and it is heavily failure-oriented. The most
frequently recorded action in the entire codebase is `REFRESH_FAILED`.

### The second consideration: audit becomes an availability dependency

Under a blanket "yes", the audit table joins the critical path of every audited operation. If
audit writes fail — lock contention on the segment tail, a full disk, a slow index — then
payments fail, rides fail, **and nobody can log in**. All 299 audited operations acquire a
shared dependency that today they do not have.

For payments and KYC that trade is defensible: a payment without an audit record is worse than
a refused payment. For authentication it inverts the intent — the audit exists to record
attacks, and making it a hard dependency turns an audit outage into a platform outage.

---

## Proposed policy

**Two classes, decided by whether the event has a business mutation to be atomic with.**

### Class A — Authoritative. Audit failure fails the operation.

Applies to events recording a **committed change to money, entitlement, or legal/regulatory
state**:

- wallet movements and payouts · payments and settlements · commission and commercial ledger
  entries · KYC decisions · merchant/driver approval, rejection and suspension · order and ride
  state transitions carrying financial consequence · segment lifecycle events

**Semantics:** the audit write joins the business transaction. If it cannot commit, the
operation rolls back. The customer sees a failure rather than an unrecorded movement of money.

**Justification:** for these, an unrecorded change is a worse outcome than a refused one. This
is the case architecture review made, and it holds.

### Class B — Observational. Audit failure is recorded and alerted, never fails the operation.

Applies to **failure, security and telemetry events, and to events with no business mutation**:

- authentication failures, OTP failures, expiries, revocations · rate-limit and lockout events
- CRUD on preferences, addresses, cart, wishlist, notification records
- anything recorded via `recordFailure()`

**Semantics:** written outside the transaction, as today. A failure to write is itself an
alertable incident — it must be loud — but it does not abort the operation, because in most
cases there is no operation left to abort.

**Justification:** atomicity is undefined for these events. Forcing them into transactions
would create transactions that exist only to satisfy a trigger.

### Consequence for enforcement

**B8's trigger, as written, rejects all-NULL writes on `audit_logs` unconditionally.** A
two-class policy therefore requires the enforcement boundary to distinguish the classes —
either by restricting the trigger to Class-A actions, or by giving Class-B writes their own
authoritative fields without transactional binding.

That is a design question for B8's author, and it is the one place this policy touches B8's
implementation. It should be settled **before** the 299-operation programme is scoped, because
it determines whether that programme covers 299 operations or roughly 220.

---

## Recommendation

**Adopt the two-class policy. Answer the founder question "yes, for Class A".**

1. **Class A gets true atomicity.** This is the substance of authoritative audit and the reason
   B8 exists.
2. **Class B stays observational**, with a hard requirement that write failures alert. The
   guarantee is *durability and alerting*, not atomicity.
3. **Record the classification per audit action**, not per domain. The evidence shows domains
   are mixed — `auth` contains both `EMAIL_VERIFIED` (a committed state change) and
   `EMAIL_VERIFICATION_FAILED` (a security event). A domain-level rule would get both wrong.
4. **Do not describe the platform as "Class-A authoritative" until Class-A enforcement is live
   for the Class-A set.** Under phased enforcement there is a window where B8's infrastructure
   is deployed and the guarantee is not.

### What this proposal deliberately does not do

- It does not decide which specific actions are Class A. That list is a product and compliance
  judgement — 295 distinct audit actions exist, and the boundary between "financial
  consequence" and "operational record" is a business call. This proposal fixes the *criterion*
  and leaves the enumeration to be ratified.
- It does not estimate the programme. Scope depends on the enumeration above.

---

## If the founder prefers a single class

Both single-class answers are coherent and should be stated honestly:

| Answer | Consequence |
| --- | --- |
| **Yes, everything** | Audit becomes an availability dependency of authentication. The 79 failure events need synthetic transactions that guarantee nothing. Highest integrity claim, materially worse availability, and a real risk that an audit outage becomes a login outage. |
| **No, nothing** | The trigger must be removed permanently, `append()` becomes optional, and B8 delivers an archive engine over a best-effort log. Cheapest, and honest — but it abandons the property B8 was built for. |

The two-class policy exists because neither single answer survives contact with the 79.
