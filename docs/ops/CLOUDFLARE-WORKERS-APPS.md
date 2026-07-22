# Cloudflare Workers — all Dripplex portals (OpenNext)

Deploy every Next.js portal independently to Cloudflare Workers via
[@opennextjs/cloudflare](https://opennext.js.org/cloudflare).

## Applications

| App                       | Worker name                   | Intended hostname          | Root directory            | Build command              | Deploy command           |
| ------------------------- | ----------------------------- | -------------------------- | ------------------------- | -------------------------- | ------------------------ |
| `apps/customer-web`       | `dripplex-platform`           | `www` / `app.dripplex.com` | `apps/customer-web`       | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/merchant-portal`    | `dripplex-merchant-portal`    | `merchant.dripplex.com`    | `apps/merchant-portal`    | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/rider-portal`       | `dripplex-rider-portal`       | `rider.dripplex.com`       | `apps/rider-portal`       | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/admin-portal`       | `dripplex-admin-portal`       | `admin.dripplex.com`       | `apps/admin-portal`       | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/operations-console` | `dripplex-operations-console` | `ops.dripplex.com`         | `apps/operations-console` | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/backend`            | _(not a Worker)_              | `api.dripplex.com`         | —                         | Docker / Compose           | `scripts/cicd/deploy.sh` |

Customer Worker name is **`dripplex-platform`** to match the existing Cloudflare Workers Builds project.

## Per-app files

| File                  | Purpose                               |
| --------------------- | ------------------------------------- |
| `wrangler.jsonc`      | Worker name, assets, nodejs_compat    |
| `open-next.config.ts` | OpenNext Cloudflare adapter           |
| `scripts/cf-build.sh` | Monorepo-aware OpenNext build         |
| `public/_headers`     | Immutable cache for `/_next/static/*` |
| `.dev.vars.example`   | Local preview env template            |

## Backend

NestJS Backend Core cannot run as a Cloudflare Worker. See
`apps/backend/docs/CLOUDFLARE-DEPLOYMENT.md`. Deploy via Docker Compose / SSH
(`scripts/cicd/deploy.sh`) or a future Cloudflare Containers image.

## Local / CI deploy

```bash
# Requires CLOUDFLARE_API_TOKEN with Workers Scripts Edit
export CLOUDFLARE_API_TOKEN=…
export CLOUDFLARE_ACCOUNT_ID=…   # optional if token is scoped

# One app
pnpm --filter @dripplex/customer-web deploy

# All portals (builds missing .open-next then wrangler deploy)
bash scripts/cloudflare/deploy-all.sh
bash scripts/cloudflare/deploy-all.sh dry-run
```

`wrangler deploy --temporary` uses a preview account with a **1 MiB** limit and
will fail for OpenNext bundles (~1.4 MiB gzip). Use a real Free+ account token
(Free plan allows **3 MiB** gzip).

## Build variables (Workers Builds)

| Variable                   | Default (portals)                 |
| -------------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.dripplex.com/api/v1` |
| `NEXT_PUBLIC_APP_URL`      | per-app hostname (see table)      |
| `NEXT_PUBLIC_SENTRY_DSN`   | optional                          |

## Custom domains

1. Point nameservers for `dripplex.com` at Cloudflare (currently QServers).
2. Add custom domains on each Worker (or CNAME to `*.workers.dev`).
3. Set `CORS_ORIGINS` on the API to the HTTPS portal origins.

## Docker vs Cloudflare

| Target             | How                                            |
| ------------------ | ---------------------------------------------- |
| Docker / Compose   | `DOCKER_BUILD=1` → Next `output: 'standalone'` |
| Cloudflare Workers | OpenNext → `.open-next/` (no standalone)       |
| EOF                |
