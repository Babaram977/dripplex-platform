# Cloudflare Workers — all Dripplex portals (OpenNext)

Deploy every Next.js portal independently to Cloudflare Workers via
[@opennextjs/cloudflare](https://opennext.js.org/cloudflare).

## Applications

| App                       | Worker name             | Custom domains                                         | Root directory            | Build command              | Deploy command           |
| ------------------------- | ----------------------- | ------------------------------------------------------ | ------------------------- | -------------------------- | ------------------------ |
| `apps/customer-web`       | `dripplex-customer-web` | `dripplex.com`, `www.dripplex.com`, `app.dripplex.com` | `apps/customer-web`       | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/merchant-portal`    | `dripplex-merchant`     | `merchant.dripplex.com`                                | `apps/merchant-portal`    | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/rider-portal`       | `dripplex-rider`        | `rider.dripplex.com`                                   | `apps/rider-portal`       | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/admin-portal`       | `dripplex-admin`        | `admin.dripplex.com`                                   | `apps/admin-portal`       | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/operations-console` | `dripplex-ops`          | `ops.dripplex.com`                                     | `apps/operations-console` | `bash scripts/cf-build.sh` | `npx wrangler deploy`    |
| `apps/backend`            | _(not a Worker)_        | `api.dripplex.com` (Docker/Compose origin)             | —                         | Docker / Compose           | `scripts/cicd/deploy.sh` |

Obsolete Worker name **`dripplex-platform`** is replaced by **`dripplex-customer-web`**. Delete the old Worker after the first successful deploy of the new name.

## Workers Builds (customer-web)

| Setting        | Value                      |
| -------------- | -------------------------- |
| Root directory | `apps/customer-web`        |
| Build command  | `bash scripts/cf-build.sh` |
| Deploy command | `npx wrangler deploy`      |
| Worker name    | `dripplex-customer-web`    |

Create separate Workers Builds projects for merchant / rider / admin / ops with the same pattern (Root Directory = that app).

## Auth

```bash
export CLOUDFLARE_API_TOKEN=…   # Workers Scripts Edit + Zone DNS Edit
export CLOUDFLARE_ACCOUNT_ID=…  # optional

# Deploy all portals + write report
bash scripts/cloudflare/d2-deploy-production.sh

# Or GitHub Actions → "Deploy Cloudflare Workers" (workflow_dispatch)
```

## Custom domains

Configured in each `wrangler.jsonc` via `routes[].custom_domain = true`. Deploy attaches domains and issues SSL when the zone is Active on Cloudflare.

## Backend / api.dripplex.com

NestJS is not deployed as a Worker. Point `api.dripplex.com` at your API origin (Compose/K8s) with Cloudflare proxy, or use Cloudflare Containers later. See `apps/backend/docs/CLOUDFLARE-DEPLOYMENT.md`.
