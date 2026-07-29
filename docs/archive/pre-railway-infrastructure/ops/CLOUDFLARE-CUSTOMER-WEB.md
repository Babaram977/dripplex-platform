# Cloudflare Workers — customer-web (OpenNext)

Deploy `@dripplex/customer-web` to **Cloudflare Workers** via [@opennextjs/cloudflare](https://opennext.js.org/cloudflare).

For **all portals** (merchant, rider, admin, ops) see [`CLOUDFLARE-WORKERS-APPS.md`](./CLOUDFLARE-WORKERS-APPS.md). Live cutover status: root [`PRODUCTION_READINESS.md`](../../PRODUCTION_READINESS.md).

## Files

| File                                    | Purpose                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `apps/customer-web/wrangler.jsonc`      | Preferred config when Root Directory = `apps/customer-web` |
| `wrangler.jsonc` (repo root)            | Fallback when Root Directory is monorepo root              |
| `apps/customer-web/open-next.config.ts` | OpenNext Cloudflare adapter                                |
| `apps/customer-web/public/_headers`     | Immutable cache for `/_next/static/*`                      |
| `apps/customer-web/scripts/cf-build.sh` | Monorepo-aware OpenNext build (+ default `NEXT_PUBLIC_*`)  |
| `apps/customer-web/.dev.vars.example`   | Local preview env template                                 |

Worker name: **`dripplex-customer-web`** (must match the Cloudflare Workers project).

## Workers Builds settings (required)

In **Workers & Pages → dripplex-customer-web → Settings → Builds**:

### Recommended (Root Directory = app)

| Setting                   | Value                          |
| ------------------------- | ------------------------------ |
| **Root directory**        | `apps/customer-web`            |
| **Build command**         | `bash scripts/cf-build.sh`     |
| **Deploy command**        | `npx wrangler deploy`          |
| **Non-production deploy** | `npx wrangler versions upload` |

### Fallback (Root Directory empty)

| Setting            | Value                                        |
| ------------------ | -------------------------------------------- |
| **Root directory** | _(leave empty)_                              |
| **Build command**  | `bash apps/customer-web/scripts/cf-build.sh` |
| **Deploy command** | `npx wrangler deploy`                        |

### Build variables & secrets

`cf-build.sh` defaults these if unset; override in the dashboard when needed:

| Variable                   | Default                           |
| -------------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.dripplex.com/api/v1` |
| `NEXT_PUBLIC_APP_URL`      | `https://www.dripplex.com`        |
| `NEXT_PUBLIC_SENTRY_DSN`   | _(optional, empty)_               |

## Local deploy

```bash
pnpm install
cp apps/customer-web/.dev.vars.example apps/customer-web/.dev.vars
pnpm --filter @dripplex/customer-web deploy
```

## Docker vs Cloudflare

| Target             | How                                            |
| ------------------ | ---------------------------------------------- |
| Docker / Compose   | `DOCKER_BUILD=1` → Next `output: 'standalone'` |
| Cloudflare Workers | OpenNext → `.open-next/` (no standalone)       |

## Custom domain

Point `www.dripplex.com` / `app.dripplex.com` at Worker **dripplex-customer-web** under Domains & Routes (or CNAME to `dripplex-customer-web.<account>.workers.dev`).
