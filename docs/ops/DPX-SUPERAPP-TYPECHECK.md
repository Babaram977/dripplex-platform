# DPX-SUPERAPP-TYPECHECK — a type gate on the super-app

**Date:** 2026-08-18
**Why now:** the founder's decision to put the super-app on `dripplex.com` as the single front door
for customers, drivers, riders and merchants. Until then the app was a preview on a
`.up.railway.app` URL; as the primary domain it becomes the only way a driver can earn, and it was
the one app in the monorepo with **no `tsconfig.json` at all** — never typechecked, so a mistake
surfaced only when a real person hit that screen in a browser.

---

## 1. What was added

| File                           | Change                                                         |
| ------------------------------ | -------------------------------------------------------------- |
| `apps/super-app/tsconfig.json` | new — extends `@dripplex/config/typescript/react-library`      |
| `apps/super-app/package.json`  | `typecheck: tsc --noEmit -p tsconfig.json`, plus the type deps |

No CI change was needed: the pipeline already runs `pnpm typecheck` (`turbo run typecheck`), which
picks up any package declaring the task. The super-app is now the 19th package in that run, and
`pnpm build` already covered its `vite build`. Both gates are live on every pull request.

## 2. Where the gate is set, and why

`strict` is on. What is relaxed is style, not correctness — the point is to catch what a driver or
customer would hit, not to demand a stylistic rewrite of 68k lines of generated JSX.

| Flag                                    | Off because                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `noUnusedLocals` / `noUnusedParameters` | Generated code carries unused imports. Style only.                                                                          |
| `exactOptionalPropertyTypes`            | Absent vs explicitly-`undefined` is not a distinction generated prop-passing makes. `customer-web` already sets this false. |
| `noPropertyAccessFromIndexSignature`    | Requires `obj['key']` over `obj.key`. Style only.                                                                           |
| `noUncheckedIndexedAccess`              | **The one correctness rule deferred rather than dropped** — see below.                                                      |

`noUncheckedIndexedAccess` accounted for **97 of the 146** errors the gate first reported, nearly
all of them `arr[0]` on an array literal declared a few lines above. Clearing them means 97
unverifiable edits to screens with no test coverage — more risk than the out-of-bounds reads it
would catch. It should be turned back on as its own pass, with the app exercised in a browser
afterwards. That is the single outstanding item here.

## 3. What the gate found on its first run

Eleven real defects, none of which any test or build would have caught. Every fix was checked
against the **backend** source of truth — the Prisma schema, the controller's return type, the
service that builds the response — never against the client's own interface, since the client
interface is exactly what was wrong in four of these.

**Crashes and silent failures**

1. **A paid order reported as a failure.** `checkoutScreen.tsx` called `playNotificationSound`
   without importing it. `api.orders.pay` had already returned, so the money was taken — then the
   `ReferenceError` was caught by the surrounding `catch` and the customer was shown "Checkout
   failed. Please try again." A customer who tries again pays twice.
2. **Sign-out went nowhere.** `AccountManagementScreen` declared `onSignOut` in its props type but
   never destructured it. The session ended server-side, then the call threw, and the user was left
   sitting on the account screen looking signed in.
3. **A rider stranded on a finished job.** The terminal-state panel was guarded by
   `isTerminal && job.status !== 'DELIVERED'`, so a delivery paid by wallet or card — no cash to
   confirm — matched neither panel: no confirmation, no "Done" button. The guard also made the
   `'✅ Delivered'` branch inside it unreachable, which is how TypeScript found it.

**Client reading fields the backend does not send**

4. **A verified merchant never showed as approved.** `business?.approvalStatus === 'APPROVED'` —
   the backend field is `verificationStatus`, the enum is
   `PENDING | UNDER_REVIEW | VERIFIED | REJECTED`, and there is no `APPROVED`. The comparison was
   always false, so the onboarding checklist told every merchant "your application is with the
   DrippleX team" forever.
5. **Always "your driver".** The tip screen's state was typed `RideDto`; `GET /customer/rides/:id`
   returns `CustomerRideDto`, which is `RideDto` plus `driverName`.
6. **The customer's name vanished mid-delivery.** `GET /rider/jobs[/:id]` returns
   `RiderDeliveryJobDto` (with `customerName`); the job _actions_ return a plain `DeliveryJobDto`.
   `act()` replaced the whole job with an action's result, so after the rider tapped anything the
   "Message customer" button fell back to "Your customer". Now merged, keeping the name.
7. **`activeRiderJob`** was typed `DeliveryJobDto` in `App.tsx` while being fed from — and passed
   to — code expecting `RiderDeliveryJobDto`.
8. **Review counts always read "(0)"** next to a live star rating; `ProductSummaryDto.rating.count`
   was available and unused.

**Dead controls**

9. **Three unclickable rows in the Ops Console.** The `Card` component takes `{children, style}`
   and silently dropped the `onClick` those rows passed — while `cursor: 'pointer'` made them look
   clickable. An operator could not select a driver from those queues.
10. **The chat route's fallback home was half-wired.** It passed `onSearch`/`onCart`, which
    `HomeScreen` no longer takes, and omitted the required `onSecurity`. Both renders now come from
    one hoisted definition so they cannot drift again.
11. **The analytics heatmap had no hover readout** — `title` was written inside the `style` object,
    where it is not a CSS property and did nothing.

## 4. Gaps recorded rather than filled

Per the playbook, missing backend data is documented, not invented.

- **`StoreProduct.category`** is optional and unset for live products. `ProductSummaryDto` carries
  `categoryId` (a UUID) and no name, so a store's category strip shows "All" alone. Resolving ids
  to `CategoryDto.name` is unbuilt wiring.
- **Six Ops Console lists have no feed** — promotions, generated reports, integrations, roles,
  admin sessions, peak-hour demand, and the audit log. They stay empty. What changed is that each
  is now a named row type instead of `Record<string, unknown>`, so the table code typechecks and
  the type states exactly which fields an endpoint must return. An untyped bag documents nothing
  and would render `undefined` the day something half-shaped is wired in.

## 5. Verification

```
pnpm turbo run typecheck --filter=@dripplex/super-app   # 0 errors
pnpm typecheck                                          # 19/19 packages
pnpm --filter @dripplex/super-app build                 # vite build succeeds
```

The fixes are type-level and small, but they are behavioural: items 1, 2, 3, 4, 9 and 10 change
what a person sees. They have not been exercised in a browser — worth walking checkout, sign-out, a
non-cash delivery and the Ops driver queue once this is deployed.
