import { CONTROLLER_WATERMARK, GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { CATALOGUE_WRITE_SCOPE, INVENTORY_WRITE_SCOPE } from '../catalogue-ingestion.constants';
import { INTEGRATION_SCOPE_KEY } from '../decorators/integration-scope.decorator';
import { IntegrationCredentialGuard } from '../guards/integration-credential.guard';

import { CatalogueSyncController } from './catalogue-sync.controller';
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

  it('resolves the push endpoint to /api/v1/integrations/inventory once prefixed', () => {
    const path = Reflect.getMetadata(PATH_METADATA, InventorySyncController) as string;
    expect(`api/v1/${path}`).toBe('api/v1/integrations/inventory');
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
 * The two POS routes must ask for different credential scopes.
 *
 * The guard used to hard-code `catalog:write`, so any second POS route would
 * have inherited it: a till issued a stock-only key could have rewritten names
 * and prices, and a catalogue key could have moved stock. Scope is now stated
 * per route, and these assertions are what stop the two drifting back together.
 */
describe('POS credential scopes are stated per route', () => {
  it('the stock push requires inventory:write', () => {
    expect(Reflect.getMetadata(INTEGRATION_SCOPE_KEY, InventorySyncController.prototype.push)).toBe(
      INVENTORY_WRITE_SCOPE,
    );
  });

  it('the catalogue push requires catalog:write', () => {
    expect(Reflect.getMetadata(INTEGRATION_SCOPE_KEY, CatalogueSyncController.prototype.sync)).toBe(
      CATALOGUE_WRITE_SCOPE,
    );
  });

  it('neither route accepts the other route’s scope', () => {
    expect(
      Reflect.getMetadata(INTEGRATION_SCOPE_KEY, InventorySyncController.prototype.push),
    ).not.toBe(CATALOGUE_WRITE_SCOPE);
    expect(
      Reflect.getMetadata(INTEGRATION_SCOPE_KEY, CatalogueSyncController.prototype.sync),
    ).not.toBe(INVENTORY_WRITE_SCOPE);
  });

  /**
   * Every route the credential guard protects has to declare a scope. The
   * guard fails closed on a missing one, so forgetting the decorator turns a
   * route into a 401 rather than an over-grant — but a route that answers 401
   * forever is still a broken route, and this catches it here instead.
   */
  it('every credential-guarded route declares a scope', () => {
    const guarded: readonly (readonly [object, string])[] = [
      [InventorySyncController.prototype.push, 'InventorySyncController.push'],
      [CatalogueSyncController.prototype.sync, 'CatalogueSyncController.sync'],
    ];

    for (const [handler, name] of guarded) {
      const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];
      if (!guards.includes(IntegrationCredentialGuard)) {
        continue;
      }
      expect([name, Reflect.getMetadata(INTEGRATION_SCOPE_KEY, handler)]).toEqual([
        name,
        expect.any(String),
      ]);
    }
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
