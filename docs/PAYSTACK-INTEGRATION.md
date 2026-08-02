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

## Status: keys wired, live verification blocked in this sandbox

`PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY` in root `.env.example` are now
real DrippleX **Test Mode** keys (from Settings → API Keys & Webhooks,
2026-08-02). `PaystackProvider` is no longer inert — every card-payment
path above (order pay, ride pay, wallet fund) will make real calls against
Paystack's sandbox once these values are present in whatever `.env` the
backend actually runs from.

**I could not live-verify the call myself.** This session's outbound network
goes through a policy-enforcing egress proxy, and `api.paystack.co` isn't on
its allowlist — both `curl` and Node's own `fetch` (i.e. exactly what
`PaystackProvider` uses) get an explicit `403 Host not in allowlist` here,
confirmed directly against the real key. This is a restriction on _this
sandbox's_ network policy, not a problem with the integration code or the
keys — it's a different, more restrictive proxy than whatever allowed the
earlier Google Maps `curl` checks through. It should not affect a real
deployment (Railway/Coolify are standard cloud egress, not behind this
proxy), but it does mean the actual "call Paystack and see JSON back" check
still needs to happen from an environment that isn't this one — either your
own machine, or once the backend is deployed.

**Still outstanding:**

1. **Live-verify from a real environment** — either run the backend
   locally on your own machine and call `POST /customer/wallet/fund` (or
   the order/ride pay endpoints), or wait until it's deployed and do the
   same against the live URL. Either should now return a real
   `authorizationUrl` pointing at Paystack's hosted checkout.
2. **Webhook URL** (Settings → API Keys & Webhooks → Test Webhook URL) —
   needs a publicly reachable HTTPS URL, so it can't be set until the
   backend has a real deployed address (Coolify/Railway). Point it at
   `<backend base URL>/api/v1/webhooks/paystack` once that exists. Not
   blocking in the meantime — ride and wallet payments verify explicitly
   (`POST .../pay/verify`, `POST .../fund/verify`) rather than waiting on
   a webhook; only marketplace order payments currently rely on it.
3. **Test Callback URL** (same page) — only used as a _fallback_ when an
   API call doesn't pass its own `callback_url`; our code always passes
   one dynamically per request, so this dashboard field is optional. Fine
   to leave blank.
4. **IP Whitelist** (same page) — optional API-request restriction by
   source IP. Skip it — Railway/Coolify's outbound IP isn't static by
   default, and this is a Test Mode key anyway (no real funds at risk if
   left open).
5. **Test Public Key** — not used anywhere in the code yet (no inline
   Paystack.js card widget; the flow redirects to Paystack's own hosted
   checkout page via `authorizationUrl`). Stored in `.env.example` for
   when/if that changes, same precedent as the Google Maps browser key
   being committed ahead of its UI.

Full checkout completion (entering Paystack's test card `4084084084084081`)
is a manual browser step regardless of where verification happens — I can
prepare everything up to the checkout redirect but can't click through
Paystack's hosted UI myself.

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
