import { RequestMethod } from '@nestjs/common';

import { PERMISSION_SEEDS } from '../../prisma/seed-data/permissions';
import { ROLE_PERMISSION_GRANTS } from '../../prisma/seed-data/role-permissions';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminBookingsController } from './admin-bookings.controller';
import { BOOKING_PERMISSIONS } from './bookings.constants';
import { CustomerBookingsController } from './customer-bookings.controller';
import { MerchantBookingsController } from './merchant-bookings.controller';

/**
 * Two failures this pins, both of which have real precedent in this codebase.
 *
 * A route with no `@RequirePermissions` is open to any signed-in user — a
 * customer could accept a hotel's bookings.
 *
 * A permission that guards a route but is missing from `PERMISSION_SEEDS`, or
 * granted to no role, is the opposite failure and just as bad: the endpoint
 * ships and nobody on earth can call it. The RBAC bootstrap incident in
 * DPX-LAUNCH-004 was this shape — a catalog that did not match the code.
 *
 * Read off the actual decorator metadata rather than a hand-written list, so a
 * route added later is covered without anyone remembering to add it here.
 */
const CONTROLLERS = [
  CustomerBookingsController,
  MerchantBookingsController,
  AdminBookingsController,
];

interface Route {
  controller: string;
  handler: string;
  permissions: string[] | undefined;
}

function routesOf(controller: (new (...args: never[]) => object) & { name: string }): Route[] {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
    .map((handler) => ({
      controller: controller.name,
      handler,
      permissions: Reflect.getMetadata(PERMISSIONS_KEY, proto[handler] as object) as
        string[] | undefined,
    }));
}

const ROUTES = CONTROLLERS.flatMap((c) => routesOf(c));

describe('booking permissions', () => {
  it('found the routes it claims to be checking', () => {
    // A guard against this whole file silently passing because reflection
    // returned nothing.
    expect(ROUTES.length).toBeGreaterThanOrEqual(12);
  });

  it('guards every booking route with a permission', () => {
    const unguarded = ROUTES.filter(
      (r) => r.permissions === undefined || r.permissions.length === 0,
    ).map((r) => `${r.controller}.${r.handler}`);
    expect(unguarded).toEqual([]);
  });

  it('uses only permissions that exist in the seed catalogue', () => {
    const seeded = new Set(PERMISSION_SEEDS.map((p) => p.code));
    const missing = [...new Set(ROUTES.flatMap((r) => r.permissions ?? []))].filter(
      (code) => !seeded.has(code),
    );
    expect(missing).toEqual([]);
  });

  it('grants every booking permission to at least one role', () => {
    const granted = new Set(Object.values(ROLE_PERMISSION_GRANTS).flat());
    const ungranted = Object.values(BOOKING_PERMISSIONS).filter((code) => !granted.has(code));
    expect(ungranted).toEqual([]);
  });

  it('gives customers browse and book, and nothing merchant-side', () => {
    const customer = ROLE_PERMISSION_GRANTS['customer'] ?? [];
    expect(customer).toContain(BOOKING_PERMISSIONS.CUSTOMER_READ);
    expect(customer).toContain(BOOKING_PERMISSIONS.CUSTOMER_BOOK);
    expect(customer).not.toContain(BOOKING_PERMISSIONS.MERCHANT_MANAGE);
    expect(customer).not.toContain(BOOKING_PERMISSIONS.ADMIN_MANAGE);
  });

  it('gives merchants their own hotel and nothing platform-wide', () => {
    const merchant = ROLE_PERMISSION_GRANTS['merchant'] ?? [];
    expect(merchant).toContain(BOOKING_PERMISSIONS.MERCHANT_MANAGE);
    expect(merchant).not.toContain(BOOKING_PERMISSIONS.ADMIN_MANAGE);
  });

  it('gives operations staff the read they need for the console', () => {
    expect(ROLE_PERMISSION_GRANTS['operations_staff'] ?? []).toContain(
      BOOKING_PERMISSIONS.ADMIN_MANAGE,
    );
  });

  /**
   * Browsing and booking are separate on purpose: a customer who cannot book
   * should still be able to see what a room costs. A hotel page that 403s is a
   * worse answer than one showing a price and a disabled button.
   */
  it('keeps browsing separable from booking', () => {
    expect(BOOKING_PERMISSIONS.CUSTOMER_READ).not.toBe(BOOKING_PERMISSIONS.CUSTOMER_BOOK);

    const booking = ROUTES.filter((r) => r.controller === 'CustomerBookingsController').find(
      (r) => r.handler === 'create',
    );
    expect(booking?.permissions).toEqual([BOOKING_PERMISSIONS.CUSTOMER_BOOK]);
  });

  /** Accepting a booking moves a guest's money. It must never be reachable
   *  with a read-only grant. */
  it('requires the merchant grant to accept or reject', () => {
    for (const handler of ['accept', 'reject']) {
      const route = ROUTES.find(
        (r) => r.controller === 'MerchantBookingsController' && r.handler === handler,
      );
      expect(route?.permissions).toEqual([BOOKING_PERMISSIONS.MERCHANT_MANAGE]);
    }
  });

  /**
   * Ops can look. Ops cannot answer on a hotel's behalf — that would charge a
   * guest for a room no hotel agreed to provide — and cannot re-run a payout,
   * because retrying a settlement by hand is how a hotel gets paid twice.
   * Neither is a founder decision, so neither is an endpoint.
   *
   * Asserted as "every admin route is a GET" rather than as a list of allowed
   * handler names. The name list said the same thing for one route and then
   * failed the moment a second *read* route was added, which teaches the next
   * person to append a name and move on — exactly the reflex this test exists
   * to catch. A method check cannot be satisfied that way.
   */
  it('exposes no admin route that writes', () => {
    // Prove the helper can see a write before trusting it to report none.
    // Without this the assertion below passes just as happily if reflection
    // silently returns nothing for every handler.
    expect(httpMethodOf(MerchantBookingsController, 'accept')).toBe('POST');

    const writes = ROUTES.filter((r) => r.controller === 'AdminBookingsController')
      .map((r) => ({
        handler: r.handler,
        method: httpMethodOf(AdminBookingsController, r.handler),
      }))
      .filter((r) => r.method !== 'GET')
      .map((r) => `${r.handler} (${r.method})`);
    expect(writes).toEqual([]);
  });
});

/** Nest stores the verb as the `RequestMethod` enum under the 'method' key. */
function httpMethodOf(
  controller: (new (...args: never[]) => object) & { name: string },
  handler: string,
): string {
  const proto = controller.prototype as Record<string, unknown>;
  const method = Reflect.getMetadata('method', proto[handler] as object) as unknown;
  return RequestMethod[method as number] ?? `unknown(${String(method)})`;
}
