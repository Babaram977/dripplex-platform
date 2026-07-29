# Reality Stage R1.4 — Merchant Product Management UI — Design Handoff Package

**Date:** 2026-07-28
**Branch:** `claude/dripplex-coolify-deploy-fatig4`
**Commit:** `62aa3d9`
**Status:** Frontend complete, typecheck/lint clean, manually browser-verified against a live local backend. **Not yet applied to Railway** — same standing caveat as R1.1–R1.3: this session has no Railway deploy access, so nothing here is live until this branch reaches whatever branch Railway deploys from.

---

## 1. Summary

R1.4 is the first real screen surface in any portal app since the recovery audit: a working merchant-portal UI for the R1.2 merchant product management API. A merchant can now sign in, see catalog stats, and run the full product lifecycle — create a draft, add images, add variants, set inventory, publish, unpublish, edit, and delete — end to end against the live backend, with no mock data anywhere in the path.

**No Figma designs were available for this milestone.** Per your explicit fallback instruction, this was built against the existing DrippleX Design System (DDS) and the shared `@dripplex/ui` package rather than waiting on the Figma MCP connector. Concretely that meant:

- Reused the existing brand tokens, `customer-web`'s shell/nav patterns, and the pre-existing `PortalAuthGate` component verbatim — no new visual language invented.
- One correction from memory: the DDS type system is **Sora (display) + Manrope (sans)**, not Poppins. `docs/BRAND-IDENTITY.md` documents this as the established stack and explicitly says not to introduce alternates in feature code, so R1.4 uses the existing `font-display`/default sans classes rather than Poppins.
- Every new component (`Textarea`, `Select`, `Switch`) is a small, isolated primitive added to `@dripplex/ui` following the exact styling convention `Input` already uses — nothing is hard-coded inline in merchant-portal, so a future Figma pass can restyle these three primitives once and every screen picks it up.

This is the point where a real pixel-conformance pass against Figma frames (once the connector is reconnected, or you paste frame links) will matter most — see §4.

## 2. What's built

**Routes** (all under a new `(dashboard)` route group in `apps/merchant-portal`, gated by the existing `PortalAuthGate`):

| Route           | Purpose                                                                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`             | Overview — live product-count stat cards (total/published/draft, from 3 parallel `list()` calls), "New product" CTA, existing `BackendStatusPanel` (kept as-is, unmodified)                                                                                                                                 |
| `/products`     | List — status filter dropdown, page-based pagination (R1.2's list endpoint is page-based, not cursor-based — this is a merchant's own catalog, not the public browse endpoint), empty state, status/featured badges                                                                                         |
| `/products/new` | Create — name/description/price/currency/SKU form, creates as `DRAFT`, redirects to the detail page                                                                                                                                                                                                         |
| `/products/:id` | Detail — 4 panels: Details (name/description/price/SKU/featured toggle), Images (add by URL, reorder via up/down, remove), Variants (add/remove, active toggle), Inventory (track toggle, quantity, low-stock alert, reserved/available readout). Publish/Unpublish/Delete actions live in the page header. |

**Shell** (`apps/merchant-portal/src/components/layout/`): `Sidebar` (collapsible, "Overview"/"Products" nav, external "Back to site" link), `MobileNavDrawer`, `DashboardHeader` (sidebar toggle, theme toggle, user menu with sign-out) — all direct structural copies of `customer-web`'s equivalents, simplified to merchant-portal's smaller nav (no search bar, no notifications bell — out of scope here).

**SDK**: `MerchantProductsApi` (`packages/sdk/src/merchant/merchant-api.ts`) — one method per R1.2 endpoint (`list`, `get`, `create`, `update`, `remove`, `publish`, `unpublish`, `addImage`, `removeImage`, `reorderImages`, `createVariant`, `updateVariant`, `removeVariant`, `updateInventory`), wired into `DripplexClient` and the `merchant` portal SDK barrel. 11 new unit tests cover every method's request shape.

**New `@dripplex/ui` primitives**: `Textarea`, `Select` (native `<select>` wrapper), `Switch` (button-based toggle, `role="switch"`).

## 3. What Nora needs to know before a Figma conformance pass

- **This is intentionally plain.** No custom illustrations, no motion, no empty-state artwork beyond the existing `EmptyState` component's default. It's built for correctness first; visual refinement is expected to be a follow-up pass, not a rebuild.
- **The overview page keeps the pre-existing `BackendStatusPanel`** below the new stat cards. It's a diagnostic panel (shows auth/business/KYC/wallet status against the live backend) that predates R1.4 and wasn't designed for merchants — it has some redundant UI (its own sign-out link, separate from the header's). Left in place deliberately rather than deleted, since removing it wasn't in scope and it's genuinely useful for debugging. Worth a decision on whether it survives into a polished design or gets moved to a diagnostics-only route.
- **Images are added by URL only** — there's no file upload/asset pipeline in this milestone. A merchant pastes an image URL (e.g., from an existing CDN) and it's added as-is. If direct upload is wanted, that's a distinct piece of scope (needs a storage backend) not covered here.
- **List pagination is page-numbered** (Previous/Next, "Page X of Y") because R1.2's merchant list endpoint returns `PaginatedResult` with `page`/`pageSize`/`totalPages`, unlike R1.3's customer-facing cursor pagination. Don't design an infinite-scroll pattern for this screen — the API doesn't support it here.
- **No merchant onboarding/business-setup UI exists yet.** This assumes a merchant account already has an approved `MerchantProfile` (R1.2's `requireMerchantId` check). A brand-new merchant with no profile will hit a 404 from every product endpoint — there's no friendly "set up your business first" screen. That's a gap, not a bug in this milestone's scope; flagging it as a likely next-priority screen.

## 4. Environment note: dev-mode CSP fix

While browser-verifying this milestone, discovered that the shared Next.js security-headers config (`packages/config/next/security-headers.js`, used by all five portals — Program C3) sets a strict `script-src 'self' 'unsafe-inline'` CSP with no `'unsafe-eval'`. Next.js's dev-mode Fast Refresh requires `eval()`, so every portal's `next dev` server was silently non-interactive — forms would fall back to native HTML submission (visible as a GET request with the form fields as a query string) because the CSP blocked React's event handlers from ever attaching. This wasn't specific to merchant-portal or R1.4; it would have affected local development on any portal.

Fixed narrowly: `'unsafe-eval'` is now included in `script-src` only when `NODE_ENV !== 'production'`. Production builds (Railway) are unaffected — same strict policy as before. This is what made the manual browser walkthrough in §5 possible at all.

## 5. Verification performed

- `pnpm --filter @dripplex/merchant-portal typecheck` — clean
- `pnpm --filter @dripplex/merchant-portal lint` — clean (0 errors)
- `pnpm --filter @dripplex/sdk test` — 52/52 passing (11 new for `MerchantProductsApi`)
- `pnpm --filter @dripplex/sdk lint`, `build` — clean
- `pnpm --filter @dripplex/ui lint`, `build` — clean
- Typecheck re-run for all 5 portals (`customer-web`, `admin-portal`, `rider-portal`, `operations-console`, `merchant-portal`) to confirm the shared CSP change didn't break anyone else — clean
- **Manual browser walkthrough** (Playwright against a live local backend + local Postgres/Redis, real merchant JWT, no mocks): sign in → dashboard stats render → create draft product → add image by URL → add variant → set inventory (quantity/low-stock alert) → publish → confirm `PUBLISHED` badge and Unpublish button appear → return to list, confirm item + badge + formatted price → return to dashboard, confirm stat cards updated to 1 total / 1 published / 0 draft. No console or runtime errors at any step. Test product and test merchant account deleted afterward; no test data left in any database.

## 6. Suggested next step

R1.5 — Customer Marketplace UI, consuming the R1.3 customer API (browse/search/detail/presets). Per the PR #35 closure note from Step 2, some reusable shell pieces (mobile-nav-drawer pattern, dashboard-placeholder conventions) already exist in `customer-web` and should be reused rather than rebuilt.
