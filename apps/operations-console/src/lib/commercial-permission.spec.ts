import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { COMMERCIAL_MANAGE_PERMISSION } from './commercial-permission';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(appRoot, '../..');

/**
 * The Commercial screen is gated on a permission string this app has to
 * hardcode — the backend's catalogue is a Nest module the console cannot
 * import. A silent typo or a rename on the backend side would not break the
 * build; it would just hide the screen from the administrators who need it,
 * or (if the string drifted to something everyone holds) show it to staff it
 * was deliberately kept from. Neither failure announces itself.
 *
 * These read the backend source directly, in the same spirit as
 * rbac-seed-parity.spec.ts, so the two cannot drift unnoticed.
 */
describe('COMMERCIAL_MANAGE_PERMISSION', () => {
  it('matches the backend ADMIN_CREDIT_SETTINGS_MANAGE literal', () => {
    const constants = readFileSync(
      path.join(repoRoot, 'apps/backend/src/commercial/commercial.constants.ts'),
      'utf8',
    );
    const match = /ADMIN_CREDIT_SETTINGS_MANAGE:\s*'([^']+)'/.exec(constants);

    expect(
      match,
      'ADMIN_CREDIT_SETTINGS_MANAGE not found in commercial.constants.ts',
    ).not.toBeNull();
    expect(COMMERCIAL_MANAGE_PERMISSION).toBe(match?.[1]);
  });

  it('is a permission the backend actually seeds', () => {
    const seeds = readFileSync(
      path.join(repoRoot, 'apps/backend/prisma/seed-data/permissions.ts'),
      'utf8',
    );
    expect(seeds).toContain(`'${COMMERCIAL_MANAGE_PERMISSION}'`);
  });

  it('gates the Commercial nav entry, so line staff are not offered a 403', () => {
    const shell = readFileSync(path.join(appRoot, 'src/components/app-shell.tsx'), 'utf8');
    const entry = /\{[^{}]*href:\s*'\/commercial'[\s\S]*?\}/.exec(shell);

    expect(entry, "no '/commercial' nav entry found").not.toBeNull();
    expect(entry?.[0]).toContain('permission: COMMERCIAL_MANAGE_PERMISSION');
  });
});
