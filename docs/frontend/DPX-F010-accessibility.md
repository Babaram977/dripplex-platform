# DPX-F010 — Accessibility

| Field            | Value                     |
| ---------------- | ------------------------- |
| **Document ID**  | DPX-F010                  |
| **Title**        | Accessibility             |
| **Program**      | B — Frontend Platform     |
| **Status**       | Draft — architecture only |
| **Last updated** | 2026-07-21                |

## Purpose

Accessibility requirements for all Program B portals.

## Baseline

- WCAG 2.2 AA target
- Keyboard navigation for all interactive flows
- Focus management for dialogs/sheets
- Form errors associated with inputs (`aria-invalid`, describedby)
- Color contrast via design tokens (DPX-F002)
- Prefer semantic HTML before ARIA
- Automated a11y checks in CI (axe or equivalent) once Storybook/CI exists

## Related

- DPX-F002 Design System · Program B Phase B0
