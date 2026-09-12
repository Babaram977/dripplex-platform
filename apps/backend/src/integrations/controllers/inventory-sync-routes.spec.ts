import { CONTROLLER_WATERMARK, GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { IntegrationCredentialGuard } from '../guards/integration-credential.guard';

import { InventorySyncController } from './inventory-sync.controller';

/**
 * Mirrors `catalogue-sync-routes.spec.ts`, for the same reason.
 *
 * `IntegrationsController` shipped as `@Controller('api/v1/integrations')` and
 * so mounted every route it owned at `/api/v1/api/v1/integrations`, where the
 * doubled path answered 401 rather than 404 — it looked alive while being
 * unreachable. A stock route that silently does not exist would let a merchant
 * believe their shelf is being kept up to date while it quietly is not.
 */
describe('inventory sync controller route prefix', () => {
  it('is registered as a controller', () => {
    expect(Reflect.getMetadata(CONTROLLER_WATERMARK, InventorySyncController)).toBe(true);
  });

  it('declares the path "integrations/inventory"', () => {
    expect(Reflect.getMetadata(PATH_METADATA, InventorySyncController)).toBe(
      'integrations/inventory',
    );
  });

  it('does not repeat the global api/v1 prefix', () => {
    const path = Reflect.getMetadata(PATH_METADATA, InventorySyncController) as string;
    expect(path).not.toMatch(/(^|\/)api\/v1(\/|$)/);
  });

  it('resolves the push endpoint to /api/v1/integrations/inventory/sync once prefixed', () => {
    const controller = Reflect.getMetadata(PATH_METADATA, InventorySyncController) as string;
    const handler = Reflect.getMetadata(
      PATH_METADATA,
      InventorySyncController.prototype.push,
    ) as string;
    expect(`api/v1/${controller}/${handler}`).toBe('api/v1/integrations/inventory/sync');
  });

  /**
   * Not cosmetic. A bare `PUT /integrations/inventory` was swallowed by
   * `PUT /integrations/:integrationId`, which registers first — see
   * `pos-route-reachability.spec.ts`.
   */
  it('does not sit at a path a one-segment parameter route can claim', () => {
    const controller = Reflect.getMetadata(PATH_METADATA, InventorySyncController) as string;
    const handler = Reflect.getMetadata(
      PATH_METADATA,
      InventorySyncController.prototype.push,
    ) as string;
    expect(handler).not.toBe('/');
    expect(`${controller}/${handler}`.split('/').length).toBeGreaterThan(2);
  });

  /**
   * Public to the JWT guard, still guarded by the credential guard. Either
   * assertion alone would be wrong: without `@Public()` the global JWT guard
   * refuses a POS before the credential guard is consulted, and without the
   * credential guard the route would be genuinely unauthenticated.
   */
  it('marks the push endpoint public so the global JWT guard steps aside', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, InventorySyncController.prototype.push)).toBe(true);
  });

  it('still authenticates the push endpoint with the integration credential guard', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, InventorySyncController.prototype.push) ??
      []) as unknown[];
    expect(guards).toContain(IntegrationCredentialGuard);
  });
});

/**
 * The merchant-facing read is the mirror image of the push, and the pairing is
 * the point. `push` is public to the JWT guard because a POS holds no JWT;
 * this one is merchant-facing, so making it public too would hand one
 * merchant's stock levels to anyone who could guess an integration id.
 */
describe('inventory levels route is merchant-facing', () => {
  const handler: object = InventorySyncController.prototype.listLevels;

  it('is not public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
  });

  it('requires integrations:read', () => {
    const required = (Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? []) as string[];
    expect(required).toContain('integrations:read');
  });

  it('does not attach the integration credential guard', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];
    expect(guards).not.toContain(IntegrationCredentialGuard);
  });
});
