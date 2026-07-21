# Contributing to Dripplex

Thank you for contributing. Dripplex is production software for a multi-sided Super Platform. Changes must protect maintainability, scalability, security, and long-term growth across Africa.

## Development setup

1. Install Node.js 22+ and enable pnpm via Corepack:
   ```bash
   corepack enable
   corepack prepare pnpm@9.15.0 --activate
   ```
2. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```
3. Copy environment templates (never commit real secrets):
   ```bash
   cp .env.example .env
   ```
4. Run quality gates before opening a PR:
   ```bash
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

## Branching

- `main` is protected and always deployable.
- Feature branches: `cursor/<short-description>-<id>` or `feat/<ticket>-<slug>`.
- Hotfixes: `fix/<ticket>-<slug>`.
- Prefer small, reviewable PRs over large monolithic diffs.

## Commit messages

Use Conventional Commits:

```text
feat(backend): add wallet ledger posting
fix(customer-web): correct OTP resend cooldown
chore(repo): tighten turbo cache inputs
docs(architecture): document dispatch bounded context
```

Scopes should match apps/packages when possible (`backend`, `customer-web`, `ui`, `config`, …).

## Architecture rules (non-negotiable)

1. **Business logic belongs in Services** (NestJS) or domain modules — never in controllers, React components, or pages.
2. **Reuse `@dripplex/*` packages** — do not copy types, hooks, utils, UI, or SDK code between apps.
3. **Strict TypeScript** — no `any`, no non-null assertions unless justified and reviewed.
4. **Validate at boundaries** — Zod (frontend) and class-validator DTOs (backend) for every external input.
5. **Generate tests** with every behavior change — unit tests for services/utils; integration tests for modules.
6. **Document decisions** — non-trivial design changes get an ADR under `docs/adr/`.
7. **API contracts** — versioned under `/api/v1/`; breaking changes require a new version path.
8. **Soft deletes & audit fields** — `createdAt`, `updatedAt`, `deletedAt` on persisted entities.

Follow `.cursor/rules/` for AI-assisted contributions.

## Pull requests

Every PR must:

- Describe the problem and the solution.
- List affected apps/packages.
- Include tests (or explain why none apply).
- Pass CI: install → lint → typecheck → unit tests → build.
- Avoid unrelated refactors.

## Code review expectations

Reviewers verify:

- Correct bounded-context ownership.
- No duplicated logic.
- Security (authz, secrets, validation, rate limits).
- Observability hooks where appropriate.
- Mobile-responsive UI and dark mode for frontend changes.

## Reporting issues

Use GitHub Issues with reproduction steps, expected vs actual behavior, and environment details. Security issues go through [SECURITY.md](SECURITY.md), not public issues.
