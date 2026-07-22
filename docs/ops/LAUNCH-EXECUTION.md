# Production launch execution log — v1.0.0

| Field              | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Target version** | `1.0.0` / tag `v1.0.0`                                          |
| **Started**        | 2026-07-22                                                      |
| **Executor**       | Cursor Cloud Agent                                              |
| **Status**         | **BLOCKED** — awaiting merges, secrets, and live infrastructure |

## Launch sequence

| Step | Action                           | Status | Notes                                                                     |
| ---- | -------------------------------- | ------ | ------------------------------------------------------------------------- |
| 1    | Merge approved PRs → `main`      | ⏳     | PRs #24–#32 open as **draft**; CI failing on Prisma generate (fix pushed) |
| 2    | Create/push `v1.0.0` tag         | ⏳     | After merge via **Release Tag** workflow                                  |
| 3    | Publish production Docker images | ⏳     | `publish-images.yml` + GHCR                                               |
| 4    | `prisma migrate deploy`          | ⏳     | Needs `DATABASE_URL` on production host                                   |
| 5    | Deploy Backend Core              | ⏳     | `PROD_DEPLOY_HOST` / SSH not in agent env                                 |
| 6    | Deploy portals                   | ⏳     | Same                                                                      |
| 7    | Production smoke tests           | ⏳     | `scripts/golive/validate-production.sh`                                   |
| 8    | Verify monitoring                | ⏳     | Grafana/Sentry/Uptime Kuma need live obs stack                            |
| 9    | Confirm no critical alerts       | ⏳     | Post-deploy                                                               |
| 10   | Sign production validation       | ⏳     | `docs/ops/PRODUCTION-VALIDATION.md`                                       |

## Connectivity probe (agent)

| Surface                                   | Result         |
| ----------------------------------------- | -------------- |
| `www.dripplex.com`                        | ✅ HTTP 200    |
| `api.dripplex.com`                        | ❌ Unreachable |
| `merchant` / `rider` / `admin` / `status` | ❌ Unreachable |

## Integrations

| Service                         | Agent access                                              |
| ------------------------------- | --------------------------------------------------------- |
| GitHub (merge, workflows, tags) | ✅ Token via `gh`                                         |
| Supabase MCP                    | ❌ `needsAuth` — not used; project uses Postgres + Prisma |
| Production SSH / Hetzner        | ❌ Secrets not in environment                             |
| Cloudflare / registrar          | ❌ Not connected                                          |
| Play / App Store                | ❌ Out of scope                                           |

## Operator actions required

1. **Mark PRs ready for review** and merge stack **C4 → D5** into `main` (or squash D5 after rebase onto `main`).
2. Configure GitHub **production** environment secrets (`docs/cicd/SECRETS.md`).
3. Run **Release Tag** (`1.0.0`) → **Publish Images** → **Deploy Production** (`confirm=promote-production`).
4. Alternatively on prod host: `EXECUTE=1 bash scripts/golive/go-live.sh`.
5. Complete `docs/ops/PRODUCTION-VALIDATION.md` sign-off.

## Official live declaration

**Dripplex is NOT officially live** until steps 1–10 complete with green smoke and ops sign-off.
