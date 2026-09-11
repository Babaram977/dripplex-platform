import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Reflector } from '@nestjs/core';

import { PERMISSION_SEEDS } from '../../../prisma/seed-data/permissions';
import { ROLE_PERMISSION_GRANTS } from '../../../prisma/seed-data/role-permissions';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';
import { SUPPORT_PERMISSIONS } from '../../support/support.constants';
import { DriverSupportController } from '../controllers/driver-support.controller';
import { DRIVER_PERMISSIONS } from '../driver.constants';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ExecutionContext } from '@nestjs/common';

/**
 * DPX-SUPPORT-001, pre-merge review of PR #362 — the one authorization question
 * the design raises.
 *
 * `/driver/support-tickets` is the single place in the support system where
 * persona is NOT derived from the session: the adapter forces
 * `SupportPersona.DRIVER`, because the route is the driver app's by definition.
 * That is only safe while the route itself is reachable by drivers alone. If it
 * ever became reachable by anyone else, a caller could manufacture a DRIVER
 * ticket for themselves — landing in the queue filter operators use for driver
 * problems, attributed to a persona they do not hold.
 *
 * The universal route has no such exception, and needs no such test: it derives
 * persona from the session and every persona is allowed to file.
 *
 * These tests drive the real `PermissionsGuard` over the real controller
 * metadata. Asserting the decorator alone would not show that the guard reads
 * it, and asserting the guard alone would not show this controller is behind it.
 */
describe('/driver/support-tickets — who can reach the one route that forces a persona', () => {
  const guard = new PermissionsGuard(new Reflector());

  const contextFor = (
    user: AuthenticatedUser | undefined,
    handler: (...args: never[]) => unknown,
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => DriverSupportController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const principal = (permissions: string[], roles: string[]): AuthenticatedUser => ({
    id: 'user-id',
    sid: 'session-id',
    email: 'someone@dripplex.test',
    role: roles[0] ?? 'customer',
    portal: 'customer',
    roles,
    permissions,
  });

  const HANDLERS = ['create', 'listOwn', 'getOwn'] as const;

  it.each(HANDLERS)('lets a driver through to %s', (name) => {
    const handler = DriverSupportController.prototype[name];
    const driver = principal(
      [DRIVER_PERMISSIONS.SUPPORT_TICKET_MANAGE, SUPPORT_PERMISSIONS.TICKETS_USE],
      ['driver'],
    );
    expect(guard.canActivate(contextFor(driver, handler))).toBe(true);
  });

  it.each(HANDLERS)(
    'refuses a customer at %s, even holding the universal support grant',
    (name) => {
      const handler = DriverSupportController.prototype[name];
      // This is the attack the adapter's forced persona would otherwise enable:
      // a customer calling the driver route and being recorded as a DRIVER.
      // `support:tickets:use` is held by every persona and must not open this
      // door — the two permissions are deliberately separate strings.
      const customer = principal([SUPPORT_PERMISSIONS.TICKETS_USE], ['customer']);
      expect(() => guard.canActivate(contextFor(customer, handler))).toThrow(
        ForbiddenDomainException,
      );
    },
  );

  it.each(HANDLERS)('refuses Operations staff at %s', (name) => {
    const handler = DriverSupportController.prototype[name];
    // Operations answer tickets; they do not file them as drivers.
    const operator = principal([SUPPORT_PERMISSIONS.ADMIN_MANAGE], ['operations_staff']);
    expect(() => guard.canActivate(contextFor(operator, handler))).toThrow(
      ForbiddenDomainException,
    );
  });

  it.each(HANDLERS)('refuses an unauthenticated caller at %s', (name) => {
    const handler = DriverSupportController.prototype[name];
    expect(() => guard.canActivate(contextFor(undefined, handler))).toThrow(
      ForbiddenDomainException,
    );
  });

  it('has no handler that weakens or escapes the class-level requirement', () => {
    // `getAllAndOverride` takes the handler's metadata over the class's, so a
    // handler-level decorator would silently replace the guard this controller
    // relies on. None of the three declares one.
    for (const name of HANDLERS) {
      expect(
        Reflect.getMetadata(PERMISSIONS_KEY, DriverSupportController.prototype[name]),
      ).toBeUndefined();
      expect(
        Reflect.getMetadata(IS_PUBLIC_KEY, DriverSupportController.prototype[name]),
      ).toBeUndefined();
    }
    expect(Reflect.getMetadata(PERMISSIONS_KEY, DriverSupportController)).toEqual([
      DRIVER_PERMISSIONS.SUPPORT_TICKET_MANAGE,
    ]);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, DriverSupportController)).toBeUndefined();
  });

  it('grants the legacy permission to the driver role and to no other role', () => {
    // The guard compares exact strings with no wildcard, so "who can reach this
    // route" is exactly "who is granted this permission". Granting it to a
    // second role is what would quietly reopen the door, and this is where that
    // shows up.
    const holders = Object.entries(ROLE_PERMISSION_GRANTS)
      .filter(([, codes]) => codes.includes(DRIVER_PERMISSIONS.SUPPORT_TICKET_MANAGE))
      .map(([role]) => role);
    expect(holders).toEqual(['driver']);
  });

  it('grants it to the driver role alone in the catalogue that actually runs in production', () => {
    // seed-rbac.cjs is the copy that seeds production; seed-data/*.ts is the one
    // the rest of the suite imports. A boundary proven only in the second would
    // be a boundary not proven at all.
    const source = readFileSync(
      join(__dirname, '..', '..', '..', 'prisma', 'seed-rbac.cjs'),
      'utf8',
    );
    const grants = source.slice(source.indexOf('ROLE_PERMISSION_GRANTS'));
    const holders: string[] = [];
    for (const match of grants.matchAll(/^ {2}(\w+):\s*\[([\s\S]*?)\],?\s*$/gm)) {
      if ((match[2] ?? '').includes(`'${DRIVER_PERMISSIONS.SUPPORT_TICKET_MANAGE}'`)) {
        holders.push(match[1] ?? '');
      }
    }
    expect(holders).toEqual(['driver']);
  });

  it('keeps the legacy permission in the catalogue, so deployed driver apps still work', () => {
    // The reverse failure: dropping it would 403 every driver still on a build
    // that calls these routes — the drivers least likely to have updated.
    const catalogue = new Set(PERMISSION_SEEDS.map((permission) => permission.code));
    expect(catalogue.has(DRIVER_PERMISSIONS.SUPPORT_TICKET_MANAGE)).toBe(true);
    expect(DRIVER_PERMISSIONS.SUPPORT_TICKET_MANAGE).toBe('driver:support-ticket:manage');
  });
});
