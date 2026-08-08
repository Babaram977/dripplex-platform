> **Superseded by FPX-001.** This interim stub is retained for history; the canonical frontend architecture reference is [`docs/FPX-001-frontend-platform-architecture.md`](../FPX-001-frontend-platform-architecture.md).

# DPX-F009 — Offline Strategy

| Field            | Value                     |
| ---------------- | ------------------------- |
| **Document ID**  | DPX-F009                  |
| **Title**        | Offline Strategy          |
| **Program**      | B — Frontend Platform     |
| **Status**       | Draft — architecture only |
| **Last updated** | 2026-07-21                |

## Purpose

Define expected behavior when connectivity is poor or absent (especially mobile web and later Program C).

## Draft scope

- Read-mostly caches for catalog/search results (TTL)
- Cart: prefer server cart; optional optimistic UI with conflict resolution
- Checkout/payment: **never** finalize offline
- Clear user messaging for offline/degraded modes

## Non-goals for B0

- Full offline-first PWA for commerce writes
