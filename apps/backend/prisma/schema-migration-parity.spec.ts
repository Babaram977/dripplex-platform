import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

/**
 * The migration history and schema.prisma must describe the same database.
 *
 * Drift between them was first recorded on 2026-08-07 (docs/REALITY-STAGE-R1.1.md)
 * and survived four subsequent migrations, each of which noticed it, wrote a
 * paragraph explaining that it was pre-existing, and stepped around it. It
 * survived because **nothing failed**: `prisma migrate status` reports "up to
 * date" by comparing which migrations have been *applied*, not whether applying
 * them produces the schema the code expects. There was no check that could go
 * red, so eight months of noise accumulated in every `migrate diff` — and noise
 * is where a real problem hides. The calls migration (#299) had to be
 * hand-narrowed to avoid sweeping it in.
 *
 * This is that missing check. It replays the migration history into a scratch
 * database and asserts the result matches schema.prisma exactly.
 *
 * When it fails, the message is the SQL needed to reconcile the two. That does
 * NOT mean run it: half the drift closed on 2026-08-26 was fixed in
 * schema.prisma instead, because the database was right and the schema
 * under-described it — most sharply `promotions_domains_idx`, which the history
 * correctly builds as GIN over an array column and which the diff proposed
 * replacing with a btree index unable to serve the queries it exists for.
 * Read the diff and decide which side is wrong.
 */
describe('schema/migration parity', () => {
  const databaseUrl = process.env['DATABASE_URL'];
  const backendRoot = join(__dirname, '..');

  it('produces schema.prisma exactly when the migration history is replayed', async () => {
    if (databaseUrl === undefined || databaseUrl === '') {
      // Same convention as every other database-backed spec here: without a
      // database this cannot run. CI always supplies one.
      return;
    }

    // A scratch database on the same server. `--shadow-database-url` needs one
    // that already exists — Prisma resets it, but will not create it (P1003) —
    // so it is made here through the maintenance database and dropped again
    // afterwards. Named per worker so a parallel run cannot collide with itself.
    const shadowName = `dx_parity_shadow_${process.env['JEST_WORKER_ID'] ?? '1'}`;
    const shadowUrl = new URL(databaseUrl);
    shadowUrl.pathname = `/${shadowName}`;

    const adminUrl = new URL(databaseUrl);
    adminUrl.pathname = '/postgres';
    const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });

    let output: string;
    try {
      // CREATE DATABASE cannot run inside a transaction, which is why these are
      // executeRawUnsafe rather than a $transaction.
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${shadowName}"`);
      await admin.$executeRawUnsafe(`CREATE DATABASE "${shadowName}"`);

      output = execFileSync(
        'npx',
        [
          'prisma',
          'migrate',
          'diff',
          '--from-migrations',
          './prisma/migrations',
          '--to-schema-datamodel',
          './prisma/schema.prisma',
          '--shadow-database-url',
          shadowUrl.toString(),
          '--script',
        ],
        { cwd: backendRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } finally {
      await admin
        .$executeRawUnsafe(`DROP DATABASE IF EXISTS "${shadowName}"`)
        .catch(() => undefined);
      await admin.$disconnect();
    }

    // Prisma prints this exact line when the two sides already agree.
    const drifted = !output.includes('This is an empty migration.');

    expect(drifted ? `\n${output}` : '').toBe('');
  }, 180_000);
});
