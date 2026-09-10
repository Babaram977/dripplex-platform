# DPX-LAUNCH-011 — Backend could not deploy for 18 hours (2026-09-10)

**Status:** Root cause found and fixed in `5fc6d572`. Deployment verification
pending — see "Verification" below. This document is the record of _why_ eight
consecutive deploys failed, because the reason was not what any of them were
aimed at.

## Summary

Between 02:57 and 21:15 UTC every `@dripplex/backend` deployment failed at
`PRE_DEPLOY_COMMAND`. Four separate fixes were made to the fleet settlement
migrations during that window. **None of them ever executed against
production.** The pre-deploy container was never starting at all.

Production itself was never down. `api.dripplex.com/api/v1/health` served 200
throughout, on the container built at ~02:48 — the last deploy before the fleet
work. This was a _cannot ship_ incident, not an outage.

## Root cause

`preDeployCommand` is spawned directly by Railway, **without a shell**.

This was already known and written up here in August — see
`DPX-LAUNCH-006-REGISTRATION-INCIDENT.md` (Bug 1, "Fix, attempt 1") and the
"Railway deploy quirks" section of `docs/DPX-SUPERAPP-WIRING-STATUS.md`. It is
the entire reason `prisma/seed-rbac.cjs` runs `migrate deploy` itself via
`execFileSync` rather than chaining with `&&`, and why the steady-state value
is a single command:

```
preDeployCommand: ["node prisma/seed-rbac.cjs"]
```

During the fleet settlement recovery that value was replaced with shell syntax:

```
pnpm prisma migrate resolve --rolled-back A || true; \
pnpm prisma migrate resolve --rolled-back B || true; \
pnpm prisma migrate deploy
```

With no shell, `;` and `||` are not operators. The command could not be
executed, so the container never started and produced no output.

### How that was established

The `deploy` log stream distinguishes the two failure modes cleanly:

| Deployment         | preDeployCommand            | `deploy` log entries                                                    |
| ------------------ | --------------------------- | ----------------------------------------------------------------------- |
| `e74bb957` (02:56) | `node prisma/seed-rbac.cjs` | "Starting Container", full Prisma output, `P3009`, "Stopping Container" |
| `28c610d5` (20:43) | shell string                | **0**                                                                   |
| `19bca67e` (20:51) | shell string                | **0**                                                                   |
| `c96f291a` (21:13) | shell string                | **0**                                                                   |

A pre-deploy that _runs_ logs to the deploy stream. Three consecutive empty
streams mean it never ran. `get-deployment-diagnosis` returned `null` for all
of them, and `failureError` was only the generic "Pre-deploy command failed",
which is why this was not obvious from the Railway API alone.

## Why fixing the command was not sufficient

`20260910043000_fleet_settlement_receivables` is recorded **failed** in
`_prisma_migrations` (it hit `42P07`, `fleet_settlement_requests` already
exists, at 02:52:39). Prisma refuses to apply _anything_ while such a row
exists — `P3009`. So the chain needed reconciling as well as the command
fixing.

Because `preDeployCommand` must stay one shell-free command, that
reconciliation belongs **inside** `seed-rbac.cjs` — the same reason
`seed-admin.cjs` and `seed-promotions.cjs` are chained there rather than added
as extra pre-deploy commands.

`runMigrations()` is now preceded by `reconcileFailedMigrations()`:

- It resolves **`--rolled-back`, never `--applied`.** `--applied` would mark
  the migration done and skip it, which assumes production's schema already
  matches. `--rolled-back` re-runs it, so nothing has to be assumed about the
  live schema — which matters, because this session had no database access to
  verify it with.
- Re-running is only safe because every statement in the three fleet
  migrations is guarded (`IF NOT EXISTS`, `IF EXISTS`, or a `pg_constraint`
  lookup inside `DO $$`). That property is now asserted by a spec in
  `prisma/prisma-foundation.spec.ts` rather than trusted.
- It is an **allowlist and fails closed.** An unrecognised failed migration
  aborts the deploy instead of being cleared to make Railway green.

## Rehearsal (Postgres 16, all 110 migrations)

1. Empty database → whole chain applies.
2. Mark `043000` failed → reproduces `P3009` with production's exact wording.
3. Patched bootstrap → reconciles, re-runs `043000`, chain completes, RBAC
   seeds, exit 0.
4. Second run → "No pending migrations to apply", clean no-op.
5. Unknown failed migration → aborts, exit 1.

## Also fixed on the way

`20260910051000` ran a bare `ALTER TYPE ... ADD VALUE 'PROCESSING'` on an enum
that `20260910050000` already creates _with_ that label — `42710`, on a
database in any state including empty. Fixed to `ADD VALUE IF NOT EXISTS` in
`778c1e5`. Real bug, necessary fix, but it was never the blocker and had never
run in production.

## Open items — do not treat a green deploy as closing these

1. **Staged environment patch `e7002358-4a0f-4bb7-abd1-9b3b6f116090`**
   (created 20:51:31 UTC). It stages the **removal of nearly every environment
   variable across every service** — `DATABASE_URL`, `REDIS_URL`, both JWT
   secrets, `PAYSTACK_SECRET_KEY`, Firebase, Google, object storage, Termii,
   Resend, the mail bridge credentials — plus shared `DATABASE_URL`/`REDIS_URL`
   and three portals' service-domain ports. Railway reports it as
   `destructive: false`; that flag does not cover this. **It must be discarded,
   not deployed.** Committing it would take the whole platform down.
2. **`fleet_settlement_requests` is defined twice, differently.** `043000`
   creates it with `status VARCHAR(16)` + a CHECK constraint and a
   `receivable_id` column; `050000` creates it with a
   `FleetSettlementRequestStatus` enum column and different amount precision.
   Both use `CREATE TABLE IF NOT EXISTS`, so `043000` wins by ordering and
   `050000`'s definition silently no-ops. Whether the surviving shape matches
   `schema.prisma` has **not** been verified. Fleet settlement endpoints should
   not be trusted until it is — a green deploy will not prove it, because
   `migrate deploy` does not detect drift.
3. **`DPX_MIGRATION_RECOVERY`** is set on the backend service and is read
   nowhere in the codebase. Inert; remove it.
4. `preDeployCommand` needs no further "recovery" edits. Once the chain is
   clean, `reconcileFailedMigrations()` is a no-op on every deploy.

## Rule to carry forward

`preDeployCommand` takes **one command, no shell.** No `&&`, no `;`, no `||`,
no pipes. Anything that needs sequencing goes inside `seed-rbac.cjs`. This has
now caused two production incidents (DPX-LAUNCH-006 and this one); the second
was more expensive because the failure was silent.
