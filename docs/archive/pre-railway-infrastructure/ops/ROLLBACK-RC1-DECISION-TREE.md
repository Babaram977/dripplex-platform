# Rollback procedure (RC1)

Use when staging/production health fails after a deploy, migrations break, or critical smoke cases fail.

## Decision tree

1. **Frontend-only regression** → roll back portal image(s) / previous build artifact. API stays.
2. **API regression, schema unchanged** → roll back backend container/image to previous tag. Frontends may stay.
3. **Failed or partial migration** → stop traffic → restore DB from pre-migrate backup → redeploy previous API tag.
4. **Data corruption** → restore DB + config secrets from backup set; rotate JWTs if tokens may have leaked.

## Frontend rollback

1. Redeploy previous known-good build (`1.0.0-rc.0` or last green SHA).
2. Purge CDN cache for HTML + `sw.js` / `manifest.webmanifest`.
3. Confirm customer SW updates (cache name `dripplex-rc1-offline-v1` may need hard refresh once).

## Backend rollback

1. Scale new revision to 0 / stop new pods.
2. Start previous image tag.
3. `GET /api/v1/health` must pass.
4. Spot-check auth login + one write path (e.g. cart or session refresh).

## Database rollback

Prisma migrations are **forward-only** in RC1. Do not invent down migrations under freeze.

1. Take a post-incident snapshot (forensics).
2. Restore Postgres from the **pre-migrate** backup (`docs/ops/BACKUPS.md`).
3. Point `DATABASE_URL` at restored instance (or replace volume).
4. Deploy API tag that matches restored schema.

## Config / secrets rollback

1. Revert secret versions in the secret manager.
2. Restart API and portals to pick up env.
3. If JWT secrets rotated incorrectly, force re-login (refresh tokens invalidated).

## Communication

- Mark release **NOT READY** / revoke staging approval until smoke passes again.
- Record incident in release notes Known Issues.
- Do **not** promote to production without a new signed checklist.
