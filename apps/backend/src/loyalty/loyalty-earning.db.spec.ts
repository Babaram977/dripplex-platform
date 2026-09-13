import { randomUUID } from 'node:crypto';

import {
  DriverStatus,
  LoyaltyEarnerPersona,
  LoyaltyLedgerEntryType,
  PrismaClient,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { LoyaltyEarningService } from './loyalty-earning.service';
import { LoyaltySettingsService } from './loyalty-settings.service';
import { LOYALTY_REFERENCE_TYPES } from './loyalty.constants';
import { LoyaltyService } from './loyalty.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-LOYALTY-007 — partners earn DX Points only under an approved programme.
 *
 * The first test is the most important one in this file: with every programme
 * seeded off, a driver finishing a trip earns nothing. That is the platform's
 * behaviour today, and it is the rule Nora's policy asks for.
 */
describe('partner DX Points earning', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let earning: LoyaltyEarningService;
  const createdUserIds: string[] = [];

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
    const settings = new LoyaltySettingsService(prisma, auditService);
    const loyalty = new LoyaltyService(
      prisma,
      auditService,
      new WalletService(prisma, auditService, new DomainEventBus()),
      settings,
    );
    earning = new LoyaltyEarningService(prisma, auditService, loyalty, settings);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.loyaltyLedgerEntry.deleteMany({
        where: { account: { userId: { in: createdUserIds } } },
      });
      await prisma.loyaltyAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.driverProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    // Back to seeded — every programme off — so one test switching a persona on
    // never becomes another test's surprise, or another suite's.
    await prisma.loyaltyEarningProgramme.updateMany({
      data: { active: false, dailyPointsCap: 2000, pointsPerCompletedJob: 20 },
    });
  });

  async function partner(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `partner-earning-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Partner',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function balanceOf(userId: string): Promise<number> {
    const account = await prisma.loyaltyAccount.findUnique({ where: { userId } });
    return account?.pointsBalance ?? 0;
  }

  it('pays a partner nothing while their programme is switched off', async () => {
    if (!databaseAvailable) return;
    // The seeded state, and the platform's behaviour before this shipped.
    const driverId = await partner();

    await earning.awardForCompletedJob({
      persona: LoyaltyEarnerPersona.DRIVER,
      userId: driverId,
      referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_RIDE,
      referenceId: randomUUID(),
    });

    expect(await balanceOf(driverId)).toBe(0);
  });

  it('pays once the programme is approved, and not before', async () => {
    if (!databaseAvailable) return;
    const driverId = await partner();
    const adminId = await partner();

    await earning.update(LoyaltyEarnerPersona.DRIVER, { active: true }, adminId);
    await earning.awardForCompletedJob({
      persona: LoyaltyEarnerPersona.DRIVER,
      userId: driverId,
      referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_RIDE,
      referenceId: randomUUID(),
    });

    expect(await balanceOf(driverId)).toBe(20);
  });

  it('keeps each persona behind its own switch', async () => {
    if (!databaseAvailable) return;
    // Switching drivers on must not switch riders or merchants on. The three
    // are separate approvals in the policy and separate rows here.
    const riderId = await partner();
    const adminId = await partner();

    await earning.update(LoyaltyEarnerPersona.DRIVER, { active: true }, adminId);
    await earning.awardForCompletedJob({
      persona: LoyaltyEarnerPersona.RIDER,
      userId: riderId,
      referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_DELIVERY,
      referenceId: randomUUID(),
    });

    expect(await balanceOf(riderId)).toBe(0);
  });

  it('pays for a job exactly once, however often the event is replayed', async () => {
    if (!databaseAvailable) return;
    const driverId = await partner();
    const adminId = await partner();
    const rideId = randomUUID();
    await earning.update(LoyaltyEarnerPersona.DRIVER, { active: true }, adminId);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await earning.awardForCompletedJob({
        persona: LoyaltyEarnerPersona.DRIVER,
        userId: driverId,
        referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_RIDE,
        referenceId: rideId,
      });
    }

    expect(await balanceOf(driverId)).toBe(20);
  });

  describe('reviews', () => {
    it('lets a good review boost points', async () => {
      if (!databaseAvailable) return;
      // Founder decision 2026-09-11: a review can boost DX Points.
      const driverId = await partner();
      const adminId = await partner();
      await earning.update(LoyaltyEarnerPersona.DRIVER, { active: true }, adminId);

      await earning.awardForReview({
        persona: LoyaltyEarnerPersona.DRIVER,
        userId: driverId,
        rating: 5,
        referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_REVIEW,
        referenceId: randomUUID(),
      });

      expect(await balanceOf(driverId)).toBe(50);
    });

    it('earns nothing below the bar, and never deducts', async () => {
      if (!databaseAvailable) return;
      // A points system that subtracted on a bad review would be a star rating
      // by another name, which is the thing the founder decision separates.
      const driverId = await partner();
      const adminId = await partner();
      await earning.update(LoyaltyEarnerPersona.DRIVER, { active: true }, adminId);

      await earning.awardForReview({
        persona: LoyaltyEarnerPersona.DRIVER,
        userId: driverId,
        rating: 5,
        referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_REVIEW,
        referenceId: randomUUID(),
      });
      await earning.awardForReview({
        persona: LoyaltyEarnerPersona.DRIVER,
        userId: driverId,
        rating: 1,
        referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_REVIEW,
        referenceId: randomUUID(),
      });

      expect(await balanceOf(driverId)).toBe(50);
      const negative = await prisma.loyaltyLedgerEntry.count({
        where: { account: { userId: driverId }, points: { lt: 0 } },
      });
      expect(negative).toBe(0);
    });

    it('records review points as EARNED, on the points ledger only', async () => {
      if (!databaseAvailable) return;
      // The separation that makes "boosts points, never the rating" true by
      // construction: this path writes one loyalty line and touches nothing
      // the rating engine reads.
      const driverId = await partner();
      const adminId = await partner();
      await earning.update(LoyaltyEarnerPersona.DRIVER, { active: true }, adminId);

      await earning.awardForReview({
        persona: LoyaltyEarnerPersona.DRIVER,
        userId: driverId,
        rating: 5,
        referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_REVIEW,
        referenceId: randomUUID(),
      });

      const entries = await prisma.loyaltyLedgerEntry.findMany({
        where: { account: { userId: driverId } },
        select: { type: true, points: true },
      });
      expect(entries).toEqual([{ type: LoyaltyLedgerEntryType.EARNED, points: 50 }]);
      const ratings = await prisma.rideRating.count({ where: { rateeId: driverId } });
      expect(ratings).toBe(0);
    });
  });

  describe('the daily cap', () => {
    it('stops paying once a partner has earned the day’s allowance', async () => {
      if (!databaseAvailable) return;
      // A busy driver finishes far more jobs in a day than a customer places
      // orders, which is why the cap matters more on this side.
      const driverId = await partner();
      const adminId = await partner();
      await earning.update(
        LoyaltyEarnerPersona.DRIVER,
        { active: true, pointsPerCompletedJob: 20, dailyPointsCap: 50 },
        adminId,
      );

      for (let job = 0; job < 5; job += 1) {
        await earning.awardForCompletedJob({
          persona: LoyaltyEarnerPersona.DRIVER,
          userId: driverId,
          referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_RIDE,
          referenceId: randomUUID(),
        });
      }

      // 20 + 20 + the 10 that was left, then nothing.
      expect(await balanceOf(driverId)).toBe(50);
    });

    it('pays the headroom rather than refusing the whole award', async () => {
      if (!databaseAvailable) return;
      // A driver with 10 points of room left should get 10, not zero.
      const driverId = await partner();
      const adminId = await partner();
      await earning.update(
        LoyaltyEarnerPersona.DRIVER,
        { active: true, pointsPerCompletedJob: 30, dailyPointsCap: 40 },
        adminId,
      );

      await earning.awardForCompletedJob({
        persona: LoyaltyEarnerPersona.DRIVER,
        userId: driverId,
        referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_RIDE,
        referenceId: randomUUID(),
      });
      await earning.awardForCompletedJob({
        persona: LoyaltyEarnerPersona.DRIVER,
        userId: driverId,
        referenceType: LOYALTY_REFERENCE_TYPES.PARTNER_RIDE,
        referenceId: randomUUID(),
      });

      expect(await balanceOf(driverId)).toBe(40);
    });
  });

  it('refuses a review bar outside one to five stars', async () => {
    if (!databaseAvailable) return;
    const adminId = await partner();
    await expect(
      earning.update(LoyaltyEarnerPersona.DRIVER, { minReviewRating: 0 }, adminId),
    ).rejects.toThrow(/between 1 and 5/i);
  });

  it('seeds every partner persona switched off', async () => {
    if (!databaseAvailable) return;
    const programmes = await earning.list();

    expect(programmes.map((programme) => programme.persona).sort()).toEqual([
      'DRIVER',
      'FLEET_OWNER',
      'MERCHANT',
      'RIDER',
    ]);
    expect(programmes.every((programme) => !programme.active)).toBe(true);
  });

  describe('the blast radius shown before switching one on', () => {
    it('counts the partners a programme would begin paying', async () => {
      if (!databaseAvailable) return;
      // Approved drivers only. Somebody still pending approval cannot take a
      // trip, so counting them would overstate what the switch commits to.
      const approvedId = await partner();
      const pendingId = await partner();
      await prisma.driverProfile.create({
        data: { userId: approvedId, status: DriverStatus.APPROVED },
      });
      await prisma.driverProfile.create({
        data: { userId: pendingId, status: DriverStatus.PENDING },
      });

      const impact = await earning.impact();
      const drivers = impact.find((row) => row.persona === LoyaltyEarnerPersona.DRIVER);

      expect(drivers?.eligiblePartners).toBe(1);
    });

    it('states the worst case rather than a forecast', async () => {
      if (!databaseAvailable) return;
      // A forecast needs assumptions about how many trips a driver does, and an
      // operator cannot check my assumptions. Everybody hitting their cap needs
      // none and cannot be exceeded.
      const driverId = await partner();
      const adminId = await partner();
      await prisma.driverProfile.create({
        data: { userId: driverId, status: DriverStatus.APPROVED },
      });
      await earning.update(LoyaltyEarnerPersona.DRIVER, { dailyPointsCap: 2000 }, adminId);

      const impact = await earning.impact();
      const drivers = impact.find((row) => row.persona === LoyaltyEarnerPersona.DRIVER);
      if (drivers === undefined) {
        throw new Error('Every persona has a programme, so this cannot be missing');
      }

      expect(drivers.worstCaseDailyPoints).toBe(drivers.eligiblePartners * 2000);
      // 100 points to the naira, so 2,000 points is ₦20 per driver per day —
      // the ruling doubled what a partner-earning programme costs the platform.
      expect(drivers.worstCaseDailyNaira).toBe((drivers.eligiblePartners * 2000) / 100);
    });

    it('reports no ceiling at all when the programme is uncapped', async () => {
      if (!databaseAvailable) return;
      // Null rather than a number, because there is no ceiling to state — and
      // that absence is exactly what should give an operator pause.
      const adminId = await partner();
      await earning.update(LoyaltyEarnerPersona.DRIVER, { dailyPointsCap: null }, adminId);

      const impact = await earning.impact();
      const drivers = impact.find((row) => row.persona === LoyaltyEarnerPersona.DRIVER);

      expect(drivers?.dailyPointsCap).toBeNull();
      expect(drivers?.worstCaseDailyPoints).toBeNull();
      expect(drivers?.worstCaseDailyNaira).toBeNull();
    });
  });
});
