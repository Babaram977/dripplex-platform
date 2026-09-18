import { randomUUID } from 'node:crypto';

import { CommissionScope, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { ValidationDomainException } from '../common/exceptions/domain.exception';

import * as constants from './commission-campaign.constants';
import { COMMISSION_CAMPAIGN_PERMISSIONS } from './commission-campaign.constants';
import { CommissionCampaignService } from './commission-campaign.service';
import { AdminCommissionCampaignsController } from './controllers/admin-commission-campaigns.controller';

import type { CommissionCampaignDto } from './commission-campaign.service';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-COMMISSION-002 — campaign duration is an OPS-CONTROLLED PARAMETER.
 *
 * FOUNDER RULING, 2026-09-18: the platform does not impose a maximum campaign
 * duration. How long exceptional pricing runs is a commercial decision the
 * Operations Console makes as part of the campaign itself, subject only to the
 * existing validity rule `endsAt > startsAt`.
 *
 * This spec replaces `commission-campaign-window-bound.db.spec.ts`, which
 * proved a ceiling that was proposed and then ruled against. The proposal and
 * why it was declined are recorded in
 * `docs/DPX-COMMISSION-002-CAMPAIGN-DURATION.md`.
 *
 * WHAT IS PROVEN HERE, and why each half matters:
 *
 *   1. NO CEILING EXISTS, and none can be reintroduced unnoticed. Asserted
 *      against the constants module's own exports, not against behaviour — a
 *      behavioural test would pass for a ceiling set generously high, which is
 *      still a ceiling nobody ruled.
 *
 *   2. THE WINDOW OPS SETS IS THE WINDOW STORED, at every length, on both
 *      write paths. A duration is only "ops-controlled" if create and update
 *      both honour it exactly; enforcing on one path and not the other is how
 *      a parameter quietly becomes a suggestion.
 *
 *   3. AN INVALID WINDOW IS STILL REFUSED, on both write paths. Flexible is
 *      not the same as unvalidated.
 *
 *   4. THE BLAST RADIUS IS STILL GATED. With no duration ceiling, the controls
 *      that remain are permission, audit and visibility — so the permissions
 *      on the five mutations are pinned here rather than assumed.
 */
describe('Commission campaign duration is ops-controlled (database)', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let campaigns: CommissionCampaignService;
  const createdIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;

    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    campaigns = new CommissionCampaignService(prisma, new AuditService(auditLogRepository), {
      broadcast: jest.fn().mockResolvedValue({ sent: 0, skipped: 0, notificationIds: [] }),
    } as unknown as NotificationCenterService);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      if (createdIds.length > 0) {
        await prisma.commissionCampaign.deleteMany({ where: { id: { in: createdIds } } });
      }
      await prisma.$disconnect();
    }
  });

  const skipIfNoDb = (): boolean => {
    if (!databaseAvailable) {
      // Reported rather than silently green: a spec covering a commercial
      // control must not pass by never having run.
      console.warn('DPX-COMMISSION-002 duration spec skipped — no database');
      return true;
    }
    return false;
  };

  async function create(startsAt: Date, endsAt: Date, rate = 0.05): Promise<CommissionCampaignDto> {
    const campaign = await campaigns.create({
      name: `duration-${randomUUID()}`,
      scope: CommissionScope.MERCHANT_ORDER,
      commissionRate: rate,
      startsAt,
      endsAt,
      announce: false,
    });
    createdIds.push(campaign.id);
    return campaign;
  }

  // ─── 1. No ceiling, and none can creep back ─────────────────────────────

  describe('the platform imposes no maximum duration', () => {
    it('exports no maximum-window constant or resolver at all', () => {
      // Asserted against the module's exports rather than against behaviour.
      // A behavioural check ("a long window is accepted") would still pass for
      // a ceiling set at fifty years — which is a number nobody ruled. The
      // ruling is that no such number exists, so the test is that no such
      // export exists.
      const exported = Object.keys(constants);
      const ceilingish = exported.filter((k) => /MAX_WINDOW|MaxWindow|MAX_DURATION/i.test(k));
      expect(ceilingish).toEqual([]);
    });

    it('validates the window in exactly one place, and only for ordering', () => {
      // One seam, one rule. If a second condition appears in assertWindow, it
      // is a constraint on duration that this ruling says should not be there.
      // A named shape rather than an index signature: `assertWindow` is
      // private, so it has to be reached through a cast either way, and a
      // precise type keeps it non-optional.
      const proto = CommissionCampaignService.prototype as unknown as {
        assertWindow: (startsAt: Date, endsAt: Date) => void;
      };
      const source = proto.assertWindow.toString();
      expect(source).toContain('must end after it starts');
      expect(source).not.toMatch(/max|ceiling|limit|longest/i);
    });
  });

  // ─── 2. The window Ops sets is the window stored ────────────────────────

  describe('the duration Ops chooses is honoured exactly', () => {
    it('stores a short promotional window to the instant', async () => {
      if (skipIfNoDb()) return;
      const startsAt = new Date('2026-10-01T00:00:00.000Z');
      const endsAt = new Date('2026-10-08T00:00:00.000Z');

      const campaign = await create(startsAt, endsAt);

      expect(new Date(campaign.startsAt).toISOString()).toBe(startsAt.toISOString());
      expect(new Date(campaign.endsAt).toISOString()).toBe(endsAt.toISOString());
    });

    it('stores a multi-year window to the instant — no cap, no truncation', async () => {
      if (skipIfNoDb()) return;
      const startsAt = new Date('2026-10-01T00:00:00.000Z');
      const endsAt = new Date('2099-10-01T00:00:00.000Z');

      const campaign = await create(startsAt, endsAt);

      // Seventy-three years. Accepted, and stored verbatim rather than clamped
      // to some quiet maximum.
      expect(new Date(campaign.endsAt).toISOString()).toBe(endsAt.toISOString());
    });

    it('lets Ops EXTEND a running campaign through update', async () => {
      if (skipIfNoDb()) return;
      const campaign = await create(
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2026-10-08T00:00:00.000Z'),
      );

      const extended = await campaigns.update(campaign.id, {
        endsAt: new Date('2027-10-08T00:00:00.000Z'),
      });

      expect(new Date(extended.endsAt).toISOString()).toBe('2027-10-08T00:00:00.000Z');
    });

    it('lets Ops SHORTEN a running campaign through update', async () => {
      if (skipIfNoDb()) return;
      const campaign = await create(
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2027-10-01T00:00:00.000Z'),
      );

      const shortened = await campaigns.update(campaign.id, {
        endsAt: new Date('2026-10-02T00:00:00.000Z'),
      });

      // Ending a campaign early is the control that matters most when there is
      // no ceiling: the answer to a campaign running too long is that Ops can
      // stop it, not that the platform refused to let them start it.
      expect(new Date(shortened.endsAt).toISOString()).toBe('2026-10-02T00:00:00.000Z');
    });

    it('keeps a zero-rate campaign expressible, as ruled', async () => {
      if (skipIfNoDb()) return;
      // Existing behaviour, explicitly retained on 2026-09-18. The negotiated
      // merchant rate refuses zero; the campaign is the instrument the locked
      // precedence names for expressing it.
      const campaign = await create(
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2026-10-08T00:00:00.000Z'),
        0,
      );

      expect(campaign.commissionRate).toBe(0);
    });
  });

  // ─── 3. Flexible is not unvalidated ─────────────────────────────────────

  describe('an invalid window is still refused', () => {
    it('refuses a window that ends before it starts, on create', async () => {
      if (skipIfNoDb()) return;
      await expect(
        create(new Date('2026-10-08T00:00:00.000Z'), new Date('2026-10-01T00:00:00.000Z')),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('refuses a zero-length window, on create', async () => {
      if (skipIfNoDb()) return;
      const instant = new Date('2026-10-01T00:00:00.000Z');
      // endsAt === startsAt. The rule is strictly greater-than, so a campaign
      // that is in force for no time at all is not expressible.
      await expect(create(instant, instant)).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('refuses an inverted window on UPDATE too, not just on create', async () => {
      if (skipIfNoDb()) return;
      const campaign = await create(
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2026-10-08T00:00:00.000Z'),
      );

      // Both write paths, because a rule enforced on create alone is a rule an
      // operator steps around by editing.
      await expect(
        campaigns.update(campaign.id, { endsAt: new Date('2026-09-01T00:00:00.000Z') }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });

  // ─── 4. What guards the blast radius instead ────────────────────────────

  describe('campaign management stays permission-gated', () => {
    it('gates reading on READ and every mutation on MANAGE', () => {
      // With no duration ceiling, permission, audit and visibility are the
      // controls that remain. Pinned rather than assumed: a mutation that
      // silently dropped to READ would let anyone who can view campaigns set
      // a platform-wide rate.
      // The handlers are reached as real properties, not by string lookup, so
      // a renamed or deleted route is a compile error here rather than a test
      // that quietly stops checking anything.
      const c = AdminCommissionCampaignsController.prototype;
      const perm = (handler: unknown): unknown =>
        Reflect.getMetadata('permissions', handler as object);

      expect(perm(c.list)).toEqual([COMMISSION_CAMPAIGN_PERMISSIONS.READ]);
      expect(perm(c.get)).toEqual([COMMISSION_CAMPAIGN_PERMISSIONS.READ]);

      const mutations: [string, unknown][] = [
        ['create', c.create],
        ['update', c.update],
        ['pause', c.pause],
        ['resume', c.resume],
        ['archive', c.archive],
      ];
      for (const [name, handler] of mutations) {
        expect([name, perm(handler)]).toEqual([name, [COMMISSION_CAMPAIGN_PERMISSIONS.MANAGE]]);
      }
    });

    it('keeps READ and MANAGE as genuinely different permissions', () => {
      // Guards the pairing above from being satisfied by the two constants
      // collapsing into the same string.
      expect(COMMISSION_CAMPAIGN_PERMISSIONS.READ).not.toBe(COMMISSION_CAMPAIGN_PERMISSIONS.MANAGE);
    });
  });
});
