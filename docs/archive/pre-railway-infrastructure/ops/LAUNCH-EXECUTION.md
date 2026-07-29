# Production launch execution log — v1.0.0

| Field              | Value                                            |
| ------------------ | ------------------------------------------------ |
| **Target version** | `1.0.0` / tag `v1.0.0`                           |
| **Started**        | 2026-07-22                                       |
| **Executor**       | Cursor Cloud Agent                               |
| **Status**         | **IN PROGRESS** — code on `main`; deploy blocked |

## Launch sequence

| Step | Action                           | Status | Notes                                                                 |
| ---- | -------------------------------- | ------ | --------------------------------------------------------------------- |
| 1    | Merge approved PRs → `main`      | ✅     | #24–#32 merged 2026-07-22                                             |
| 2    | Create/push `v1.0.0` tag         | ✅     | `git push origin v1.0.0`                                              |
| 3    | Publish production Docker images | ⚠️     | Initial `publish-images` failed (workflow_call); fix pushed to `main` |
| 4    | `prisma migrate deploy`          | ⏳     | Needs `DATABASE_URL` + production host                                |
| 5    | Deploy Backend Core              | ⏳     | `PROD_DEPLOY_*` secrets + **Deploy Production** workflow              |
| 6    | Deploy portals                   | ⏳     | Same pipeline                                                         |
| 7    | Production smoke tests           | ⏳     | After deploy: `scripts/golive/validate-production.sh`                 |
| 8    | Verify monitoring                | ⏳     | Grafana / Sentry / Uptime Kuma on obs host                            |
| 9    | Confirm no critical alerts       | ⏳     | Post-deploy                                                           |
| 10   | Sign production validation       | ⏳     | `docs/ops/PRODUCTION-VALIDATION.md`                                   |

## Connectivity probe (agent)

| Surface                                   | Result         |
| ----------------------------------------- | -------------- |
| `www.dripplex.com`                        | ✅ HTTP 200    |
| `api.dripplex.com`                        | ❌ Unreachable |
| `merchant` / `rider` / `admin` / `status` | ❌ Unreachable |

## Integrations

| Service                            | Agent access                                                  |
| ---------------------------------- | ------------------------------------------------------------- |
| GitHub (merge, tags)               | ✅ PRs merged; tag `v1.0.0` pushed                            |
| GitHub Actions (workflow_dispatch) | ❌ HTTP 403 — cannot trigger Deploy Production from agent     |
| Supabase MCP                       | ❌ `needsAuth` — project uses Postgres + Prisma, not Supabase |
| Production SSH / Hetzner           | ❌ Secrets not in agent environment                           |
| Cloudflare / registrar             | ❌ Not connected                                              |

## Your next steps (manual)

1. **GitHub → Actions → Publish Docker Images** — re-run on `main` (or wait for push from workflow fix).
2. **GitHub → Settings → Environments → production** — set `PROD_DEPLOY_HOST`, `PROD_SSH_KEY`, `DATABASE_URL`, `REDIS_URL`, JWT secrets (`docs/cicd/SECRETS.md`).
3. **Actions → Deploy Production** — `image_tag=v1.0.0`, `confirm=promote-production`.
4. Or SSH to prod: `EXECUTE=1 IMAGE_TAG=v1.0.0 bash scripts/golive/go-live.sh`
5. Sign `docs/ops/PRODUCTION-VALIDATION.md`.

## Official live declaration

**Dripplex is NOT officially live** until deploy + smoke + ops sign-off complete.
