import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Every permission the Operations Console checks must be one the server
 * actually grants.
 *
 * `hasPerm` asks whether a string is in the session's permission list. A
 * string nobody grants is not an error — it is simply always false, so the
 * control it guards silently never renders and the page looks finished while
 * being unusable.
 *
 * That is not hypothetical. `canCreate` was written as
 * `promotions:admin:manage`; the real permission is `admin:promotions:manage`,
 * the segments the other way round. The New campaign control was therefore
 * invisible to every operator, which left the Referral Campaigns page with no
 * campaigns and so no way to enrol a promoter into one. The unit test for it
 * passed the whole time, because the test asserted against the same invented
 * string the component used — the two agreed with each other and neither
 * agreed with the server.
 *
 * Comparing against the seed is what breaks that circle: the seed is what the
 * deploy actually writes into the database, so it cannot drift from the
 * console's beliefs without this failing.
 */

const CONSOLE = join(__dirname, 'adminConsoleScreen.tsx');
const SEED = join(__dirname, '../../../../apps/backend/prisma/seed-rbac.cjs');

/** Permission literals the console gates UI on. */
function permissionsCheckedByTheConsole(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/hasPerm\('([^']+)'\)/g)) found.add(match[1] ?? '');
  for (const match of source.matchAll(/requires: '([^']+)'/g)) found.add(match[1] ?? '');
  return [...found].filter((p) => p !== '');
}

/** Every permission code the RBAC seed writes. */
function permissionsGrantedByTheSeed(source: string): Set<string> {
  return new Set([...source.matchAll(/'([a-z_]+:[a-z_]+:[a-z_]+)'/g)].map((m) => m[1] ?? ''));
}

describe('Operations Console permission strings', () => {
  const consoleSource = readFileSync(CONSOLE, 'utf8');
  const seedSource = readFileSync(SEED, 'utf8');

  it('reads both files and finds something to check', () => {
    // Without this the two assertions below hold vacuously if a path breaks or
    // the regexes stop matching — the exact way a guard rots into decoration.
    expect(consoleSource.length).toBeGreaterThan(1000);
    expect(permissionsCheckedByTheConsole(consoleSource).length).toBeGreaterThan(4);
    expect(permissionsGrantedByTheSeed(seedSource).size).toBeGreaterThan(50);
  });

  it('checks only permissions the RBAC seed actually grants', () => {
    const granted = permissionsGrantedByTheSeed(seedSource);
    const unknown = permissionsCheckedByTheConsole(consoleSource).filter((p) => !granted.has(p));

    // A miss here means a control is invisible to every operator, no matter
    // their role. Fix the string; do not add it to an allow-list.
    expect(unknown).toEqual([]);
  });

  it('still gates campaign creation on the permission the server enforces', () => {
    // Named explicitly because this is the one that was wrong, and because the
    // generic check above would also pass if the gate were deleted entirely.
    expect(consoleSource).toContain("hasPerm('admin:promotions:manage')");
    expect(consoleSource).not.toContain("hasPerm('promotions:admin:manage')");
  });
});
