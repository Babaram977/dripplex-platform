# DPX-WALLET-001 — Wallet & Financial Infrastructure Specification

**Status:** Implementation specification. Hand to the developer working on the backend.
**Companion:** `DPX-WALLET-100` (architecture + regulatory decision). This document is the
"how"; that one is the "what and whether".

**Supersedes `DPX-WALLET-100` §2.** That section said the ledger "is already double-entry"
and that the founder's redesign would rebuild what exists. That was measured on
`WalletService.transfer()` alone, which _is_ atomic and paired. Multi-leg flows — ride
settlement, refunds, clawbacks — are **not**, and §1.2 below sets out the evidence. The
founder's call for a transaction header, a chart of accounts and an enforced balancing
invariant is correct. This document specifies it.

---

## 1. Verified baseline

### 1.1 What already exists and must **not** be rebuilt

| Capability               | Where                                                            | Note                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Append-only journal      | `WalletLedgerEntry`                                              | No `update`/`delete`/`upsert` in production code. Snapshots `balanceAfter` on every row.                                               |
| Idempotency by reference | `@@unique([walletId, referenceType, referenceId])`               | Replaying the same logical event is a no-op. This is the mechanism the new layer inherits.                                             |
| Optimistic locking       | `Wallet.version`                                                 | Concurrent mutation safety, with a `withConflictRetry` wrapper in ride payments.                                                       |
| **Escrow primitives**    | `HOLD` / `HOLD_COMMIT` / `HOLD_RELEASE`, `Wallet.pendingBalance` | **This is the authorize → capture → release model the founder's §11–§14 ask for. It is built.** Reuse it; do not invent a second one.  |
| Platform revenue account | `WalletOwnerType.PLATFORM`, `PLATFORM_WALLET_OWNER_ID`           | Commission already lands somewhere real.                                                                                               |
| Webhook signature checks | `PaystackProvider.handleWebhook`                                 | HMAC over the raw body, rejecting on mismatch. `rawBody` is plumbed through the controller correctly. Flutterwave equivalent in place. |
| Card top-up              | `WalletFundingService`                                           | Live, initiate/verify.                                                                                                                 |
| Withdrawal state machine | `WithdrawalRequest`, `WalletPin` (bcrypt)                        | `PENDING → COMPLETED \| FAILED \| CANCELLED`, real debit, admin fulfilment.                                                            |

### 1.2 The real gap — multi-leg events are not atomic and nothing enforces balance

`WalletService.transfer()` applies both legs inside one `prisma.$transaction`. **Ride flows
do not.** `RidePaymentService` composes financial events from _separate_ single-leg calls,
each atomic on its own. The code documents the window itself:

> `apps/backend/src/rides/ride-payment.service.ts` — _"debit-before-credit so a failure
> between the two briefly holds money at the platform (recoverable on retry) rather than
> creating it for the customer out of nothing."_

That ordering is careful and the retry is idempotent, but the consequence stands:

1. **No transaction header.** Legs of one business event are correlated only by the
   `(referenceType, referenceId)` convention. Nothing models the event itself.
2. **No balancing invariant.** Nothing asserts Σ debits = Σ credits. A three-leg ride
   settlement that writes two legs and fails leaves the books unbalanced, and no query
   will tell you.
3. **No chart of accounts.** Wallets exist; clearing, payables, revenue, refund reserve and
   tax accounts do not. Money in flight between DrippleX and a PSP has nowhere to sit.
4. **No reconciliation.** Nothing compares the ledger against PSP settlement reports.

### 1.3 Not built at all

Virtual accounts (repo-wide search for `virtual`/`nuban`/`DVA`: **zero** matches);
automated payouts (`PaystackTransferProvider` throws `NotImplementedException` and is never
called); bank-account name verification (`verifiedAt` exists, nothing writes it); customer
BVN/NIN.

---

## 2. Migration strategy — additive, not a rewrite

**Do not rewrite the wallet.** There is live customer money in it. The new accounting layer
is added _alongside_ `WalletLedgerEntry`, which becomes the wallet-facing projection of the
new ledger rather than the record of truth.

```
Step 1  Create ledger_accounts, ledger_transactions, ledger_entries. Nothing reads them.
Step 2  Dual-write: every WalletService mutation also posts a balanced transaction.
Step 3  Backfill history from WalletLedgerEntry into the new tables.
Step 4  Run reconciliation across both for one full settlement cycle. Must agree.
Step 5  Flip reporting and reconciliation to the new ledger. Wallet balances stay as
        the read projection — the founder's "cached balance for performance".
```

Rolling back is possible at every step until 5. A big-bang cutover of a live money system
is not acceptable.

---

## 3. Schema

### 3.1 `ledger_accounts` — chart of accounts

```sql
CREATE TYPE ledger_account_type AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');

CREATE TABLE ledger_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code  varchar(20)  NOT NULL UNIQUE,
  name          varchar(200) NOT NULL,
  account_type  ledger_account_type NOT NULL,
  owner_type    wallet_owner_type,            -- null for platform-internal accounts
  owner_id      uuid,
  currency      varchar(3)   NOT NULL DEFAULT 'NGN',
  status        varchar(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, currency, account_code)
);
```

Seed accounts:

| Code   | Name                    | Type      | Meaning                                          |
| ------ | ----------------------- | --------- | ------------------------------------------------ |
| 100001 | Customer Wallet         | LIABILITY | Owed to customers. One sub-account per customer. |
| 100002 | Driver Wallet           | LIABILITY | Owed to drivers.                                 |
| 100003 | Merchant Wallet         | LIABILITY | Owed to merchants.                               |
| 200001 | Customer Funds Clearing | ASSET     | Money at the PSP, not yet settled to the bank.   |
| 200002 | Settlement Bank         | ASSET     | Money actually in the partner/trust account.     |
| 200003 | Ride Escrow             | LIABILITY | Fare captured, ride still disputable.            |
| 300001 | Ride Revenue            | REVENUE   | Commission earned.                               |
| 300002 | Bill Payment Revenue    | REVENUE   |                                                  |
| 400001 | Refund Reserve          | LIABILITY |                                                  |
| 400002 | Provider Float          | ASSET     | Prepaid balance at Peyflex and similar.          |
| 500001 | Provider Fees           | EXPENSE   | PSP charges.                                     |

Wallet-owned accounts are created lazily on first use, mirroring how `Wallet` rows are
created today.

### 3.2 `ledger_transactions` — one row per business event

```sql
CREATE TYPE ledger_txn_status AS ENUM ('PENDING','POSTED','REVERSED');

CREATE TABLE ledger_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        varchar(100) NOT NULL,
  transaction_type varchar(50)  NOT NULL,   -- WALLET_DEPOSIT, RIDE_SETTLEMENT, ...
  status           ledger_txn_status NOT NULL DEFAULT 'POSTED',
  currency         varchar(3)   NOT NULL DEFAULT 'NGN',
  description      varchar(500),
  metadata         jsonb,
  reversal_of_id   uuid REFERENCES ledger_transactions(id),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (transaction_type, reference)
);
```

`UNIQUE (transaction_type, reference)` carries forward the idempotency guarantee the
current `(walletId, referenceType, referenceId)` constraint provides — replaying an event
is rejected by the database, not by application logic.

**A posted transaction is never mutated.** Corrections are a new transaction with
`reversal_of_id` set.

### 3.3 `ledger_entries` — the legs

```sql
CREATE TYPE ledger_direction AS ENUM ('DEBIT','CREDIT');

CREATE TABLE ledger_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  account_id     uuid NOT NULL REFERENCES ledger_accounts(id),
  direction      ledger_direction NOT NULL,
  amount         numeric(18,2) NOT NULL CHECK (amount > 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ledger_entries (account_id, created_at);
CREATE INDEX ON ledger_entries (transaction_id);
```

**The balancing invariant, enforced in the database.** Application-level checks get
bypassed; this cannot be.

```sql
CREATE OR REPLACE FUNCTION assert_transaction_balances() RETURNS trigger AS $$
DECLARE d numeric(18,2); c numeric(18,2);
BEGIN
  SELECT COALESCE(SUM(amount) FILTER (WHERE direction='DEBIT'),0),
         COALESCE(SUM(amount) FILTER (WHERE direction='CREDIT'),0)
    INTO d, c
    FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF d <> c THEN
    RAISE EXCEPTION 'Unbalanced transaction %: debits % <> credits %',
      NEW.transaction_id, d, c;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balance
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_transaction_balances();
```

`DEFERRABLE INITIALLY DEFERRED` is the crux: the check runs at **commit**, so all legs of
one transaction are inserted first and evaluated together. An unbalanced write cannot
commit. This is what makes the §1.2 partial-write window structurally impossible rather
than merely unlikely.

### 3.4 `virtual_accounts`

```sql
CREATE TABLE virtual_accounts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id),
  provider             payment_provider NOT NULL,
  provider_customer_id varchar(100),
  provider_account_id  varchar(100),
  bank_name            varchar(100) NOT NULL,
  bank_code            varchar(20),
  account_number       varchar(20)  NOT NULL,
  account_name         varchar(200) NOT NULL,
  currency             varchar(3)   NOT NULL DEFAULT 'NGN',
  status               varchar(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at           timestamptz  NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  UNIQUE (provider, account_number)
);
```

One active account per `(user_id, provider, currency)`, enforced by a partial unique index
on `deleted_at IS NULL`.

### 3.5 `provider_transactions` — webhook idempotency

The founder's §9, and the single most important table for not crediting ₦30,000 on three
retries of a ₦10,000 notification.

```sql
CREATE TABLE provider_transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                payment_provider NOT NULL,
  provider_transaction_id varchar(200) NOT NULL,
  event_type              varchar(100),
  amount                  numeric(18,2),
  currency                varchar(3),
  raw_payload             jsonb NOT NULL,
  ledger_transaction_id   uuid REFERENCES ledger_transactions(id),
  status                  varchar(20) NOT NULL DEFAULT 'PROCESSED',
  received_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id)
);
```

The insert happens **in the same database transaction** as the ledger posting. A duplicate
webhook hits the unique constraint and the whole thing rolls back — no credit, no partial
state. Store `raw_payload` always: it is the evidence in a provider dispute, which is a
lesson already learned on Peyflex (`DPX-PAYBILL-001`).

### 3.6 `reconciliation_runs` / `reconciliation_exceptions`

```sql
CREATE TABLE reconciliation_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start  timestamptz NOT NULL,
  period_end    timestamptz NOT NULL,
  provider      payment_provider NOT NULL,
  ledger_total  numeric(18,2) NOT NULL,
  provider_total numeric(18,2) NOT NULL,
  variance      numeric(18,2) NOT NULL,
  status        varchar(20) NOT NULL,   -- CLEAN | EXCEPTIONS
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reconciliation_exceptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL REFERENCES reconciliation_runs(id),
  kind              varchar(50) NOT NULL,  -- MISSING_IN_LEDGER | MISSING_AT_PROVIDER
                                           -- | AMOUNT_MISMATCH | UNBALANCED_TRANSACTION
  provider_reference varchar(200),
  ledger_transaction_id uuid REFERENCES ledger_transactions(id),
  expected          numeric(18,2),
  actual            numeric(18,2),
  resolved_at       timestamptz,
  resolved_by       uuid REFERENCES users(id),
  note              varchar(1000)
);
```

---

## 4. Worked ledger postings

### 4.1 Deposit — customer transfers ₦10,000 to their virtual account

```
TXN  WALLET_DEPOSIT  ref=PSP-TX-123
  DR  200001 Customer Funds Clearing   10,000
  CR  100001 Customer Wallet (Saeed)   10,000
```

### 4.2 Ride — fare ₦3,000, commission ₦300

**Authorize** (fare reserved, ride not finished). Uses the existing `HOLD` primitive:

```
TXN  RIDE_AUTHORIZE  ref=<rideId>
  DR  100001 Customer Wallet            3,000
  CR  200003 Ride Escrow                3,000
```

**Complete** (dispute window closed):

```
TXN  RIDE_SETTLEMENT  ref=<rideId>
  DR  200003 Ride Escrow                3,000
  CR  100002 Driver Wallet              2,700
  CR  300001 Ride Revenue                 300
```

Three legs, one transaction, balanced at commit. Today this is two independent calls with a
documented gap between them; the deferred constraint closes it.

**Cancelled before completion:**

```
TXN  RIDE_RELEASE  ref=<rideId>
  DR  200003 Ride Escrow                3,000
  CR  100001 Customer Wallet            3,000
```

### 4.3 Bill payment — ₦20,000 KEDCO

**Reserve**, then on the provider's _final_ state:

```
TXN  BILL_RESERVE  ref=<purchaseId>
  DR  100001 Customer Wallet           20,000
  CR  200003 Escrow                    20,000

TXN  BILL_SETTLE   ref=<purchaseId>      (token delivered)
  DR  200003 Escrow                    20,000
  CR  400002 Provider Float            19,700
  CR  300002 Bill Payment Revenue         300

TXN  BILL_REVERSE  ref=<purchaseId>      (provider declared failure)
  DR  200003 Escrow                    20,000
  CR  100001 Customer Wallet           20,000
```

**A provider `UNKNOWN` outcome must not post either settle or reverse.** It stays in escrow
until a human resolves it against the provider dashboard — which is exactly the existing
`UtilitiesService` PENDING policy, and it must survive this migration unchanged.

### 4.4 Withdrawal — ₦10,000

```
TXN  WITHDRAWAL_REQUEST  ref=<withdrawalId>     (available → pending)
  DR  100001 Customer Wallet           10,000
  CR  200004 Withdrawals Payable       10,000

TXN  WITHDRAWAL_SETTLED  ref=<withdrawalId>
  DR  200004 Withdrawals Payable       10,000
  CR  200002 Settlement Bank           10,000

TXN  WITHDRAWAL_FAILED   ref=<withdrawalId>
  DR  200004 Withdrawals Payable       10,000
  CR  100001 Customer Wallet           10,000
```

---

## 5. State machines

**Deposit** — `INITIATED → AWAITING_TRANSFER → CREDITED`, or `→ ABANDONED` on expiry.
Credit occurs **only** on a signature-verified webhook, never on client assertion.

**Withdrawal** — `PENDING → PROCESSING → COMPLETED | FAILED`, plus `CANCELLED` from
`PENDING` only. Money sits in `pendingBalance` for the whole of `PROCESSING`; it returns to
available on `FAILED`. Never destroy the balance at request time (founder §11 — the current
implementation debits at request time, which this changes).

**Ride** — `AUTHORIZED → CAPTURED → SETTLED`, or `AUTHORIZED → RELEASED`.

**Bill** — `RESERVED → SETTLED | REVERSED | UNRESOLVED`. `UNRESOLVED` is terminal until a
human acts.

---

## 6. API contracts

```
GET    /wallet                          balance + currency + limits
GET    /wallet/transactions             paginated statement
GET    /wallet/virtual-account          provision on first call, idempotent
POST   /wallet/deposit                  card path (existing)
POST   /wallet/withdraw                 { amount, bankAccountId, pin }
GET    /wallet/withdrawals[/:id]
POST   /wallet/transfer                 internal book transfer
POST   /wallet/bank-accounts            triggers name enquiry — see §8
POST   /webhooks/paystack               existing, signature-verified
POST   /webhooks/flutterwave            existing, signature-verified
POST   /internal/reconciliation/run
GET    /internal/reconciliation/exceptions
```

Every mutating endpoint requires an `Idempotency-Key` header, stored against the resulting
`ledger_transactions.reference`.

---

## 7. Provider adapter interfaces

Extend the existing ports rather than introducing new vocabulary. `PaymentProviderAdapter`
and `PayoutProvider` already establish the shape.

```ts
export interface VirtualAccountProvider {
  readonly provider: PaymentProvider;
  readonly configured: boolean;
  createVirtualAccount(input: {
    userId: string;
    name: string;
    phone: string;
    email?: string;
    bvn?: string;
  }): Promise<{
    accountNumber: string;
    bankName: string;
    bankCode: string;
    accountName: string;
    providerAccountId: string;
  }>;
  parseCreditWebhook(input: WebhookHandleInput): Promise<VirtualAccountCredit | null>;
}

export interface BankAccountResolver {
  resolveAccountName(input: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{ accountName: string }>;
  listBanks(): Promise<{ name: string; code: string }[]>;
}
```

`PayoutProvider` already exists with the right signatures — implement
`PaystackTransferProvider` against it. **Nothing above leaks a provider's naming into the
ledger.**

---

## 8. Reconciliation

Runs daily per provider, and on demand.

1. **Internal integrity.** Every `ledger_transactions` row has balanced entries. The
   deferred constraint should make this vacuous — assert it anyway; a passing check that
   can never fail still catches a future migration that drops the trigger.
2. **Projection agreement.** For every wallet, stored `availableBalance` equals the balance
   derived from its ledger account. Divergence is a `RECONCILIATION EXCEPTION`.
3. **Provider agreement.** Ledger `Customer Funds Clearing` movements for the period equal
   the PSP's settlement report. Each unmatched item becomes an exception typed
   `MISSING_IN_LEDGER` or `MISSING_AT_PROVIDER`.
4. **Float agreement.** `Provider Float` equals the Peyflex balance read live.

Exceptions surface in Operations. **A non-zero variance is an alarm, not a log line** — the
Peyflex episode is the standing example of a real discrepancy that was invisible for days
because nothing compared anything.

---

## 9. Security requirements

- Idempotency key on every financial mutation; database-enforced, not application-enforced.
- Webhook signature verification — **already implemented**, must not regress.
- PIN on withdrawal — already implemented.
- Name enquiry before a bank account can be saved (see `DPX-WALLET-100` Phase 1a). This is
  the highest-priority item in either document and depends on nothing else here.
- No code outside `WalletService` may write a balance. Enforce with a lint rule or a
  repository boundary.
- Ledger tables: `INSERT` only. Revoke `UPDATE`/`DELETE` from the application role.

---

## 10. Sequencing

| Phase | Work                                                                     | Blocked by                    |
| ----- | ------------------------------------------------------------------------ | ----------------------------- |
| 0     | **Name enquiry on bank accounts.** Ship independently, now.              | nothing                       |
| 1     | Ledger tables + deferred balance constraint + dual-write + backfill (§2) | nothing                       |
| 2     | Reconciliation engine and Operations exception queue                     | Phase 1                       |
| 3     | Virtual accounts, `provider_transactions`, deposit-by-transfer           | **counsel** (`WALLET-100` §4) |
| 4     | Automated payouts via `PaystackTransferProvider`                         | Phase 0 + counsel             |
| 5     | BVN/NIN capture and CBN KYC tiering                                      | counsel                       |

Phases 0–2 are pure engineering hygiene on money that is **already** moving through the
platform, and carry no licensing implication. Phases 3–5 must wait on
`DPX-WALLET-100` §4.

---

## 11. Open questions

1. Which PSP is primary for virtual accounts, and is the fallback provider real at launch
   or deferred? Multi-provider orchestration doubles the reconciliation surface.
2. How long is the ride dispute window before escrow releases to the driver? This is a
   product decision with a direct cash-flow consequence for drivers.
3. Does the founder want the withdrawal debit moved from request-time to
   `pendingBalance` (§5) as part of Phase 1? It is a behaviour change to a live flow.
