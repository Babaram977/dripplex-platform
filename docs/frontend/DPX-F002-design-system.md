> **Superseded by FPX-001.** This interim stub is retained for history; the canonical frontend architecture reference is [`docs/FPX-001-frontend-platform-architecture.md`](../FPX-001-frontend-platform-architecture.md).

# DPX-F002 — Design System

| Field            | Value                     |
| ---------------- | ------------------------- |
| **Document ID**  | DPX-F002                  |
| **Title**        | Design System             |
| **Program**      | B — Frontend Platform     |
| **Status**       | Draft — architecture only |
| **Last updated** | 2026-07-21                |

## Purpose

Establish tokens, primitives, and composition rules before feature screens.

## Scope (draft)

- Color, typography, spacing, radius, elevation, motion tokens (CSS variables)
- Primitives in `@dripplex/ui`: Button, Input, Label, Form field, Dialog, Toast, Sheet, Tabs, Table, Badge
- Layout primitives: Page, Section, Stack, Cluster, Container
- Dark/light theme strategy (product decision — avoid defaulting to dark-only)
- Storybook as source of truth for component states
- Brand-first surfaces for marketing/landing (see product design rules)

## Out of scope

- Full page layouts for B1+ (those live in F003–F005 + Figma)

## Related

- DPX-F001, DPX-F010
- Figma libraries (to be linked when created)
