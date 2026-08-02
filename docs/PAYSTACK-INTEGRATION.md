# Paystack Integration — Phase 1 (Test Mode)

Tracks the founder's "integrate Paystack Test Mode, complete every payment
flow" directive. Companion to docs/LAUNCH-READINESS-CREDENTIALS.md.

## Critical fix landed first

Before any Paystack work could matter, the backend had a bug that meant
**it could not boot at all, in any environment**: `PaymentsModule` never
imported `WalletModule`, so `PaymentService`'s `WalletService` dependency
was unresolvable — NestJS would throw at startup with "Nest can't resolve
dependencies of PaymentService" and the app would never come up. Reproduced
and confirmed fixed via `Test.createTestingModule({ imports: [AppModule] })
.compile()` against the compiled build. Fixed in a standalone commit before
this pass began (`fix(payments): register WalletModule in PaymentsModule`).

## What was already real (before this pass)

- `PaystackProvider` (`apps/backend/src/payments/providers/paystack.provider.ts`)
  — real `/transaction/initialize` and `/transaction/verify/:reference`
  calls, HMAC-SHA512 webhook signature verification against the raw body.
  Flutterwave, Moniepoint, OPay adapters exist too, same shape.
- Order payments: `PaymentService.initializePayment/verifyPayment`, admin
  refunds (credits the customer wallet), `PaymentWebhooksController`
  (`/webhooks/paystack`, `/webhooks/flutterwave`).
- Ride payments: `RidePaymentService` — card/wallet/cash, driver payout
  split via the platform wallet clearinghouse, tips. No webhook — verified
  through an explicit `POST /customer/rides/:id/pay/verify`, same as the
  wallet top-up flow below.
- Promotion discounts and referral rewards already flow through
  `WalletService` credits elsewhere in the codebase (DPX-CORE-002,
  RIDE-004.1) — not touched this pass, already real.

## What this pass added

- **Wallet funding** (the one real gap): `POST /customer/wallet/fund` +
  `POST /customer/wallet/fund/verify`. See
  `apps/backend/src/wallet/wallet-funding.service.ts`. New
  `WalletTopUpTransaction` table, new `customer:wallet:fund` permission.

## Outstanding — needs founder input

**Test-mode API keys.** `PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY` are
still empty in `.env.example` — every card-payment code path above is real
but inert until a key is set (`PaystackProvider` throws "Paystack is not
configured" otherwise, same NotConfigured-style guard used throughout this
codebase). From the Paystack dashboard, **Settings → API Keys & Webhooks**
(stay in Test Mode toggle, top-right):

1. Copy the **Test Secret Key** (`sk_test_...`) → backend `PAYSTACK_SECRET_KEY`.
2. Copy the **Test Public Key** (`pk_test_...`) → any frontend that needs
   inline card collection (not currently used — the flow redirects to
   Paystack's hosted checkout via `authorizationUrl`, so the public key
   isn't required yet, only the secret key is).
3. Set the webhook URL (same page) to `<backend base URL>/api/v1/webhooks/paystack`
   — needs a real deployed backend URL (Coolify/Railway), not localhost.

Once the secret key is set, I can live-verify: initialize a real Paystack
test transaction, confirm the returned `authorizationUrl` resolves, and
(with a webhook URL configured) confirm a webhook round-trips correctly.
Full checkout completion (entering Paystack's test card
`4084084084084081`) is a manual step in a browser — I can prepare
everything up to that point but can't click through Paystack's hosted
checkout UI myself.

## Known pre-existing schema drift (not touched this pass)

While generating this pass's migration, `prisma migrate diff` surfaced
unrelated drift between `schema.prisma` and applied migration history that
predates this session: a rename on `wallet_ledger_entries`' unique index,
an `orders_order_number_idx` that exists in the schema but not in any
migration, and a `promotions_domains_idx` drop/recreate. None of these
block anything today (the DB already has working equivalents), but they
mean a fresh `prisma migrate deploy` from history alone would not produce
byte-identical DDL to `schema.prisma`. Worth a dedicated cleanup pass
before relying on migration history for a from-scratch environment setup —
flagged here rather than silently folded into this migration.
