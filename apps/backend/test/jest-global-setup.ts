import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

/**
 * Jest global setup — database integration-test integrity guard.
 *
 * Many backend specs are real-Postgres integration tests that set a local
 * `databaseAvailable = false` and early-return when the database can't be
 * reached — so with no database present they pass **vacuously**, silently
 * hiding real failures. (This is exactly how a broken SOS-queue fixture stayed
 * "green" in a CI job that had no Postgres service.)
 *
 * When a database is required, this fails the whole run fast rather than
 * letting those specs skip-and-succeed.
 *
 * ## When it arms, and why `DATABASE_URL` counts
 *
 *  - `CI=true` (set by GitHub Actions)
 *  - `DATABASE_REQUIRED=true`, set explicitly
 *  - **`DATABASE_URL` is set** — added 2026-08-23
 *
 * That third condition is the one that was missing, and its absence cost two
 * near-misses in two days. Running `DATABASE_URL=… pnpm jest` with the database
 * down reported **every DB-backed suite as passing**: 15 green ticks in 2ms,
 * asserting nothing. Once that was a security test — cross-hotel isolation of
 * booking check-in codes — which "passed" identically whether the guard it
 * tested was present or deleted.
 *
 * Passing `DATABASE_URL` is not incidental. Nothing defaults it: `jest-setup-env`
 * supplies `REDIS_URL`, `NODE_ENV` and the JWT secrets, but deliberately not
 * this. Someone who sets it is saying "test against that database", and the
 * honest answer when it cannot be reached is an error, not a green run.
 *
 * ## Turning it off
 *
 * `DATABASE_REQUIRED=false` overrides all three, for the genuine case of
 * running the non-database specs on a machine whose `.env` points at a database
 * that happens to be down. It has to be explicit, because the whole failure
 * mode here is a run that looks fine and is not.
 *
 * With none of the above — no `DATABASE_URL` at all — this is a no-op and the
 * suite still runs, exactly as before. It prints a warning first, because a
 * green run in that mode has not verified anything a database is involved in.
 *
 * ## One thing worth knowing about `.env`
 *
 * Importing `@prisma/client` auto-loads `apps/backend/.env`, and that happens
 * at the top of this file — before the check below runs. So on a developer
 * machine with a `.env` naming a database, the guard arms even when nothing was
 * passed on the command line.
 *
 * That is the intended outcome, not an accident of import order: a `.env`
 * pointing at a database is the same statement of intent as an exported
 * variable. It does mean `DATABASE_REQUIRED=false` is the way to run the
 * non-database specs on such a machine, rather than unsetting the variable.
 */
export function databaseIsRequired(env: NodeJS.ProcessEnv): boolean {
  // An explicit "false" wins over every reason to arm, and only that exact
  // value: anything else falls through, so a typo cannot quietly disable the
  // guard the way `DATABASE_REQUIRED=no` otherwise would.
  if (env['DATABASE_REQUIRED'] === 'false') return false;

  return (
    env['CI'] === 'true' ||
    env['DATABASE_REQUIRED'] === 'true' ||
    (env['DATABASE_URL'] ?? '') !== ''
  );
}

/** Why the run is armed, for an error message that names the actual cause. */
function armedBecause(env: NodeJS.ProcessEnv): string {
  if (env['CI'] === 'true') return 'CI=true';
  if (env['DATABASE_REQUIRED'] === 'true') return 'DATABASE_REQUIRED=true';
  return 'DATABASE_URL is set';
}

export default async function globalSetup(): Promise<void> {
  if (!databaseIsRequired(process.env)) {
    warnUnverified(process.env['DATABASE_REQUIRED'] === 'false');
    return;
  }

  const reason = armedBecause(process.env);
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error(
      `Database-backed test run requires DATABASE_URL to be set (armed by ${reason}). ` +
        'Refusing to run so DB-dependent specs cannot silently skip and report success.',
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(
      `Database-backed test run requires a reachable database at DATABASE_URL (armed by ${reason}), ` +
        `but the connection failed: ${error instanceof Error ? error.message : String(error)}. ` +
        'Every DB-backed spec would otherwise skip and report as passing. ' +
        'Start the database, or set DATABASE_REQUIRED=false to run only the specs that need none.',
    );
  } finally {
    await prisma.$disconnect();
  }

  await assertRedisReachable(reason);
}

/**
 * The same integrity argument, for Redis.
 *
 * A spec that boots the whole application (`moduleRef.init()`) starts
 * `RedisService`, and its `onModuleInit` awaits `client.connect()`. ioredis
 * retries a refused connection forever, so a missing Redis does not fail the
 * run — it hangs it, with no output, until the CI job's timeout kills the
 * whole thing 45 minutes later. That is indistinguishable from a runner fault
 * and cost a full CI cycle to diagnose once.
 *
 * So: probe once, with a short deadline and retries disabled, and say plainly
 * what is missing.
 *
 * The URL falls back to the same default `jest-setup-env` gives the workers,
 * rather than demanding the variable be set. What matters is whether the thing
 * the workers will dial is actually reachable; insisting on the variable would
 * fail a local `DATABASE_URL=… pnpm jest` that would otherwise have worked
 * perfectly well against a local Redis.
 */
const WORKER_DEFAULT_REDIS_URL = 'redis://localhost:6379';

async function assertRedisReachable(reason: string): Promise<void> {
  const configured = process.env['REDIS_URL'];
  const url = configured !== undefined && configured !== '' ? configured : WORKER_DEFAULT_REDIS_URL;

  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
    // Returning null from the retry strategy stops ioredis reconnecting, which
    // is what turns "hangs forever" into "fails in five seconds".
    retryStrategy: () => null,
  });

  try {
    await client.connect();
    await client.ping();
  } catch (error) {
    throw new Error(
      `Database-backed test run requires a reachable Redis at ${url} (armed by ${reason}), but ` +
        `the connection failed: ${error instanceof Error ? error.message : String(error)}. ` +
        'Specs that boot the full AppModule will hang without it.',
    );
  } finally {
    client.disconnect();
  }
}

/**
 * Say plainly that a green run in this mode proves less than it looks like.
 *
 * Without this, the only signal is suspiciously fast timings — which is how
 * both near-misses were eventually spotted, and not a signal anyone should
 * have to rely on.
 */
function warnUnverified(optedOut: boolean): void {
  const why = optedOut
    ? 'DATABASE_REQUIRED=false: database-backed specs will SKIP.        '
    : 'No DATABASE_URL: every database-backed spec will SKIP.           ';
  console.warn(
    '\n[33m' +
      '┌─────────────────────────────────────────────────────────────────────┐\n' +
      `│  ${why}│\n` +
      '│  They report as PASSING while asserting nothing.                    │\n' +
      '│                                                                     │\n' +
      '│  A green run here does not verify anything touching the database.   │\n' +
      '│  To run them:  DATABASE_URL=… REDIS_URL=… pnpm test                 │\n' +
      '└─────────────────────────────────────────────────────────────────────┘' +
      '[0m\n',
  );
}
