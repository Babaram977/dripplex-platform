import { CONTROLLER_WATERMARK, GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { IntegrationCredentialGuard } from '../guards/integration-credential.guard';
import { POS_DRIVABLE_ORDER_STATUSES } from '../order-sync.constants';

import { OrderSyncController } from './order-sync.controller';

/**
 * Mirrors `catalogue-sync-routes.spec.ts` and `inventory-sync-routes.spec.ts`.
 *
 * `IntegrationsController` shipped as `@Controller('api/v1/integrations')` and
 * so mounted every route it owned at `/api/v1/api/v1/integrations`, where the
 * doubled path answered 401 rather than 404 — it looked alive while being
 * unreachable. An order route that silently does not exist would leave a
 * kitchen's tickets stuck in a POS nobody is listening to.
 */
describe('order sync controller routes', () => {
  it('is registered as a controller', () => {
    expect(Reflect.getMetadata(CONTROLLER_WATERMARK, OrderSyncController)).toBe(true);
  });

  it('declares the path "integrations/orders"', () => {
    expect(Reflect.getMetadata(PATH_METADATA, OrderSyncController)).toBe('integrations/orders');
  });

  it('does not repeat the global api/v1 prefix', () => {
    const path = Reflect.getMetadata(PATH_METADATA, OrderSyncController) as string;
    expect(path).not.toMatch(/(^|\/)api\/v1(\/|$)/);
  });

  it('resolves the status route to /api/v1/integrations/orders/:orderNumber/status', () => {
    const controller = Reflect.getMetadata(PATH_METADATA, OrderSyncController) as string;
    const handler = Reflect.getMetadata(
      PATH_METADATA,
      OrderSyncController.prototype.updateStatus,
    ) as string;
    expect(`api/v1/${controller}/${handler}`).toBe(
      'api/v1/integrations/orders/:orderNumber/status',
    );
  });

  /**
   * Public to the JWT guard, still guarded by the credential guard. Either
   * assertion alone would be wrong: without `@Public()` the global JWT guard
   * refuses a POS before the credential guard is consulted, and without the
   * credential guard these routes would hand a merchant's order book to
   * anyone.
   */
  describe.each([
    ['updateStatus', OrderSyncController.prototype.updateStatus as object],
    ['getOrder', OrderSyncController.prototype.getOrder as object],
    ['listOrders', OrderSyncController.prototype.listOrders as object],
  ])('%s', (_name, handler) => {
    it('is public to the global JWT guard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    });

    it('is still guarded by the integration credential guard', () => {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];
      expect(guards).toContain(IntegrationCredentialGuard);
    });

    it('carries no user permission, because no user is calling it', () => {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toBeUndefined();
    });
  });
});

/**
 * The list of transitions a POS may drive is a security boundary, not a
 * convenience.
 *
 * `CANCELLED` refunds the customer's wallet inside `MerchantOrdersService`, and
 * `COMPLETED` is what releases a merchant settlement. Either appearing here
 * would make a POS credential a way to move money, so the list is asserted
 * exactly rather than merely spot-checked.
 */
describe('the transitions a POS may drive', () => {
  it('is exactly PREPARING and READY', () => {
    expect([...POS_DRIVABLE_ORDER_STATUSES].sort()).toEqual(['PREPARING', 'READY']);
  });

  it.each(['CANCELLED', 'REFUNDED', 'COMPLETED', 'DELIVERED', 'PICKED_UP', 'CONFIRMED'])(
    'never includes %s',
    (status) => {
      expect(POS_DRIVABLE_ORDER_STATUSES as readonly string[]).not.toContain(status);
    },
  );
});
