import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { AdminFleetsController } from './controllers/admin-fleets.controller';
import { FLEET_PERMISSIONS } from './fleet.constants';

/**
 * Pre-merge review of PR #356, 2026-09-11 — two high-risk findings against the
 * fleet commission backfill, both fixed and both pinned here.
 *
 * The endpoint rewrites `FleetCommissionPeriod` across every fleet. Neither
 * property below is visible in a normal test run — a wrong verb still returns
 * the right JSON, and a missing permission decorator still lets an
 * authenticated admin through — so nothing else in the suite would notice
 * either regressing.
 */
describe('fleet commission reconstruction — how the route is exposed', () => {
  const handler = AdminFleetsController.prototype.reconstructCommission;

  it('is a POST, because the applied form is a platform-wide financial write', () => {
    // A GET is safe by convention, and browser prefetch, link unfurling, proxy
    // caches and retry-on-timeout all rely on that convention. None of them
    // should be able to start a rewrite of what every fleet is billed.
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('commission/reconstruction');
  });

  it('requires the commission permission, not the broader fleet-admin one', () => {
    // Every other commission route on this controller declares it. This one
    // inherited the class-level `admin:fleets:manage` — the same grant that
    // merely lists fleets — which made the most consequential action on the
    // controller reachable by its least privileged operator.
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual([
      FLEET_PERMISSIONS.ADMIN_COMMISSION_MANAGE,
    ]);
    expect(FLEET_PERMISSIONS.ADMIN_COMMISSION_MANAGE).toBe('admin:fleets:commission:manage');
  });

  it('sits beside the other commission routes on the same permission', () => {
    // Guards against the reverse drift: a future route added here that quietly
    // falls back to the class-level default, as this one did.
    for (const name of [
      'setNegotiatedRate',
      'settlePeriod',
      'replaceTiers',
      'listTiers',
    ] as const) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, AdminFleetsController.prototype[name])).toEqual([
        FLEET_PERMISSIONS.ADMIN_COMMISSION_MANAGE,
      ]);
    }
  });
});
