# Dripplex

**life,Simplified**

Dripplex is a Nigerian Super Platform combining marketplace, food delivery, parcel delivery, ride hailing, pharmacy, home services, wallet, and operator portals — designed for millions of users and expansion across Africa.

## Monorepo

This repository is a **Turborepo + pnpm** monorepo.

```text
dripplex-platform/
├── apps/
│   ├── customer-web          # Customer Next.js app
│   ├── merchant-portal       # Merchant Next.js app
│   ├── rider-portal          # Rider Next.js app
│   ├── driver-portal         # Driver Next.js app
│   ├── operations-console    # Operations Next.js app
│   ├── admin-portal          # Admin Next.js app
│   └── backend               # NestJS API (api/v1)
├── packages/
│   ├── ui                    # Design system & shared components
│   ├── sdk                   # Typed API client
│   ├── types                 # Shared domain & API types
│   ├── config                # Shared ESLint / TS / Prettier configs
│   ├── hooks                 # Shared React hooks
│   └── utils                 # Shared pure utilities
├── docs/                     # Architecture & ADRs
├── scripts/                  # Repo maintenance scripts
├── infrastructure/           # Docker & deployment assets
└── .github/                  # CI/CD workflows
```

## Prerequisites

- Node.js `>= 22`
- pnpm `>= 9` (enforced via `packageManager` field)
- Docker & Docker Compose (for local Postgres/Redis — Commit 5)

## Getting started

```bash
# Enable Corepack (recommended) or install pnpm globally
corepack enable
corepack prepare pnpm@9.15.0 --activate

# Install all workspace dependencies
pnpm install

# Verify the workspace
pnpm lint
pnpm typecheck
```

Workspace foundation (Commit 1) provides monorepo tooling, shared `@dripplex/config`, and package skeletons. Application and domain implementations land in subsequent commits.

## Scripts

| Script              | Description                       |
| ------------------- | --------------------------------- |
| `pnpm install`      | Install workspace dependencies    |
| `pnpm dev`          | Run all `dev` tasks via Turbo     |
| `pnpm build`        | Build all packages and apps       |
| `pnpm lint`         | Lint all packages                 |
| `pnpm typecheck`    | Typecheck all packages            |
| `pnpm test`         | Run unit tests                    |
| `pnpm format`       | Format with Prettier              |
| `pnpm format:check` | Check formatting                  |
| `pnpm clean`        | Remove build artifacts and caches |

Filter a single package:

```bash
pnpm --filter @dripplex/config lint
pnpm --filter @dripplex/backend dev
```

## Architecture principles

- **Clean Architecture / DDD** — domain logic lives in services; controllers stay thin.
- **Repository pattern** — persistence is abstracted behind repositories (Prisma adapters).
- **Shared packages first** — never duplicate UI, types, hooks, utils, or SDK logic across apps.
- **Strict TypeScript** — `any` is forbidden; exact optional types and no unchecked index access.
- **API versioning** — all public REST endpoints under `/api/v1/`.
- **Security by default** — JWT + OTP, RBAC, rate limiting, hashed secrets, env-based configuration.

See [docs/architecture/overview.md](docs/architecture/overview.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Report vulnerabilities per [SECURITY.md](SECURITY.md). Never commit secrets. Use `.env.example` as the template.

## License

Proprietary — see [LICENSE](LICENSE). All rights reserved.
