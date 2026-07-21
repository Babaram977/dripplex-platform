# Infrastructure

Docker, Compose, CI/CD, and deployment assets for the Dripplex platform.

## Docker Compose

Run the full local stack (PostgreSQL, Redis, backend API, customer web):

```bash
cp .env.example .env
pnpm install
docker compose up --build
```

| Service      | URL                          |
| ------------ | ---------------------------- |
| Backend API  | http://localhost:3000/api/v1 |
| Customer Web | http://localhost:3001        |
| PostgreSQL   | localhost:5432               |
| Redis        | localhost:6379               |

Infrastructure-only services:

```bash
docker compose up -d postgres redis
```

## Dockerfiles

| Path                           | Image              |
| ------------------------------ | ------------------ |
| `apps/backend/Dockerfile`      | NestJS API         |
| `apps/customer-web/Dockerfile` | Next.js standalone |

## CI/CD

GitHub Actions workflows live in `.github/workflows/`:

- **CI** — install, lint, typecheck, test, build
- **Security** — CodeQL, dependency review, Gitleaks
- **Release** — changelog-driven GitHub Releases on version tags

## Dev Container

Optional VS Code Dev Container configuration is in `.devcontainer/devcontainer.json`. It installs workspace dependencies and starts PostgreSQL + Redis via Compose.

## Observability

Backend exposes:

- `GET /api/v1/health` — liveness/readiness with Postgres + Redis checks
- `GET /api/v1/metrics` — metrics exporter readiness (placeholder until Prometheus/OTel wiring)

Configure optional `SENTRY_DSN` in `.env` for future error tracking integration.
