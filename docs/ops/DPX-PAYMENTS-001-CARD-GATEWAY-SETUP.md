# DPX-PAYMENTS-001 — Turning card payments on

How to configure Paystack and Flutterwave, and what the platform does with them.

Everything here goes in **Railway → `@dripplex/backend` → Variables**. No key belongs in code, in
a document, or in a chat message.

---

## 1. Paystack

Dashboard → **Settings → API Keys & Webhooks**.

| Variable              | Value                     |
| --------------------- | ------------------------- |
| `PAYSTACK_SECRET_KEY` | `sk_live_…` (Secret Key)  |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_…` (Public Key)  |
| `PAYSTACK_BASE_URL`   | `https://api.paystack.co` |

Set the **Webhook URL** on that same screen to:

```
https://api.dripplex.com/api/v1/webhooks/paystack
```

Paystack signs its webhooks with your secret key, so there is no separate hash variable.

## 2. Flutterwave

Dashboard → **Settings → API**.

| Variable                   | Value                           |
| -------------------------- | ------------------------------- |
| `FLUTTERWAVE_SECRET_KEY`   | `FLWSECK-…`                     |
| `FLUTTERWAVE_PUBLIC_KEY`   | `FLWPUBK-…`                     |
| `FLUTTERWAVE_WEBHOOK_HASH` | the **Secret hash** (see below) |
| `FLUTTERWAVE_BASE_URL`     | `https://api.flutterwave.com`   |

Webhook URL:

```
https://api.dripplex.com/api/v1/webhooks/flutterwave
```

**The Secret hash is a value you invent**, not one Flutterwave issues. Put the same string in
their dashboard and in `FLUTTERWAVE_WEBHOOK_HASH`. The backend compares the incoming
`verif-hash` header against it and rejects anything that does not match, so if the two differ
every webhook is silently discarded and payments appear stuck rather than failing loudly.

## 3. The customer chooses — both stay live

**Founder decision, 2026-08-18:** keep Paystack and Flutterwave both configured and let the
customer pick at payment time, because one gateway can be down while the other is working.

`GET /customer/payments/providers` reports which gateways can actually take money right now, and
the client renders one option per entry. A gateway is only listed if it has a **secret key** — so
rotating or removing a key removes the option rather than leaving a button that fails after the
customer has chosen what to buy. If a client names a gateway that cannot charge, the backend
refuses with "That payment method is unavailable right now. Please choose another." rather than
failing deeper.

A caller with no reason to prefer one can still send `CARD` and get the default below.

## 4. Which gateway is the default

| Variable                   | Value                       |
| -------------------------- | --------------------------- |
| `PAYMENT_DEFAULT_PROVIDER` | `FLUTTERWAVE` or `PAYSTACK` |

Both providers can be configured at once; this picks the live one. Switching it is one variable
and no deploy.

The resolution rules are pinned in `src/config/card-provider-selection.spec.ts`:

- The named default wins **when that gateway actually has a secret key**.
- If it does not, the other configured gateway is used — a default left pointing at a gateway
  nobody configured must not silently disable card payments.
- **OPay is never selected.** It is a legal value in the schema but is safe-disabled
  platform-wide (DPX-D1).
- A **public key alone is not "configured"**. A public key renders a form; only a secret key can
  charge anything, and treating one as configured would put a live-looking Card button in front
  of customers.
- A **whitespace-only value reads as off**, not as "configured with an empty secret" — an easy
  mistake to make in a dashboard.

When neither gateway is configured, the client is told so and does not offer the option at all.

---

## 5. Test first

Use test credentials (`sk_test_…` / `FLWSECK_TEST-…`) and run one ₦100 wallet top-up end to end
before switching to live keys. The webhook is the part that most often needs a second look,
because a mismatched Flutterwave secret hash fails quietly.

---

## 6. Why keys alone were not enough

Two client-side bugs meant card payments could not have worked whatever was configured. Both are
fixed; recorded here because they explain why the client no longer names a gateway at all.

**Wallet top-up returned 422 on every attempt.** The super-app sent `provider: 'paystack'` in
lower case; `FundWalletDto` validates against an uppercase enum. It now sends no provider, so the
server's configured default applies.

**The Utilities Card button hardcoded `PAYSTACK`** in its own source, so it would have failed the
moment Flutterwave became the default.

**A client never hardcodes a gateway.** It either names one the _server_ said is live, or sends
`CARD` and lets the server pick. The alternative is a client that breaks every time a key
changes, which is exactly what both bugs were. The stored `UtilityPurchase.paymentMethod` always
records the gateway that really ran, so reconciliation is unaffected.

**The Top Up screen's Card / Bank Transfer / USSD rows were theatre** — all three ran the same
call and opened the same gateway checkout, where the customer chose card/transfer/USSD anyway.
They are replaced by the real choice: which gateway.

`GET /customer/utilities` reports `cardEnabled` so the client can hide the Card option rather
than offer one that fails after the customer has chosen what to buy — the same
deployed-but-disabled pattern the Peyflex adapter uses.
