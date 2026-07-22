# Cloudflare Workers — customer-web (OpenNext)

Deploy `@dripplex/customer-web` to **Cloudflare Workers** via [@opennextjs/cloudflare](https://opennext.js.org/cloudflare).

## Files (in `apps/customer-web`)

| File                  | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `wrangler.jsonc`      | Worker name, assets, `nodejs_compat`, images binding |
| `open-next.config.ts` | OpenNext Cloudflare adapter                          |
| `public/_headers`     | Immutable cache for `/_next/static/*`                |
| `scripts/cf-build.sh` | Monorepo-aware OpenNext build                        |
| `.dev.vars.example`   | Local preview env template                           |

Worker name: **`dripplex-customer-web`** (must match the Worker in the Cloudflare dashboard).

## Fix: “workspace root” / monorepo deploy error

Cloudflare must **not** treat the Turborepo root as the Next.js app.

In **Workers & Pages → dripplex-customer-web → Settings → Builds**:

| Setting                   | Value                          |
| ------------------------- | ------------------------------ |
| **Root directory**        | `apps/customer-web`            |
| **Build command**         | `bash scripts/cf-build.sh`     |
| **Deploy command**        | `npx wrangler deploy`          |
| **Non-production deploy** | `npx wrangler versions upload` |

### Build variables & secrets

Set under **Build variables and secrets** (required for Next inlining):

| Variable                   | Example                           |
| -------------------------- | --------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.dripplex.com/api/v1` |
| `NEXT_PUBLIC_APP_URL`      | `https://www.dripplex.com`        |
| `NEXT_PUBLIC_SENTRY_DSN`   | (optional)                        |

Runtime secrets (if any) go in **Settings → Variables and Secrets**, not build vars.

## Local deploy

```bash
# from repo root
pnpm install
cp apps/customer-web/.dev.vars.example apps/customer-web/.dev.vars
pnpm --filter @dripplex/customer-web deploy
```

Preview in the Workers runtime:

```bash
pnpm --filter @dripplex/customer-web preview
```

## Docker vs Cloudflare

| Target                   | How                                            |
| ------------------------ | ---------------------------------------------- |
| Docker / Compose (D1–D2) | `DOCKER_BUILD=1` → Next `output: 'standalone'` |
| Cloudflare Workers       | OpenNext → `.open-next/` (no standalone)       |

Both paths are supported from the same `next.config.ts`.

## Custom domain

Point `www.dripplex.com` / `app.dripplex.com` at this Worker under **Settings → Domains & Routes** (or Cloudflare DNS CNAME to `dripplex-customer-web.<account>.workers.dev`).

## Optional: R2 incremental cache

Uncomment `r2_buckets` in `wrangler.jsonc` and wire `r2IncrementalCache` in `open-next.config.ts` after creating bucket `dripplex-customer-web-cache`.
