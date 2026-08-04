# Wallet Slice 4 — Withdraw Design Note

Written before implementation, per the same "design note before code" discipline as
`RIDE-002.7-WALLET-PAYMENT-DESIGN.md`. Documents what actually exists, the gaps found,
and the decisions locked before writing any schema or service code.

## Reality audit (verified before writing code)

**`WalletService.withdrawal()`** already exists and is directly reusable — it debits the
wallet and records a `WITHDRAWAL`-typed `WalletLedgerEntry`, using the same
optimistic-locked, reference-idempotent `mutateAndEmit` path as every other mutation.
What's missing is everything around it: no bank-account-linked request/approval state
machine, no way for a customer to name a destination account, no PIN gate, no status to
track. This was flagged as an explicit follow-up in the RIDE-002.7 design note.

**`BankAccount` is merchant-only.** Its one FK is `merchantId → User.id`, its unique
constraint is `[merchantId, accountNumber]`, and its only consumer today is merchant
payout configuration. It has no `verifiedAt`-backing verification call anywhere (the
field exists but nothing ever sets it) — merchant bank accounts are also currently
self-attested, not provider-verified. Reusing this model for customer withdrawal
accounts would conflate two different ownership semantics (a merchant's payout account
vs. a customer's withdrawal destination) under one table. **Decision: a new
`CustomerBankAccount` model**, not a generalization of `BankAccount` — same shape,
separate table, so each stays simple and neither's constraints leak into the other.

**No bank-account verification API is integrated anywhere in the platform.** Paystack's
account-resolve endpoint (or equivalent on Flutterwave/Moniepoint) is not called by any
existing code — `PaymentProviderAdapter` only exposes `initializePayment`/
`verifyPayment`/`handleWebhook` (charge collection, confirmed in the RIDE-002.7 audit).
**Decision: Phase 1 ships self-attested bank accounts** (customer types bank name,
account number, account name — no server-side name-matching), the same trust level
merchant `BankAccount` already operates at in production today. This is a real,
documented limitation, not something this slice hides.

**No PIN infrastructure exists anywhere.** The one prior PIN mention in the codebase is
`RideTripService`'s "no mandatory passenger OTP/PIN before ride start" — an explicit
decision _against_ a PIN, unrelated to Wallet. There is no `WalletPin` model, no
set/verify flow, nothing to build on. **Decision: build it for real** — a new
`WalletPin` model, bcrypt-hashed (reusing `AppConfigService.bcryptSaltRounds`, the same
config the password flows already use), gating withdrawal creation. Slice 5 (Security)
owns the "change PIN" UI on top of the set/verify primitives this slice creates.

**No payout provider exists.** Confirmed in the RIDE-002.7 audit and re-confirmed here:
`PaymentProviderAdapter` has no transfer/payout method, and no provider adapter
implements one. Building a real, working bank transfer integration requires real
Paystack/Flutterwave/Moniepoint transfer-API credentials, which — like every other
gateway path in this environment (Top Up, Ride gateway payment, Marketplace checkout) —
are not configured here. **Decision, matching the founder's own phasing request:**

- **Phase 1** ships the complete real customer-facing flow — bank account linking, PIN
  gate, withdrawal request creation with real balance validation and a real debit at
  request time, and real status tracking — plus a real **admin manual-completion path**
  (list pending requests, mark completed with a reference note, or mark failed with a
  reason that reverses the debit). This mirrors how early-stage Nigerian fintechs
  actually operate before their payout API integration goes live: withdrawals are real
  money movements inside the platform, fulfilled manually by ops until Phase 2's
  automation lands. It is a real, usable feature end-to-end in this environment, not a
  stub that silently does nothing.
- **Phase 2** adds the `PayoutProvider` interface and a `PaystackTransferProvider`
  adapter implementing it, following the exact `MoniepointProvider`/`OpayProvider`
  precedent: a real class, real constructor/DI wiring, real method signatures, that
  throws `NotImplementedException` until real transfer-API credentials are configured.
  When credentials arrive, only the provider's internals change — the request/status
  model built in Phase 1 does not.

## Data model

```
CustomerBankAccount
  id, userId (→ User), bankName, bankCode, accountName, accountNumber,
  isDefault, createdAt, deletedAt (soft delete)
  @@unique([userId, accountNumber])

WalletPin
  userId (→ User, PK), pinHash, createdAt, updatedAt

WithdrawalRequest
  id, userId (→ User), walletId (→ Wallet), bankAccountId (→ CustomerBankAccount),
  amount, currency, status (PENDING | COMPLETED | FAILED | CANCELLED),
  failureReason, adminNote, processedByUserId, processedAt,
  createdAt, updatedAt
```

`WithdrawalRequest.id` is the `referenceId` passed to `WalletService.withdrawal()` /
`WalletService.credit()` (reversal), so debit-at-creation and refund-on-failure are both
idempotent — retrying a failed admin action cannot double-move money, matching the
`WalletLedgerEntry` uniqueness constraint every other mutation already relies on.

**Balance movement timing:** the wallet is debited **at request creation**, not at
completion. This mirrors real bank-transfer UX (money leaves your available balance the
moment you initiate a transfer, before it lands) and — more importantly — prevents a
customer from spending the same naira twice while a withdrawal is pending. A `FAILED`
outcome reverses the debit via a real `WalletService.credit()` call referencing the same
`WithdrawalRequest.id`.

**No `RideType`-style enum needed** — `WithdrawalRequestStatus` is a new enum, additive
migration, no interaction with any existing enum.

## API surface

```
GET    /customer/wallet/bank-accounts            list
POST   /customer/wallet/bank-accounts             add
PATCH  /customer/wallet/bank-accounts/:id/default set default
DELETE /customer/wallet/bank-accounts/:id         remove

GET    /customer/wallet/pin/status                { hasPin: boolean }
POST   /customer/wallet/pin                       set PIN (first time only)
POST   /customer/wallet/pin/verify                verify PIN (used before withdrawal)

POST   /customer/wallet/withdrawals                create request (amount, bankAccountId, pin)
GET    /customer/wallet/withdrawals                list (paginated, own requests only)
GET    /customer/wallet/withdrawals/:id            detail

GET    /admin/wallet/withdrawals?status=PENDING    admin queue
POST   /admin/wallet/withdrawals/:id/complete       mark completed (adminNote)
POST   /admin/wallet/withdrawals/:id/fail           mark failed (reason) — reverses debit
```

New permissions: `customer:wallet:withdraw`, `admin:wallet:withdrawals:manage` (added to
`WALLET_PERMISSIONS`, gated the same way every other wallet endpoint already is).

## DPX-UX-001 application

Withdraw is money movement — per the standing principle, it gets an explicit confirm
step (same pattern as Transfer in Slice 2): entering an amount and picking a bank
account does not withdraw anything until a distinct "Confirm withdrawal" step, PIN
entry included in that step rather than as a separate screen (reduce taps — one
confirmation surface, not two). Setting a PIN for the first time is the one exception
that gets its own short flow, since a PIN is being created, not just checked.

## Out of scope for this slice

- Real bank-account-number verification (flagged above, needs a real provider API call
  Phase 2 doesn't add either — it's a separate capability from transfers).
- Real automated payout (Phase 2 ships the interface + stub only, per the
  no-sandbox-credentials constraint documented across every other gateway path in this
  environment).
- Withdrawal limits/fraud rules beyond "amount ≤ available balance" — no such policy has
  been specified by the founder yet; not invented here.
