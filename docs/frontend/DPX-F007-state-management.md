> **Superseded by the FPX series.** See [`docs/FPX-001-frontend-platform-architecture.md`](../FPX-001-frontend-platform-architecture.md) and [`docs/FPX-README.md`](../FPX-README.md).

# DPX-F007 — State Management

| Field            | Value                     |
| ---------------- | ------------------------- |
| **Document ID**  | DPX-F007                  |
| **Title**        | State Management          |
| **Program**      | B — Frontend Platform     |
| **Status**       | Draft — architecture only |
| **Last updated** | 2026-07-21                |

## Purpose

Define client state boundaries: server cache vs UI state vs form state.

## Draft decisions

- Server/async data: React Query or equivalent keyed to SDK calls
- Auth session: dedicated provider wrapping SDK tokens
- Forms: React Hook Form + Zod schemas from `@dripplex/types`
- Avoid duplicating backend domain rules in client stores
- Prefer URL state for filters/search where shareable

## Open questions

- Global cart store vs server-backed cart only (Backend Core already has cart APIs)
