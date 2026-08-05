# DPX-LAUNCH-001.5 — Stabilization Window

Founder-authorized (2026-08-05), following the successful `main`
fast-forward and full deployment verification of all seven frozen
modules onto Railway. Founder's framing, verbatim:

> A few weeks ago I would have said "the architecture is complete."
> Today I'd say "the platform is operational." That's a very different
> statement... I would create a stabilization window before Ride
> implementation begins. One week. Objectives: Observe Railway.
> Exercise deployments. Watch logs. Monitor performance. Validate
> backups. Confirm health. Verify CORS. Configure production secrets.
> Complete monitoring. No major features. Just operational confidence.

Scope split into what could start immediately (no founder input needed)
versus what stays queued exactly as `docs/ops/DPX-LAUNCH-001-RAILWAY-READINESS.md`
§B/§C already documented it (production secrets, `CORS_ORIGINS`, backup
plan tier, custom domain).

## 1. Baseline metrics (captured 2026-08-05, ~4h post-launch)

| Service  | CPU (avg/max)  | Memory (avg/max)  |
| -------- | -------------- | ----------------- |
| Backend  | 0.034% / 0.10% | 109 MB / 116 MB   |
| Postgres | 0.034% / 0.08% | 62.4 MB / 62.9 MB |

Light load throughout — no real user traffic yet, expected for a
just-launched platform. This is the baseline the coming days' samples
get compared against; a meaningful deviation (sustained CPU/memory
climb with no corresponding traffic) would be the first sign of a leak
or a runaway process, not something visible from a single point-in-time
check.

## 2. Real rollback drill

Question this answers: when a bad deploy happens, does the documented
recovery procedure actually work, end to end, or only in theory?

**Method:** the Railway MCP tooling available in this session can only
`redeploy` a service's _current_ latest deployment — there is no tool
here to redeploy a specific _past_ deployment ID (documented as a known
gap in `docs/ops/DPX-LAUNCH-001-RAILWAY-READINESS.md` §D "Rollback
procedure"). Since this repo's actual recovery path is Railway's
GitHub-integration auto-deploy-on-push, the real, always-available
rollback mechanism is **git revert + push**, not a Railway-dashboard
click — so that's what this drill tests, on `merchant-portal` (newest
service, no real users yet, lowest possible stakes).

1. Committed a trivial, harmless, single-comment-line change to
   `apps/merchant-portal/Dockerfile` (`d2455ea`), pushed to `main`.
2. Railway auto-triggered a real rebuild+redeploy from the push —
   confirmed via `list-deployments`/`get-status`, not assumed. Deployment
   `5fa67991-bb03-4dcb-a1c1-37d4eede4fd0` reached `SUCCESS`.
3. Ran `git revert --no-edit d2455ea` (commit `b86d2b0`, confirmed clean
   — one file changed, two deletions, `apps/merchant-portal/Dockerfile`
   back to its exact pre-drill state) and `git push origin main`. Railway
   auto-triggered another real rebuild+redeploy from the revert push —
   deployment `2366d5f8-d6b7-40b0-94e8-497e0efe78fd`, `createdAt`
   21:11:35 UTC, `updatedAt` 21:12:03 UTC (~28s, cached build layers),
   status `SUCCESS`. Confirmed via `list-deployments` that this
   deployment's `meta.commitHash` is `b86d2b0` and `meta.commitMessage`
   is the revert commit message — not just "some deploy succeeded," but
   specifically the revert. Deploy logs confirm the container started
   clean on the reverted image: `Starting Container` → `✓ Starting...`
   → `✓ Ready in 80ms` → `▲ Next.js 15.5.21` listening, no errors.

**Result: the drill passed.** A bad (or in this case harmless-but-real)
change pushed to `main` was auto-deployed, observed, then undone with a
plain `git revert` + push, and Railway auto-deployed the reverted state
just as automatically — no dashboard interaction, no manual redeploy
trigger, no founder involvement needed. This confirms the documented
recovery procedure in `docs/ops/DPX-LAUNCH-001-RAILWAY-READINESS.md` §D
is real, not aspirational. Total time from "bad" push to confirmed
reverted-and-healthy: under 3 minutes end to end (`d2455ea` push →
`5fa67991` SUCCESS → `b86d2b0` push → `2366d5f8` SUCCESS).

## 3. Real finding: new services had no build-path scoping

While watching the rollback-drill deploy trigger, noticed it also
triggered a rebuild of `operations-console` — a service that shouldn't
have been touched by a `merchant-portal`-only change. Checked both new
services' config: neither `merchant-portal` nor `operations-console`
(both created earlier today) had `watchPatterns` set, unlike every
other service in the project (backend, customer-web, admin-portal,
driver-portal all scope rebuilds to their own app directory + shared
packages). This meant both new services were rebuilding on _every_
push to `main`, regardless of relevance — wasteful compute, and it
would have made a future "what triggered this deploy?" investigation
confusing. Fixed both to match the existing scoped pattern
(`apps/<app>/**` + `packages/{types,utils,sdk,ui,hooks}/**` +
`pnpm-lock.yaml`/`pnpm-workspace.yaml`).

## 4. Backup/restore drill

**Status: feasibility checked — this session structurally cannot run
it, at all, regardless of credentials or founder go-ahead.**

The question this section originally asked ("can this session's network
reach Railway's Postgres for a `pg_dump`/`pg_restore` cycle?") now has a
definitive answer, not a probe result: this environment's egress proxy
documentation (`/root/.ccr/README.md`) explicitly lists **"raw-TCP
databases"** under "Not supported through the proxy (report, do not
work around)" — alongside gRPC, WebSocket upgrades, and non-443 HTTPS
ports. This session's only network path out is the HTTPS-only proxy;
there is no raw TCP path to Postgres's `5432` at all, independent of
whether credentials are supplied. Supplying `DATABASE_URL` would not
change this — the connection would never leave the proxy layer. This
is a hard platform boundary of the session, not a permissions gap to
ask the founder to lift.

**What this changes for the backup/restore work itself:** it reframes
from "give me the credentials and I'll run the drill" to "this needs a
path that doesn't route through this sandbox's egress." Checked
Railway's own documentation for what that looks like
(`docs.railway.com/guides/postgres-backups-restores`) — Railway
supports three backup layers for managed Postgres:

1. **Scheduled volume backups** — full-volume snapshots, restorable
   (via Railway's own dashboard/API) into the same project/environment.
   Restoring removes any newer backups taken after the restore point.
2. **Logical backups via `pg_dump`** — same tool this drill was
   originally going to use, but run _from inside Railway's network_
   (e.g. a one-off Railway CLI session or a Railway-hosted job), not
   from this sandbox.
3. **PITR (point-in-time recovery)** for restoring to a specific
   timestamp rather than a snapshot boundary.

None of these require this session to open a raw connection to
Postgres. But none of them are exposed through the Railway MCP toolset
available in this session either — there's no `backup`/`restore`
action among the available tools (`get-status`, `list-*`,
`get-logs`, `set-variables`, `update-service`, `create-deployment`,
`generate-domain`, `redeploy`, `get-service-metrics`, plus
`search-docs`/`fetch-docs`). Enabling scheduled volume backups and
running a real restore drill is therefore a **Railway
dashboard action**, not something this session can execute even with
credentials — flagged as a founder/ops action item, not left silently
unresolved.

**Recommended concrete next step** (added to §7, does not require a
credential, just a decision): founder or whoever holds Railway
dashboard access enables scheduled volume backups on the `Postgres`
service and runs one restore drill directly in Railway's UI, following
their own documented "which layer to use when" guidance. Alternatively,
Railway's guide describes deploying a small **cron-service** in-project
that runs `pg_dump` on a schedule and ships the dump offsite — that
_is_ something this session could implement as ordinary code (a new
Railway service + script), since it runs inside Railway's network
rather than through this sandbox's egress. That's a real implementation
option worth raising with the founder rather than waiting on dashboard
access, if backup automation is wanted sooner.

## 5. Monitoring-completeness spec

What "monitoring complete" will mean once `SENTRY_DSN` (backend) and
`NEXT_PUBLIC_SENTRY_DSN` (frontends) are supplied — written now so
wiring it up is mechanical the moment the founder provides the DSN,
not another research pass:

- **Error tracking**: `initBackendSentry()` (`apps/backend/src/observability/sentry.ts`)
  is already real and unconditionally called from `main.ts` — confirmed
  in Launch Track 1. Setting `SENTRY_DSN` on the backend Railway service
  is the only remaining step; no code change needed.
- **Frontend error tracking**: none of the five portals currently
  import `@sentry/nextjs` in their own config — confirmed by grep, a
  real gap, not yet closed. Wiring this in is in-scope for whenever
  Sentry credentials arrive, not blocked on anything else.
- **Alerting**: no Slack/PagerDuty/email hook exists on deploy failure
  or health-check failure today (confirmed in Launch Track 1, §D.5).
  Decision needed from the founder on channel (Slack webhook is the
  cheapest, and `SLACK_WEBHOOK_URL`/`ONCALL_SLACK_CHANNEL` already
  exist as named-but-unwired vars in the old pre-Railway
  `.env.production.example` — those were never implemented against any
  real code, so this would be new work, not just flipping a switch).
- **Log retention**: Railway's own log retention window has not been
  checked against this platform's operational needs — flagged as an
  open question, not yet answered.
- **Dashboards**: Railway's built-in per-service CPU/memory/network
  graphs are usable today with zero setup (this doc's §1 baseline was
  pulled from them). Whether that's sufficient for launch or something
  more (Grafana, etc.) is an open decision, not a blocker.

## 6. Multi-day observation

A single point-in-time check (what Launch Track 1's deployment
verification was) proves a deploy succeeded. It doesn't prove the
platform stays healthy under real conditions over days. This section
tracks samples taken across the stabilization window.

| Date/time (UTC)   | Backend CPU/Mem         | Postgres CPU/Mem         | Notes                                                                                            |
| ----------------- | ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ |
| 2026-08-05 ~21:05 | 0.034% avg / 109 MB avg | 0.034% avg / 62.4 MB avg | Baseline, ~4h post-launch, no real traffic                                                       |
| 2026-08-05 ~21:20 | 0.032% avg / 112 MB avg | 0.034% avg / 62.5 MB avg | Second sample (1h window), post rollback-drill deploys — no drift from baseline, no real traffic |

_(Appended to as further samples are taken across the window.)_

## 6a. Log & error review (2026-08-05, ~21:30 UTC)

Founder's follow-up review asked to continue "log review, error
review, resource trends, deployment confidence." Deployment confidence
and resource trends are §6 above; this is the log/error half:

- **Deployment confidence**: `get-status` across all 9 services in
  `production` — every one (`customer-web`, `backend`,
  `customer-mobile`, `admin-portal`, `driver-portal`, `Postgres`,
  `Redis`, `merchant-portal`, `operations-console`) shows its latest
  deployment as `SUCCESS`. No service in a degraded or crashed state.
- **Backend deploy logs, filtered for `error`**: zero matching lines
  on the current live deployment (`adb2a2c5`). Not "errors were
  suppressed" — genuinely nothing matched.
- **Backend HTTP (proxy request) logs**: zero entries in the queried
  window. Read plainly, not spun: this isn't "clean under load," it's
  "no load yet" — consistent with §1/§6's "no real user traffic"
  baseline. A log/error review with no traffic can only prove the
  platform is quiet, not that it's resilient; that second claim still
  needs real traffic (or a deliberate synthetic load) to test, which is
  out of scope for a no-credential stabilization pass.
- **Conclusion**: nothing anomalous found. This is a clean result, not
  a null result — the absence of both errors and traffic is itself the
  honest finding for this point in the window.

## 7. Founder decisions recorded (2026-08-05, second review round)

Following review of the rollback drill, backup feasibility finding,
and observation samples above, the founder made the following calls
verbatim:

> Backup strategy — Short term: Railway's managed backup and restore
> process. Medium term: Build an automated `pg_dump` service that runs
> inside Railway and stores encrypted backups in external object
> storage.
>
> CORS_ORIGINS — Before enabling additional integrations, define the
> production origins explicitly. Avoid wildcard configurations in
> production. List each application domain intentionally.
>
> Production credentials — introduce in this order: 1. Payment
> gateway. 2. Maps. 3. Firebase notifications. 4. Sentry. 5. Smile ID.
> That order aligns with customer-facing impact.
>
> Custom domains — don't rush this if Railway's generated domains are
> stable. Complete the stabilization window first, then move production
> traffic to custom domains after you're satisfied with operational
> behavior.
>
> What I would not do — interrupt this stabilization period to start
> large new feature work immediately... Current: Launch Track 1.5.
> Continue: Daily observations, Log review, Error review, Resource
> trends, Deployment confidence. When the stabilization window
> completes: move into DPX-RIDE-001 — Ride Reality Audit, only after
> confirming the current platform remains stable over the observation
> period.

**What this settles:**

- The backup approach is decided in principle (Railway-managed first,
  in-project `pg_dump` + encrypted offsite storage second). Execution
  of either still needs something this session doesn't have: Railway
  dashboard access for the short-term option, or external object-storage
  credentials (and an encryption-key decision) for the medium-term
  one — so both stay in §8 below as founder-dependent, now with a
  decided shape instead of an open question.
- The credential rollout order (payment → maps → Firebase → Sentry →
  Smile ID) is recorded for when the founder supplies each one — no
  code change needed to act on this, it's a sequencing decision for
  founder handoff, not an engineering task.
- Custom domains: confirmed non-blocking, deferred until after
  stabilization, consistent with Launch Track 1's original framing.
- Ride Reality Audit: confirmed still gated on stabilization
  completing — not started, not scheduled to start from this decision
  alone.

## 7a. CORS_ORIGINS — proposed value (drafted, NOT applied)

The founder's guidance ("list each application domain intentionally,
avoid wildcards") is actionable right now using data this session
already has — the live Railway-generated domains for every currently
deployed frontend, pulled directly via `list-domains` (not guessed):

| Service              | Domain                                                                                                               | In proposal?                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `customer-web`       | `dripplexcustomer-web-production.up.railway.app`                                                                     | Yes                                                                     |
| `admin-portal`       | `dripplexadmin-portal-production.up.railway.app`                                                                     | Yes                                                                     |
| `driver-portal`      | `dripplexdriver-portal-production.up.railway.app`                                                                    | Yes                                                                     |
| `merchant-portal`    | `dripplexmerchant-portal-production.up.railway.app`                                                                  | Yes                                                                     |
| `operations-console` | `dripplexoperations-console-production.up.railway.app`                                                               | Yes                                                                     |
| `rider-portal`       | not deployed yet                                                                                                     | No — nothing to allow yet                                               |
| `customer-mobile`    | live, but a misconfigured stray duplicate of `customer-web` (flagged in Launch Track 1 §D.3, never fixed or deleted) | No — would just extend an already-flagged problem into the CORS surface |

Proposed value (HTTPS, five origins, no wildcard):

```
https://dripplexcustomer-web-production.up.railway.app,https://dripplexadmin-portal-production.up.railway.app,https://dripplexdriver-portal-production.up.railway.app,https://dripplexmerchant-portal-production.up.railway.app,https://dripplexoperations-console-production.up.railway.app
```

**This is a draft, not applied.** The founder's earlier explicit
instruction stands: "Since Railway redacts the current value, do not
overwrite it. Leave it unchanged until I provide the existing value or
update it directly in Railway." This proposal exists so that whenever
the founder does share the current value (or authorizes an overwrite),
the actual comparison/merge work is already done instead of starting
from scratch — and separately flags that `customer-mobile`'s stray
config should probably be resolved (fixed or deleted) before or
alongside any CORS change, since leaving it as-is means either
excluding a live service from CORS (fine, it's not meant to be
customer-facing) or having to explain its presence if it's ever
included by mistake.

## 8. Still queued for the founder

- `CORS_ORIGINS` current value — needed to safely append driver-portal's
  domain without dropping what's already there; this session's Railway
  connection returns values redacted.
- Payment provider keys (Paystack/Flutterwave/OPay), `GOOGLE_MAPS_SERVER_API_KEY`
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, Smile ID, Firebase (server + web),
    Sentry DSNs.
- **Backup plan decision (updated by §4's feasibility finding, not just
  "unchanged from Launch Track 1" anymore):** since this session cannot
  reach Postgres via raw TCP under any circumstances, the founder (or
  whoever holds Railway dashboard access) needs to choose one of two
  concrete paths, not just "a tier":
  1. Enable Railway's scheduled volume backups directly in the
     dashboard and run one restore drill there (no credential needed
     from this session — a dashboard click, following Railway's own
     "which layer to use when" guide).
  2. Authorize this session to build an in-project cron-service that
     runs `pg_dump` on a schedule and ships the dump offsite (real
     implementation work this session _can_ do, since it runs inside
     Railway's network, not through this sandbox's blocked egress).
- Custom domain decision.

Full detail on the payment/maps/Smile ID/Firebase/Sentry items:
`docs/ops/DPX-LAUNCH-001-RAILWAY-READINESS.md` §B.
