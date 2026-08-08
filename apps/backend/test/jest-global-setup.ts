import { PrismaClient } from '@prisma/client';

/**
 * Jest global setup — database integration-test integrity guard.
 *
 * Many backend specs are real-Postgres integration tests that set a local
 * `databaseAvailable = false` and early-return when the database can't be
 * reached — so with no database present they pass **vacuously**, silently
 * hiding real failures. (This is exactly how a broken SOS-queue fixture stayed
 * "green" in a CI job that had no Postgres service.)
 *
 * When a database is required — in CI (`CI=true`, set by GitHub Actions) or when
 * `DATABASE_REQUIRED=true` is set explicitly — this fails the entire run fast if
 * `DATABASE_URL` is missing or the database is unreachable, so DB-dependent
 * specs can no longer skip-and-succeed. Locally, with neither flag set, it is a
 * no-op and the suite still runs without a database.
 */
export default async function globalSetup(): Promise<void> {
  const required = process.env['CI'] === 'true' || process.env['DATABASE_REQUIRED'] === 'true';
  if (!required) {
    return;
  }

  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'Database-backed test run requires DATABASE_URL to be set (CI / DATABASE_REQUIRED is on). ' +
        'Refusing to run so DB-dependent specs cannot silently skip and report success.',
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(
      'Database-backed test run requires a reachable database at DATABASE_URL, but the ' +
        `connection failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
