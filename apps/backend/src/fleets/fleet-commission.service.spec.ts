import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
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

    service = new FleetCommissionService(prisma, commissionAccounts, auditService);

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
