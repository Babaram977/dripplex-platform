import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminOrdersController } from './admin-orders.controller';
import { ORDER_PERMISSIONS } from './order.constants';

/**
 * DPX-ORDER-8D-C ops visibility — who may see the exception queue.
 *
 * It rides the EXISTING `admin:orders:read`, which operations_staff,
 * administrator and super_administrator already hold in seed-rbac.cjs. No new
 * permission was minted: a stalled order is an order, whoever may read orders
 * may read that one is stuck, and a fresh permission code would have needed an
 * RBAC seed change to grant it to the people who already have the broader
 * right.
 */
describe('AdminOrdersController · order exception queue authorization', () => {
  it('AOP-001 · the exception queue requires admin:orders:read', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminOrdersController.prototype.listOrderExceptions),
    ).toEqual([ORDER_PERMISSIONS.ADMIN_READ]);
  });

  it('AOP-002 · it is a READ right, never the manage right', () => {
    // ADMIN_MANAGE gates dispute resolution — an action. Attaching it here, or
    // accepting it as an alternative, would let a read-only surface be built
    // against a permission that also authorises mutation.
    const required = Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdminOrdersController.prototype.listOrderExceptions,
    ) as string[];

    expect(required).not.toContain(ORDER_PERMISSIONS.ADMIN_MANAGE);
    expect(required).toHaveLength(1);
  });

  it('AOP-003 · no mutating handler was added alongside it', () => {
    // The 2026-09-16 ruling escalates a stalled order; it authorises nobody to
    // act on one. If a resolve/dismiss handler is ever added to this
    // controller, this test should fail and send it back for a ruling.
    const handlers = Object.getOwnPropertyNames(AdminOrdersController.prototype).filter(
      (name) => name !== 'constructor',
    );

    expect(handlers.filter((name) => /exception/i.test(name))).toEqual(['listOrderExceptions']);
  });
});
