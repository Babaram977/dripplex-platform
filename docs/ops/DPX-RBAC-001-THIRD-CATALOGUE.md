# DPX-RBAC-001 — the third permission catalogue

**Date:** 2026-08-18
**Trigger:** a Railway service showing CRASHED in production status, investigated on the founder's
instruction.
**Outcome:** the service is being removed. Nothing in production changes, because it never ran.

---

## 1. What it was

A Railway service named `seed-permissions-roles`, in `overflowing-unity` → production. Not a
deployment of anything in this repository: a one-off Railway _function_ on the stock
`ghcr.io/railwayapp/function-bun:1.3.0` image, whose entire program was a **base64 blob pasted into
the start-command field**:

```
./run.sh Y29uc3QgeyBQcmlzbWFDbGllbnQgfSA9IHJlcXVpcmUoJ0BwcmlzbWEvY2xpZW50Jyk7...
```

Decoded, it is a permission/role seeding script: a `PERMISSION_SEEDS` array, a `ROLE_SEEDS` array, a
`ROLE_PERMISSION_GRANTS` map, and a `main()` that upserts all three. Its one variable was
`DATABASE_URL`, referencing the backend's — production Postgres.

It is referenced nowhere in this repository. `grep` cannot find it, because it does not exist as a
file anywhere.

## 2. Why it crashed

Every run failed identically:

```
No dependencies found, skipping bun install
error: Cannot find module '.prisma/client/default'
Bun v1.3.0 (Linux x64)
```

The script calls `require('@prisma/client')`. The Prisma client is **generated** from the schema by
`prisma generate`; it does not exist until something generates it. The Railway function runtime
installs no dependencies and has no schema, so the import resolves to an unconfigured stub and
throws.

This is structural, not transient. No retry, restart, or variable would fix it. It crash-looped four
times within thirteen seconds on 2026-08-07 and has been CRASHED since. **It has never once
completed a run.**

## 3. Why it mattered anyway

It was a **third copy of the permission catalogue**, and it was stale.

| Source                                                       | Permissions | Roles |
| ------------------------------------------------------------ | ----------- | ----- |
| `prisma/seed-data/*.ts` (dev + tests)                        | 128         | 9     |
| `prisma/seed-rbac.cjs` (**the one that runs in production**) | 128         | 9     |
| The Railway blob                                             | **99**      | 9     |

Twenty-nine permissions behind. Among the missing: **`admin:rides:pricing:manage`** — the exact
permission whose absence from production 403'd the pricing console, found and fixed in #182, which
is also the incident that produced `prisma/rbac-seed-parity.spec.ts`.

That spec compares `seed-data/*.ts` against `seed-rbac.cjs` and fails the build when they drift. It
could never have seen this one. A test can only read files in the repository; a catalogue pasted
into a hosting dashboard is outside its reach entirely.

**What the actual risk was, stated precisely rather than dramatically:** the script only _upserts_ —
it contains no `delete`. Had someone fixed the Prisma problem and run it, it would not have revoked
the 29 newer permissions or anyone's grants; it would have re-written 99 rows that already exist.
The danger was not destruction. It was that a stale, unversioned, un-greppable copy of the
authorization model held write credentials to the production database, with nothing keeping it in
sync and no test able to notice.

## 4. What was ruled out

- **That it was doing the production seeding.** It is not. `seed-rbac.cjs` runs in the backend
  service's own deploy step and logged `seeded 128 permissions` on the most recent successful
  deploy. Production RBAC is correct and has been throughout.
- **That the crash caused harm.** It never connected to the database. Nothing was written.
- **That anything depends on it.** No repository reference, no service reference, no variable
  consumed by another service.

## 5. Where seeding belongs

In the backend's deploy step, from `prisma/seed-rbac.cjs`, versioned in this repository and guarded
by `rbac-seed-parity.spec.ts`. One path, reviewable, testable, greppable.

If a one-off data fix is ever needed against production again, it should be a script committed to
`prisma/` and run through the backend service — which already has the generated Prisma client, the
schema, and the credentials — not a blob typed into a dashboard.

## 6. Removal status

The removal was **staged** from this session on 2026-08-18. Railway treats a service deletion as a
staged change requiring an explicit commit, and the dashboard shows it as `Apply 1 change` with the
service card marked "Service will be deleted" — one change, nothing else bundled with it.

Committing it from here is not possible: Railway requires **two-factor verification** for
destructive staged changes, which an API/MCP token cannot supply.

**To finish — a founder action, one click:** Railway → `overflowing-unity` → production → **Deploy**
on the `Apply 1 change` bar. Then confirm `seed-permissions-roles` no longer appears in the
project's service list.

There is no urgency and no risk in waiting. The service is CRASHED with zero replicas, holds no
traffic, and has never executed. Railway was also mid-incident when this was staged — "Deployments
are slow to progress", all four regions (<https://status.railway.com/incident/YYU63JUO>) — so
applying it after that clears is the calmer choice.
