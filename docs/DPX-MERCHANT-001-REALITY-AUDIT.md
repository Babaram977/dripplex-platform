# DPX-MERCHANT-001 — Merchant Module: Reality Audit & Proposed Implementation Plan

Founder-directed (2026-08-05), immediately after the DPX-OPS-001 freeze, with
an explicit instruction: **audit only, no implementation yet**. Treat the
complete Figma Make export under `docs/reference/figma-super-app-source/` as
the visual source of truth "wherever Merchant screens exist," audit every
Merchant Figma screen against the actual merchant backend, database, SDK and
current portal, identify what is real/partial/missing/contradicted, do not
redesign Figma screens, do not fabricate backend capabilities, and return
with a proposed production implementation plan for Founder approval. This
document is that return.

Founder-set roadmap this audit sits inside: **Merchant → Orders → Admin →
AI**, using the standing discipline — reality audit → Figma/source audit →
backend/schema/API audit → gap analysis → Founder scope approval →
implementation → E2E verification → security review → production audit →
Founder approval → freeze. This document covers the first four steps. No
code was written or changed to produce it.

## 1. Figma/source audit — decisive finding: no Merchant screens exist

The founder's instruction was conditional: treat the Figma Make export as
source of truth "wherever Merchant screens exist." That condition needed to
be checked, not assumed. It was checked exhaustively, three independent ways:

1. **Direct file listing** of `docs/reference/figma-super-app-source/` (26
   files) — every file is named for a real module (`homeScreen.tsx`,
   `marketplaceScreen.tsx`, `storeScreen.tsx`, `productDetailScreen.tsx`,
   `cartScreen.tsx`, `checkoutScreen.tsx`, `rideScreen-v2.tsx`,
   `driverScreen.tsx`, `walletScreen.tsx`, `adminConsoleScreen.tsx`,
   `trackingScreen.tsx`, plus grouped `screensA/B/C/D.tsx` and design
   tokens). No file named for Merchant.
2. **`App.tsx`'s own screen-module index** (lines 51-135), which is the
   export's definitive list — every screen module the export actually wires
   up is imported there via `import { ... } from '../features/<MODULE>'`.
   The complete list, read directly: **HOME, MARKETPLACE, STORE, PRODUCT,
   CART, CHECKOUT, ORDERS, RIDE, DRIVER, WALLET, ADMIN**. No `MERCHANT`
   import exists.
3. **Cross-referencing two independent historical inventory docs** written
   before this audit: `docs/FIGMA-SOURCE-INVENTORY.md` explicitly records
   "MERCHANT | 🔴 placeholder only" and states there is "no Figma-generated
   Ride, Driver, Wallet, Merchant, or Admin/Ops UI to compare against" (an
   earlier, now-superseded claim about several of those modules, but
   Merchant's placeholder status was never revised). `docs/
FIGMA-SOURCE-INVENTORY-V2.md` — written after the "complete" export was
   recovered — lists real screen files for every module its own prose
   claims is now real, **except Merchant**, which is silently absent from
   its own inventory table. That absence corroborates, not contradicts,
   the direct file-system finding.

**Conclusion**: the recovered Figma Make export does not contain a Merchant
module. This is not a gap in this audit's search — it is a property of the
source file itself, confirmed three ways. There is no Merchant screen to
audit against, and per the founder's own instruction not to redesign Figma
screens or fabricate anything, this audit does not invent one. This is the
same situation Driver Slice 1 and Slice 2 were already found in and
documented honestly (`DPX-100-MODULE-COMPLETION-GATE.md`'s "Figma-first
scope note") — those slices proceeded without a Figma comparison and were
frozen on that basis with founder approval. The proposed plan in §5 follows
that precedent rather than treating it as a blocker.

## 2. Backend/schema audit

Read directly: `apps/backend/prisma/schema.prisma`, `apps/backend/src/
merchants/`, `apps/backend/src/orders/merchant-orders.controller.ts` (+
service, per `docs/MARKETPLACE-FOUNDATION.md`), `apps/backend/src/products/
merchant-products.controller.ts`, `apps/backend/src/wallet/
merchant-wallet.controller.ts`, `apps/backend/src/analytics/
merchant-analytics.controller.ts`, `apps/backend/src/reviews/
merchant-reviews.controller.ts`, `apps/backend/src/promotions/`.

| Schema model                                                     | Real?                                                                                                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MerchantProfile`, `MerchantOnboarding`                          | ✅ Real — status lifecycle (`MerchantStatus`), approval fields.                                                                                          |
| `Business`                                                       | ✅ Real, but **single business per merchant** — `merchantId` is `@unique`, one `address`/`latitude`/`longitude` per row. No branch/location child model. |
| `MerchantKyc`                                                    | ✅ Real — document type/status/review fields, linked to both merchant and business.                                                                      |
| `BankAccount`                                                    | ✅ Real — multiple per merchant, default flag, unique per `(merchantId, accountNumber)`.                                                                 |
| `Promotion.merchantId`                                           | ✅ Field exists (optional) — schema supports merchant-scoped promotions, but see §2's promotions row below for who can actually set it.                  |
| `AnalyticsDailyMetric`                                           | ✅ Generic `scopeType`/`scopeId` metric store — used by the real merchant analytics endpoint (see below).                                                |
| Branch/location, staff/team-member, support ticket for merchants | ❌ **No model exists anywhere in the schema** for any of these three.                                                                                    |

## 3. Backend API + SDK audit, capability by capability

This is the founder's own named capability list (onboarding/KYC, business
profile, branches, catalog/products, inventory/availability, incoming
orders, order processing, fulfilment, settlements/earnings, promotions,
analytics, staff/roles, support, notifications), each checked against the
real controller, the real SDK client, and the real merchant-portal page.

| Capability                                         | Backend                                                                                                                                                                                                        | SDK                                                                                                                                                                                                                                                                                                                         | Portal UI                                                             | Status                                                                                                                                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Onboarding / KYC                                   | ✅ `POST/GET /merchant/kyc` (`MerchantController`)                                                                                                                                                             | ✅ `MerchantApi.submitKyc/getKycStatus`                                                                                                                                                                                                                                                                                     | ❌ No page                                                            | **Partial** (backend+SDK real, portal missing)                                                                                                                                                                                            |
| Business profile                                   | ✅ `POST/GET/PATCH /merchant/business`                                                                                                                                                                         | ✅ `MerchantApi.createBusiness/getBusiness/updateBusiness`                                                                                                                                                                                                                                                                  | ❌ No page                                                            | **Partial**                                                                                                                                                                                                                               |
| Bank accounts                                      | ✅ `POST/GET /merchant/bank-account`, `PATCH .../default`                                                                                                                                                      | ✅ `MerchantApi.createBankAccount/listBankAccounts/setDefaultBankAccount`                                                                                                                                                                                                                                                   | ❌ No page                                                            | **Partial**                                                                                                                                                                                                                               |
| Branches (multi-location)                          | ❌ No model, no endpoint                                                                                                                                                                                       | ❌ N/A                                                                                                                                                                                                                                                                                                                      | ❌ N/A                                                                | **Missing**                                                                                                                                                                                                                               |
| Catalog / products                                 | ✅ Full CRUD + publish/unpublish/images/variants/inventory (`MerchantProductsController`)                                                                                                                      | ✅ `MerchantProductsApi` — 13 methods, matches 1:1                                                                                                                                                                                                                                                                          | ✅ List, create, edit, images, variants, inventory pages built (R1.4) | **Real, end to end**                                                                                                                                                                                                                      |
| Inventory/availability (per-product)               | ✅ `PATCH /merchant/products/:id/inventory`                                                                                                                                                                    | ✅ `MerchantProductsApi.updateInventory`                                                                                                                                                                                                                                                                                    | ✅ Built as part of the products UI                                   | **Real**                                                                                                                                                                                                                                  |
| Store pause/resume (storefront-level availability) | ✅ `POST /merchant/business/pause`, `POST /merchant/business/resume` (`MerchantController`) — real service methods, real audit events                                                                          | ❌ **No SDK method** — grepped `packages/sdk/src` for `pauseStore`/`resumeStore`/`pause-store`/`resume-store`: zero matches                                                                                                                                                                                                 | ❌ No control anywhere in the portal                                  | **Contradicted** — real backend capability, completely unreachable from any frontend today                                                                                                                                                |
| Incoming orders / order processing / fulfilment    | ✅ `MerchantOrdersController` — `list/get/accept/reject/ready/delay/cancel`, backed by `MerchantOrdersService` and the Universal Order State Machine (DPX-CORE-003 #1-2, `docs/MARKETPLACE-FOUNDATION.md`)     | ❌ **No SDK method for any of these six actions.** Confirmed by my own grep of `packages/sdk/src`, and independently by the codebase's own test: `packages/sdk/src/e2e/merchant-flow.e2e.spec.ts` line 98 — a test literally titled _"documents Backend Core gap: no merchant order accept/prepare/ready endpoints on SDK"_ | ❌ No orders page in the portal at all                                | **Contradicted** — the single biggest capability gap: a merchant today has no way, through any real client, to see or act on an incoming order                                                                                            |
| Settlements / earnings                             | ✅ `GET /merchant/wallet` (`MerchantWalletController`) — balance only, via the shared `WalletService`                                                                                                          | ✅ `WalletClient.merchantWallet()` — path matches (`/merchant/wallet`)                                                                                                                                                                                                                                                      | ❌ No page                                                            | **Partial** (balance real; no earnings breakdown/settlement-history view distinct from the generic wallet)                                                                                                                                |
| Promotions                                         | ⚠️ `Promotion.merchantId` field exists (schema supports merchant scoping), but only `customer-promotions.controller.ts` (browse) and admin (`AdminPromotionsClient`) exist — **no merchant-facing controller** | N/A — nothing to call                                                                                                                                                                                                                                                                                                       | ❌ No page                                                            | **Missing** for merchant self-service (admin can scope a promotion to a merchant on the merchant's behalf; the merchant cannot create/manage their own)                                                                                   |
| Analytics                                          | ✅ `GET /merchant/analytics/overview` (`MerchantAnalyticsController`, real `AnalyticsService.getMerchantOverview`)                                                                                             | ❌ **Path mismatch bug**: `AnalyticsClient.merchant()` requests `GET /merchant/analytics` (no `/overview` suffix) — the SDK method as written does not match the only route the controller exposes and would 404 against the real backend                                                                                   | ❌ No page                                                            | **Contradicted** — a real backend capability with a broken SDK contract, not caught by the merchant-flow e2e spec because that spec only mocks `fetch` and asserts the SDK's own call sequence, never validates against real Nest routing |
| Staff / roles                                      | ❌ No model, no endpoint — a merchant account is single-user only                                                                                                                                              | ❌ N/A                                                                                                                                                                                                                                                                                                                      | ❌ N/A                                                                | **Missing**                                                                                                                                                                                                                               |
| Support                                            | ❌ No merchant-scoped support model — only `DriverSupportTicket` exists, driver-only                                                                                                                           | ❌ N/A                                                                                                                                                                                                                                                                                                                      | ❌ N/A                                                                | **Missing**                                                                                                                                                                                                                               |
| Notifications                                      | ✅ Merchant lifecycle events wired through the platform-wide `NotificationService.notifyMerchantLifecycle()` (audit+event+notification triple pattern, same as every other module)                             | ✅ `MerchantSdk.notifications` exposes the same generic `NotificationsClient` every portal uses                                                                                                                                                                                                                             | ❌ No bell/list anywhere in the portal's header or sidebar            | **Partial** (backend+SDK real, zero portal surface)                                                                                                                                                                                       |
| Reviews (merchant reply)                           | ✅ `POST /merchant/reviews/:id/reply` (`MerchantReviewsController`)                                                                                                                                            | ✅ `ReviewsClient` reply method, path matches                                                                                                                                                                                                                                                                               | ❌ No page                                                            | **Partial**                                                                                                                                                                                                                               |

### Two confirmed contract defects, not just gaps

Two of the rows above are not "not built yet" — they are places where a real
SDK method exists and would fail against the real backend today:

1. **Analytics path mismatch** — `AnalyticsClient.merchant()` calls
   `/merchant/analytics`; the only route the backend serves is
   `/merchant/analytics/overview`. One-line SDK fix once scope is approved.
2. **Store pause/resume and the six order-lifecycle actions have zero SDK
   coverage** despite complete, real backend implementations. This is
   already self-documented in the repository's own test suite (the
   `merchant-flow.e2e.spec.ts` gap-test named above), so this finding is
   corroborated by the codebase itself, not only by this audit.

## 4. Current `merchant-portal` frontend — reality check

Read directly (full route listing): the app has exactly two functional
areas behind auth — `(dashboard)/page.tsx` (an overview showing product
counts only, via `sdk.merchantProducts.list()`) and `(dashboard)/products/`
(list, `new/`, `[id]/` edit — the R1.4 catalog UI, which is genuinely
complete and real). The sidebar (`components/layout/sidebar.tsx`) has
exactly two nav items: **Overview** and **Products**. The header
(`components/layout/dashboard-header.tsx`) has a theme toggle and a
sign-out menu — no notification bell, no business/KYC/wallet/orders link
anywhere. This matches the backend/SDK audit precisely: the only capability
area that is real end-to-end (backend, SDK, and portal UI) is catalog
management. Every other capability that has real backend+SDK support
(onboarding, KYC, bank accounts, wallet, analytics, reviews) has **no portal
page at all**, and the single highest-value capability — incoming order
processing — is missing at the SDK layer too, so it can't be built without
that SDK work first regardless of UI effort.

One deployment-path note, out of scope for this audit to act on but worth
recording: `merchant-portal` is configured for Cloudflare (`open-next.config.ts`,
`wrangler.jsonc`) rather than the Railway/Coolify Docker pattern the rest of
the platform (`operations-console`, `driver-portal`, `customer-web`,
`admin-portal`) now uses. Whether that's intentional or should be aligned is
a Founder decision, not assumed here.

## 5. Gap analysis summary

| Area                                                                    | Real | Partial (backend real, portal missing) | Contradicted (SDK/backend mismatch) | Missing entirely |
| ----------------------------------------------------------------------- | ---- | -------------------------------------- | ----------------------------------- | ---------------- |
| Catalog/products, per-product inventory                                 | ✅   |                                        |                                     |                  |
| Onboarding/KYC, business profile, bank accounts, reviews, notifications |      | ✅                                     |                                     |                  |
| Settlements/earnings (balance only)                                     |      | ✅                                     |                                     |                  |
| Store pause/resume                                                      |      |                                        | ✅                                  |                  |
| Incoming orders / order processing / fulfilment                         |      |                                        | ✅                                  |                  |
| Analytics                                                               |      |                                        | ✅                                  |                  |
| Branches, staff/roles, support, merchant self-service promotions        |      |                                        |                                     | ✅               |

## 6. Proposed production implementation plan (for Founder approval — nothing below has been built)

Ordered by dependency and value, following the same phased pattern used for
every prior module. No phase below fabricates a backend capability that
doesn't exist — Phase 3 is explicitly the only phase that proposes new
backend work, and is separated out so it can be approved or deferred
independently of Phases 1-2.

**Phase 1 — Close the two contract defects + wire existing backend into the
SDK (no new backend logic, no schema changes):**

- Fix `AnalyticsClient.merchant()`'s path to `/merchant/analytics/overview`.
- Add SDK methods for `pauseStore`/`resumeStore` (`POST /merchant/business/pause|resume`).
- Add a `MerchantOrdersApi` (or extend `MerchantApi`) with `list/get/accept/reject/ready/delay/cancel`, mirroring the real controller 1:1 — this alone unblocks Phase 2's most important screen.

**Phase 2 — Merchant Portal UI for capability that is now fully real
end-to-end, composed from the platform's existing shared component library
(`packages/ui/src/components/super-app/`) and design tokens, since no
Merchant Figma screens exist to port from (§1). This is the same path
Driver Slice 1/2 took under the same condition, not a new precedent:**

- Incoming Orders queue + order detail with accept/reject/ready/delay/cancel actions — the single highest-value screen, since it's the only thing standing between "merchants can list products" and "merchants can actually run a storefront."
- Business profile page (view/edit).
- KYC submission + status page.
- Bank account management page.
- Store pause/resume control (likely as part of the business profile page or a dedicated settings page).
- Wallet/earnings page (balance, reusing the same wallet UI pattern already shipped for Wallet Slice 1-5).
- Analytics overview page (reusing the KPI-card pattern from DPX-OPS-001 Slice 4's analytics screens).
- Reviews reply UI.
- Notification bell, reusing the existing shared notification-bell pattern already shipped in `customer-web`.

**Phase 3 — New backend capability (each item below needs its own explicit
Founder scope decision — none of it exists today, and none of it is
assumed in scope by default):**

- Multi-branch/multi-location merchant support (schema + backend + SDK + UI) — a materially larger change (every order/product currently assumes one business per merchant).
- Merchant self-service promotions (a merchant-facing controller + permission + SDK + UI on top of the `Promotion.merchantId` field that already exists).
- Merchant staff/roles (sub-user delegation) — a new capability, no existing model to extend.
- Merchant support ticketing — could reasonably mirror the existing `DriverSupportTicket` pattern if approved.

Each phase would go through the full standing discipline after scope
approval: implementation → E2E verification → security review → production
audit → Founder approval → freeze, the same as every prior module.

## 7. What this audit did not do

Per the founder's explicit instruction: no code was written, no Figma
screens were redesigned or invented, and no backend capability was assumed
to exist without being read directly in source. Every "real" claim above
cites the file it was verified against; every "missing" claim was checked
by grep/read, not inferred from documentation alone — `docs/
MARKETPLACE-FOUNDATION.md`'s own SDK-gap claim, for example, turned out to
be stale for the onboarding/business/KYC/bank-account/catalog surface (real
SDK coverage exists there now) while still accurate for the order-lifecycle
surface — this audit re-verified rather than carrying either claim forward
unchecked.

## 8. Founder Scope Decision (2026-08-05)

Recorded verbatim from the founder's review of this audit:

> **Phase 1 — Approved.** Fix the existing integration defects first.
> Claude should: correct `AnalyticsClient.merchant()` to the real
> `/merchant/analytics/overview` endpoint; add SDK coverage for the
> existing `MerchantOrdersController` capabilities (list orders, accept,
> reject, ready, delay, cancel); add SDK coverage for store pause/resume;
> add proper SDK tests for every corrected/new contract. Do not change
> backend behavior merely to make the SDK easier. These are
> contract/integration repairs, not new product features.
>
> **Phase 2 — Approved.** Expose the real capabilities that already exist
> through merchant-portal. Priority should be operational usefulness
> rather than trying to manufacture a large portal: Merchant Home/Overview
> → Incoming Orders → Products/Catalog → Business Profile →
> Onboarding/KYC → Wallet/Bank → Reviews → Notifications → Analytics/Store
> controls. The critical workflow is: order received → merchant
> accepts/rejects → prepares → marks ready → fulfilment proceeds. That
> needs full E2E verification against the real Marketplace order
> lifecycle.
>
> **Important UI ruling.** The audit establishes that there is no
> recovered Merchant Figma source. Therefore Claude must stop referring to
> Merchant work as "Figma parity" — there is nothing to port 1:1. For
> Merchant only, use the established DrippleX Design System / DDS,
> existing approved brand tokens, shared primitives and interaction
> conventions to create a coherent operational portal. This does not
> authorize modifying locked shared components in ways that visually
> change Ride, Marketplace, Wallet or Driver. New Merchant-specific
> components are preferable where necessary. Maintain the usability rule:
> merchant tasks should be simple, precise and require as few steps as
> possible.
>
> **Phase 3 — Hold for individual approval.** I don't want Claude
> automatically building branches, promotions, staff/roles and support
> just because they're listed as missing — they have different business
> implications. Preliminary direction: **multi-branch** — defer initially,
> a single-location merchant should not have to understand branch
> management merely to start selling, but architecture should not prevent
> branches later; **promotions** — likely valuable, but rules are needed
> around what merchants may discount themselves versus
> platform-funded/admin campaigns; **staff/roles** — important for larger
> merchants but unnecessary complexity for small restaurants/shops at
> launch, a later merchant-business capability; **merchant support** —
> likely worth implementing sooner since real merchants need a path to
> resolve order/payment/account problems, but scope it deliberately rather
> than copying Driver Support blindly. Phase 3 remains unapproved new
> capability until reviewed individually.
>
> **One additional requirement.** Since onboarding/KYC and bank accounts
> already exist, Phase 2 should audit the merchant's activation gate
> before exposing onboarding as merely a collection of forms. We need to
> know exactly what must be true before a merchant can become ACTIVE and
> receive real customer orders — identity/business verification, required
> documents, bank/payment information, store readiness, and whatever the
> backend genuinely enforces should be examined. Do not invent conditions.
> If no unified activation gate exists, report that as a production gap
> before deciding how to fix it.
>
> **Approved execution sequence.** Phase 1 contract repairs →
> verification → Phase 2 portal implementation → real E2E merchant/order
> testing → security review → production audit → Founder Review. Do not
> freeze DPX-MERCHANT-001 and do not begin Phase 3 without coming back for
> approval.

This decision supersedes §6's Phase 3 framing above only insofar as Phase 3
is now explicitly on hold pending individual review of each item, not a
single approvable package. §6 is left as originally written (the audit's
own proposal) with this section recording what was actually approved.

## 9. Phase 2 pre-work: the merchant activation gate, read directly

Founder's requirement: know exactly what must be true before a merchant
becomes ACTIVE and can receive real customer orders — do not invent
conditions, and report honestly if no unified gate exists. It doesn't.
Unlike Driver (`DriverActivationService`, a single named service
`DPX-DRIVER-*` docs point to), Merchant's gate is inline logic split
across three independent files with no single source of truth:

1. **`MerchantsService.approveMerchant()`** (`apps/backend/src/merchants/
merchants.service.ts:538`) — the admin-side approval check. Reads
   exactly two conditions, nothing else:
   - A `Business` profile must exist (`ValidationDomainException` if not).
   - The merchant's latest `MerchantKyc` document must have
     `verificationStatus === VERIFIED` (`ValidationDomainException` if
     not, checked against `detail.kycDocuments[0]` — the newest one only).

   On pass, it sets `MerchantProfile.status = APPROVED`,
   `Business.status = ACTIVE`, `Business.verificationStatus = VERIFIED`,
   `MerchantOnboarding.status = APPROVED` — all in one transaction. There
   is no check here for a bank account, a minimum published-product count,
   business-address completeness, or anything else — those are simply not
   part of the gate.

2. **`CheckoutService.assertMerchantApproved()`** (`apps/backend/src/
orders/checkout.service.ts:512`) — the actual "can receive a real
   order" enforcement point, checked per-merchant at checkout time (not
   any earlier). Blocks with `ValidationDomainException` unless
   `MerchantProfile.status === APPROVED`. This is where "ACTIVE and
   receiving real customer orders" is genuinely enforced — everything
   upstream of it (product creation, publishing) has no such check.

3. **`CustomerMerchantsService`**'s browse/search/detail queries
   (`apps/backend/src/merchants/customer/customer-merchants.service.ts`)
   filter to `Business.status === ACTIVE AND MerchantProfile.isApproved
=== true`. An unapproved merchant's storefront is simply invisible to
   customers — they'd never reach checkout for it in the first place.

**What is genuinely not required, confirmed by absence, not assumption:**

- **Bank account**: `createBankAccount`/`listBankAccounts` are entirely
  optional self-service actions with no caller anywhere checking their
  existence before approval or before checkout. A merchant can be
  APPROVED and fulfilling paid orders with zero bank accounts on file.
- **Minimum catalog**: nothing requires at least one published product
  before approval — an approved merchant with an empty catalog is valid
  state, just commercially inert until they publish something.
- **Identity verification** (`assertIdentityVerified` —
  `user.emailVerifiedAt`/`phoneVerifiedAt`) is checked once, at
  `createBusiness`/`submitKyc` time (i.e., before a `Business` row can
  even exist), not re-checked at `approveMerchant` time. In practice this
  makes it a precondition to reaching step 1's gate rather than part of
  the gate itself.

**A materially more important finding, found while tracing this path**:
grepping `apps/backend/src/orders`, `apps/backend/src/payments`, and
`apps/backend/src/wallet` for any merchant-wallet-crediting call
(`WalletOwnerType.MERCHANT` used as a credit target, or any
`OrderSettlement`/`MerchantSettlement` model in `schema.prisma`) returns
**zero results**. Ride has a real settlement service
(`RideSettlementService`, DPX-CORE-003 predecessor work) that splits fare
into a commission split and credits the driver's wallet through a
clearing-house pattern. **No equivalent exists for Marketplace orders.**
`GET /merchant/wallet` (§3's "settlements/earnings" row) is a real,
correctly-wired read endpoint — but nothing in the codebase ever deposits
money into a merchant's wallet from a paid order. A fully approved
merchant, fulfilling paid orders end-to-end through the real
`MerchantOrdersController` lifecycle Phase 1 just wired into the SDK,
would see their wallet balance stay at zero throughout. This corrects
§3's "settlements/earnings: Partial (balance real; no earnings breakdown
view)" row — the gap is not the missing breakdown view, it's that the
underlying revenue-crediting mechanism does not exist at all. Building a
merchant-facing Wallet/Earnings screen in Phase 2 would therefore show a
technically-real but permanently-empty number; the screen should say so
honestly (a documented capability gap per the DPX-100 gate's "missing
backend capabilities are documented, never faked" rule) rather than imply
earnings are being tracked.

This is a new finding, not raised in the original Phase 3 proposal (§6),
and not one of the four items the founder's scope decision (§8) already
addressed. It is not itself a Phase 3 item (branches/promotions/staff/
support) — it's a hole in a capability (settlements/earnings) already
classified "Partial" and put in Phase 2. Flagging it here rather than
silently building around it, per the standing "don't fabricate backend
capabilities" instruction.
