# Program B1 — Customer Web Production Deployment

| Field            | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| **Program**      | B1 — Customer Web Production                                   |
| **Branch**       | `cursor/program-b1-customer-web-production-1b33`               |
| **Base**         | `main`                                                         |
| **Status**       | Code complete — Cloudflare live deploy blocked on account auth |
| **Last updated** | 2026-07-22                                                     |

## Constraints honored

- Backend Core locked — no API / schema / auth / payment / delivery changes
- No mock APIs
- Monorepo architecture preserved

---

## Completed

### 1. Repository verification

| File                                    | Status                                    |
| --------------------------------------- | ----------------------------------------- |
| `apps/customer-web/wrangler.jsonc`      | ✅ Present — name `dripplex-customer-web` |
| `apps/customer-web/open-next.config.ts` | ✅                                        |
| `apps/customer-web/scripts/cf-build.sh` | ✅ Defaults `NEXT_PUBLIC_*`               |
| `apps/customer-web/public/_headers`     | ✅                                        |
| Root `wrangler.jsonc`                   | ✅ Monorepo-root fallback                 |

### 2. Cloudflare Workers Build settings (documented)

| Setting        | Value                      |
| -------------- | -------------------------- |
| Root directory | `apps/customer-web`        |
| Build command  | `bash scripts/cf-build.sh` |
| Deploy command | `npx wrangler deploy`      |
| Worker name    | `dripplex-customer-web`    |

### 3. Environment variables

| Variable                   | Status                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ `.env.example`, `.dev.vars.example`, `cf-build.sh` default |
| `NEXT_PUBLIC_APP_URL`      | ✅ Same                                                       |
| `NEXT_PUBLIC_SENTRY_DSN`   | ✅ Optional                                                   |

### 4. Production build (agent)

| Gate                     | Result                                                                |
| ------------------------ | --------------------------------------------------------------------- |
| Lint                     | ✅                                                                    |
| Typecheck                | ✅                                                                    |
| Tests                    | ✅ 4/4                                                                |
| OpenNext (`cf-build.sh`) | ✅                                                                    |
| Wrangler `--dry-run`     | ✅ gzip ≈ 1.43 MiB                                                    |
| Wrangler live deploy     | ❌ No Cloudflare account auth in agent; `--temporary` capped at 1 MiB |

### 5. Authentication

Live Backend Core SDK (`createCustomerSdk` + `bindSdkAuth`):

- Login / Register / Forgot / Reset / OTP ✅
- JWT refresh via SDK interceptor ✅
- Logout (navbar + dashboard header) ✅
- Forgot-password copy corrected ✅

### 6. Customer dashboard (B1)

| Surface                                              | Status                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| Landing                                              | ✅                                                         |
| Dashboard shell                                      | ✅ + mobile drawer                                         |
| Overview (Backend Core probes)                       | ✅                                                         |
| Profile / Notifications / Wallet / Orders / Settings | ✅ Production placeholders (routes exist; product UI → B2) |

### 7–8. UI / performance

- Dark mode, responsive shell, SEO metadata, PWA baseline ✅
- `global-error.tsx`, dashboard `loading.tsx` ✅
- Dead hash links / PWA shortcut 404s fixed ✅
- Lighthouse not run in agent (no browser MCP); OpenNext + `_headers` caching in place

### 9. Deployment

**Not live from this agent.** Blockers:

1. Cloudflare MCP requires Cursor **desktop** interactive auth
2. No `CLOUDFLARE_API_TOKEN` / `wrangler login` in environment
3. Preview (`--temporary`) rejects OpenNext bundle (1 MiB preview limit; Free plan allows 3 MiB gzip — our bundle fits Free/Paid)

Operator: authenticate Cloudflare → set Builds settings → Retry deploy (or `pnpm --filter @dripplex/customer-web deploy` locally).

---

## Files changed (this branch)

- Dashboard placeholders + routes under `dashboard/{profile,notifications,wallet,orders,settings}`
- Nav / header / bottom nav / mobile drawer
- `global-error.tsx`, dashboard `loading.tsx`
- Wrangler name → `dripplex-customer-web`
- `.dev.vars.example`, `docs/ops/CLOUDFLARE-CUSTOMER-WEB.md`
- `docs/PROGRAM-B1.md` (this file)

---

## Remaining issues (genuine blockers)

1. **Cloudflare account authentication** for live Workers deploy
2. **Dashboard Build settings** must be applied in Cloudflare UI (or via authenticated MCP)
3. If an old Worker named `dripplex-platform` still exists, **rename** to `dripplex-customer-web`
4. Backend API reachability for end-user login against production (`api.dripplex.com`) — infrastructure, not Customer Web

---

## Ready for B2?

**Yes — for Program B2 (Marketplace & Super App modules), conditionally.**

Customer Web is **production-ready as a B1 shell**: auth, dashboard chrome, placeholders, OpenNext/Wrangler packaging, and verified builds.

**Do not claim “live on Cloudflare Workers”** until an authenticated deploy succeeds and the Worker URL responds.

After deploy succeeds, B2 can implement marketplace, cart, checkout UI on these routes.
