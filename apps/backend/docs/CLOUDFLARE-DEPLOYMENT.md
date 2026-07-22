# Backend Core — Cloudflare deployment notes

NestJS Backend Core (`@dripplex/backend`) is **not** deployable as a Cloudflare Worker.

## Why

- Requires Node.js runtime with Prisma, Redis clients, long-lived TCP, and Nest middleware.
- Bundle size and native dependencies exceed Workers limits.
- OpenNext targets Next.js only.

## Supported production paths

1. **Docker / Compose** (primary) — `infrastructure/docker/docker-compose.production.yml` + `scripts/cicd/deploy.sh`
2. **Kubernetes** — manifests under `infrastructure/kubernetes/` (if present)
3. **Cloudflare Containers** (optional future) — run the existing Docker image on Cloudflare Containers; still requires Cloudflare account auth, Container enablement, and secrets. Not configured in this repo yet.

## Production URL

- `https://api.dripplex.com` → reverse proxy / edge → Nest on port 3000 (`API_GLOBAL_PREFIX=api/v1`)

## Required secrets

See root `.env.production.example` and `PRODUCTION_READINESS.md`.
