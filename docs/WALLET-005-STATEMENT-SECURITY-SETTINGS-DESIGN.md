# Wallet Slice 5 — Statement + Security + Settings Design Note

Written per the same "design note before/alongside code" discipline as
`WALLET-004-WITHDRAW-DESIGN.md`. Documents what already existed, what had to be built,
and the decisions made where Figma's design didn't map cleanly onto real backend
capability.

## Reality audit (verified before writing code)

**Statement** had no backend at all — `WalletLedgerEntry` (from Slice 2) has everything
needed (type, direction, amount, `createdAt`), just no month-scoped aggregation endpoint
and no CSV export. Built both directly on the existing ledger table; no new model.

**Security's "trusted devices" is not wallet-specific infrastructure — it already
exists.** `AuthSession` + `SessionManagementService` + `SessionsController`
(`GET/DELETE /auth/sessions`) is a pre-existing, portal-agnostic session list/revoke
system with real device/browser/OS parsing and IP tracking, gated by
`auth:sessions:read`/`auth:sessions:revoke`. This slice is its first wallet-facing UI,
not new backend. Zero new backend code for this section.

**Security's PIN change has an anticipated seam.** `WalletPin` (Slice 4) was built with
a set/verify pair only; its code comment explicitly reserved "change" for this slice.
Added `WalletPinService.change()` on top of the existing bcrypt-hash primitive — verifies
the current PIN via the existing `verify()` before replacing the hash, same audit-log
pattern as the rest of the service.

**Security's Face ID and 2FA have no real backend and cannot get one honestly in this
slice.** Face ID needs a native platform (WebAuthn) integration this web app doesn't
have. Wallet 2FA (SMS-gated large transfers) needs OTP enforcement wired into the
Transfer/Withdraw flows specifically — a distinct follow-up, not a checkbox that can be
"turned on" here. **Decision: real, honest disabled toggles** with subtext explaining
why, not toggles that silently do nothing when tapped — the established
known-gap-documented-not-hidden pattern used for Auto Top-Up (below), rider-portal, PDF
export, and Biometric/2FA (Slice 4).

**Settings' notification preferences don't map 1:1 onto Figma's 3 toggles.** The
platform's `NotificationPreference` model is granular at (channel, type), not category —
`NotificationCategory` is a non-persisted, emit-time-only dimension (see the schema
comment: "several types (PAYMENT_SUCCESS, PAYMENT_FAILED) are shared across categories
... category must be set explicitly by the caller, not inferred"). `PAYMENT_SUCCESS`/
`PAYMENT_FAILED` fire for Ride fares and Marketplace orders as well as Wallet — a toggle
labeled "Wallet activity" that touched those types would silently mute unrelated
domains' confirmations. **Decision: collapse to 2 real toggles** using only types that
are unambiguously wallet-money-movement: "Withdrawals & payouts"
(`WITHDRAWAL_REQUESTED`/`WITHDRAWAL_COMPLETED`/`WITHDRAWAL_FAILED`) and "Promotions &
offers" (`PROMOTION_REDEEMED`/`PROMOTION_EXPIRED`/`CASHBACK_AWARDED`/
`REFERRAL_REDEEMED`/`REFERRAL_REWARDED`). Ride-deduction and top-up alerts are
deliberately excluded from independent control here — a stated scope boundary, not a
silently dropped feature. Reuses the existing `GET/PUT
customer/notifications/preferences` endpoint at the `IN_APP` channel; no new backend.

**Settings' spending limits are new and real.** No prior concept of a wallet spending
limit existed anywhere. Added `dailyLimit`/`singleTransactionLimit` (nullable
`Decimal(14,2)`, null = no limit) directly on `Wallet`, plus
`WalletService.setLimits()`/`assertWithinLimits()`. Enforcement is scoped to
**customer-initiated outflow only** — `WalletService.transfer()` and withdrawal-request
creation — not the generic `debit()`/`credit()`/`mutateAndEmit()` used platform-wide for
ride fares and marketplace payments. This matches both the Figma copy's intent ("Daily
limit", "Single transaction limit" read as customer controls over their own outgoing
transfers, not a cap on being charged for a ride they took) and the
`WalletTransactionType` distinction already in the schema (`WITHDRAWAL`/`TRANSFER` vs.
generic `DEBIT`).

**Settings' Auto Top-Up is a documented gap, not new work.** It needs a saved
auto-charge payment method — Payment Methods (Slice 3) already established that no such
capability exists. Shown as a disabled toggle with honest subtext, same pattern as
Security's Face ID/2FA above.

**Settings' Currency display is genuinely static** — the platform is NGN-only, nothing
to build.

**Settings' Privacy Mode has no server-side meaning** — it is a pure display preference
(hide balance/amounts on this device), so it's a real, client-only `localStorage` toggle
rather than a wallet field. Nothing about it needed backend work, and inventing a
server-persisted field for a device-local UI preference would be over-engineering.

## Data model

```prisma
// on Wallet
dailyLimit             Decimal? @db.Decimal(14, 2)  // null = no limit
singleTransactionLimit Decimal? @db.Decimal(14, 2)  // null = no limit
```

No new tables. Statement, Security, and the notification/currency/privacy parts of
Settings are all read/write against existing models (`WalletLedgerEntry`, `WalletPin`,
`AuthSession`, `NotificationPreference`).

## API surface

```
GET  /customer/wallet/statement?month&year        real month aggregation (in/out/net + entries)
GET  /customer/wallet/statement/export?month&year  text/csv download

PUT  /customer/wallet/pin                          change PIN (currentPin, newPin)

PUT  /customer/wallet/limits                       set daily/single-transaction limits (null clears)

GET  /auth/sessions                                trusted devices (pre-existing, reused as-is)
DELETE /auth/sessions/:id                           revoke a device (pre-existing, reused as-is)

GET/PUT /customer/notifications/preferences         notification toggles (pre-existing, reused as-is)
```

`assertWithinLimits()` is called from `WalletService.transfer()` and
`WithdrawalService.create()`, before the PIN check, so a limit violation fails fast
without prompting for a PIN that won't matter.

## DPX-UX-001 application

Statement's month picker defaults to the real current month (not Figma's hardcoded
"2024"). Spending limits use an explicit "Save limits" button rather than saving on every
keystroke — typing a number shouldn't fire a network request per digit. Everything else
follows the established read-mostly pattern: toggles act immediately (notification
prefs, privacy mode), money-relevant actions (PIN change, limits) require an explicit
confirm/save step.

## Out of scope for this slice

- Face ID / WebAuthn — needs native platform integration this web app doesn't have.
- Wallet 2FA (SMS-gated large transfers) — needs OTP enforcement wired into
  Transfer/Withdraw specifically, a distinct follow-up.
- Auto Top-Up — needs a saved auto-charge payment method (Payment Methods gap, Slice 3).
- Spending limit enforcement on ride/marketplace wallet payments — deliberately out of
  scope; those are system-initiated debits, not customer-initiated transfers/withdrawals.
- PDF statement export — CSV only, matching the existing PDF-export gap pattern used
  elsewhere (e.g. trip receipts).
