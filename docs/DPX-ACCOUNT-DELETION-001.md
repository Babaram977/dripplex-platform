# DPX-ACCOUNT-DELETION-001 — Account deletion

**Status:** governing specification. Product and engineering design only — no implementation.
**Founder decision date:** 2026-08-21. The policy in §2 is locked; everything after it is design
serving that policy.
**Blocks:** store submission. Google Play requires a deletion route including a public web URL;
Apple requires in-app deletion under 5.1.1(v). Neither store accepts the app without it — see
`docs/store/DPX-MOBILE-003-STORE-PRIVACY-DECLARATIONS.md` §5, where the Data Safety answer to
"users can request data deletion" is currently **No**.

Nothing in this document exists in code today. A search across `apps/backend/src` and
`apps/super-app/src` for `deleteAccount`, `delete-account`, `account/delete` and
`accountDeletion` returns nothing.

---

## 1. The distinction this whole document rests on

**Account deletion is not destruction of every historical record.**

Conflating the two is how platforms either break their own books or break the law. A deleted
account must stop being a way to reach a person; it must not erase the fact that an order was
placed, a payout was made, or a fraud signal was raised. Three separable things:

|                           | Meaning                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Account closure**       | Access ends. Credentials stop working. The user is no longer reachable through the product.                      |
| **Personal-data erasure** | Identifying fields are deleted or anonymised where no obligation requires keeping them.                          |
| **Regulated retention**   | Financial, transaction, KYC and fraud-prevention records survive, for as long as the law requires and no longer. |

## 2. Policy (locked)

- A user must be able to **initiate** account deletion from inside the app.
- A deletion request is **evaluated against active obligations** rather than executed on sight.
- A **positive withdrawable wallet balance must be settled** before final deletion. The user is
  shown the balance and must withdraw or otherwise settle it; deletion cannot silently consume
  someone's money.
- **Active obligations put the request into a pending or blocked state** rather than rejecting
  it: an order in progress, an active ride, an unresolved refund, a pending payout, a
  rider/driver cash obligation, or an active merchant financial obligation.
- The user may initiate at any time; **final closure happens after obligations settle.**
- At the appropriate closure stage, **access is removed.**
- **Eligible personal data is deleted or anonymised.**
- **Financial, transaction, fraud-prevention, KYC and other legally required records are retained
  only where required.**
- **No deletion request may be blocked indefinitely.** A residual balance the user cannot
  withdraw — below the minimum threshold, or bank details that will not accept it — must not
  become a permanent bar on closing the account. The system must provide a reasonable settlement
  path; where ordinary withdrawal is impossible, the request moves to an alternative resolution
  path rather than sitting in `PENDING_SETTLEMENT` forever.
- **Exact Nigerian statutory retention periods must be confirmed before implementation. Do not
  invent durations.**

## 3. State machine

`AccountDeletionRequest` carries its own lifecycle. It does **not** overload `UserStatus`, which is
part of the locked auth model (`PENDING_VERIFICATION | ACTIVE | INACTIVE | SUSPENDED | BLOCKED`)
and means something different — `SUSPENDED` is a platform action against a user, and deletion is
the user's own choice. Conflating them would make "why is this account inactive?" unanswerable.

```
                    ┌──────────────► CANCELLED  (user changes their mind, any pre-closure state)
                    │
REQUESTED ──────────┼──► PENDING_SETTLEMENT ──► PENDING_REVIEW ──► PROCESSING ──► COMPLETED
    │               │         ▲       │
    │               │         └───────┘  (re-evaluated on each obligation-cleared event)
    │               │
    └───────────────┴──► REJECTED  (ineligible — reason recorded and shown)
```

| State                | Meaning                                                                                 | Exit                                                            |
| -------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `REQUESTED`          | Recorded; obligations not yet evaluated                                                 | Automatic evaluation → next state                               |
| `PENDING_SETTLEMENT` | One or more obligations outstanding. **User keeps full access** so they can settle them | Re-evaluated whenever an obligation-clearing domain event fires |
| `PENDING_REVIEW`     | Ops review required — merchants, riders and drivers only, never plain customers         | Ops approves → `PROCESSING`, or rejects with reason             |
| `PROCESSING`         | Access revoked, erasure/anonymisation job running                                       | Job completes → `COMPLETED`                                     |
| `COMPLETED`          | Erasure done; only retained records remain                                              | Terminal                                                        |
| `REJECTED`           | Cannot proceed — reason recorded and surfaced                                           | Terminal; user may request again                                |
| `CANCELLED`          | Withdrawn by the user before `PROCESSING`                                               | Terminal                                                        |

**Access is revoked on entry to `PROCESSING`, not at `REQUESTED`.** A user sitting in
`PENDING_SETTLEMENT` needs to log in to withdraw their balance. Revoking earlier would trap the
money and make the policy unsatisfiable.

**`PROCESSING` is a point of no return.** Cancellation is available up to that transition and not
after; the UI must say so before the user confirms.

## 4. Obligation checks

Every blocker below maps to a real model. Nothing here is hypothetical.

| Obligation                    | Source of truth                                                  | Blocking condition |
| ----------------------------- | ---------------------------------------------------------------- | ------------------ |
| Withdrawable wallet balance   | `Wallet.availableBalance` where `ownerId = user`, per `currency` | `> 0`              |
| Funds in flight               | `Wallet.pendingBalance`                                          | `> 0`              |
| Withdrawal mid-flight         | `WithdrawalRequest.status = PENDING`                             | any row            |
| Order in progress             | `Order.status` ∉ terminal set                                    | any row            |
| Active ride                   | `Ride.status` ∉ `{COMPLETED, CANCELLED, NO_DRIVERS_FOUND}`       | any row            |
| Unresolved refund             | `Order.status = REFUNDED` pending payout, or `DISPUTED`          | any row            |
| Pending merchant payout       | `OrderSettlement.status = PENDING`                               | any row            |
| Rider/driver cash owed        | `CommissionAccount.outstandingBalance`                           | `> 0`              |
| Merchant financial obligation | `OrderSettlement` `PENDING`/`FAILED`, unresolved disputes        | any row            |

**Terminal order set:** `COMPLETED`, `CANCELLED`, `REFUNDED` (once the refund has actually
settled), `DISPUTED` only once the dispute closes. `DELIVERED` is **not** terminal — settlement
runs after it, so a delivered order can still owe a merchant money.

**`WithdrawalRequest.status = PENDING` deserves care.** The wallet is debited at request creation,
not at completion (`WALLET-004`), so `availableBalance` can read zero while money is still in
flight. A `FAILED` outcome reverses the debit and the balance reappears. Checking only
`availableBalance == 0` would let an account delete while a withdrawal is mid-flight, and a later
reversal would credit a wallet whose owner no longer exists. **Both must be checked.**

Each evaluation stores the _reason set_, not a boolean, so the user can be told what is blocking
them and Ops can see it without re-deriving it.

## 5. Data model (proposed)

```
AccountDeletionRequest
  id                 uuid
  userId             uuid           -> User
  status             AccountDeletionStatus
  requestedAt        timestamp
  requestedVia       enum { IN_APP, WEB, OPS }
  reason             text?          -- optional, user-supplied
  blockingReasons    jsonb          -- last evaluation's reason set
  lastEvaluatedAt    timestamp?
  reviewedBy         uuid?          -> User (ops)
  reviewedAt         timestamp?
  rejectionReason    text?
  accessRevokedAt    timestamp?
  anonymisedAt       timestamp?
  completedAt        timestamp?
  cancelledAt        timestamp?
  retentionExpiresAt timestamp?     -- NULL until §10 is answered
```

One **open** request per user (partial unique index on `userId` where status is non-terminal).
Terminal rows are kept: "this account was deleted, when, and why" is itself a record we need.

## 6. What happens to the data

**Deleted or anonymised.** Direct identifiers on `User` — `firstName`, `lastName`, `email`,
`phone`, `profilePhotoUrl`, `dateOfBirth`, `passwordHash`; `CustomerAddress` rows; `DeviceToken`
rows (push must stop immediately); `AuthSession` rows; `WalletPin`.

Identifiers are **anonymised in place, not row-deleted**, because `Order`, `WalletLedgerEntry` and
`OrderSettlement` carry foreign keys to `User`. Deleting the row would either cascade into the
financial record or leave it dangling. Replace with tombstone values (`deleted-<uuid>@invalid`,
null name) and set a `deletedAt` marker.

**Retained, pending §10.** `Order` / `OrderItem` and their monetary fields; `WalletLedgerEntry`
and `WalletTopUpTransaction`; `OrderSettlement`, `WithdrawalRequest`, `CommissionAccount`
history; `AuditLog`; fraud-prevention signals; `CustomerKyc` / `DriverKyc` / `MerchantKyc`
records and their document images.

**KYC images are the sharpest case.** They sit in Cloudflare R2 and are the most sensitive
artefact we hold — a government ID and a face. They are also exactly what an AML or fraud
investigation would need. Their retention period is a legal question, not an engineering one, and
whatever is decided the deletion job must actually delete the R2 objects when it expires, not just
the database rows pointing at them.

## 7. API contract (proposed)

| Method   | Path                                                | Purpose                                                                                                          |
| -------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/v1/account/deletion`                          | Create a request. Body: optional `reason`. Returns the request with its evaluated `status` and `blockingReasons` |
| `GET`    | `/api/v1/account/deletion`                          | Current request, or 404 if none                                                                                  |
| `DELETE` | `/api/v1/account/deletion`                          | Cancel. 409 once `PROCESSING`                                                                                    |
| `GET`    | `/api/v1/account/deletion/eligibility`              | Dry run — what would block, without creating a request                                                           |
| `GET`    | `/api/v1/operations/account-deletions`              | Ops queue                                                                                                        |
| `POST`   | `/api/v1/operations/account-deletions/{id}/approve` | Ops approval → `PROCESSING`                                                                                      |
| `POST`   | `/api/v1/operations/account-deletions/{id}/reject`  | Requires a reason                                                                                                |

`eligibility` exists so the UI can show the balance and the blockers **before** the user commits,
which the policy requires. It must be a real evaluation, not a guess the UI assembles itself.

## 8. Public web route

Google Play requires a deletion route reachable **without installing the app**. Two pages on
`customer-web`, which already serves `/privacy` and `/terms`:

- `/account-deletion` — what deletion means, what is erased, what is retained and why, how long it
  takes, and how to start it. This is the URL that goes in the Play Console.
- `/account-deletion/request` — an authenticated request form for users who no longer have the app
  installed. Same backend endpoint, `requestedVia = WEB`.

Also needed: `/contact`. `docs/store/GOOGLE-PLAY.md` and `APP-STORE.md` both list
`https://dripplex.com/contact` as the support URL and **no such route exists** in customer-web.

## 9. User messaging

The tone the policy implies: deletion is the user's right, obligations are explained rather than
used as an excuse, and nothing about their money is hidden.

- **Blocked on balance** — show the amount. "You have ₦12,400 in your DrippleX wallet. Withdraw it
  before we can close your account." with a direct withdraw action.
- **Blocked on activity** — name it. "You have 1 order in progress. We'll continue with your
  request once it's delivered." Not a generic failure.
- **Confirmation before `PROCESSING`** — state plainly what is erased, what is kept and why, and
  that it cannot be undone from this point.
- **Completion** — confirm by email before the address is anonymised. Sequencing matters: send
  first, anonymise second, or the confirmation is unsendable.

## 10. Gated on legal review — do not implement until answered

Two questions, both requiring legal input, both deliberately unanswered here rather than guessed.

### 10a. Residual balances that cannot be withdrawn

**Founder decision 2026-08-21: no indefinite deletion block.** The mechanism is not decided.

`PENDING_SETTLEMENT` must not be a trap. When a balance cannot clear by ordinary withdrawal, the
request needs somewhere else to go. Candidate mechanisms, none approved:

- assisted payout — Ops pays out manually against corrected details;
- transfer to another verified account holder nominated by the user;
- forfeiture after notice, **only where legally permitted**;
- escheatment or an equivalent unclaimed-funds route.

Each carries financial and legal consequences. Forfeiture in particular is not a default we can
adopt because it is convenient: taking a user's money on account closure has to be lawful,
disclosed in the terms before they act, and defensible if challenged. **This must be resolved,
with legal review, before implementation begins.**

### 10b. Retention periods

**Do not implement §6 retention until this is answered.** Deliberately unanswered here rather than
guessed.

The review needs to cover, together rather than separately:

1. **How long we must keep** — CBN and financial-services record-keeping; AML/CFT obligations on
   KYC and transaction records; tax and accounting retention on `Order`, `OrderSettlement`,
   `WalletLedgerEntry`.
2. **How fast we must delete** — NDPA 2023 grants data subjects a right to erasure with defined
   exceptions. Retention obligations are the exception, not a blanket exemption; anything outside
   them must actually go.

Both questions land on the same fields, so answering one without the other produces a policy that
fails the other. Output should be a per-category retention period, which becomes
`retentionExpiresAt` and a scheduled purge.

## 11. Edge cases

| Case                                    | Handling                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merchant with live listings             | Deactivate listings at `PROCESSING`; block while payouts are `PENDING`                                                                               |
| Rider owing platform cash               | `CommissionAccount.outstandingBalance > 0` blocks; user is told the amount                                                                           |
| Multi-persona account                   | One `User`, several roles. **All** roles' obligations must clear — a customer who is also a merchant cannot delete around a pending payout           |
| Suspended or blocked user               | May still request deletion. Suspension is our action; erasure is their right. Fraud-related retention still applies                                  |
| Residual balance that will not withdraw | **Must not block indefinitely** (§10a). Falls to the alternative resolution path once that mechanism is decided; until then, implementation is gated |
| User re-registers with the same phone   | Phone is anonymised at `COMPLETED`, freeing the unique constraint. A new account is genuinely new — no history carries over                          |
| Deletion during an active ride          | Blocks. Cancelling a stranger's ride mid-journey is not an acceptable side effect                                                                    |
| Request while already `PROCESSING`      | 409                                                                                                                                                  |
| Withdrawal fails after `COMPLETED`      | Must be impossible — `WithdrawalRequest.status = PENDING` blocks entry to `PROCESSING`                                                               |
| Ops rejects                             | Reason recorded and shown; user may request again                                                                                                    |

## 12. Audit trail

Every transition writes an `AuditLog` row: actor (user or Ops), from-state, to-state, evaluated
blocking reasons, timestamp. This is a regulated action on someone's data and money — the record
of _why_ an account closed must outlive the account, and `AuditLog` is already retained under §6.

## 13. Acceptance criteria

1. A user can initiate deletion from inside the app, and from the web without the app installed.
2. `eligibility` returns the real balance and the real blocker set before any request is created.
3. A positive `availableBalance`, a non-zero `pendingBalance`, or a `PENDING` `WithdrawalRequest`
   puts the request in `PENDING_SETTLEMENT` — never `COMPLETED`.
4. A user in `PENDING_SETTLEMENT` retains enough access to settle what is blocking them.
5. Clearing the last obligation re-evaluates automatically; no Ops action needed for a plain
   customer with nothing outstanding.
6. Access is revoked exactly on entry to `PROCESSING`.
7. Cancellation works in every pre-`PROCESSING` state and returns 409 after.
8. At `COMPLETED`: identifiers anonymised, device tokens gone, sessions revoked, push stops.
9. At `COMPLETED`: `Order`, `WalletLedgerEntry`, `OrderSettlement` and `AuditLog` rows still exist
   and still reconcile. **Financial totals before and after deletion must match exactly.**
10. The completion email is sent before the address is anonymised.
11. Every transition is in `AuditLog` with its blocking-reason set.
12. The Play Console deletion URL resolves and explains erasure versus retention.
13. **No request can remain in `PENDING_SETTLEMENT` indefinitely.** Every blocking reason has
    either a user-actionable resolution or an Ops-actionable one; a residual balance below the
    withdrawal threshold must reach a terminal state by some path (§10a).
14. Play Data Safety "users can request data deletion" can be answered **Yes**.

## 14. Open questions for the founder

1. **Ops review for merchants, riders and drivers** — assumed above. Should a plain customer with
   no obligations complete automatically, or does every deletion get human review?
2. **Grace period.** Many platforms hold 14–30 days between `PROCESSING` and irreversible
   erasure, to absorb regret and account-takeover-driven deletions. Not in the policy as stated.
   Worth adding?
3. **Merchant with an active storefront and customers mid-order** — notice period before delisting?

**Resolved since the first draft:** a wallet balance that cannot be withdrawn must never block
deletion permanently (founder decision 2026-08-21). The mechanism that replaces the block is still
open, and is now tracked in §10a where it gates implementation alongside retention.
