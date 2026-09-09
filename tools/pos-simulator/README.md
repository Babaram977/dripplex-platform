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

## Not covered, because it does not exist

`OrderStatusUpdate` has **no producers** — DrippleX → POS order and status
transmission is unimplemented, and was out of scope for the Phase 1 contract. There is
also **no write path for `CategoryMapping`**: `CategoryMappingService` exposes only
`resolve()`, so mappings must be inserted out-of-band and every unmapped POS category
ingests uncategorised with a `CATEGORY_UNMAPPED` conflict.
