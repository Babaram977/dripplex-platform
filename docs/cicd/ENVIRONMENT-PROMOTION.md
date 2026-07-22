# D2 — Environment promotion guide

```text
Development (local)
        │ PR validation
        ▼
      main
        │ publish images
        ▼
    Staging  ← automatic (or dispatch)
        │ manual approval + confirm phrase
        ▼
   Production
```

## Isolation checklist

| Resource   | Dev       | Staging                  | Production        |
| ---------- | --------- | ------------------------ | ----------------- |
| Database   | local PG  | staging PG               | prod PG           |
| Redis      | local     | staging                  | prod              |
| R2 buckets | optional  | `*-staging`              | `dripplex-*`      |
| Secrets    | `.env`    | GH env staging           | GH env production |
| Domains    | localhost | `*.staging.dripplex.com` | `*.dripplex.com`  |
| Monitoring | optional  | staging stack            | prod stack        |

## Promotion rules

1. Never deploy a tag to production that has not passed staging health + smoke.
2. Prefer immutable `<sha12>` or `vX.Y.Z` tags — avoid floating `latest` in prod.
3. Database migrations run in the target environment only (`migrate deploy`).
4. If migrate fails → stop; restore from pre-migrate backup (D1 scripts); do not continue frontend rollout.
