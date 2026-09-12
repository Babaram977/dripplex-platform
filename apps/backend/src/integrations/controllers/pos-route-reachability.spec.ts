import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { IntegrationsModule } from '../integrations.module';

import { CatalogueSyncController } from './catalogue-sync.controller';
import { InventorySyncController } from './inventory-sync.controller';
import { OrderSyncController } from './order-sync.controller';

/**
 * Every POS route must actually be reachable at the path it declares.
 *
 * `PUT /api/v1/integrations/inventory` was not. `IntegrationsCController`
 * registers `PUT /api/v1/integrations/:integrationId` first, Express matches in
 * registration order, and so the CRUD update route swallowed every stock push —
 * reading the literal string "inventory" as an integration id and answering
 * **401**, which is indistinguishable from this route refusing an
 * unauthenticated caller. Nest's own startup log listed both paths as mapped,
 * because being mapped and being reachable are different things.
 *
 * A route-path assertion cannot catch that: the path was declared correctly.
 * Neither can a unit test of the controller, or of the guard, or of the
 * service. It is a property of the whole module's registration order, so that
 * is what this file checks.
 *
 * The check is scoped to the POS controllers on purpose. `IntegrationsController`
 * (legacy) and `IntegrationsCController` genuinely shadow each other on
 * `GET /integrations` and `POST /integrations`; that is a known, documented
 * overlap the catalogue contract explicitly leaves alone, and failing on it here
 * would turn this file into noise nobody reads.
 */

interface Route {
  controller: string;
  handler: string;
  method: string;
  /** Full path as registered, e.g. `integrations/inventory/sync`. */
  path: string;
}

const METHOD_NAMES = new Map<number, string>([
  [RequestMethod.GET, 'GET'],
  [RequestMethod.POST, 'POST'],
  [RequestMethod.PUT, 'PUT'],
  [RequestMethod.DELETE, 'DELETE'],
  [RequestMethod.PATCH, 'PATCH'],
  [RequestMethod.ALL, 'ALL'],
]);

function join(controllerPath: string, handlerPath: string): string {
  const tail = handlerPath === '/' ? '' : handlerPath;
  return `${controllerPath}${tail === '' ? '' : `/${tail}`}`.replace(/\/+/g, '/');
}

/** Every route the module registers, in the order Express will match them. */
function registeredRoutes(): Route[] {
  const controllers = (Reflect.getMetadata('controllers', IntegrationsModule) ?? []) as (new (
    ...args: never[]
  ) => object)[];

  const routes: Route[] = [];
  for (const controller of controllers) {
    const controllerPath = (Reflect.getMetadata(PATH_METADATA, controller) ?? '') as string;
    const prototype = controller.prototype as Record<string, unknown>;

    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === 'constructor') continue;
      const handler = prototype[name];
      if (typeof handler !== 'function') continue;

      const handlerPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (handlerPath === undefined) continue;

      const methodCode = (Reflect.getMetadata(METHOD_METADATA, handler) ??
        RequestMethod.GET) as number;
      routes.push({
        controller: controller.name,
        handler: name,
        method: METHOD_NAMES.get(methodCode) ?? String(methodCode),
        path: join(controllerPath, handlerPath),
      });
    }
  }
  return routes;
}

/** A concrete URL this route would be called at, with parameters filled in. */
function concreteExample(path: string): string {
  return path.replace(/:[^/]+/g, 'PARAM');
}

/** Does an earlier route's pattern swallow this concrete path? */
function swallows(pattern: string, concrete: string): boolean {
  const source = pattern
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : escapeRegExp(segment)))
    .join('/');
  return new RegExp(`^${source}$`).test(concrete);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('POS routes are reachable, not just mapped', () => {
  const POS_CONTROLLERS = new Set([
    CatalogueSyncController.name,
    InventorySyncController.name,
    OrderSyncController.name,
  ]);

  const routes = registeredRoutes();

  it('finds the POS routes in the module at all', () => {
    const posRoutes = routes.filter((route) => POS_CONTROLLERS.has(route.controller));
    // If this drops to zero the rest of the file passes vacuously, which is the
    // one way a reachability test can lie.
    expect(posRoutes.length).toBeGreaterThanOrEqual(10);
  });

  it('registers no earlier route that swallows a POS route', () => {
    const shadowed: string[] = [];

    routes.forEach((route, index) => {
      if (!POS_CONTROLLERS.has(route.controller)) return;
      const concrete = concreteExample(route.path);

      for (const earlier of routes.slice(0, index)) {
        if (earlier.method !== route.method && earlier.method !== 'ALL') continue;
        if (swallows(earlier.path, concrete)) {
          shadowed.push(
            `${route.method} /${route.path} (${route.controller}.${route.handler}) is swallowed by ` +
              `${earlier.method} /${earlier.path} (${earlier.controller}.${earlier.handler})`,
          );
        }
      }
    });

    expect(shadowed).toEqual([]);
  });

  /**
   * The specific one that shipped. Kept as its own assertion so a failure names
   * the bug rather than a generic rule.
   */
  it('mounts the stock push somewhere a one-segment parameter cannot reach', () => {
    const push = routes.find(
      (route) => route.controller === InventorySyncController.name && route.handler === 'push',
    );
    expect(push?.path).toBe('integrations/inventory/sync');
    // Two literal segments after `integrations`, so `/integrations/:anything`
    // cannot match it however the module is ordered.
    expect(push?.path.split('/').filter((segment) => segment.startsWith(':'))).toEqual([]);
  });
});
