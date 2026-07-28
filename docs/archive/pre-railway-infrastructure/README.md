# Archived: pre-Railway infrastructure documentation

**Archived:** 2026-07-28, following `docs/AUDIT-PRODUCTION-READINESS.md`.

## Why these are here

These documents describe a production infrastructure design — Cloudflare Workers for the frontend apps, Hetzner (Docker Compose / Kubernetes) for the backend, GHCR image publishing, and an SSH/Compose deploy pipeline — built during Programs A–D. The founder and Claude reviewed the production readiness audit together and decided **Railway is the single source of truth for production infrastructure going forward** (see `docs/ops/PRODUCTION-RAILWAY.md`), because Railway is the only target with firsthand, hands-on verification: the backend, Postgres, and Redis were confirmed actually running and responding to `/api/v1/health` earlier in this engagement.

**These documents are not deleted** — the design work is real and some of it (backup cadence, disaster-recovery thinking, security checklist categories) may still be useful reference even though the specific mechanics (Hetzner sizing, GHCR tags, Cloudflare Workers config, SSH deploy hosts) no longer apply. Nothing in here should be treated as describing current production state.

## One nuance worth knowing

`docs/ops/reports/D2-DEPLOYMENT-REPORT.md` (not archived — it's an accurate historical record, kept in place) shows the frontend apps were, at one point, genuinely deployed live to Cloudflare Workers (`workers.dev` + custom domains), while the backend was explicitly **not** deployed on that path (`api.dripplex.com` never went live). The backend's real, working deployment happened later, on Railway, in a separate thread of work. So this wasn't purely aspirational documentation — part of it really happened — but it was never a coherent, single-target production setup, and the frontend-on-Workers piece has not been re-verified as still live. Consolidating on Railway may mean redeploying the frontend apps there too, rather than just a documentation change — worth confirming with the founder before assuming Cloudflare Workers frontend hosting carries forward.

## What replaced this

See `docs/ops/PRODUCTION-RAILWAY.md` for the current, verified-as-of-writing production setup, and `docs/AUDIT-PRODUCTION-READINESS.md` for the audit that prompted this archival.
