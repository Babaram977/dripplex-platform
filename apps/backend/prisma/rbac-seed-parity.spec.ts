import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PERMISSION_SEEDS } from './seed-data/permissions';
import { ROLE_PERMISSION_GRANTS } from './seed-data/role-permissions';
import { ROLE_SEEDS } from './seed-data/roles';

/**
 * The two RBAC catalogues must not drift apart.
 *
 * There are two copies of the permission catalogue and they are seeded by
 * different code paths:
 *
 *   - `prisma/seed-data/*.ts` — TypeScript, run through ts-node by the dev
 *     seed and imported by the rest of the suite.
 *   - `prisma/seed-rbac.cjs` — plain CommonJS with its own inline copy of the
 *     same data, and **the only one that runs in production**, because
 *     `prisma/` is copied into the image as raw source and ts-node is stripped
 *     by `pnpm prune --prod`.
 *
 * That file's header asks for the two to be kept in sync by hand. Hand-syncing
 * has now failed twice, silently and in the same way: a permission added to
 * the TypeScript list, the whole test suite green, and the feature shipping to
 * production where the permission does not exist — so every endpoint behind it
 * answers 403 for every user. `admin:rides:pricing:manage` (the pricing
 * console) and the three `*:utilities:*` permissions both reached production
 * that way. In the other direction, `messaging:use` and the partner withdrawal
 * permissions existed only in production, so local dev could not exercise
 * them.
 *
 * A test is the only thing that makes "keep these in sync" true. This one
 * parses the CommonJS file as text rather than importing it — importing would
 * pull in `@prisma/client` and try to connect — and compares all three
 * catalogues code-for-code.
 */

const SEED_RBAC_PATH = join(__dirname, 'seed-rbac.cjs');

function readSeedRbac(): string {
  return readFileSync(SEED_RBAC_PATH, 'utf8');
}

/** Every `code: '...'` in the file — the permission catalogue. */
function parsePermissionCodes(source: string): string[] {
  return [...source.matchAll(/code:\s*'([^']+)'/g)].map((match) => match[1] ?? '');
}

/** Every `name: '...'` inside the ROLE_SEEDS array. */
function parseRoleNames(source: string): string[] {
  const start = source.indexOf('const ROLE_SEEDS');
  const end = source.indexOf('const ROLE_PERMISSION_GRANTS');
  const block = source.slice(start, end);
  return [...block.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1] ?? '');
}

/** The `role: [ '...', ... ]` map at the bottom of either file. */
function parseGrants(source: string): Record<string, string[]> {
  const start = source.indexOf('ROLE_PERMISSION_GRANTS');
  const block = source.slice(start);
  const grants: Record<string, string[]> = {};
  const roleBlock = /^ {2}(\w+):\s*\[([\s\S]*?)\],?\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = roleBlock.exec(block)) !== null) {
    const role = match[1] ?? '';
    const body = match[2] ?? '';
    grants[role] = [...body.matchAll(/'([^']+)'/g)].map((entry) => entry[1] ?? '');
  }
  return grants;
}

describe('RBAC seed parity — seed-data/*.ts vs seed-rbac.cjs', () => {
  const source = readSeedRbac();

  it('seeds the same permission codes in production as in development', () => {
    const fromTypeScript = [...PERMISSION_SEEDS.map((permission) => permission.code)].sort();
    const fromProduction = [...parsePermissionCodes(source)].sort();

    // Named explicitly rather than compared as a bare count, so a failure says
    // WHICH permission is about to 403 in production.
    const missingInProduction = fromTypeScript.filter((code) => !fromProduction.includes(code));
    const missingInDevelopment = fromProduction.filter((code) => !fromTypeScript.includes(code));

    expect({ missingInProduction, missingInDevelopment }).toEqual({
      missingInProduction: [],
      missingInDevelopment: [],
    });
    expect(fromProduction).toEqual(fromTypeScript);
  });

  it('seeds the same roles', () => {
    const fromTypeScript = [...ROLE_SEEDS.map((role) => role.name)].sort();
    const fromProduction = [...parseRoleNames(source)].sort();
    expect(fromProduction).toEqual(fromTypeScript);
  });

  it('grants the same permissions to each role', () => {
    const fromProduction = parseGrants(source);
    const roles = [
      ...new Set([...Object.keys(ROLE_PERMISSION_GRANTS), ...Object.keys(fromProduction)]),
    ].sort();

    const differences: Record<
      string,
      { missingInProduction: string[]; extraInProduction: string[] }
    > = {};
    for (const role of roles) {
      const expected = new Set(ROLE_PERMISSION_GRANTS[role] ?? []);
      const actual = new Set(fromProduction[role] ?? []);
      const missingInProduction = [...expected].filter((code) => !actual.has(code));
      const extraInProduction = [...actual].filter((code) => !expected.has(code));
      if (missingInProduction.length > 0 || extraInProduction.length > 0) {
        differences[role] = { missingInProduction, extraInProduction };
      }
    }

    expect(differences).toEqual({});
  });

  it('never grants an administrator something a super administrator lacks', () => {
    // A super administrator holding less than an administrator is always a
    // mistake, and it is the exact shape of the miss that let
    // `admin:utilities:manage` reach only one of the two.
    const administrator = new Set(ROLE_PERMISSION_GRANTS['administrator'] ?? []);
    const superAdministrator = new Set(ROLE_PERMISSION_GRANTS['super_administrator'] ?? []);
    expect([...administrator].filter((code) => !superAdministrator.has(code))).toEqual([]);
  });

  it('grants only permissions that exist in the catalogue', () => {
    const catalogue = new Set(PERMISSION_SEEDS.map((permission) => permission.code));
    const unknown: Record<string, string[]> = {};
    for (const [role, codes] of Object.entries(ROLE_PERMISSION_GRANTS)) {
      const missing = codes.filter((code) => !catalogue.has(code));
      if (missing.length > 0) unknown[role] = missing;
    }
    expect(unknown).toEqual({});
  });
});
