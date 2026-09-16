import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminOrderRecoveryController } from './admin-order-recovery.controller';
import { ORDER_PERMISSIONS } from './order.constants';

/**
 * DPX-ORDER-8D-RECOVERY Increment 1 — the recovery permission.
 *
 * Founder ruling: recovery authority is separate from generic order
 * management, because `admin:orders:manage` already authorises dispute
 * resolution and wallet refunds. A recovery operator must not inherit those.
 *
 * Increment 1 defines and seeds the permission and deliberately exposes NO
 * mutation behind it. The last test is what keeps that true.
 */
describe('ORDER_PERMISSIONS · recovery', () => {
  const seed = readFileSync(join(__dirname, '../../prisma/seed-rbac.cjs'), 'utf8');

  it('RECP-001 · defines admin:orders:recovery:manage', () => {
    expect(ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE).toBe('admin:orders:recovery:manage');
  });

  it('RECP-002 · is distinct from the order read and manage permissions', () => {
    // Sharing either would hand a recovery operator authority the ruling did
    // not grant them — reading every order, or refunding any of them.
    expect(ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE).not.toBe(ORDER_PERMISSIONS.ADMIN_MANAGE);
    expect(ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE).not.toBe(ORDER_PERMISSIONS.ADMIN_READ);
  });

  it('RECP-003 · is in the seed permission catalogue', () => {
    expect(seed).toContain("code: 'admin:orders:recovery:manage'");
  });

  it('RECP-004 · is granted to the same roles that already read orders', () => {
    // operations_staff, administrator, super_administrator — the three that
    // hold admin:orders:read. Granting it more widely would give recovery
    // authority to roles the ruling never mentioned.
    // A role grant is a bare quoted code on its own line; the permission
    // CATALOGUE entry is `code: '…'`. Counting the raw string would conflate
    // the two and silently pass with the wrong number of roles.
    const countGrants = (code: string): number => seed.split(`\n    '${code}',`).length - 1;

    expect(countGrants('admin:orders:recovery:manage')).toBe(3);
    expect(countGrants('admin:orders:recovery:manage')).toBe(countGrants('admin:orders:read'));
  });

  it('RECP-005 · only the recovery controller consumes it', () => {
    // Increment 1 asserted that NOTHING consumed this permission. Increment 2
    // is its authorised first consumer, so the assertion tightens rather than
    // relaxes: exactly one controller may require it.
    //
    // This still fails the moment any other controller starts demanding it —
    // which is the point. Recovery authority must not spread to order
    // management, payments or disputes without its own ruling.
    const src = join(__dirname, '..');
    const hits = execSync(
      `grep -rl "ADMIN_RECOVERY_MANAGE" ${src} --include=*.ts || true`,
    ).toString();
    const files = hits
      .split('\n')
      .filter(Boolean)
      .map((file) => file.split('/').pop());

    expect(files.sort()).toEqual([
      'admin-order-recovery.controller.ts',
      'order-recovery.permissions.spec.ts',
      'order.constants.ts',
    ]);
  });

  it('RECP-006 · the cancel handler requires the recovery permission, not order read', () => {
    // Asserting the decorator is not enough on its own — the HTTP spec drives
    // the real guard — but this catches a silent downgrade in review.
    const required = Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdminOrderRecoveryController.prototype.cancel,
    ) as string[];

    expect(required).toEqual([ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE]);
    expect(required).not.toContain(ORDER_PERMISSIONS.ADMIN_READ);
    expect(required).not.toContain(ORDER_PERMISSIONS.ADMIN_MANAGE);
  });

  it('RECP-007 · every recovery read handler requires only order-read permission', () => {
    // Reading the queue must stay available to anyone who can read orders;
    // requiring recovery authority to look would hide the queue from the
    // people meant to notice it. The activation-state read is the same: an
    // operator checking whether the backstop is armed is not exercising
    // recovery authority, and must not need it.
    for (const handler of [
      AdminOrderRecoveryController.prototype.list,
      AdminOrderRecoveryController.prototype.getActivationState,
      AdminOrderRecoveryController.prototype.getByOrder,
    ]) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([ORDER_PERMISSIONS.ADMIN_READ]);
    }
  });
});
