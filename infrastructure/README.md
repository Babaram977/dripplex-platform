# Infrastructure

Docker Compose and deployment assets for Dripplex RC1.

## Staging stack

```bash
docker compose -f infrastructure/docker/docker-compose.staging.yml up -d
```

Services:

- PostgreSQL 16
- Redis 7
- Backend (`apps/backend/Dockerfile`)

See `docs/ops/DEPLOYMENT.md` for migration order and frontend rollout.

## Images

| Image        | Dockerfile                     |
| ------------ | ------------------------------ |
| Backend      | `apps/backend/Dockerfile`      |
| Customer web | `apps/customer-web/Dockerfile` |

Merchant / rider / admin / ops portals: deploy via host platform with `pnpm build` until dedicated Dockerfiles are added post-RC.
