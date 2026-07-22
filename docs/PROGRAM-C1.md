# Program C — Phase C1: Backend ↔ Frontend Integration

| Field            | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| **Program**      | C — Backend ↔ Frontend Integration                    |
| **Phase**        | C1                                                    |
| **Status**       | Complete — awaiting review before C2                  |
| **Branch**       | `cursor/program-c1-backend-frontend-integration-1b33` |
| **Last updated** | 2026-07-22                                            |

## Constraints honored

- No UI redesign / product surface generation beyond auth + integration status shells
- No Backend API changes and no new endpoints
- Existing Backend Core contracts consumed exclusively via SDK portal barrels

## 1. APIs integrated

| Domain                              | Customer                              | Merchant  | Rider    | Admin / Ops             |
| ----------------------------------- | ------------------------------------- | --------- | -------- | ----------------------- |
| Authentication                      | ✅                                    | ✅        | ✅       | ✅                      |
| Session / me                        | ✅                                    | ✅        | ✅       | ✅                      |
| Logout / expiry                     | ✅                                    | ✅        | ✅       | ✅                      |
| Customers                           | ✅ auth                               | —         | —        | via admin               |
| Merchants/Stores                    | —                                     | ✅        | —        | ✅ admin                |
| Riders                              | —                                     | —         | ✅       | —                       |
| Admins / Staff                      | —                                     | —         | —        | ✅ RBAC                 |
| Products/Categories/Orders/Payments | SDK ready (customer/merchant barrels) | SDK ready | —        | —                       |
| Wallets                             | ✅ probe                              | ✅ probe  | ✅ probe | ✅ admin wallet surface |
| Notifications                       | ✅ probe                              | —         | —        | ✅                      |
| Reviews                             | SDK                                   | SDK       | —        | SDK                     |
| Promotions                          | ✅ probe                              | SDK       | —        | SDK                     |
| Loyalty                             | ✅ probe                              | —         | —        | —                       |
| Analytics/Reports                   | SDK                                   | SDK       | SDK      | ✅ probe                |
| CMS                                 | ✅ probe                              | —         | —        | ✅ probe                |
| Fraud                               | —                                     | —         | —        | ✅ probe                |
| Search                              | ✅ probe                              | —         | —        | SDK                     |

Customer auth forms (login, register, forgot, reset, verify OTP) call live Backend Core.
Merchant / Rider / Admin / Operations portals authenticate and probe live domains.

## 2. SDK verification

Canonical barrels in `@dripplex/sdk`:

| Barrel            | Package export               | App wrapper                                                       |
| ----------------- | ---------------------------- | ----------------------------------------------------------------- |
| `sdk.ts`          | `@dripplex/sdk/sdk`          | `apps/customer-web/src/lib/sdk.ts`                                |
| `sdk-merchant.ts` | `@dripplex/sdk/sdk-merchant` | `apps/merchant-portal/src/lib/sdk-merchant.ts`                    |
| `sdk-rider.ts`    | `@dripplex/sdk/sdk-rider`    | `apps/rider-portal/src/lib/sdk-rider.ts`                          |
| `sdk-admin.ts`    | `@dripplex/sdk/sdk-admin`    | `apps/admin-portal` + `operations-console` `src/lib/sdk-admin.ts` |

Isolation tests assert no screen imports `*.http.ts` / `*.mock.ts` and that each portal barrel exists.

## 3. Endpoints verified (via SDK)

- Auth: register/login (portal-specific), verify email, forgot/reset password, refresh, logout, me, sessions
- Merchant: business, KYC, wallet
- Rider: jobs, wallet
- Admin: merchants list, fraud queue, analytics, CMS list
- Customer platform: notifications, search popular, wallet, loyalty, promotions, wishlist, CMS banners

## 4. Remaining integration issues

1. **Product modules** (full catalog, checkout carts UI, order history screens, payment checkout UX, staff management UI, rich reports) are SDK-ready but not product-UI complete — deferred to later Program C phases; C1 provides live auth + domain probes only.
2. **Contact form** remains local capture (no Backend Core contact intake endpoint in Program A freeze).
3. **Admin/Ops login** uses generic `/auth/login` (no dedicated admin portal login route in Backend Core). Portal RBAC still enforced by JWT permissions.
4. **Driver portal** out of C1 application list (Customer / Merchant / Rider / Admin & Operations).
5. Live E2E against a running Backend Core instance should be exercised in staging before C2.

## 5. Performance observations

- React Query defaults: `staleTime` 60s, `refetchOnWindowFocus: false`, selective retry (skips 401/403/404/422)
- HttpClient: single-flight refresh promise (avoids duplicate refresh storms)
- Portal domain probes run sequentially to avoid stampedes after login
- Next.js `optimizePackageImports` for `@dripplex/ui` / `lucide-react`
- No mock adapters remain to strip

## 6. Security observations

- JWT access token attached only when `auth: true`
- Refresh rotation on authenticated 401 with one retry; failed refresh clears session
- Public 401s (login/register) do **not** clear session
- Tokens persisted in Zustand (`dripplex-auth`); logout calls Backend Core then clears local state
- RBAC helpers: `usePermission` / `usePermissions` / `hasRole`
- Session expiry surfaces as 401 → refresh → logout path

## 7. Quality gate results

| Package / App        | Typecheck | Lint | Test                 | Build               |
| -------------------- | --------- | ---- | -------------------- | ------------------- |
| `@dripplex/sdk`      | ✅        | ✅   | ✅ 15 tests          | ✅                  |
| `@dripplex/hooks`    | ✅        | ✅   | ✅ (passWithNoTests) | n/a (source export) |
| `customer-web`       | ✅        | ✅   | ✅ 4 tests           | ✅                  |
| `merchant-portal`    | ✅        | ✅   | ✅ 1 isolation       | ✅                  |
| `rider-portal`       | ✅        | ✅   | ✅ 1 isolation       | ✅                  |
| `admin-portal`       | ✅        | ✅   | ✅ 1 isolation       | ✅                  |
| `operations-console` | ✅        | ✅   | ✅ 1 isolation       | ✅                  |

No breaking Backend Core contract changes.

## Wait for review

**Do not start Program C2 until this C1 report is reviewed.**
