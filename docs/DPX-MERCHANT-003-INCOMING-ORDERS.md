# DPX-MERCHANT-003 — Incoming Orders: Implementation + Integration Verification

Status: **Implemented, live-verified against the real backend. Founder review pending.**

This is the first Merchant Phase 2 screen, built per the founder's explicit
instruction following DPX-MERCHANT-002 (settlement) acceptance: "Proceed with
Incoming Orders as the next Merchant Portal screen." It is a UI layer over the
`MerchantOrdersService`/`MerchantOrdersController` backend that already
existed and was already contract-verified in Phase 1 (DPX-MERCHANT-001 §Phase

1. — no new order-lifecycle logic was written for this screen.

## 1. Scope delivered

Two new merchant-portal pages, plus nav wiring:

- `apps/merchant-portal/src/app/(dashboard)/orders/page.tsx` — order list:
  status filter (`All orders` / `Needs attention: New, Preparing, Ready` /
  `History: Delivered, Completed, Cancelled, Refunded`), paginated (20/page),
  15s polling, empty/loading/error states, actionable-order indicator dot.
- `apps/merchant-portal/src/app/(dashboard)/orders/[id]/page.tsx` — order
  detail: items, order summary (subtotal/discount/delivery fee/tax/total),
  timeline (confirmed/ready/delivered/completed/cancelled timestamps), and
  the action panel described below.
- `sidebar.tsx` / `mobile-nav-drawer.tsx` — added an "Orders" nav item
  between Overview and Products.

### Actions surfaced (order detail page)

Mapped 1:1 to the exact transitions read from `MerchantOrdersService` source
— no transition was invented or assumed:

| Order status  | Actions offered                                                                 | Backend call                                      |
| ------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| `CONFIRMED`   | Accept (optional ETA), Reject (reason required)                                 | `PATCH /merchant/orders/:id/accept`, `.../reject` |
| `PREPARING`   | Mark ready, Delay (new ETA required, reason optional), Cancel (reason optional) | `.../ready`, `.../delay`, `.../cancel`            |
| `READY`       | Cancel (reason optional)                                                        | `.../cancel`                                      |
| anything else | no action panel rendered                                                        | —                                                 |

Accept **is** "start preparing" — there is no separate "start preparing"
action, because the backend has none; `acceptOrder` moves `CONFIRMED` straight
to `PREPARING`. The UI mirrors this rather than inventing an intermediate
step.

## 2. Founder requirements — how each was met

1. **Use existing real backend/SDK.** No new backend code. `sdk.orders.merchantGetOrders/merchantGetOrder/merchantAcceptOrder/merchantRejectOrder/merchantMarkOrderReady/merchantDelayOrder/merchantCancelOrder` — all built and unit-tested in Phase 1 — are the only data path.
2. **Complete workflow surfaced.** List (all statuses, filterable), detail, accept, reject, preparing (via accept), ready, delay, cancel, and history visibility (Delivered/Completed/Cancelled/Refunded in the filter's "History" group) — everything the backend's state machine actually permits a merchant to do.
3. **Real data only, no placeholders.** Every field rendered (`status`, `paymentStatus`, `paymentMethod`, `subtotal`, `discount`, `deliveryFee`, `tax`, `total`, `items[]`, all timestamps) comes straight off `OrderDto`. See §4 for the one field intentionally **not** shown, and why.
4. **No duplicated/redesigned order logic.** The portal computes nothing about eligible transitions beyond mirroring the same status checks the backend already enforces (and the backend still authoritatively re-checks and 422s on an invalid transition — confirmed live in §5).
5. **Frozen boundaries preserved.** No Marketplace/Ride/Wallet backend code touched. Only `apps/merchant-portal/**` (2 new pages, 2 nav edits).
6. **DDS/shared-component composition, no Figma-implemented screens touched.** Built entirely from `@dripplex/ui`'s existing `Badge, Button, Card*, EmptyState, Input, Label, LoadingSpinner, Select, Textarea` — no new component primitives added, no shared design tokens changed. Pagination on the list page mirrors `products/page.tsx`'s existing `Button variant="outline"` pattern rather than inventing new markup.
7. **Loading/empty/error/pending states.** List: skeleton-free spinner while first loading, `EmptyState` (filter-aware copy) when zero results, inline error banner on fetch failure. Detail: spinner while loading, "Order not found" (404-aware) state, inline error banner surfaced via `describeSdkError` on any action failure.
8. **Duplicate-action prevention.** A single `busy` flag (mirrors `products/[id]/page.tsx`'s established `withBusy` pattern) disables every action button and re-entry into `withBusy` for the duration of a request; the guard is also checked at the top of `withBusy` itself so a second rapid click before React re-renders the `disabled` prop is still a no-op.
9. **Payment status vs order status kept visually distinct.** Two separate `Badge`s are always rendered side by side (`Payment: PAID` / `Preparing`, etc.), with an explicit caption on the detail page: "Payment status and order status are tracked separately." They are never merged into one label, and a `PAID` order can be shown at any fulfilment status and vice versa (a `CASH` order sits at `PENDING` payment through most of its life).
10. **No implied settlement on accept/prepare.** The detail page renders no settlement/payout data at all — intentionally. A source comment marks the omission explicitly so a future editor doesn't "helpfully" add a wallet-credit note here. Settlement remains governed solely by DPX-MERCHANT-002's `ORDER_COMPLETED` trigger; confirmed live in §5 that accepting and marking ready create zero `OrderSettlement` rows.

## 3. Conventions followed (not reinvented)

- Plain `useState`/`useEffect` data fetching — merchant-portal does not use
  react-query (operations-console does; that's a deliberate per-app split
  already established, not something to unify here).
- `describeSdkError(err).description` for all error copy; `statusCode` (not
  `status`) is the field the SDK actually returns.
- No `Dialog`/`Modal` component exists in `@dripplex/ui`. Reject/Delay/Cancel
  reason capture is an inline expand-in-place form under the action buttons,
  toggled open/closed by re-clicking the triggering button — the same
  no-modal constraint every other merchant-portal mutation screen already
  works within.
- 15s polling on the list page — the same interval Ops Command Centre's
  queues and Driver's incoming-ride list use, for the same reason (no
  websocket channel exists for this data).

## 4. Known, honestly-documented gap: no customer identity/address

`OrderDto` carries `customerId` but no customer name, phone, or resolved
delivery address, and no merchant-facing endpoint exists to look either up.
Per the founder's explicit "do not create placeholder state" instruction,
the order detail page shows the order number, item snapshots, fulfilment
type, financial totals, and timestamps — and nothing invented in place of
customer identity. A merchant currently cannot see _who_ placed an order or
_where_ to deliver it from this screen alone.

This is a real gap, not a cosmetic one — closing it needs either a new
merchant-scoped customer/address read endpoint (with the appropriate privacy
scoping — a merchant should see enough to fulfil, not a customer's full
profile) or an existing one this audit didn't find. It is called out here
rather than silently worked around, and should be raised with the founder
before or during a later Merchant Phase 2 screen (most naturally Business
Profile or a dedicated backend pass), not fixed unilaterally now since it's
outside "Incoming Orders is a UI layer over the existing backend."

## 5. Live integration verification (real backend, real Postgres, real HTTP)

Static verification (`tsc --noEmit`, `eslint --max-warnings=0`, `next build`)
passed clean for `apps/merchant-portal` — 8 routes built including
`/orders` and `/orders/[id]`.

Beyond that, a live E2E script was run against the actual NestJS server
(`pnpm run dev`, real Postgres `dripplex_dev`, real Redis) driving the exact
HTTP contract the merchant-portal SDK calls — not a mock:

1. Created a real merchant user (`ACTIVE`, email+phone verified), assigned
   the real `merchant` role, created an `APPROVED` `MerchantProfile`, and a
   real `Product`.
2. Logged in through the **real** `POST /api/v1/auth/login/merchant`
   endpoint (the actual endpoint the merchant-portal login screen calls) to
   get a genuine session-bound access token — not a hand-crafted JWT.
3. Created four real `Order` + `OrderItem` rows in Postgres at `CONFIRMED`,
   `CONFIRMED`, `PREPARING`, and `READY`, all `PAID`/`WALLET`.
4. `GET /merchant/orders` → 200, all four orders present with every real
   field (`status`, `paymentStatus`, `subtotal`/`discount`/`deliveryFee`/
   `tax`/`total`, `items[]`, timestamps) — the exact shape `orders/page.tsx`
   renders.
5. `GET /merchant/orders?status=CONFIRMED` → 200, correctly scoped.
6. `GET /merchant/orders/:id` → 200, single-order detail shape confirmed —
   the exact shape `orders/[id]/page.tsx` renders.
7. `PATCH /merchant/orders/:id/accept` → 200, `CONFIRMED → PREPARING`.
8. `PATCH /merchant/orders/:id/reject` (`{reason}`) → 200,
   `CONFIRMED → CANCELLED` (refund path, since order was `PAID`).
9. `PATCH /merchant/orders/:id/delay` (`{estimatedReadyAt, reason}`) → 200,
   stays `PREPARING`, `estimatedReadyAt` updated to the new value.
10. `PATCH /merchant/orders/:id/ready` → 200, `PREPARING → READY`.
11. `PATCH /merchant/orders/:id/cancel` (`{reason}`) → 200, `READY →
CANCELLED` (refund path).
12. **Founder requirement #10 confirmed live**: `orderSettlement.count()` for
    the accepted and ready-marked orders was `0` after all of the above —
    accepting/preparing/marking-ready create no settlement row. Settlement
    only fires on the real `ORDER_COMPLETED` event, which this test
    deliberately never triggered.
13. Invalid-transition guard: `PATCH .../accept` on an order already in
    `READY` → **422** `"Only confirmed orders can be accepted"` — confirming
    the backend, not the UI, is still the sole authority on legal
    transitions (requirement #4).

All 13 checks passed. Fixture data was created and cleaned up in the same
run; nothing was left behind in `dripplex_dev`.

## 6. What this verification does not cover

- No Playwright/browser click-through was performed in this pass — the
  script drives the same HTTP contract the UI calls, but did not render the
  React components in a browser. The `next build` static check (route
  generation, TypeScript prop shapes end-to-end from `OrderDto` through JSX)
  is the coverage for the rendering layer; a full click-through is
  reasonable to add during the module-level Phase 2 E2E pass (task #389),
  not repeated per-screen.
- Concurrent-tap duplicate-prevention (`busy` flag) is implemented per the
  established `withBusy` pattern already used and relied on elsewhere in
  merchant-portal, but wasn't separately re-verified here since it's pure
  frontend state, not a backend contract question.

## 7. Files changed

- `apps/merchant-portal/src/app/(dashboard)/orders/page.tsx` (new)
- `apps/merchant-portal/src/app/(dashboard)/orders/[id]/page.tsx` (new)
- `apps/merchant-portal/src/components/layout/sidebar.tsx`
- `apps/merchant-portal/src/components/layout/mobile-nav-drawer.tsx`

No backend, SDK, schema, or shared-types changes — all contracts already
existed from Phase 1.

## 8. Next step

Per the founder's locked ordering: **Business Profile** is next in Phase 2
(`Incoming Orders → Business Profile → Onboarding/KYC → Wallet & Bank →
Reviews → Notifications → Analytics`). DPX-MERCHANT-002 remains open until
the full Phase 2 UI integration, E2E verification, security review, and
production audit are complete.
