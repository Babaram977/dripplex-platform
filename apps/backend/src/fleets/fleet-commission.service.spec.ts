import { randomUUID } from 'node:crypto';

import { CommissionCampaignStatus, CommissionScope, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { CommissionRateResolverService } from '../commercial/commission-rate-resolver.service';
import {
  ConflictDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { FleetCommissionService } from './fleet-commission.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * The founder's model, 2026-08-30: commission is a percentage of the delivery
 * fee, and the whole month settles at the band its final volume reaches.
 * Every test below is one sentence of that.
 */
describe('FleetCommissionService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: FleetCommissionService;
  let ownerId: string;
  let fleetId: string;
  // No acting user: these call the service directly, not through a request.
  const context = {};
  const createdCampaignIds: string[] = [];

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
    const auditService = new AuditService(auditLogRepository);
    const commissionAccounts = new CommissionAccountService(
      prisma,
      auditService,
      new CommercialCreditSettingsService(prisma, auditService),
    );

    service = new FleetCommissionService(
      prisma,
      commissionAccounts,
      auditService,
      // A real resolver against the real database: with no FLEET campaign
      // stored these tests exercise the standing-band path for real.
      new CommissionRateResolverService(prisma),
    );

    const owner = await prisma.user.create({
      data: {
        email: `fleet-commission-owner-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Fleet',
        lastName: 'Owner',
      },
    });
    ownerId = owner.id;

    const fleet = await prisma.fleet.create({
      data: {
        ownerId,
        fleetNumber: `DX-FL-${String(Math.floor(Math.random() * 8999) + 1000)}`,
        name: 'Test Fleet',
      },
    });
    fleetId = fleet.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      // Campaigns first: an ACTIVE FLEET campaign left behind would change what
      // every later suite's fleet jobs are charged.
      await prisma.commissionCampaign.deleteMany({ where: { id: { in: createdCampaignIds } } });
      await prisma.fleetCommissionTier.deleteMany({}).catch(() => undefined);
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId } }).catch(() => undefined);
      await prisma.fleet.delete({ where: { id: fleetId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  /** The founder's illustrative table, made whole and gap-free. */
  async function seedTiers(): Promise<void> {
    await prisma.fleetCommissionTier.deleteMany({});
    await service.replaceTiers({
      tiers: [
        { minOrders: 0, maxOrders: 998, rate: 0.1 },
        { minOrders: 999, maxOrders: 4999, rate: 0.08 },
        { minOrders: 5000, maxOrders: 9999, rate: 0.065 },
        { minOrders: 10_000, maxOrders: null, rate: 0.05 },
      ],
      adminUserId: ownerId,
      context,
    });
  }

  describe('the band table', () => {
    it('refuses a gap between bands, which would leave a volume with no rate', async () => {
      if (!databaseAvailable) return;

      await expect(
        service.replaceTiers({
          tiers: [
            { minOrders: 0, maxOrders: 998, rate: 0.1 },
            // 999 is missing: a fleet landing there would be uncharged.
            { minOrders: 1500, maxOrders: null, rate: 0.08 },
          ],
          adminUserId: ownerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('refuses overlapping bands, which would charge two rates at once', async () => {
      if (!databaseAvailable) return;

      await expect(
        service.replaceTiers({
          tiers: [
            { minOrders: 0, maxOrders: 5000, rate: 0.1 },
            { minOrders: 4000, maxOrders: null, rate: 0.08 },
          ],
          adminUserId: ownerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('requires the top band to be open-ended so a growing fleet keeps a rate', async () => {
      if (!databaseAvailable) return;

      await expect(
        service.replaceTiers({
          tiers: [{ minOrders: 0, maxOrders: 9999, rate: 0.08 }],
          adminUserId: ownerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('requires the lowest band to start at zero, for a fleet in its first quiet month', async () => {
      if (!databaseAvailable) return;

      await expect(
        service.replaceTiers({
          tiers: [{ minOrders: 999, maxOrders: null, rate: 0.08 }],
          adminUserId: ownerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('rejects a rate given as a percentage rather than a fraction', async () => {
      if (!databaseAvailable) return;

      // 8 instead of 0.08 would charge 800%.
      await expect(
        service.replaceTiers({
          tiers: [{ minOrders: 0, maxOrders: null, rate: 8 }],
          adminUserId: ownerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('picks the band a volume falls in', async () => {
      if (!databaseAvailable) return;
      await seedTiers();

      expect(await service.rateForVolume(0)).toBe(0.1);
      expect(await service.rateForVolume(998)).toBe(0.1);
      // The founder's own two figures.
      expect(await service.rateForVolume(999)).toBe(0.08);
      expect(await service.rateForVolume(4999)).toBe(0.08);
      expect(await service.rateForVolume(5000)).toBe(0.065);
      expect(await service.rateForVolume(9999)).toBe(0.065);
      expect(await service.rateForVolume(250_000)).toBe(0.05);
    });

    it('returns no rate at all when the table is empty, rather than guessing one', async () => {
      if (!databaseAvailable) return;
      await prisma.fleetCommissionTier.deleteMany({});

      // The founder never set the bands below 999 or above 9,999. A default
      // here would put a number nobody agreed on an invoice.
      expect(await service.rateForVolume(1200)).toBeNull();
    });
  });

  describe('a negotiated rate', () => {
    it('overrides the band table for that fleet only', async () => {
      if (!databaseAvailable) return;
      await seedTiers();

      // Founder decision, 2026-08-30: "make it editable negotiable". A fleet
      // of six cars and a fleet of a hundred bikes cannot share one table.
      await service.setNegotiatedRate({
        fleetId,
        rate: 0.055,
        note: 'Launch partner, 15 riders',
        adminUserId: ownerId,
        context,
      });

      // The band for this volume is 10%; the agreement wins.
      expect(await service.rateForVolume(3)).toBe(0.1);
      expect(await service.rateForFleet(fleetId, 3)).toBe(0.055);
    });

    it('falls back to the band table once the agreement is cleared', async () => {
      if (!databaseAvailable) return;
      await seedTiers();

      await service.setNegotiatedRate({
        fleetId,
        rate: null,
        adminUserId: ownerId,
        context,
      });

      expect(await service.rateForFleet(fleetId, 3)).toBe(0.1);
    });

    it('rejects a rate given as a percentage', async () => {
      if (!databaseAvailable) return;

      await expect(
        service.setNegotiatedRate({ fleetId, rate: 6.5, adminUserId: ownerId, context }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('settles a finished month at the negotiated rate, not the band', async () => {
      if (!databaseAvailable) return;
      await seedTiers();
      await service.setNegotiatedRate({
        fleetId,
        rate: 0.055,
        adminUserId: ownerId,
        context,
      });

      const periodStart = new Date(Date.UTC(2026, 3, 1) - 3_600_000);
      const periodEnd = new Date(Date.UTC(2026, 4, 1) - 3_600_000);
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId, periodStart } });
      await prisma.fleetCommissionPeriod.create({
        data: { fleetId, periodStart, periodEnd, orderCount: 5200, chargeableTotal: 7_800_000 },
      });

      const settled = await service.settlePeriod({
        fleetId,
        periodStart,
        adminUserId: ownerId,
        context,
      });

      // The 5,200-order band is 6.5%; the agreement of 5.5% is what applies.
      expect(Number(settled.appliedRate)).toBe(0.055);
      expect(Number(settled.commissionAmount)).toBe(429_000);

      await service.setNegotiatedRate({ fleetId, rate: null, adminUserId: ownerId, context });
    });
  });

  describe('a mid-month commission campaign', () => {
    /**
     * Founder decision 2026-09-11: a mid-month campaign "should add up to
     * previously earned". The month keeps accumulating across it, the band is
     * still decided on the full month's volume, and the campaign is charged
     * only on the days it covered.
     */
    async function runCampaign(rate: number): Promise<string> {
      const campaign = await prisma.commissionCampaign.create({
        data: {
          name: `Fleet test ${randomUUID().slice(0, 8)}`,
          scope: CommissionScope.FLEET,
          commissionRate: rate,
          status: CommissionCampaignStatus.ACTIVE,
          startsAt: new Date(Date.now() - 60_000),
          endsAt: new Date(Date.now() + 86_400_000),
          announce: false,
        },
      });
      createdCampaignIds.push(campaign.id);
      return campaign.id;
    }

    // Per test, not per file. An ACTIVE fleet campaign left standing changes
    // what every later test's jobs are charged — which is exactly what it is
    // supposed to do, and exactly why it cannot outlive the test that made it.
    afterEach(async () => {
      if (!databaseAvailable) return;
      await prisma.commissionCampaign.deleteMany({ where: { id: { in: createdCampaignIds } } });
      createdCampaignIds.length = 0;
    });

    it('charges campaign days at the campaign rate and the rest at the band', async () => {
      if (!databaseAvailable) return;
      await seedTiers();
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId } });

      // ₦2,000 earned before anything special is running.
      await service.recordJob({ fleetId, amount: 2000 });

      await runCampaign(0.05);
      // ₦8,000 earned while the campaign is on.
      await service.recordJob({ fleetId, amount: 8000 });

      const totals = await service.periodTotals(fleetId);

      // The month is whole: two orders, ₦10,000, and the band is still chosen
      // on that full volume rather than on the campaign's slice.
      expect(totals.orderCount).toBe(2);
      expect(totals.chargeableTotal).toBe(10_000);
      // ₦2,000 at the 10% band + ₦8,000 at the campaign's 5% = ₦600.
      expect(totals.projectedCommission).toBe(600);
      // Which is a 6% effective rate — neither the band nor the campaign alone.
      expect(totals.projectedRate).toBe(0.06);
    });

    it('does not reset the month, so the band still reflects everything earned', async () => {
      if (!databaseAvailable) return;
      await seedTiers();
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId } });

      // 60 orders before the campaign, 60 during it. The 120-order total is
      // what picks the band; a campaign that reset the month would drop the
      // fleet back into the lowest band and overcharge them on every order
      // that came before it.
      for (let index = 0; index < 60; index += 1) {
        await service.recordJob({ fleetId, amount: 100 });
      }
      await runCampaign(0.01);
      for (let index = 0; index < 60; index += 1) {
        await service.recordJob({ fleetId, amount: 100 });
      }

      const totals = await service.periodTotals(fleetId);
      const band = await service.rateForVolume(120);

      expect(totals.orderCount).toBe(120);
      // ₦6,000 at the band the full 120 orders earn + ₦6,000 at 1%.
      expect(totals.projectedCommission).toBe(
        Math.round((6_000 * (band ?? 0) + 6_000 * 0.01) * 100) / 100,
      );
    });

    it('charges a month that predates campaigns entirely at the band', async () => {
      if (!databaseAvailable) return;
      await seedTiers();

      // No segments at all — exactly the shape of every month already trading
      // when this shipped, and the guard if a segment write is ever lost.
      const periodStart = new Date(Date.UTC(2026, 1, 1) - 3_600_000);
      const periodEnd = new Date(Date.UTC(2026, 2, 1) - 3_600_000);
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId, periodStart } });
      await prisma.fleetCommissionPeriod.create({
        data: { fleetId, periodStart, periodEnd, orderCount: 3, chargeableTotal: 5_000 },
      });

      const settled = await service.settlePeriod({
        fleetId,
        periodStart,
        adminUserId: ownerId,
        context,
      });

      expect(Number(settled.appliedRate)).toBe(0.1);
      expect(Number(settled.commissionAmount)).toBe(500);
    });

    it('keeps charging what a campaign charged even after it is archived', async () => {
      if (!databaseAvailable) return;
      await seedTiers();
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId } });

      const campaignId = await runCampaign(0.02);
      await service.recordJob({ fleetId, amount: 10_000 });

      // Editing or ending a campaign must not rewrite what was already earned
      // under it — the rate is snapshotted on the bucket, not read back.
      await prisma.commissionCampaign.update({
        where: { id: campaignId },
        data: { status: CommissionCampaignStatus.ARCHIVED, commissionRate: 0.5 },
      });

      const totals = await service.periodTotals(fleetId);

      expect(totals.projectedCommission).toBe(200);
    });
  });

  describe('a trading month', () => {
    it('counts deliveries and their fees without charging anything yet', async () => {
      if (!databaseAvailable) return;
      await seedTiers();
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId } });

      await service.recordJob({ fleetId, amount: 1500 });
      await service.recordJob({ fleetId, amount: 1500 });
      await service.recordJob({ fleetId, amount: 2000 });

      const totals = await service.periodTotals(fleetId);

      expect(totals.orderCount).toBe(3);
      expect(totals.chargeableTotal).toBe(5000);
      // Three orders sits in the lowest band.
      expect(totals.projectedRate).toBe(0.1);
      expect(totals.projectedCommission).toBe(500);
      // Nothing is owed until the month closes.
      expect(totals.settled).toBe(false);
      expect(totals.commissionAmount).toBeNull();
    });

    it('refuses to settle a month that has not finished', async () => {
      if (!databaseAvailable) return;
      await seedTiers();

      const period = await service.currentPeriod(fleetId);

      // The rate depends on the final volume, so there is nothing to settle.
      await expect(
        service.settlePeriod({
          fleetId,
          periodStart: period.periodStart,
          adminUserId: ownerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('charges the whole month at the band its total reached', async () => {
      if (!databaseAvailable) return;
      await seedTiers();

      // A finished month, built directly: 5,200 orders crosses from the 8%
      // band into 6.5%, and the founder's decision is that all 5,200 are
      // charged at 6.5% — not 8% on the first 4,999.
      const periodStart = new Date(Date.UTC(2026, 0, 1) - 3_600_000);
      const periodEnd = new Date(Date.UTC(2026, 1, 1) - 3_600_000);
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId, periodStart } });
      await prisma.fleetCommissionPeriod.create({
        data: {
          fleetId,
          periodStart,
          periodEnd,
          orderCount: 5200,
          chargeableTotal: 7_800_000,
        },
      });

      const settled = await service.settlePeriod({
        fleetId,
        periodStart,
        adminUserId: ownerId,
        context,
      });

      expect(Number(settled.appliedRate)).toBe(0.065);
      // 7,800,000 × 6.5% — not the 624,000-plus-remainder a marginal band
      // would have produced.
      expect(Number(settled.commissionAmount)).toBe(507_000);
      expect(settled.settledAt).not.toBeNull();
    });

    it('refuses to settle the same month twice', async () => {
      if (!databaseAvailable) return;

      const periodStart = new Date(Date.UTC(2026, 0, 1) - 3_600_000);

      // An invoice sent twice is worse than one sent late.
      await expect(
        service.settlePeriod({
          fleetId,
          periodStart,
          adminUserId: ownerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('refuses to settle when no band covers the volume', async () => {
      if (!databaseAvailable) return;
      await prisma.fleetCommissionTier.deleteMany({});

      const periodStart = new Date(Date.UTC(2026, 1, 1) - 3_600_000);
      const periodEnd = new Date(Date.UTC(2026, 2, 1) - 3_600_000);
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId, periodStart } });
      await prisma.fleetCommissionPeriod.create({
        data: { fleetId, periodStart, periodEnd, orderCount: 40, chargeableTotal: 60_000 },
      });

      await expect(
        service.settlePeriod({
          fleetId,
          periodStart,
          adminUserId: ownerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('counts a ride at its fare alongside deliveries at their fee', async () => {
      if (!databaseAvailable) return;
      await seedTiers();
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId } });

      // Founder decision, 2026-08-30: "rides should count too, use the trip
      // fare". A fleet of cars and a fleet of bikes accumulate into the same
      // month, each job at its own base.
      await service.recordJob({ fleetId, amount: 1500 }); // a delivery fee
      await service.recordJob({ fleetId, amount: 4200 }); // a trip fare

      const totals = await service.periodTotals(fleetId);

      expect(totals.orderCount).toBe(2);
      expect(totals.chargeableTotal).toBe(5700);
      // Both count towards the volume that picks the band, not just deliveries.
      expect(totals.projectedRate).toBe(0.1);
      expect(totals.projectedCommission).toBe(570);
    });

    it('puts a delivery in the month it was delivered, not the month it was counted', async () => {
      if (!databaseAvailable) return;

      const march = new Date(Date.UTC(2026, 2, 15, 12, 0, 0));
      await service.recordJob({ fleetId, amount: 1500, at: march });

      const totals = await service.periodTotals(fleetId, march);

      expect(totals.orderCount).toBe(1);
      expect(totals.periodStart.toISOString()).toBe(
        new Date(Date.UTC(2026, 2, 1) - 3_600_000).toISOString(),
      );
    });
  });
});
