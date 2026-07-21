# Platform stabilization API contract

`apps/backend/openapi/platform-supporting-systems.openapi.yaml` is the interim
source of truth for Sprint 1 C14-C23 platform supporting-system endpoints.

The backend does not currently include `@nestjs/swagger`, so this branch avoids
Swagger dependency/bootstrap churn and keeps the contract as a checked-in
OpenAPI YAML artifact. When Swagger lands, generated docs should be reconciled
against this file before replacing it.

Current covered controller scope:

- Notifications: `customer/notifications`
- Wishlist: `customer/wishlists`
- Search: `search`, `search/*`, `customer/search/recent`
- Reviews: `reviews`, `customer/reviews`, `merchant/reviews`, `admin/reviews`
- Promotions: `customer/promotions`, `admin/promotions`
- Wallet: `customer/wallet`, `merchant/wallet`, `rider/wallet`, `admin/wallets`
