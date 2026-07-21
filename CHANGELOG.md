# Changelog

All notable changes to the Dripplex platform monorepo are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-foundation]

Sprint 0.1 engineering foundation — workspace, backend, customer web, shared packages, and infrastructure.

### Added

- Turborepo + pnpm monorepo with strict TypeScript tooling and Husky pre-commit hooks
- NestJS backend with Prisma/PostgreSQL, Redis, JWT auth scaffold, health checks, and structured logging
- Customer web Next.js 15 shell with marketing, auth UI, and dashboard chrome
- Shared packages: `@dripplex/types`, `@dripplex/utils`, `@dripplex/sdk`, `@dripplex/ui`, `@dripplex/hooks`
- Docker Compose stack for PostgreSQL, Redis, backend, and customer-web
- GitHub Actions CI (install, lint, typecheck, test, build)
- Security automation: Dependabot, CodeQL, dependency review, and Gitleaks secret scanning
- Release workflow with changelog-driven GitHub Releases
- Observability placeholders: metrics readiness endpoint and Sentry configuration hooks
- VS Code recommendations and optional Dev Container configuration

### Notes

- Business features (registration flows wired to API, marketplace, orders, payments) begin in Sprint 1.
- Backend remains at `apps/backend` through Sprint 0.1; a future migration to `apps/api` may be evaluated.

## [0.1.0]

Initial monorepo bootstrap (superseded by `v0.1.0-foundation` tag for the complete Sprint 0.1 baseline).
