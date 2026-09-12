# POS simulator

Stands in for a merchant's point-of-sale system until a provider adapter exists.

DrippleX has **no POS provider adapters**. `PosProvider` (`SQUARE`, `SHOPIFY`,
`WOOCOMMERCE`, `CUSTOM`) is a label on `MerchantIntegration`, not a client — unlike
payments, which has four real provider adapters. Phase 1 is push-only over a generic
REST contract, so any POS that can POST JSON is a `CUSTOM` integration. This script is
that POS.

It speaks only the documented public surface: a merchant JWT for the setup a merchant
would do in their console, then the `x-integration-id` / `x-integration-key` headers a
real POS holds.

## Run

```bash
# API must be running with Postgres and Redis available
DPX_JWT="<merchant access token>" node tools/pos-simulator/pos-sim.mjs
# optional: DPX_API=http://host:3000/api/v1
```

## What it exercises

| Step                      | Contract rule                                              |
| ------------------------- | ---------------------------------------------------------- |
| Connect integration       | merchant-owned, JWT                                        |
| Issue `catalog:write` key | secret hashed, never echoed back                           |
| Refuse absent / wrong key | identical refusal, no id enumeration                       |
| Push catalogue            | products created `DRAFT` — `autoPublish` off (decision #7) |
| Replay identical batch    | original job returned, `replayed: true` (decision #3)      |
| Inventory update          | writes `quantity` only, never `reserved`                   |
| Mixed batch               | `PARTIAL`; one bad row never fails the batch (decision #8) |
| Archive at source         | soft archive, never a hard delete                          |
| Merchant sync history     | jobs visible to the owning merchant                        |

## verify-category-mappings.mjs

Second script, covering the category-mapping write path end to end:

```bash
node tools/pos-simulator/verify-category-mappings.mjs
```

It logs in as two different merchants and proves the loop that matters — an unmapped
POS category raises `CATEGORY_UNMAPPED`, the merchant maps it through the API, the same
payload then resolves, and deleting the mapping restores the original behaviour. It also
proves the second merchant gets 403 on read, write and delete against the first
merchant's integration, that mapping to a non-existent category is refused, and that
`PUT` is idempotent.

## Not covered, because it does not exist

`OrderStatusUpdate` has **no producers** — DrippleX → POS order and status
transmission is unimplemented, and was out of scope for the Phase 1 contract. It needs
its own contract first: outbound authentication and signing, retry semantics, and the
delivery lifecycle are all undecided, and the database model existing is not a design.
