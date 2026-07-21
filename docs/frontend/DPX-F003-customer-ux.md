> **Superseded by the FPX series.** See [`docs/FPX-001-frontend-platform-architecture.md`](../FPX-001-frontend-platform-architecture.md) and [`docs/FPX-README.md`](../FPX-README.md).

# DPX-F003 — Customer UX

| Field            | Value                     |
| ---------------- | ------------------------- |
| **Document ID**  | DPX-F003                  |
| **Title**        | Customer UX               |
| **Program**      | B — Frontend Platform     |
| **Status**       | Draft — architecture only |
| **Last updated** | 2026-07-21                |

## Purpose

Define customer journeys mapped to Backend Core capabilities.

## Journeys (draft checklist)

Landing → Register/Verify → Login → Home → Search → Product/Merchant → Wishlist → Cart → Checkout → Pay → Orders → Tracking → Notifications → Loyalty → Wallet → Profile

## Rules

- One job per screen/section; brand-first on promotional surfaces
- Checkout/payment UX must match frozen backend contracts
- Empty, loading, and error states specified in Figma before build

## Related

- DPX-F006 Routing · DPX-F008 API Integration · Program B Phase B1
