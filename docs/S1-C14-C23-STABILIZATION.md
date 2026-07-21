# S1 C14-C23 stabilization

## Review resolution table

| Severity | Area                                  | Resolution                                                                                                                                                                                                                                                               |
| -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Critical | Notifications SDK contract drift      | Synced SDK to backend `CustomerNotificationsController`: `GET /customer/notifications`, `PATCH /customer/notifications/:id/read`, `POST /customer/notifications/mark-all-read`, `DELETE /customer/notifications/:id`, and `GET/PUT /customer/notifications/preferences`. |
| Critical | Wishlist singular route               | Replaced SDK `/customer/wishlist` calls with backend `/customer/wishlists` and added missing item/share/move-to-cart methods matching `WishlistController`.                                                                                                              |
| Critical | Search auth/query drift               | SDK search calls now use authenticated requests and backend query names from `SearchQueryDto`: `type`, `page`, `limit`, `sort`, price/rating filters, merchant/category filters, and `available`.                                                                        |
| High     | Reviews public list path              | SDK review listing now calls `GET /reviews?targetType=&targetId=` instead of path params and returns the backend list-with-aggregate shape.                                                                                                                              |
| High     | Promotions redeem route/body          | SDK promotion redemption now posts a `RedeemPromotionRequest` body to `POST /customer/promotions/redeem` with backend-required `orderId`; client-supplied `amountSaved` was removed from request types while the response still exposes server-calculated `amountSaved`. |
| High     | Wallet admin route coverage           | Added SDK admin wallet methods for `GET /admin/wallets/reconciliation`, `POST /admin/wallets/:ownerType/:ownerId/credit`, and `POST /admin/wallets/:ownerType/:ownerId/debit`; customer wallet transactions/transfer also match controller paths and bodies.             |
| High     | Missing platform API docs             | Added `apps/backend/openapi/platform-supporting-systems.openapi.yaml` and documented it as the interim source of truth until Swagger module/bootstrap lands.                                                                                                             |
| Medium   | Full Swagger integration              | Deferred. Backend does not currently depend on `@nestjs/swagger`; YAML avoids dependency churn and should be reconciled if Swagger is introduced.                                                                                                                        |
| Medium   | Exhaustive generated schemas/examples | Deferred. The YAML captures accurate paths, methods, auth, query names, and request/response envelopes for stabilization scope; richer schema examples can be generated later.                                                                                           |

## Verification scope

- SDK request-construction specs cover the corrected notifications, wishlist,
  search, reviews, promotions, and wallet routes.
- Backend DTO contract specs cover the stabilized query/body shapes the SDK now
  targets.
