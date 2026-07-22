# Program C — Phase C4: Release Candidate & Deployment Readiness

| Field            | Value                                               |
| ---------------- | --------------------------------------------------- |
| **Program**      | C — Backend ↔ Frontend Integration                  |
| **Phase**        | C4 — Release Candidate & Deployment Readiness       |
| **Status**       | Complete — awaiting staging approval                |
| **Branch**       | `cursor/program-c4-release-candidate-1b33`          |
| **Base**         | C3 (`cursor/program-c3-perf-security-release-1b33`) |
| **Version**      | `1.0.0-rc.1` (RC1)                                  |
| **Last updated** | 2026-07-22                                          |

## Constraints honored

- No new features
- No UI redesign
- No Backend API / endpoint changes
- No database schema changes
- No SDK changes except release blockers (none required)
- Release preparation only

---

## 1. Release Candidate status

| Item                                                                                       | Result                   |
| ------------------------------------------------------------------------------------------ | ------------------------ |
| RC identity                                                                                | **RC1** / `1.0.0-rc.1`   |
| Source freeze metadata                                                                     | `docs/releases/RC1.json` |
| Version consistency (Backend, SDK, Customer, Merchant, Rider, Admin, Ops, shared packages) | ✅ all `1.0.0-rc.1`      |
| Release notes                                                                              | `docs/RELEASE-RC1.md`    |
| Programs A–C3                                                                              | LOCKED (unchanged)       |

---

## 2. Deployment readiness checklist

| Area                | Artifact                                           | Status        |
| ------------------- | -------------------------------------------------- | ------------- |
| Frontend deploy     | `docs/ops/DEPLOYMENT.md` + customer Dockerfile     | ✅ prepared   |
| Backend deploy      | Dockerfile + compose                               | ✅ prepared   |
| Migration order     | Prisma `migrate deploy` only                       | ✅ documented |
| Rollback            | `docs/ops/ROLLBACK.md`                             | ✅            |
| Release checklist   | In deployment doc + smoke                          | ✅            |
| CI quality workflow | `.github/workflows/ci.yml`                         | ✅            |
| Staging compose     | `infrastructure/docker/docker-compose.staging.yml` | ✅            |

---

## 3. Production configuration verification

See `docs/ops/PRODUCTION-CONFIG.md`.

| Check                                 | Status                         |
| ------------------------------------- | ------------------------------ |
| Env template completeness             | ✅ `.env.example` expanded     |
| Production URL / API patterns         | ✅ documented (fill at deploy) |
| HTTPS / HSTS / CSP / security headers | ✅ portals (C3)                |
| Logging (`LOG_LEVEL`)                 | ✅                             |
| Health monitoring                     | ✅ `/api/v1/health`            |
| Error / APM / crash SDKs              | ⚠️ deferred (documented)       |
| Feature flags service                 | N/A — env-driven               |
| Production build settings             | ✅                             |

---

## 4. Remaining blockers

| Blocker                                 | Blocks                   | Notes                                                                 |
| --------------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| Official brand vectors / PNG splash set | **Branding polish only** | Documented in `docs/TODO-BRAND-ASSETS.md` — **only branding blocker** |
| Staging secrets + live smoke sign-off   | Staging approval         | Process — not a code defect                                           |
| APM / crash reporting not wired         | Observability depth      | Accepted deferred for RC1 staging                                     |

No Critical/High code regressions introduced in C4.

---

## 5. Known issues

See `docs/RELEASE-RC1.md` (KI-01 … KI-10). Highlights: placeholder brand assets; JWT in web storage; catalog/merchant-order BE gaps; commerce UI gaps; agent environment lacked live Postgres for full browser E2E.

---

## 6. Rollback plan

`docs/ops/ROLLBACK.md` — frontend image rollback, backend tag rollback, DB restore for failed migrations, secret version revert.

---

## 7. Release notes summary

- **RC1** freezes integration stack at `1.0.0-rc.1`
- PWA baseline on customer-web; portal icons wired
- Ops runbooks + CI + staging compose added
- **Breaking changes:** none
- **Deferred:** brand assets, APM, cookie auth, missing BE/UI product surfaces

Full text: `docs/RELEASE-RC1.md`.

---

## 8. Quality gate results

| Gate             | Result                                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| Typecheck        | ✅ `pnpm typecheck` — 17/17 tasks                                             |
| Lint             | ✅ `pnpm lint` — 17/17 tasks                                                  |
| Tests            | ✅ `pnpm test` — Backend **607** passed; portal/SDK suites green              |
| Production build | ✅ `pnpm build` — Backend + all five Next portals                             |
| Dependency audit | ✅ `pnpm audit --prod` — **0** known vulnerabilities (after RC1 remediations) |
| Critical issues  | **0**                                                                         |
| High issues      | **0**                                                                         |

### Audit remediations (release blockers)

| Change                            | Reason                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| `bcrypt` 5.1.1 → 6.0.0            | Remove transitive vulnerable `tar` via `@mapbox/node-pre-gyp` |
| `pnpm.overrides.sharp` ≥ 0.35.0   | Patch Next optional `sharp` / libvips advisories              |
| `pnpm.overrides.postcss` ≥ 8.5.10 | Clear remaining moderate XSS advisory                         |

Password hash API unchanged; backend auth unit tests still **607** pass.

---

## 9. Recommendation

### READY FOR STAGING

Conditional on:

1. Staging secrets populated from `.env.example` / secret manager
2. Compose or equivalent Postgres+Redis+API healthy
3. `docs/ops/SMOKE-CHECKLIST.md` executed and signed
4. Acceptance of known product gaps (C2 BLOCKED-BE/UI) and branding placeholder (KI-01)

### Production

**Wait for final approval after staging sign-off.** Do not deploy production from RC1 without explicit human approval.

---

## PWA verification (customer-web)

| Item                | Status                                           |
| ------------------- | ------------------------------------------------ |
| Manifest            | ✅ `/manifest.webmanifest`                       |
| Service worker      | ✅ `/sw.js` + register component                 |
| Offline fallback    | ✅ `/offline.html`                               |
| Install prompt      | ✅ browser-native via manifest (no custom UI)    |
| Theme colours       | ✅ viewport + manifest `#0E7A3E` / `#F4F6F8`     |
| Splash screens      | ⚠️ OS-generated from icons; no custom PNG splash |
| Favicon / app icons | ✅ SVG (placeholder brand — KI-01)               |
| Apple touch icons   | ✅ metadata → `/app-icon.svg` (PNG deferred)     |

---

## Monitoring verification

| Item                   | Status                      |
| ---------------------- | --------------------------- |
| Health endpoints       | ✅                          |
| Error logging          | ✅ Nest + `LOG_LEVEL`       |
| Performance monitoring | ⚠️ deferred APM             |
| Crash reporting        | ⚠️ deferred                 |
| Analytics              | ✅ Backend APIs; UI partial |
| Audit logging          | ✅                          |

---

## Backups verification

Documented in `docs/ops/BACKUPS.md` — strategy, restore, config backup, secrets. Live restore drill is an ops action on staging.
