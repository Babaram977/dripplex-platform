# ADR-0001: Monorepo with Turborepo and pnpm

- Status: Accepted
- Date: 2026-07-21

## Context

DrippleX spans six Next.js portals, one NestJS API, and multiple shared libraries. Independent repositories would slow cross-cutting type and contract changes and invite duplicated UI/SDK logic.

## Decision

Use a single git monorepo managed by:

- **pnpm workspaces** for dependency linking and disk-efficient installs
- **Turborepo** for task orchestration, caching, and filtered pipelines
- **Shared `@dripplex/config`** for TypeScript, ESLint, and Prettier baselines

Package naming uses the `@dripplex/*` scope. Apps live under `apps/`; libraries under `packages/`.

## Consequences

- Atomic PRs can update API contracts and all consumers together.
- CI runs install → lint → typecheck → test → build via Turbo.
- Teams must respect package boundaries and avoid circular dependencies.
- Local developer experience depends on Corepack/pnpm discipline (`engine-strict`).
