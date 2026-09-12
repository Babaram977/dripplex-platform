import { GUARDS_METADATA } from '@nestjs/common/constants';

import { CATALOGUE_WRITE_SCOPE, INVENTORY_WRITE_SCOPE } from '../catalogue-ingestion.constants';
import { INTEGRATION_SCOPE_KEY } from '../decorators/integration-scope.decorator';
import { IntegrationCredentialGuard } from '../guards/integration-credential.guard';
import { ORDERS_READ_SCOPE, ORDERS_WRITE_SCOPE } from '../order-sync.constants';

import { CatalogueSyncController } from './catalogue-sync.controller';
import { InventorySyncController } from './inventory-sync.controller';
import { OrderSyncController } from './order-sync.controller';

/**
 * One place that knows every route a POS credential can reach, and what each
 * one is allowed to do.
 *
 * `IntegrationCredentialGuard` used to hard-code `catalog:write`, so every POS
 * route added after the first would silently have inherited it: a till issued a
 * stock-only key could have rewritten prices, and a key meant for reading
 * orders could have moved them. Scope is now stated per route — which only
 * helps while somebody is checking that the statements are right, which is
 * what this file is.
 *
 * **Adding a POS route means adding it to this table.** The last assertion
 * fails if a credential-guarded route declares no scope at all.
 */
describe('POS credential scopes', () => {
  const routes: readonly (readonly [handler: object, name: string, scope: string])[] = [
    [CatalogueSyncController.prototype.sync, 'catalogue.sync', CATALOGUE_WRITE_SCOPE],
    [InventorySyncController.prototype.push, 'inventory.push', INVENTORY_WRITE_SCOPE],
    [OrderSyncController.prototype.updateStatus, 'orders.updateStatus', ORDERS_WRITE_SCOPE],
    [OrderSyncController.prototype.getOrder, 'orders.getOrder', ORDERS_READ_SCOPE],
    [OrderSyncController.prototype.listOrders, 'orders.listOrders', ORDERS_READ_SCOPE],
  ];

  it.each(routes)('%p (%s) requires exactly %s', (handler, _name, scope) => {
    expect(Reflect.getMetadata(INTEGRATION_SCOPE_KEY, handler)).toBe(scope);
  });

  it.each(routes)('%p (%s) is behind the credential guard', (handler) => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[];
    expect(guards).toContain(IntegrationCredentialGuard);
  });

  /**
   * Reading orders must not be enough to move them. This is the assertion that
   * would have caught the hard-coded scope: with one scope for everything, a
   * read key and a write key were the same key.
   */
  it('separates reading orders from writing them', () => {
    expect(ORDERS_READ_SCOPE).not.toBe(ORDERS_WRITE_SCOPE);
    expect(
      Reflect.getMetadata(INTEGRATION_SCOPE_KEY, OrderSyncController.prototype.getOrder),
    ).not.toBe(ORDERS_WRITE_SCOPE);
    expect(
      Reflect.getMetadata(INTEGRATION_SCOPE_KEY, OrderSyncController.prototype.listOrders),
    ).not.toBe(ORDERS_WRITE_SCOPE);
  });

  /** No route may carry a scope belonging to a different capability. */
  it('keeps catalogue, inventory and order scopes distinct', () => {
    const scopes = [CATALOGUE_WRITE_SCOPE, INVENTORY_WRITE_SCOPE, ORDERS_WRITE_SCOPE];
    expect(new Set(scopes).size).toBe(scopes.length);
  });

  it('leaves no credential-guarded route without a declared scope', () => {
    for (const [handler, name] of routes) {
      const declared = Reflect.getMetadata(INTEGRATION_SCOPE_KEY, handler) as unknown;
      // Reported with the route name so a failure says which one is missing.
      expect([name, typeof declared]).toEqual([name, 'string']);
    }
  });
});
