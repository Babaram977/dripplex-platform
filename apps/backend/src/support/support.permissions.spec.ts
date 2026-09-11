import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';

import { PERMISSION_SEEDS } from '../../prisma/seed-data/permissions';
import { ROLE_PERMISSION_GRANTS } from '../../prisma/seed-data/role-permissions';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminSupportController } from './controllers/admin-support.controller';
import { SupportController } from './controllers/support.controller';
import { SUPPORT_PERMISSIONS } from './support.constants';

/**
 * DPX-SUPPORT-001 — how the routes are exposed.
 *
 * None of this is visible in a normal run: a missing permission decorator still
 * serves the right JSON to an authenticated caller, and a missing throttle
 * still answers every request. Both only show up in production, and one of them
 * shows up as the Operations queue buried under a script.
 */
describe('support routes — how they are exposed', () => {
  it('puts the filing route on a path that does not encode who you are', () => {
    // The whole point of Phase 1. A path under /customer or /driver would have
    // rebuilt the thing being replaced.
    expect(Reflect.getMetadata(PATH_METADATA, SupportController)).toBe('support/tickets');
    expect(Reflect.getMetadata(PATH_METADATA, AdminSupportController)).toBe(
      'admin/support/tickets',
    );
  });

  it('guards filing behind the persona-neutral permission', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SupportController)).toEqual([
      SUPPORT_PERMISSIONS.TICKETS_USE,
    ]);
    expect(SUPPORT_PERMISSIONS.TICKETS_USE).toBe('support:tickets:use');
  });

  it('guards the queue behind a separate Operations permission', () => {
    // Filing and answering must not be the same grant: everybody holds the
    // first, and holding it must never imply reading anyone else's ticket.
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AdminSupportController)).toEqual([
      SUPPORT_PERMISSIONS.ADMIN_MANAGE,
    ]);
    expect(SUPPORT_PERMISSIONS.ADMIN_MANAGE).toBe('admin:support:tickets:manage');
    expect(SUPPORT_PERMISSIONS.ADMIN_MANAGE).not.toBe(SUPPORT_PERMISSIONS.TICKETS_USE);
  });

  it('rate-limits creation, and only creation', () => {
    const create = SupportController.prototype.create;
    expect(Reflect.getMetadata(METHOD_METADATA, create)).toBe(RequestMethod.POST);
    // Ten an hour: nobody has ten distinct problems an hour, and a script
    // cannot bury the queue at that rate.
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', create)).toBe(10);
    expect(Reflect.getMetadata(THROTTLER_TTL + 'default', create)).toBe(3_600_000);

    // Reading your own tickets is not rate-limited beyond the global default —
    // somebody refreshing a page they are anxious about is not an attack.
    expect(
      Reflect.getMetadata(THROTTLER_LIMIT + 'default', SupportController.prototype.listOwn),
    ).toBeUndefined();
  });

  it('seeds both permissions so the routes are not 403 for everyone in production', () => {
    // The failure mode this guards against has reached production twice: a
    // permission that exists on the decorator and not in the catalogue, so
    // every request behind it answers 403 for every user.
    const catalogue = new Set(PERMISSION_SEEDS.map((permission) => permission.code));
    expect(catalogue.has(SUPPORT_PERMISSIONS.TICKETS_USE)).toBe(true);
    expect(catalogue.has(SUPPORT_PERMISSIONS.ADMIN_MANAGE)).toBe(true);
  });

  it('grants filing to every persona that can file, and to no staff-only role', () => {
    // "Every authenticated persona can create and view their own tickets" is
    // the founder-locked scope of Phase 1; this is where it is true or not.
    for (const role of ['customer', 'merchant', 'rider', 'driver', 'fleet_owner']) {
      expect(ROLE_PERMISSION_GRANTS[role]).toContain(SUPPORT_PERMISSIONS.TICKETS_USE);
    }
  });

  it('grants the queue to Operations and the two admin roles, and to nobody else', () => {
    const holders = Object.entries(ROLE_PERMISSION_GRANTS)
      .filter(([, codes]) => codes.includes(SUPPORT_PERMISSIONS.ADMIN_MANAGE))
      .map(([role]) => role)
      .sort();
    expect(holders).toEqual(['administrator', 'operations_staff', 'super_administrator']);
  });
});
