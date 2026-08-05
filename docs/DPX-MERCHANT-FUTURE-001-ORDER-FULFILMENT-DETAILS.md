# DPX-MERCHANT-FUTURE-001 — Merchant-Facing Order Fulfilment Details (Backend Enhancement)

Status: **Documented gap. Not implemented. Requires Founder approval to build.**

Recorded per Founder Review (2026-08-05) on DPX-MERCHANT-003 (Incoming
Orders): _"This is a genuine backend capability gap, not a Merchant Portal
UI problem. [...] Record this as a new backend enhancement item."_

## The gap

`OrderDto` (`packages/types/src/order/index.ts`) carries `customerId` but no
customer name, phone, delivery address, or delivery instructions, and no
merchant-facing endpoint resolves any of them. `MerchantOrdersController`
(`GET /merchant/orders`, `GET /merchant/orders/:id`) returns order/item/
financial data only. A merchant fulfilling an order today cannot see who it
is for or where to deliver it from the Incoming Orders screen — confirmed
directly from source, not inferred (see `docs/DPX-MERCHANT-003-INCOMING-
ORDERS.md` §4 for the original finding).

`Order.deliveryAddressId` exists on the schema and is populated at checkout
(`CheckoutService`), so the data itself is captured — it is a read/exposure
gap, not a data-capture gap.

## What "genuinely allowed to see" means here

A merchant needs enough to fulfil an order, not a customer's full profile.
Concretely, for a `DELIVERY` order once it reaches `CONFIRMED` (i.e. paid
and accepted for fulfilment — never before, and never for a merchant who
isn't the order's own merchant):

- Customer's delivery-relevant name (not necessarily their full account
  name — whatever `Address`/checkout already captures as the recipient).
- Delivery phone number (for the courier/merchant to coordinate handoff).
- Delivery address (street/city/state — enough to hand off to a rider or
  print on a package label).
- Delivery instructions / notes, if the customer left any at checkout.
- For `PICKUP` orders, none of the above delivery fields apply — only
  pickup-relevant identification (e.g. name to call out) is needed.

Explicitly **not** in scope for this endpoint: customer email, full
account profile, order history with other merchants, wallet/payment
details, or anything not required to hand over this specific order.

## Proposed shape (for founder review before implementation, not built yet)

```ts
// Illustrative only — not implemented, not added to packages/types yet.
interface MerchantOrderFulfilmentDto {
  orderId: string;
  recipientName: string;
  deliveryPhone: string | null; // null for PICKUP orders
  deliveryAddress: {
    line1: string;
    city: string;
    state: string;
    instructions: string | null;
  } | null; // null for PICKUP orders
}
```

Served from a new endpoint scoped identically to the existing merchant
order endpoints — same `merchant:orders:manage` permission, same
merchant-owns-this-order authorization check already enforced by
`MerchantOrdersService`. No new permission model needed; this is an
additive read surface on data the merchant is already authorized to act
on.

## Why this wasn't built during DPX-MERCHANT-003

Per the founder's standing "reality audit before implementation" discipline
and the explicit boundary on this task ("The portal is a UI over the
existing backend authority" / "Do not modify frozen Marketplace modules
simply to expose customer information"), building this endpoint would have
meant writing new backend authorization-sensitive logic — resolving and
exposing another user's PII — without a scoped design review. That is
exactly the kind of decision this project's governance model requires
Founder sign-off on before implementation, not something to build
opportunistically inside a portal-UI task.

## Next step

Awaiting Founder approval to schedule this as a scoped backend workstream
(schema is already sufficient — no migration expected, just a new
read-only endpoint + mapper + SDK method + merchant-portal wiring into the
existing Incoming Orders detail page). Not blocking Business Profile or
any other Phase 2 screen.
