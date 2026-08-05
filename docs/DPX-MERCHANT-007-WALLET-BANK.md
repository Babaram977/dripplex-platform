# DPX-MERCHANT-007 — Wallet & Bank

## 1. Scope

Founder-locked requirements (verbatim, from the DPX-MERCHANT-007 instruction):

> The Wallet page must be transparent. For every completed settlement the
> merchant should be able to understand: Current wallet balance; Settlement
> status; Order reference; Gross merchandise subtotal; Commission rate
> applied; DrippleX commission amount; Net merchant settlement; Settlement
> date/time; Ledger history. The merchant should never have to guess: "Why
> did I receive ₦9,000 instead of ₦10,000?" The screen should answer that
> directly.
>
> Bank section: Use the existing backend capability only. Show: Linked
> bank account(s); Verification/status where available; Whether a bank
> account exists; Clear indication that this is the settlement destination
> (where supported by the backend). Do not invent withdrawal workflows if
> they are not implemented.

This is built on top of the already-approved DPX-MERCHANT-002 net-settlement
model (`OrderSettlement` + Wallet/Ledger). Per the founder's decision on the
DPX-COMMERCIAL-001 proposal ("Option 1 should stay"), this screen does
**not** implement the commission-owed/credit-limit model — that remains a
separately-scoped, deferred proposal. The founder's "pay merchant's bank
directly + upload receipt + commission debit" idea is also a separate,
not-yet-scoped feature — not built here.

## 2. Backend — new read-only capability

Two gaps existed: there was no merchant-facing settlement list, and no
merchant-facing wallet ledger endpoint (unlike `DriverWalletController`,
which already exposes `GET /driver/wallet/transactions`). Both are
read-only extensions of already-existing, already-approved architecture —
no new financial mutation, no new business logic.

- **`OrderSettlementDto`** (`packages/types`) gained `orderNumber: string`,
  joined in from `Order.orderNumber` so the merchant never has to look up a
  raw order UUID. `toOrderSettlementDto()` (`order.mapper.ts`) now takes the
  order number as a second parameter — its only prior definition was never
  called by any controller (confirmed via grep before changing the
  signature), so this was a safe, non-breaking change.
- **`MerchantSettlementService.listSettlements(merchantUserId, page,
pageSize)`** — new method. Resolves `MerchantProfile` from the
  authenticated user's id (the same `resolveMerchantProfileId` pattern used
  throughout the Orders module, since `OrderSettlement.merchantId` is
  `MerchantProfile.id`, not `User.id`), then returns a paginated,
  most-recent-first list of that merchant's settlements joined with
  `order.orderNumber`. Throws `NotFoundDomainException` if the user has no
  merchant profile.
- **`GET /merchant/settlements`** (`MerchantSettlementsController`, new) —
  thin controller wrapping the above, gated by the existing
  `merchant:wallet:read` permission (already granted to the `merchant`
  role) rather than a new permission, since settlement history is
  wallet-domain data from the merchant's perspective.
- **`GET /merchant/wallet/transactions`** (`MerchantWalletController`,
  extended) — mirrors `DriverWalletController`'s identical endpoint exactly:
  calls the existing, owner-type-agnostic `WalletService.listHistory()`.
  `GET /merchant/wallet` (existing, Phase 1) is unchanged.
- **Bank accounts**: no backend changes. `GET /merchant/bank-account`,
  `POST /merchant/bank-account`, and `PATCH
/merchant/bank-account/:id/default` already existed from Phase 1 and are
  reused as-is.

## 3. SDK

`MerchantApi` (`packages/sdk/src/merchant/merchant-api.ts`) gained three
methods — `getWallet()`, `getWalletTransactions(query)`,
`listSettlements(query)` — added directly to the class (not via a new
`wallet` property on `MerchantSdk`), consistent with how the rest of
`MerchantApi` already wraps `/merchant/*` endpoints. No new SDK types were
needed: `WalletDto`, `WalletLedgerEntryDto`, `WalletHistoryQuery`,
`OrderSettlementDto`, `PaginatedResult` were all already exported from
`@dripplex/types`.

## 4. Frontend — `apps/merchant-portal/src/app/(dashboard)/wallet/page.tsx`

Four sections, each answering one part of the founder's requirement:

- **Current balance** — `wallet.availableBalance` (+ `pendingBalance` if
  non-zero), 15s-polled alongside the rest of the page (same live-data
  precedent as Incoming Orders — no wallet-domain websocket push exists).
- **Settlements** — one card per settlement, laid out as gross → commission
  (rate + amount, shown as a subtraction) → "You received" (net,
  bolded) → status, plus the order number and settlement date/time. This is
  the direct answer to "why did I receive ₦9,000 instead of ₦10,000."
  Paginated (`page`/`pageSize`, `Previous`/`Next`, same control as Orders).
- **Ledger history** — every wallet ledger entry (credits and debits,
  settlements and reversals), each row showing amount + direction +
  balance-after + description + date. Paginated separately from
  Settlements, since the ledger can contain non-settlement entries a
  settlements-only list would hide.
- **Bank account** — lists every linked account with bank name, account
  number, a "Settlement destination" badge on whichever one is
  `isDefault`, and a "Verified"/"Unverified" badge from `verifiedAt`. An
  inline expand form (no Dialog/Modal component exists in this codebase)
  adds a new account; a "Set as settlement destination" button switches
  the default. Explicitly states in the section description that adding an
  account does **not** start a withdrawal — DrippleX has no automated bank
  payout capability yet, so none is implied.

Nav: added a "Wallet & Bank" item (between Products and Business) to both
`sidebar.tsx` and `mobile-nav-drawer.tsx`, following the exact pattern used
for every other nav item.

## 5. Live verification

Backend started against the real dev Postgres/Redis. A temporary
`verify-wallet.script.ts` created real fixtures via Prisma — a merchant
user + `MerchantProfile` + `Business`, a customer user, a `Wallet` row, two
`Order`s (`COMPLETED`/`PAID`) each with a `COMPLETED` `OrderSettlement` and
a matching `WalletLedgerEntry` — logged in through the real `POST
/auth/login/merchant`, then drove the exact HTTP contract the SDK/UI calls:

- `GET /merchant/wallet` → balance matches the sum of both settlements'
  `merchantAmount` exactly.
- `GET /merchant/wallet/transactions?page=1&pageSize=1` → correct
  pagination (`total=2`, `totalPages=2`), most-recent-first ordering,
  correct `direction`.
- `GET /merchant/settlements?page=1&pageSize=1` / `page=2` → correct
  pagination, `orderNumber` joined correctly, and
  `grossAmount`/`commissionRate`/`commissionAmount`/`merchantAmount` all
  matching the fixture's expected values (`gross - commission = net`,
  exactly the arithmetic the screen displays).
- `GET /merchant/bank-account` → empty before any account exists.
- `POST /merchant/bank-account` (first account) → `isDefault: true`
  automatically.
- `POST /merchant/bank-account` (second account) → `isDefault: false`.
- `PATCH /merchant/bank-account/:id/default` → switches the default;
  confirmed the previous default flips to `false`.

All 27 assertions passed. Fixtures were deleted at the end of the run; the
script file was deleted after; the dev backend process was stopped.

Frontend: `tsc --noEmit`, `eslint --max-warnings=0`, and `next build` all
clean on `apps/merchant-portal`, including the new `/wallet` route in the
build output.

Backend unit/integration suite: `pnpm exec jest --config ./jest.config.ts
"src/orders" "src/wallet"` → **15 suites passed, 134/134 tests passed**
(includes the 2 new `listSettlements()` tests added to
`merchant-settlement.service.spec.ts`).

## 6. Honest gaps / non-goals (deliberately not built)

- **No withdrawal workflow.** The backend has no automated bank payout
  capability — the founder's instruction was explicit not to invent one.
  The Bank section states this directly rather than implying it.
- **No commission-owed/credit-limit model** (DPX-COMMERCIAL-001). Deferred
  per the founder's "Option 1 should stay" decision — this screen reflects
  the existing net-settlement model only.
- **No merchant-bank-transfer-as-payment-method / receipt-upload /
  commission-debit feature.** A separate, not-yet-scoped idea from the same
  founder message; requires its own design pass (who verifies the receipt,
  whether a wallet debit can go negative, where the upload happens) before
  any implementation.
- **No real-time push for new settlements.** 15s polling only, matching
  every other "live" screen in this codebase.

## 7. Files changed

- `packages/types/src/order/index.ts` — `OrderSettlementDto.orderNumber`.
- `apps/backend/src/orders/order.mapper.ts` — `toOrderSettlementDto()`
  signature.
- `apps/backend/src/orders/merchant-settlement.service.ts` —
  `listSettlements()`.
- `apps/backend/src/orders/dto/list-settlements-query.dto.ts` — new.
- `apps/backend/src/orders/controllers/merchant-settlements.controller.ts`
  — new.
- `apps/backend/src/orders/orders.module.ts` — wired the new controller.
- `apps/backend/src/wallet/merchant-wallet.controller.ts` —
  `GET /merchant/wallet/transactions`.
- `apps/backend/src/orders/merchant-settlement.service.spec.ts` — 2 new
  tests.
- `packages/sdk/src/merchant/merchant-api.ts` — `getWallet()`,
  `getWalletTransactions()`, `listSettlements()`.
- `apps/merchant-portal/src/app/(dashboard)/wallet/page.tsx` — new.
- `apps/merchant-portal/src/components/layout/sidebar.tsx` — nav item.
- `apps/merchant-portal/src/components/layout/mobile-nav-drawer.tsx` — nav
  item.

## 8. Next step

Continue the locked Phase 2 order: Reviews (#386) is next, followed by
Notifications (#387) and Analytics + store controls (#388), then the
module-level E2E/security/production-audit pass (#389–#391).
