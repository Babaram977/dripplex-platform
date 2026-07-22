# Cloudflare Workers — customer-web (Program B1)

Worker name in Wrangler: **`dripplex-customer-web`**

If an older project is still named `dripplex-platform`, rename it in the Cloudflare dashboard to `dripplex-customer-web` (or create a new Worker with that name). Names must match or Builds fail.

## Workers Builds settings

| Setting                   | Value                          |
| ------------------------- | ------------------------------ |
| **Root directory**        | `apps/customer-web`            |
| **Build command**         | `bash scripts/cf-build.sh`     |
| **Deploy command**        | `npx wrangler deploy`          |
| **Non-production deploy** | `npx wrangler versions upload` |

### Build variables

| Variable                   | Required | Default in `cf-build.sh`          |
| -------------------------- | -------- | --------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes      | `https://api.dripplex.com/api/v1` |
| `NEXT_PUBLIC_APP_URL`      | Yes      | `https://www.dripplex.com`        |
| `NEXT_PUBLIC_SENTRY_DSN`   | Optional | empty                             |

## Local

```bash
cp apps/customer-web/.dev.vars.example apps/customer-web/.dev.vars
pnpm --filter @dripplex/customer-web deploy
```

See also `docs/PROGRAM-B1.md`.
