import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminOrderRecoveryController } from './admin-order-recovery.controller';
import { ORDER_PERMISSIONS } from './order.constants';

/**
 * DPX-ORDER-8D-RECOVERY — recovery permission and read-surface invariants.
 */
describe('ORDER_PERMISSIONS · recovery', () => {
  const seed = readFileSync(join(__dirname, '../../prisma/seed-rbac.cjs'), 'utf8');

  it('RECP-001 · defines admin:orders:recovery:manage', () => {
    expect(ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE).toBe('admin:orders:recovery:manage');
  });

  it('RECP-002 · is distinct from the order read and manage permissions', () => {
    expect(ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE).not.toBe(ORDER_PERMISSIONS.ADMIN_MANAGE);
    expect(ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE).not.toBe(ORDER_PERMISSIONS.ADMIN_READ);
  });

  it('RECP-003 · is in the seed permission catalogue', () => {
    expect(seed).toContain("code: 'admin:orders:recovery:manage'");
  });

  it('RECP-004 · is granted to the same roles that already read orders', () => {
    const countGrants = (code: string): number => seed.split(`\n    '${code}',`).length - 1;

    expect(countGrants('admin:orders:recovery:manage')).toBe(3);
    expect(countGrants('admin:orders:recovery:manage')).toBe(countGrants('admin:orders:read'));
  });

  it('RECP-005 · only the recovery controller consumes it', () => {
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
    const required = Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdminOrderRecoveryController.prototype.cancel,
    ) as string[];

    expect(required).toEqual([ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE]);
    expect(required).not.toContain(ORDER_PERMISSIONS.ADMIN_READ);
    expect(required).not.toContain(ORDER_PERMISSIONS.ADMIN_MANAGE);
  });

  it('RECP-007 · every recovery read handler requires only order-read permission', () => {
    for (const handler of [
      AdminOrderRecoveryController.prototype.list,
      AdminOrderRecoveryController.prototype.getActivationState,
      AdminOrderRecoveryController.prototype.getByOrder,
    ]) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([ORDER_PERMISSIONS.ADMIN_READ]);
    }
  });
});
