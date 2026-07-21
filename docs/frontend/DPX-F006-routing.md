> **Superseded by the FPX series.** See [`docs/FPX-001-frontend-platform-architecture.md`](../FPX-001-frontend-platform-architecture.md) and [`docs/FPX-README.md`](../FPX-README.md).

# DPX-F006 — Routing

| Field            | Value                     |
| ---------------- | ------------------------- |
| **Document ID**  | DPX-F006                  |
| **Title**        | Routing                   |
| **Program**      | B — Frontend Platform     |
| **Status**       | Draft — architecture only |
| **Last updated** | 2026-07-21                |

## Purpose

App Router conventions, portal route maps, auth gates, and deep-link strategy.

## Draft decisions

- File-based App Router
- Auth-aware layouts per portal
- Public vs authenticated route groups
- Locale prefix strategy (tie to i18n in B0)

## Deliverable before B1

Route map tables for Customer, Merchant, Admin, Operations (URL → page → required permission).
