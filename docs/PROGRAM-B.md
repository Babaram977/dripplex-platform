# Program B — Frontend Platform

| Field              | Value                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| **Program**        | B — Frontend Platform                                                                 |
| **Baseline**       | Backend Core `v1.0.0-backend-core` + `v1.0.1-frontend-baseline`                       |
| **Status**         | Documentation first — **FPX series**                                                  |
| **Governing docs** | [FPX-001](./FPX-001-frontend-platform-architecture.md) · [FPX index](./FPX-README.md) |
| **Last updated**   | 2026-07-21                                                                            |

---

## Principle

Think like a **product company**, not a backend sprint team.

Do **not** write frontend product code until:

1. **FPX-001 → FPX-010** are reviewed and approved
2. **FPX-002** design system is implemented in `@dripplex/ui` + Storybook
3. High-fidelity **Figma** is locked for the screens being built

Backend Core remains **feature-frozen** (auth, checkout, payments, delivery — bugfixes only).

---

## Technical debt

| ID         | Title                                                      | Status                                |
| ---------- | ---------------------------------------------------------- | ------------------------------------- |
| **TD-001** | Monorepo customer-web `confirmPassword` lint/type failures | Resolved · `v1.0.1-frontend-baseline` |

---

## FPX documentation series (Phase B0)

| ID                                                     | Title                          |
| ------------------------------------------------------ | ------------------------------ |
| [FPX-001](./FPX-001-frontend-platform-architecture.md) | Frontend Vision & Architecture |
| FPX-002                                                | Design System                  |
| FPX-003                                                | Customer Experience            |
| FPX-004                                                | Merchant Portal                |
| FPX-005                                                | Admin Platform                 |
| FPX-006                                                | Operations Portal              |
| FPX-007                                                | API Integration                |
| FPX-008                                                | State Management               |
| FPX-009                                                | Routing                        |
| FPX-010                                                | Responsive Standards           |

---

## Implementation phases (after FPX approval)

| Phase  | Focus                                                                      |
| ------ | -------------------------------------------------------------------------- |
| **B0** | FPX documentation lock                                                     |
| **B1** | Design system only (tokens, primitives, Storybook) — **not** product pages |
| **B2** | Customer Web                                                               |
| **B3** | Merchant Portal                                                            |
| **B4** | Admin Platform                                                             |
| **B5** | Operations Platform                                                        |

Realtime (live tracking, sockets) follows readiness — see FPX-001 §13.

---

## Figma gate

For every major screen:

1. Design in Figma
2. Review and approve
3. Lock the design
4. Implement against `@dripplex/ui`

---

## Recommended next deliverable

**Approve FPX-001**, then author **FPX-002 — Design System**.

---

## Out of scope

- S1-C24+ backend features
- Native mobile (Program C)
- Production infra (Program D)
- AI automation (Program E)
