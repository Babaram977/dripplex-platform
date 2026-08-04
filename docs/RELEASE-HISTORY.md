# DrippleX release history

**This is the canonical release timeline.** It reflects what's actually in git history and what was actually verified — not what any individual milestone doc claimed at the time. Where an earlier document's claims didn't hold up, that's noted here and the original document was corrected or archived (`docs/archive/`) rather than silently rewritten.

**No `v1.0.0` tag exists yet.** Per the founder's explicit instruction (2026-07-28): that specific tag gets created when there's a real, deployed, end-to-end-verified product behind it — not before, regardless of what any release-notes document says. A `v1.0-baseline` tag (2026-08-04, see "Baseline" below) exists locally, marking a git-history consolidation point — `main` catching up to already-built, already-frozen module work, not a production launch claim — but is not yet pushed to the remote (deferred, GitHub-side policy).

---

## 2026-07-21 — Backend Core built (S1-C1 through C23)

23 chapters of backend work, each merged as its own reviewed PR over the course of one day: identity, auth, merchant onboarding, customer addresses, cart, checkout/orders, payments, delivery, and platform supporting systems (notifications, search, reviews, promotions, loyalty, CMS, fraud, analytics, wallet, audit).

**`v1.0.0-backend-core` (`docs/RELEASE-v1.0.0-backend-core.md`)** — accurate, holds up. Quality gates recorded at the time (lint/typecheck/build clean, 607 backend tests passing) match what this session independently re-verified via `docs/AUDIT-IMPLEMENTATION.md`. Scoped narrowly to the backend only — doesn't claim frontend completeness. No tag was cut for this either, but the claims in the document are accurate to what was actually built.

## 2026-07-21 to 2026-07-22 — Frontend shells + RC1 claimed

Frontend app shells built (Program B/C: customer-web, merchant-portal, rider-portal, admin-portal, operations-console) with brand identity work, an SDK integration layer, and end-to-end validation tooling. `docs/RELEASE-RC1.md` recorded this as release candidate `1.0.0-rc.1`, "frozen" for launch.

**Not accurate, archived:** No `1.0.0-rc.1` tag was ever created. The frontend work delivered was thinner than the RC1 document implies — confirmed later by `docs/AUDIT-IMPLEMENTATION.md`: every app beyond `customer-web` had login only, and `customer-web` itself had auth + a dashboard shell, no commerce UI. See `docs/archive/unrealized-releases/`.

## 2026-07-22 — v1.0.0 launch attempted, NO-GO

Program D (D1–D5) built production infrastructure design and packaging: Cloudflare Workers config for all five frontend apps, a Hetzner/Docker Compose/Kubernetes design for the backend, GHCR image publishing, monitoring/alerting design, mobile app packaging, and a go-live runbook. `docs/RELEASE-v1.0.0.md` and the merged `docs/PROGRAM-D5.md` recorded this as a completed `v1.0.0` production launch.

**Not accurate, archived.** What actually happened, recorded honestly in the launch attempt's own `PRODUCTION_READINESS.md` (from the PR that attempted it, since closed — see below): **verdict NO-GO.** No Cloudflare account authentication was available in the deploying environment, DNS for `dripplex.com` pointed at an unrelated third-party parking page (not Cloudflare), no production Postgres/Redis was provisioned, and every one of the 13 live-verification checks (landing page, registration, login, OTP, API health, etc.) failed. `docs/ops/LAUNCH-EXECUTION.md` (now archived) self-recorded its own status as "IN PROGRESS — deploy blocked." No tag was ever created. See `docs/archive/pre-railway-infrastructure/` and `docs/archive/unrealized-releases/`.

Two PRs continuing this work — #35 ("Program B1: Customer Web production shell & Cloudflare packaging") and #36 ("Program D1: Production deployment packaging & live launch attempt", containing the `PRODUCTION_READINESS.md` NO-GO report referenced above) — sat open, unmerged, until closed on 2026-07-28 as part of this reconciliation (see below).

## 2026-07-22 (separately) — Backend actually deployed live, on Railway

In a separate, later thread of work (not part of Programs A–D), the backend was deployed to Railway and **genuinely verified live**: `/api/v1/health` responded healthy with real Postgres and Redis connections confirmed via direct `curl`, not assumption. `customer-web` and `admin-portal` were also deployed to Railway and confirmed reachable. This is the only production infrastructure claim in this project's history that was independently, hands-on verified at the time it was made.

## 2026-07-28 — Implementation Audit

`docs/AUDIT-IMPLEMENTATION.md`: ran the actual backend test suite (91 suites, 607 tests, all passing) and read the actual frontend source trees. Found the backend far more complete than the release documents' frontend claims suggested, and the frontend far less complete — login-only everywhere except `customer-web`'s dashboard shell. Also found the single largest gap: no `Product` model existed anywhere in the schema. This finding became the basis for the "Reality Stage."

## 2026-07-28 — Reality Stage R1.1, R1.2, R1.3

Built and shipped, on `claude/dripplex-coolify-deploy-fatig4` (not yet merged to `main`):

- **R1.1 — Product Catalog Foundation:** `Category`, `Brand`, `Product`, `ProductImage`, `ProductVariant`, `ProductInventory` models, non-destructive migration, Cart/Order wired to real product validation. 631 tests (607 existing + 24 new).
- **R1.2 — Merchant Product Management API:** create/update/delete/publish/unpublish, image/variant/inventory management, permission-scoped to the owning merchant. 651 tests (+20).
- **R1.3 — Customer Marketplace API:** browse/filter/sort/search with cursor pagination, featured/new-arrivals/trending/recommended, product detail, similar products, categories/brands. 685 tests (+34).

Each milestone shipped with a Design Handoff Package (`docs/REALITY-STAGE-R1.1.md`, `R1.2` endpoint list in-thread, `docs/REALITY-STAGE-R1.3.md`) documenting the API contract for the design side.

**Status: real and tested, not yet deployed anywhere.** This work exists only on the feature branch — none of it has reached Railway (or anywhere else) yet, because Railway tool access has been unavailable for the duration of this work.

## 2026-07-28 — Production Readiness Audit and recovery

A founder-requested "Executive Review" against the release documents' claims was instead redirected into `docs/AUDIT-PRODUCTION-READINESS.md` — an evidence-based check against 7 concrete criteria (codebase freeze, PRs merged, security issues, infra readiness, store readiness, launch checklist, operational blockers). None passed. Recovery plan, approved by the founder, executed the same day:

1. **Infrastructure consolidated on Railway** — the only target with firsthand verification. Cloudflare Workers/Hetzner/GHCR design archived to `docs/archive/pre-railway-infrastructure/`; `docs/ops/PRODUCTION-RAILWAY.md` is now canonical.
2. **PRs #35 and #36 closed** — both described Cloudflare production work that never went live; the closing comments preserve the branches as reference and flag reusable non-Cloudflare UI work in #35 for R1.5.
3. **Dependency vulnerabilities triaged**: 9 findings → 2 remaining (both deferred with documented reasoning, not silently dropped) — see `docs/SECURITY-VULNERABILITY-TRIAGE.md`.
4. **Release documentation reconciled** — this document, plus archiving `RELEASE-v1.0.0.md`, `RELEASE-RC1.md`, and `PROGRAM-D5.md` to `docs/archive/unrealized-releases/` with correction banners.

## 2026-07-28 — Reality Stage R1.4, R1.5

Built and shipped, still on `claude/dripplex-coolify-deploy-fatig4` (still not merged to `main`):

- **R1.4 — Merchant Product Management UI:** dashboard shell, product list/create/edit, publish/unpublish, image/variant/inventory management, all in `merchant-portal`. Built against the R1.2 API with no Figma access (founder-approved DDS fallback). Found and fixed a real bug along the way: the shared Next.js CSP config blocked `unsafe-eval`, silently breaking client-side interactivity in every portal's local dev server. 745 backend tests unaffected; 11 new SDK tests for the merchant products client.
- **R1.5 — Customer Marketplace UI:** Marketplace Home, Merchant Listing, Product Listing, Merchant Mini Store, Product Detail, smart search (lightweight structural parsing, not an LLM, per explicit founder decision), and cart/favourite/share on every product card — all in `customer-web`. Required a backend-first phase since R1.3 never shipped a merchant-listing API (`GET /merchants`, `GET /merchants/:id`, both smart-search endpoints, plus a `CustomerProductsApi`/`CustomerMerchantsApi` SDK client that R1.3 also never got). 709 backend tests, 62 SDK tests, all green.

Both milestones were verified with a full manual browser walkthrough against a live local backend with seeded data — not just typecheck/lint/unit tests — and each caught real, previously-undetected bugs before they could reach production:

- R1.5's backend work found `Business.merchantId` (→ `User.id`) and `Product.merchantId` (→ `MerchantProfile.id`) are different ID spaces despite the identical field name — fixed before the merchant-listing API shipped.
- R1.5's frontend verification found `@dripplex/types`'s `package.json` had no CJS export condition, meaning the backend's compiled output could never actually `require()` it — `node dist/main.js` was silently broken. Also found the pre-existing `CartService` used the wrong ID space (the same class of bug as above, in code that predates this whole effort), meaning **every real Add to Cart call from the marketplace would have failed**. Both fixed and verified via live requests, not just tests.

Each milestone shipped a Design Handoff Package (`docs/REALITY-STAGE-R1.4.md`, `docs/REALITY-STAGE-R1.5.md`).

**Status: real, tested, browser-verified — still not merged to `main`, still not deployed anywhere.** See `docs/AUDIT-PRODUCTION-READINESS-R1.6.md` for what that gap actually means before treating any of this as "in production."

## 2026-07-28 — Gate R1.6.1: R1.1–R1.6 merged to `main`

PR #44 (`claude/dripplex-coolify-deploy-fatig4` → `main`) opened, reviewed, and merged the same day, closing the gap `docs/AUDIT-PRODUCTION-READINESS-R1.6.md` identified. Merge commit `d17ff67f`.

- **Mergeability**: clean — `main` had not moved since the branch's fork point, so this was conflict-free (15 commits, 163 files, +10511/-678).
- **CI**: ran for the first time ever on this lineage. First run failed one check (`Security scan`) on a pre-existing, already-triaged `brace-expansion` advisory (`docs/SECURITY-VULNERABILITY-TRIAGE.md`) surfacing through `admin-portal`'s production Sentry/Cloudflare deps under `pnpm audit --prod` — confirmed via lockfile diff this predates the branch, not introduced by it. Fixed by encoding the already-accepted risk into CI via a scoped `pnpm.auditConfig.ignoreGhsas` entry rather than re-attempting a fix already tried and reverted for breaking `eslint`. All three checks green after that (Security scan, Dockerfiles present, Typecheck·Lint·Test·Build).
- **Production data safety check**: the catalog migration (`20260728015436_add_product_catalog`) deletes any `cart_items`/`order_items` rows with no matching product before adding a new FK constraint — safe by design since `products` didn't exist before this migration, but verified directly against the live Railway Postgres before merging rather than assumed: both tables were confirmed empty (0 rows).
- A founder review of the PR (schema, migrations, Merchant/Customer APIs, RBAC, test coverage, trade-offs) approved the merge contingent on that production-data verification passing, which it did.

**Follow-up backlog opened, not blockers to this baseline:** CAT-002 (`ProductAttribute`/`AttributeValue`), CAT-003 (`StockMovement` inventory audit trail), CAT-004 (`ProductTag`), CAT-005 (`Collection`), CAT-006 (advanced search, only if needed later). See `docs/CATALOG-ERD.md` for the current schema diagram.

**Status: R1.1–R1.6 is now real, tested, merged, and on `main`.** Still not deployed with this stage's changes — see "What's next."

---

## 2026-07-28 to 2026-08-04 — DPX-100: Figma-first port, module freezes, Driver security (superseded the R1.7/R1.8 plan below)

**The R1.7/R1.8 roadmap this document originally pointed to next did not happen as planned.** Instead, the founder redirected the platform toward a different, more foundational initiative: porting every screen to match the locked Figma export pixel-for-pixel (`docs/DPX-100-MODULE-COMPLETION-GATE.md`), module by module, with a ten-item completion gate and a formal freeze once each module clears it. That work — 50+ commits — happened entirely on `claude/dripplex-coolify-deploy-fatig4` and was never merged back to `main` via a PR; this section (and the baseline event below) is that reconciliation, in the same spirit as Gate R1.6.1 above.

**Brand foundation.** Locked design tokens (color/typography/spacing/radius/animation) and a real logo mark ported from the founder's Figma Make export into `packages/ui`, replacing placeholder styling platform-wide.

**Two standing engineering principles adopted**, alongside the Module Completion Gate itself:

- **DPX-UX-001 — Simplicity First** (`docs/DPX-UX-001-SIMPLICITY-FIRST.md`): fewer taps, smart defaults, no redundant re-collection of known data.
- **DPX-901 — Configuration-Driven Security Policy** (`docs/DPX-901-CONFIG-DRIVEN-SECURITY-POLICY.md`, adopted 2026-08-04 alongside the Driver Security Standard below): security thresholds/intervals/toggles live in configuration or a database-backed admin setting, never hard-coded.

**Ride module — Frozen.** Five slices (Home/Search/Fare/Finding/Assigned → full trip lifecycle → payment → history/saved places), each Playwright-verified against a live backend. `docs/RIDE-DPX-100-PRODUCTION-AUDIT.md` cleared all ten gate items; founder approved the freeze (`packages/ui/src/components/super-app/MATURITY.md`'s "Ride module — Frozen" section). A same-day rebrand fix (DX naming/casing) landed as an approved frozen-module bug fix, not a reopening.

**Marketplace module — Frozen.** Entry/Store/Product Detail/Cart/Checkout/Tracking ported into `packages/ui`, stabilized, then a founder-flagged pricing-integrity defect was found and fixed: Cart preview and Order creation computed tax/delivery-fee/discount independently and could disagree with what was actually charged. A single shared `PricingService` (`docs/PRICING-ENGINE.md`) now backs both, verified end-to-end. Checkout also gained real Cash-on-Delivery and Dx Wallet payment methods (`docs/MARKETPLACE-006-CASH-WALLET-PAYMENT-DESIGN.md`), for five real payment methods total alongside Paystack/Flutterwave/OPay.

**Wallet module — Frozen.** Five slices (Home → Transaction History/Transfer/Top-up → Payment Methods/Rewards → Withdraw, a full production module in two phases → Statement/Security/Settings). `docs/WALLET-DPX-100-PRODUCTION-AUDIT.md` found and fixed six real issues before the founder approved the freeze.

**Driver module — in progress, security capability now locked.** `docs/DRIVER-APP-DPX-100-AUDIT.md` audited the module (driver-portal already has real, working, pre-DPX-100 screens for most of the priority list — availability, earnings, ratings, wallet, onboarding-partial; vehicle management and shift management and support are genuinely missing) and flagged facial/identity verification as the one founder-decision-blocked item. Built as **DRIVER-001 / DPX-DS-001 / DPX-DRIVER-001**: a provider-agnostic risk-based verification service (`SmileIdProvider` as the real first implementation), a nine-trigger priority-ordered risk engine, lockout with admin unlock, a full audit trail, and — after a founder correction that Claude had started inventing UI ahead of the Driver Figma port — backend-only scope for this pass, with the security _policy_ itself made admin-configurable (`DriverSecuritySettings`, no redeploy needed to change a threshold) rather than hard-coded. Consolidated into `docs/DPX-DRIVER-001-SECURITY-STANDARD.md`, founder-approved and locked (2026-08-04). Driver's Figma-ported UI, vehicle management, shift management, and support remain open — see that module's slice plan.

**Production infrastructure:** a Coolify self-hosted runbook was built (`docs/ops/PRODUCTION-COOLIFY.md`) as an alternative to Railway, but `docs/ops/PRODUCTION-RAILWAY.md` records the founder reinstating Railway as canonical on 2026-08-03 after confirming it live and healthy. **This document does not independently re-verify, as of this baseline, which target is actually receiving traffic today, or from which branch** — the two ops docs describe different states at different times and weren't reconciled against each other as part of this pass. Treat that as an open follow-up, not settled by anything written here.

## 2026-08-04 — Baseline: `main` fast-forwarded to match the real production history

Per founder direction, given the above was all real, tested, and (per the module audits) already the intended production state — just never merged — `main` was fast-forwarded directly to this branch's tip rather than opened as a single ~55-commit/350-file PR against a `main` that was six weeks stale relative to what the branch already contained. Preceded by a full monorepo verification: `turbo run typecheck`/`lint` clean across all 18 packages/apps; backend test suite 146/146 suites, 1106/1106 tests passing (an authoritative sequential run — a parallel `turbo run test` pass showed 2 spurious failures from concurrent workers racing the shared dev Postgres/Prisma client, confirmed non-reproducing in isolation); `turbo run build` clean for every package plus `backend` and `driver-portal` (the apps this pass actually touched) — five other Next.js apps failed only on `next/font`'s Google Fonts fetch hitting this sandbox's outbound-HTTPS proxy's self-signed cert, a pre-existing environment constraint unrelated to any code here, not reproducible in a normal build environment.

**Tag `v1.0-baseline` created locally at the fast-forwarded commit. Remote tag push deferred due to repository policy (HTTP 403) — branch pushes to both this branch and `main` succeeded, so this is a GitHub-side tag-ref restriction, not a network/proxy failure, and per this session's egress-policy guidance was not retried.** Baseline remains fully established without it: `main` is at commit `4b80290` and this document records the milestone — an administrator can push the local tag later if wanted, but nothing about the baseline's validity depends on the tag existing on the remote.

From this point forward: branch new work from `main`, and return to normal per-module PRs — this consolidation exists to close the gap, not to establish direct-to-main pushes as the ongoing pattern.

## 2026-08-04 — DPX-DRIVER-002 Slice 1: Driver onboarding, vehicle management, and inspection engine (backend)

Per the founder's reordered Driver module priority and the newly-adopted
8-step module lifecycle (`docs/DPX-100-MODULE-COMPLETION-GATE.md`'s "module
lifecycle" section), Slice 1 of the Driver module shipped as real backend
capability, before any UI: **Driver Onboarding** (`OnboardingService`
repurposes the previously vestigial `DriverOnboarding` model — emergency
contact, agreement acceptance, a validated submit-for-review step),
**Vehicle Management** (`VehiclesService` — driver CRUD on own vehicles,
plate-number uniqueness, admin approve/reject, automatic re-review when a
vehicle's identifying details change), and the **Driver & Vehicle Inspection
Standard** (`docs/DPX-DRIVER-002-INSPECTION-STANDARD.md` — new
`InspectionCentre`/`Inspection` models, `InspectionCentresService`,
`InspectionsService` covering appointment booking, an officer-records/
supervisor-decides checklist workflow, re-inspection scheduling, and a
passed inspection auto-approving its vehicle). Two new roles
(`inspection_officer`, `inspection_supervisor`) plus the existing
`operations_staff`/`administrator`/`super_administrator` gate the
operations-console side — no separate Inspector app was built, per the
founder's explicit decision. Criminal/watchlist background checks were
deliberately deferred to a future `DPX-DRIVER-003`, with extension points
preserved but nothing built yet.

Verified: `tsc`/`eslint` clean across `apps/backend`, `packages/types`, and
`packages/sdk`; 19 new service-level tests plus DTO-validation and
permission-constant tests, all passing against the real dev database;
full backend suite 1134/1136 tests passing (the 2 failures are pre-existing,
unrelated DB-seed pollution in an unrelated Marketplace ratings test —
confirmed by isolating the run and tracing the colliding row to a
`prisma/seed-data/marketplace.ts` fixture seeded in an earlier session, not
anything this slice touched).

**Deliberately not done this pass, named honestly:** `DriversService.approveDriver()`'s
existing KYC-document gate was not extended to also require an approved
vehicle or a passed inspection — the three systems work independently today;
combining them into DPX-DRIVER-002 Phase 4's single activation gate is a
real, scoped follow-up. Both the driver-portal onboarding/vehicle UI and the
Operations Portal's Inspection UI (queue, checklist, photo capture,
approve/reject, re-inspection scheduling, reporting) are backend-only for
this pass, per the standing Figma-first rule — the endpoints are ready for a
UI once designs are provided. See `docs/DRIVER-APP-DPX-100-AUDIT.md`'s Slice
1 status note for the full detail.

---

## What's next

The R1.7/R1.8 commerce-completion plan below was superseded by the DPX-100 initiative above — Marketplace's commerce loop (cart/checkout/order/payment UI) shipped as part of that port, not as R1.7/R1.8 specifically. What's actually still open, per each module's own audit doc: the Driver module's Figma-ported UI (including onboarding/vehicle/inspection, all backend-real as of DPX-DRIVER-002 Slice 1 above), the `approveDriver()` combined activation gate, shift management, and support (`docs/DRIVER-APP-DPX-100-AUDIT.md`); reconciling the Railway-vs-Coolify production-infrastructure question above; and Orders/AI/Merchant/Admin, next in the founder's module ordering per `docs/DPX-100-MODULE-COMPLETION-GATE.md`.

<details>
<summary>Original 2026-07-28 "what's next" (superseded, kept for the record)</summary>

The commerce loop is still open — there is no cart/checkout/order/payment UI anywhere in `customer-web`, and no merchant-onboarding UI in `merchant-portal`, despite the backend supporting both. That's R1.7 (Customer Commerce Completion) and R1.8 (Merchant Operations) on the roadmap. A `v1.0.0` tag gets created when there's a real, deployed, end-to-end-verified product behind it — not before.

</details>
