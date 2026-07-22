# D2 — Docker image strategy

## Images

| Logical name    | GHCR repository            | Dockerfile                        |
| --------------- | -------------------------- | --------------------------------- |
| backend-core    | `dripplex-backend-core`    | `apps/backend/Dockerfile`         |
| customer-web    | `dripplex-customer-web`    | `apps/customer-web/Dockerfile`    |
| merchant-portal | `dripplex-merchant-portal` | `apps/merchant-portal/Dockerfile` |
| rider-portal    | `dripplex-rider-portal`    | `apps/rider-portal/Dockerfile`    |
| admin-portal    | `dripplex-admin-portal`    | `apps/admin-portal/Dockerfile`    |

Bake file: `infrastructure/docker/docker-bake.hcl`  
Shared Next template: `infrastructure/docker/Dockerfile.next`

## Tag strategy

| Tag                      | Meaning                                |
| ------------------------ | -------------------------------------- |
| `latest`                 | Most recent successful `main` build    |
| `<sha12>`                | Immutable build (preferred deploy pin) |
| `staging`                | Optional alias after staging success   |
| `production`             | Optional alias after prod success      |
| `v1.0.0` / `v1.0.0-rc.1` | Semantic release (`release-tag.yml`)   |
| `build-<sha12>`          | Moving git tag created on publish      |

## Build args (frontends)

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

Baked at image build time for each environment target (staging publish may use staging API URL via workflow env override in a future matrix).

## Security

- Trivy scan on pushed images (`CRITICAL`/`HIGH`, unfixed ignored)
- `pnpm audit --prod --audit-level=high` in CI
- No secrets in image layers (runtime env only)
