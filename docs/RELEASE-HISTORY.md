# DrippleX release history

**This is the canonical release timeline.** It reflects what's actually in git history and what was actually verified — not what any individual milestone doc claimed at the time. Where an earlier document's claims didn't hold up, that's noted here and the original document was corrected or archived (`docs/archive/`) rather than silently rewritten.

**No `v1.0.0` (or any other) git tag exists yet.** Per the founder's explicit instruction (2026-07-28): a tag gets created when the repository actually reaches that point, not before, regardless of what any release-notes document says.

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

---

## What's next

R1.4 (Merchant UI) and R1.5 (Customer Marketplace UI), per the founder's roadmap, building against the API contracts already shipped in R1.1–R1.3. A `v1.0.0` tag gets created when there's a real, deployed, end-to-end-verified product behind it — not before.
