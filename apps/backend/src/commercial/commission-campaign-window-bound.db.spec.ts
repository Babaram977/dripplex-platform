import { randomUUID } from 'node:crypto';

import { CommissionScope, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import * as constants from './commission-campaign.constants';
import { CommissionCampaignService } from './commission-campaign.service';

import type { CommissionCampaignDto } from './commission-campaign.service';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const DAY_MS = 86_400_000;

/**
 * DPX-COMMISSION-002 — the maximum campaign window, proposed and SHIPPED
 * INERT.
 *
 * WHY THIS SPEC EXISTS. `assertWindow` bounds a campaign only by
 * `endsAt > startsAt`. There is no maximum. The rate is valid at 0 —
 * deliberately, since the negotiated merchant rate refuses zero and the ruling
 * names the campaign as the instrument for it — and a campaign with no `rules`
 * applies platform-wide within its scope. Permanent, platform-wide, zero
 * commission is therefore expressible in one call. The zero is intended; the
 * permanence is what nothing bounds.
 *
 * WHAT IS BEING PROVEN, in two halves that must both hold:
 *
 *   1. WITH NO CEILING CONFIGURED — today's state, and the state this merges
 *      in — behaviour is EXACTLY unchanged. A seventy-three-year window is
 *      still accepted. This is the half that makes the proposal safe to merge
 *      before any number is decided, and it is the half that would fail if a
 *      ceiling were ever smuggled in as a default.
 *
 *   2. WITH A CEILING CONFIGURED, both write paths refuse — create AND update.
 *      One seam, both callers, because a ceiling enforced on create alone
 *      would be a ceiling an operator could step around by editing.
 *
 * The number itself is deliberately not chosen here. How long exceptional
 * pricing may run is a commercial commitment; these tests demonstrate the
 * boundary works whatever number is eventually ruled.
 */
describe('Commission campaign window bound (database)', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let campaigns: CommissionCampaignService;
  const createdIds: string[] = [];
  let maxWindowSpy: jest.SpyInstance<number | null, [raw?: number | null | undefined]>;

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

  beforeEach(() => {
    maxWindowSpy = jest.spyOn(constants, 'resolveCommissionCampaignMaxWindowMs');
  });

  afterEach(() => {
    maxWindowSpy.mockRestore();
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
      // Reported rather than silently green: a spec that proves a financial
      // boundary must not pass by never having run.
      console.warn('DPX-COMMISSION-002 window-bound spec skipped — no database');
      return true;
    }
    return false;
  };

  async function create(startsAt: Date, endsAt: Date, rate = 0.05): Promise<CommissionCampaignDto> {
    const campaign = await campaigns.create({
      name: `window-bound-${randomUUID()}`,
      scope: CommissionScope.MERCHANT_ORDER,
      commissionRate: rate,
      startsAt,
      endsAt,
      announce: false,
    });
    createdIds.push(campaign.id);
    return campaign;
  }

  // ─── Half one: inert today ──────────────────────────────────────────────

  describe('with no ceiling configured — the state this merges in', () => {
    it('resolves to null, meaning no ceiling', () => {
      // Guards against a default being smuggled in. The constant is null and
      // the resolver must say so.
      maxWindowSpy.mockRestore();
      expect(constants.COMMISSION_CAMPAIGN_MAX_WINDOW_MS).toBeNull();
      expect(constants.resolveCommissionCampaignMaxWindowMs()).toBeNull();
    });

    it('still accepts a seventy-three-year window, exactly as before', async () => {
      if (skipIfNoDb()) return;
      maxWindowSpy.mockReturnValue(null);

      const campaign = await create(
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2099-09-01T00:00:00.000Z'),
      );

      // THE POINT OF THIS TEST. Merging the seam must change nothing until a
      // number is ruled. If this ever goes red, a ceiling was chosen without a
      // ruling.
      expect(new Date(campaign.endsAt).getUTCFullYear()).toBe(2099);
    });

    it('still accepts a permanent platform-wide ZERO-rate campaign', async () => {
      if (skipIfNoDb()) return;
      maxWindowSpy.mockReturnValue(null);

      // This is the exact shape that prompted the proposal, and it is still
      // legal. Recorded as a passing test rather than described in prose, so
      // the gap is demonstrable rather than asserted.
      const campaign = await create(
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2099-09-01T00:00:00.000Z'),
        0,
      );
      expect(campaign.commissionRate).toBe(0);
      expect(campaign.rules).toBeNull();
    });

    it('still refuses a window that ends before it starts', async () => {
      if (skipIfNoDb()) return;
      maxWindowSpy.mockReturnValue(null);

      await expect(
        create(new Date('2026-09-08T00:00:00.000Z'), new Date('2026-09-01T00:00:00.000Z')),
      ).rejects.toThrow(/must end after it starts/);
    });
  });

  // ─── Half two: the boundary, once a number is ruled ─────────────────────

  describe('with a ceiling configured', () => {
    const NINETY_DAYS = 90 * DAY_MS;

    it('accepts a window inside the ceiling', async () => {
      if (skipIfNoDb()) return;
      maxWindowSpy.mockReturnValue(NINETY_DAYS);

      const campaign = await create(
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-10-01T00:00:00.000Z'),
      );
      expect(campaign.id).toBeTruthy();
    });

    it('accepts a window exactly at the ceiling', async () => {
      if (skipIfNoDb()) return;
      maxWindowSpy.mockReturnValue(NINETY_DAYS);

      const startsAt = new Date('2026-09-01T00:00:00.000Z');
      const campaign = await create(startsAt, new Date(startsAt.getTime() + NINETY_DAYS));
      expect(campaign.id).toBeTruthy();
    });

    it('refuses a window one millisecond over the ceiling', async () => {
      if (skipIfNoDb()) return;
      maxWindowSpy.mockReturnValue(NINETY_DAYS);

      const startsAt = new Date('2026-09-01T00:00:00.000Z');
      await expect(
        create(startsAt, new Date(startsAt.getTime() + NINETY_DAYS + 1)),
      ).rejects.toThrow(/at most 90 days/);
    });

    it('refuses the permanent zero-commission campaign this proposal is about', async () => {
      if (skipIfNoDb()) return;
      maxWindowSpy.mockReturnValue(NINETY_DAYS);

      await expect(
        create(new Date('2026-09-01T00:00:00.000Z'), new Date('2099-09-01T00:00:00.000Z'), 0),
      ).rejects.toThrow(/at most 90 days/);
    });

    it('refuses on UPDATE too, not only on create', async () => {
      if (skipIfNoDb()) return;

      // Created inside the ceiling…
      maxWindowSpy.mockReturnValue(NINETY_DAYS);
      const campaign = await create(
        new Date('2026-09-01T00:00:00.000Z'),
        new Date('2026-10-01T00:00:00.000Z'),
      );

      // …then stretched past it. A ceiling enforced on create alone is a
      // ceiling an operator steps around by editing, which is why assertWindow
      // is one seam called by both paths.
      await expect(
        campaigns.update(campaign.id, { endsAt: new Date('2099-09-01T00:00:00.000Z') }),
      ).rejects.toThrow(/at most 90 days/);
    });

    it('names the limit and what was asked for, so the refusal is actionable', async () => {
      if (skipIfNoDb()) return;
      maxWindowSpy.mockReturnValue(NINETY_DAYS);

      await expect(
        create(new Date('2026-09-01T00:00:00.000Z'), new Date('2027-09-01T00:00:00.000Z')),
      ).rejects.toThrow(/at most 90 days; this one asks for 365/);
    });
  });

  // ─── The resolver's own fail-open contract ──────────────────────────────

  describe('the resolver fails OPEN, unlike the recovery boundary', () => {
    // The resolver takes the raw value as a defaulted parameter, the same
    // shape `resolveRecoveryActivationAt` uses, so these need no mocking.
    it.each([
      ['zero', 0],
      ['negative', -1],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('treats %s as no ceiling rather than as a literal limit', (_label, value) => {
      // Deliberately the opposite of resolveRecoveryActivationAt, which fails
      // CLOSED. There, an unreadable boundary must stop the platform moving
      // money by itself. Here, an unreadable boundary must not start refusing
      // every campaign — including a one-day one — which is what treating an
      // absurd value as a literal ceiling would do.
      maxWindowSpy.mockRestore();
      expect(constants.resolveCommissionCampaignMaxWindowMs(value)).toBeNull();
    });

    it('passes a sane ceiling through unchanged', () => {
      maxWindowSpy.mockRestore();
      expect(constants.resolveCommissionCampaignMaxWindowMs(90 * DAY_MS)).toBe(90 * DAY_MS);
    });
  });
});
