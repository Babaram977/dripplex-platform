> **Superseded by FPX-001.** This interim stub is retained for history; the canonical frontend architecture reference is [`docs/FPX-001-frontend-platform-architecture.md`](../FPX-001-frontend-platform-architecture.md).

# DPX-F001 — Frontend Architecture

| Field            | Value                     |
| ---------------- | ------------------------- |
| **Document ID**  | DPX-F001                  |
| **Title**        | Frontend Architecture     |
| **Program**      | B — Frontend Platform     |
| **Status**       | Draft — architecture only |
| **Baseline**     | `v1.0.0-backend-core`     |
| **Last updated** | 2026-07-21                |

## Purpose

Define how DrippleX web clients are structured on top of Backend Core: apps, shared packages, boundaries, and non-negotiable engineering rules.

## Decisions (draft)

1. **Apps:** Customer Web, Merchant Portal, Admin Portal, Operations Portal (separate Next.js apps or route groups — decide in review).
2. **Shared packages:** `@dripplex/ui` (design system), `@dripplex/sdk`, `@dripplex/types`, `@dripplex/hooks`, `@dripplex/utils`.
3. **Framework:** Next.js App Router, React Server Components where they help; client components for interactive commerce flows.
4. **API boundary:** All HTTP via `@dripplex/sdk` — no ad-hoc `fetch` to backend in feature code.
5. **Auth:** Use Backend Core JWT/session contracts; never re-implement identity rules in the UI.
6. **Freeze respect:** Do not require backend auth/checkout/payment/delivery contract changes for B0–B1; file backend bugs only.

## Open questions

- Monorepo app layout: four apps vs one app with portal segments
- Hosting target (Vercel / Cloudflare / self-hosted) — deferred to Program D coordination
- SSR vs CSR defaults per portal

## Related

- DPX-F002 Design System
- DPX-F006 Routing
- DPX-F007 State Management
- DPX-F008 API Integration
- `docs/PROGRAM-B.md`
