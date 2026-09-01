# DPX-WALLET-100 — Integrating the DrippleX Wallet with the Nigerian Banking System

**Status:** Decision note. Architecture direction locked by the founder (2026-09-01);
regulatory position **open** and requiring Nigerian fintech counsel before any code lands.

**Purpose.** Records the verified state of the wallet today, the founder's chosen
architecture, and the gaps between them — so the licensing question is settled before
implementation rather than discovered during it.

---

## 1. Verified baseline (read from the code, 2026-09-01)

Everything in this section was confirmed against the repository, not against a prior
report. Where a claim is about absence, the search that established it is named.

### What works today

**Money in — card top-up, live.** `WalletFundingService` (`apps/backend/src/wallet/wallet-funding.service.ts`)
runs an initiate/verify pair against a `PaymentProviderAdapter`. `PaystackProvider` and
`FlutterwaveProvider` are real implementations. `MoniepointProvider` and `OpayProvider`
are stubs that throw `NotImplementedException`.

**The ledger.** `Wallet` carries `availableBalance`, `pendingBalance`, and a `version`
column used for optimistic locking. `WalletLedgerEntry` records `type`, `amount`,
`direction`, `balanceAfter`, `referenceType`, `referenceId` and `metadata`, under a
unique constraint on `(walletId, referenceType, referenceId)` that makes every mutation
idempotent by reference.

**Money out — real state machine, manual fulfilment.** `WithdrawalRequest`
(`PENDING → COMPLETED | FAILED | CANCELLED`) with a bcrypt-hashed `WalletPin` gate, real
balance validation, and a real debit at request time. An admin completes it with a
reference or fails it with a reason that reverses the debit.

### What does not exist

| Gap                                                    | How it was confirmed                                                                                                                                                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Virtual account numbers (dedicated NUBAN per user)** | A repo-wide search for `virtual`, `dedicated account`, `DVA`, `nuban` across `apps/backend/src` returns **zero** matches. Nothing exists.                                                                                                          |
| **Automated payouts**                                  | `PaystackTransferProvider` (`apps/backend/src/wallet/payout/paystack-transfer.provider.ts`) is a real class with real DI wiring whose every method throws `NotImplementedException`. It is not called by `WithdrawalService`.                      |
| **Bank-account verification**                          | `BankAccountsService` stores a self-attested `bankName`, `bankCode`, `accountName`, `accountNumber`. No account-resolve call exists anywhere in the platform. The merchant `BankAccount` model has a `verifiedAt` column that no code ever writes. |
| **Customer BVN/NIN capture**                           | Not built. Driver KYC is a separate, admin-reviewed flow (`DPX-DRIVER-002`) and is not a CBN wallet-tier mechanism.                                                                                                                                |
| **Any recorded licensing position**                    | No document under `docs/` states one.                                                                                                                                                                                                              |

---

## 2. The ledger — partly right, and corrected in DPX-WALLET-001

> **Revised 2026-09-01.** This section originally concluded the ledger "is already
> double-entry" and needed no work. That was measured on `WalletService.transfer()`, which
> is genuinely atomic and paired — but multi-leg flows (ride settlement, refunds,
> clawbacks) are assembled from separate single-leg calls with a documented window between
> them, and nothing enforces that debits equal credits. The conclusion below is too strong.
> **`DPX-WALLET-001` §1.2 supersedes it** and specifies the transaction header, chart of
> accounts and deferred balancing constraint that close the gap. What follows remains
> accurate about what exists; it was wrong about what that is sufficient for.

The founder's note proposed replacing a pattern described as:

```
customer.balance -= 3000
driver.balance   += 2700
```

> "without an immutable accounting trail"

**That is not what the code does, and has not been.** Recording it as the baseline would
mean rebuilding something that already exists. The evidence:

- **Transfers write paired entries.** `WalletService.transfer()`
  (`apps/backend/src/wallet/wallet.service.ts:204`) mints a single `reference` UUID and
  applies a `DEBIT` on the source and a `CREDIT` on the destination inside one
  `prisma.$transaction`. The code comments the intent directly: the reference is minted
  centrally _"so neither side's row is the 'real' one — a dispute is about a single event
  with two halves."_
- **The ledger is append-only.** No `walletLedgerEntry.update`, `.delete` or `.upsert`
  call exists in production code; the only `deleteMany` calls are test-fixture cleanup.
- **Every entry snapshots `balanceAfter`**, so the balance is reconstructible and any
  divergence between the stored balance and the ledger is detectable.
- **Commission is booked, not dropped.** `WalletOwnerType` includes `PLATFORM`, with a
  sentinel `PLATFORM_WALLET_OWNER_ID`, used in six places in
  `apps/backend/src/rides/ride-payment.service.ts`. The founder's ₦300 revenue leg has a
  wallet to land in today.

**Where the founder's instinct is right, and it is important:** _segregation is not a
ledger property._ A flawless double-entry ledger can sit on top of a single company
current account holding customers' money commingled with operating funds. The ledger says
who is owed what; it says nothing about where the cash physically is or whose creditors
can reach it. **That is a banking and licensing arrangement, and it is genuinely
unresolved.** It is the real substance of the concern, and section 4 treats it as such.

---

## 3. Architecture — locked

Partner-led (**Option A**). DrippleX does not become a bank. Three layers:

```
Layer 1   DrippleX wallet + double-entry ledger      (built)
Layer 2   Regulated PSP — virtual accounts,          (partially built:
          collections, transfers, settlement          collections yes,
                                                      the rest no)
Layer 3   Nigerian banking rails — banks, NIP/NIBSS  (reached only via Layer 2)
```

DrippleX never touches NIP/NIBSS directly. It talks to a licensed PSP; the PSP's licence
and its partner bank carry the regulated money movement.

**Design constraint carried forward:** the ledger must not encode any one PSP's
vocabulary, so a later move to a different partner — or to DrippleX's own licence —
changes adapters, not the wallet. The existing `PaymentProviderAdapter` /
`PayoutProvider` split already establishes this shape and should be preserved.

---

## 4. The open regulatory question — blocking

**Where does customer money legally sit, and whose is it if Afnan Homes has a bad month?**

Today, card top-ups settle to a platform-level account. Customers hold a claim recorded in
the DrippleX ledger. Whether those funds are segregated from operating funds, and under
what legal structure, is **not documented and not decided**.

This must be answered by Nigerian fintech counsel, not by engineering. It determines:

1. Whether customer funds sit in a **trust / pooled settlement account** ring-fenced from
   Afnan Homes' operating money.
2. Which **CBN licence category** applies, and whether the PSP's licence covers DrippleX's
   activity or DrippleX needs its own. Broadly: a PSSP may not hold customer funds; an MMO
   may. Categories and thresholds change — treat this sentence as a prompt for counsel,
   **not** as a statement of current law.
3. **KYC tiering** — CBN tiers wallet limits against identity evidence (BVN/NIN). Nothing
   in DrippleX collects this from customers today, so tier limits cannot currently be
   enforced.
4. AML/CFT monitoring, reporting and record-keeping obligations.

**Nothing in Phase 2 or Phase 3 below should be built before this is answered**, because
the answer changes what is built. Phase 1 is deliberately independent of it.

---

## 5. Phasing

### Phase 1 — Safe now, no licence implication, no partner agreement

**1a. Resolve the account name before saving a bank account.** _Highest priority._

Today a customer can typo a digit and save it. The only thing catching that is the manual
admin step — which Phase 2 removes. Automating payouts over self-attested account numbers
sends real money irreversibly to strangers. `BankAccountsService` already carries
`bankCode` and does nothing with it; `verifiedAt` already exists unused. This is a small,
contained change and **must land before any payout automation**.

**1b. Reconciliation check.** A scheduled job asserting that every wallet's stored balance
equals the sum of its ledger entries, alarming on divergence. The ledger already makes
this computable; nothing computes it.

### Phase 2 — Requires the section 4 answer

- Virtual accounts (dedicated NUBAN per customer) so funding works by bank transfer from
  any Nigerian bank — materially cheaper than card fees and how most Nigerians actually
  move money. Inbound credits arrive by webhook and credit the wallet.
- BVN/NIN capture and CBN KYC tiering, with enforced per-tier limits.
- Automated payouts: implement `PaystackTransferProvider` against the real Transfer API
  and call it from `WithdrawalService`. The Phase 1 request/status model does not change —
  only the provider's internals, exactly as `WALLET-004` anticipated.

### Phase 3 — Only if the wallet becomes the business

DrippleX pursues its own CBN authorisation. Regulatory capital, compliance function,
AML/CFT, safeguarding, audit and reporting. Out of scope for launch.

---

## 6. Non-goals

- Direct NIBSS/NIP integration by DrippleX. Reached through the PSP.
- Replacing the wallet ledger. It is sound (section 2); it gets a reconciliation check,
  not a rewrite.
- Treating a PSP's product naming as a DrippleX domain concept.

---

## 7. Founder decisions required

1. **Counsel engaged on section 4** — the blocking item.
2. **Which PSP** for virtual accounts and transfers, and whether the same one serves both.
3. **Segregation structure** for customer funds, once counsel advises.
4. Confirm Phase 1a may proceed immediately — it is independent of all of the above.
