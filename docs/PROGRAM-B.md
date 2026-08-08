# Program B — Frontend Platform

| Field            | Value                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| **Program**      | B — Frontend Platform                                                                                         |
| **Baseline**     | Backend Core `v1.0.0-backend-core`                                                                            |
| **Status**       | Largely delivered — platform implemented on `main`                                                            |
| **Architecture** | [FPX-001 — Frontend Platform Architecture](./FPX-001-frontend-platform-architecture.md) (canonical, as-built) |
| **Last updated** | 2026-08-08                                                                                                    |

---

## Principle

The canonical frontend architecture reference is now [**FPX-001**](./FPX-001-frontend-platform-architecture.md) (adopted, as-built), which supersedes the interim `docs/frontend/DPX-F001…F010` stubs. The frontend platform — all six apps and the six shared packages — is already implemented on `main`, so the original pre-implementation gate below is historical.

Original gate (retained for context):

1. Frontend lint/type baseline is clean (**TD-001**)
2. DPX-F001…F010 architecture series is drafted and reviewed → **superseded by FPX-001**
3. Design system tokens/primitives are defined
4. High-fidelity Figma exists for each portal

**Standing rule for _new_ UI:** design-before-code against the Production Figma (never invent screens). Backend Core's commerce/auth foundation is stable; feature work continues in active domains (notably the Driver module and its admin/operations surfaces).

---

## Technical debt

| ID         | Title                                                      | Status                                                       |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| **TD-001** | Monorepo customer-web `confirmPassword` lint/type failures | Fixed in this baseline PR; tagged `v1.0.1-frontend-baseline` |

Additional frontend debt discovered during B0 should be logged here before feature work.

---

## Phases

### B0 — Frontend Foundation

Next.js App Router, shared design system, theme, auth + SDK integration, responsive layout, Storybook, a11y, i18n.

### B1 — Customer Experience

Landing, registration/login, home, search, product/merchant/category pages, cart, checkout, orders, tracking, wallet, loyalty, notifications, profile.

### B2 — Merchant Portal

Store operations (catalog, orders, promotions, analytics, review replies, KYC/business surfaces).

### B3 — Admin Portal

Platform administration.

### B4 — Operations Portal

Support, fraud queue, CMS, reports.

### B5 — Realtime

Push/in-app notifications UX, live tracking, WebSockets, presence.

---

## Frontend architecture documentation

**Canonical:** [FPX-001 — Frontend Platform Architecture](./FPX-001-frontend-platform-architecture.md) (adopted, as-built).

The `docs/frontend/DPX-F001…F010` documents are the earlier interim **stubs**, now **superseded by FPX-001** and retained for history only (each carries a banner pointing to FPX-001). See [`docs/frontend/README.md`](./frontend/README.md).

---

## Original recommended sequence (historical — largely delivered)

The kickoff plan; the apps and packages it targets are now implemented on `main`, and the DPX-F approval step has been superseded by FPX-001's adoption:

```
TD-001 baseline clean
        ↓
Frontend architecture reference (now FPX-001, adopted as-built)
        ↓
Design system (tokens + primitives) + Storybook
        ↓
Figma: Customer / Merchant / Admin / Operations
        ↓
B0 foundation implementation
        ↓
B1 → B5 product surfaces
```

---

## Out of scope for Program B kickoff

- New backend marketplace features (S1-C24+)
- Mobile native apps (Program C)
- Production K8s/monitoring (Program D)
- AI/automation (Program E)
