import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  PromotionDomain,
  PromotionStatus,
  ReferralOwnerType,
  ReferralRefereeType,
  RideStatus,
  RideType,
} from '@prisma/client';

import { PromotionsService } from '../promotions/promotions.service';

import { RidesService } from './rides.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const INCENTIVE_ID = '00000000-0000-4000-8000-00000000200a';
const FARE = 1_000;

/**
 * DPX-PROMO-REF-001 — the universal acquisition incentive, through the real
 * pricing path.
 *
 * Driven through `RidesService.estimateFare` with the real `PromotionsService`
 * and the seeded platform-wide promotion, deliberately. The rules it depends on
 * — `referralOnly` above all — were implemented, unit-tested and dead in
 * production for exactly the reason a test that hands the evaluator a context
 * cannot catch: nothing on the production path supplied one. Asserting this
 * anywhere but the pricing path would repeat that mistake.
 */
describe('universal acquisition incentive', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let rides: RidesService;
  const users: string[] = [];

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
    const audit = { record: () => Promise.resolve(undefined) } as unknown as AuditService;
    const bus = { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus;
    const promotions = new PromotionsService(prisma, audit, bus, {
      credit: () => Promise.resolve(undefined),
      cashback: () => Promise.resolve(undefined),
    } as never);
    rides = new RidesService(
      prisma,
      {
        estimate: () =>
          Promise.resolve({ totalFare: FARE, baseFare: FARE, distanceKm: 3, durationMin: 10 }),
      } as never,
      audit,
      {} as never,
      {} as never,
      {} as never,
      promotions,
      bus,
      {} as never,
      {} as never,
      { findExclusion: () => Promise.resolve(null) } as never,
    );
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.ride.deleteMany({ where: { customerId: { in: users } } });
    await prisma.referralRedemption.deleteMany({ where: { refereeUserId: { in: users } } });
    await prisma.referral.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  async function aUser(): Promise<string> {
    const u = await prisma.user.create({
      data: {
        email: `inc-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'I',
        lastName: 'N',
      },
    });
    users.push(u.id);
    return u.id;
  }

  /** A customer acquired through a referral — any referral. */
  async function anAcquiredCustomer(): Promise<string> {
    const referrer = await aUser();
    const referee = await aUser();
    const referral = await prisma.referral.create({
      data: {
        userId: referrer,
        ownerType: ReferralOwnerType.CUSTOMER,
        code: randomUUID().slice(0, 8).toUpperCase(),
      },
    });
    await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId: referee,
        refereeType: ReferralRefereeType.CUSTOMER,
      },
    });
    return referee;
  }

  async function completeRides(customerId: string, count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
      await prisma.ride.create({
        data: {
          customerId,
          rideType: RideType.ECONOMY,
          status: RideStatus.COMPLETED,
          pickupLatitude: 12,
          pickupLongitude: 8,
          dropoffLatitude: 12.1,
          dropoffLongitude: 8.1,
          pickupAddress: 'A',
          dropoffAddress: 'B',
        },
      });
    }
  }

  async function quote(
    customerId: string,
  ): Promise<{ promotionId: string | null; promoDiscount: number }> {
    return await rides.estimateFare(customerId, {
      rideType: RideType.ECONOMY,
      pickupLatitude: 12,
      pickupLongitude: 8,
      dropoffLatitude: 12.1,
      dropoffLongitude: 8.1,
    });
  }

  it('is seeded exactly once, as one platform-wide row', async () => {
    if (!databaseAvailable) return;
    const rows = await prisma.promotion.findMany({
      where: { metadata: { path: ['kind'], equals: 'universal-acquisition-incentive' } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(INCENTIVE_ID);
    expect(rows[0]?.status).toBe(PromotionStatus.ACTIVE);
    expect(rows[0]?.domains).toEqual([PromotionDomain.RIDE]);
    expect(Number(rows[0]?.percentOff)).toBe(20);
    // The ceiling is a rule, never perUserLimit — which counts claims, not
    // completed rides, and would let a declined discount bank a slot.
    expect(rows[0]?.perUserLimit).toBeNull();
    expect(rows[0]?.rules).toMatchObject({ referralOnly: true, maxPriorCompletedRides: 3 });
  });

  it.each([[0], [1], [2]])('discounts a referred customer on ride #%i+1', async (priorRides) => {
    if (!databaseAvailable) return;
    const customerId = await anAcquiredCustomer();
    await completeRides(customerId, priorRides);

    const estimate = await quote(customerId);

    expect(estimate.promotionId).toBe(INCENTIVE_ID);
    expect(estimate.promoDiscount).toBe(FARE * 0.2);
  });

  it('stops at ride #4, and stays stopped', async () => {
    if (!databaseAvailable) return;
    const customerId = await anAcquiredCustomer();
    await completeRides(customerId, 3);

    const fourth = await quote(customerId);
    expect(fourth.promotionId).toBeNull();
    expect(fourth.promoDiscount).toBe(0);

    await completeRides(customerId, 5);
    const ninth = await quote(customerId);
    expect(ninth.promoDiscount).toBe(0);
  });

  it('does not discount a customer nobody referred', async () => {
    if (!databaseAvailable) return;
    // `referralOnly` was dead in production until the ride path supplied the
    // context: before this increment, this customer would have been discounted.
    const customerId = await aUser();

    const estimate = await quote(customerId);

    expect(estimate.promotionId).toBeNull();
    expect(estimate.promoDiscount).toBe(0);
  });

  it('cannot be restarted by a second campaign', async () => {
    if (!databaseAvailable) return;
    // refereeUserId is unique platform-wide, so a customer cannot hold a second
    // acquisition at all — and the counter reads completed rides, which no
    // campaign can reset.
    const customerId = await anAcquiredCustomer();
    await completeRides(customerId, 3);

    const second = await prisma.referralRedemption.count({ where: { refereeUserId: customerId } });
    expect(second).toBe(1);
    expect((await quote(customerId)).promoDiscount).toBe(0);
  });

  it('does not leak into another domain', async () => {
    if (!databaseAvailable) return;
    // The incentive is RIDE-only. A marketplace checkout for the same acquired
    // customer must not pick it up.
    const customerId = await anAcquiredCustomer();
    const promotions = new PromotionsService(
      prisma,
      { record: () => Promise.resolve(undefined) } as unknown as AuditService,
      { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus,
      { credit: () => Promise.resolve(undefined) } as never,
    );

    const marketplace = await promotions.previewPromotion({
      userId: customerId,
      domain: PromotionDomain.MARKETPLACE,
      subtotal: FARE,
      eligibility: { isReferral: true, completedRides: 0 },
    });

    expect(marketplace.discounts.find((d) => d.promotionId === INCENTIVE_ID)).toBeUndefined();
  });

  it('grants the same slot to simultaneous requests — measured, not assumed', async () => {
    if (!databaseAvailable) return;
    // The counter is COMPLETED rides, and a ride being priced is not completed.
    // So N simultaneous requests all read the same count and all price as
    // eligible. This measures that window rather than asserting it away,
    // because the honest question is not whether the reads race — they do —
    // but whether the outcome can exceed three DISCOUNTED COMPLETED rides.
    const customerId = await anAcquiredCustomer();
    await completeRides(customerId, 2);

    const quotes = await Promise.all([quote(customerId), quote(customerId), quote(customerId)]);
    const discounted = quotes.filter((q) => q.promoDiscount > 0);

    // All three are quoted the discount: each sees 2 prior completed rides.
    expect(discounted).toHaveLength(3);
    // And that is the exposure, stated plainly: rides 3, 4 and 5 would each
    // carry 20% if all three were requested at once and all three completed.
    // The cap holds for sequential riding, which is every ordinary customer,
    // and leaks only for genuinely simultaneous requests by one person.
    // Recorded in the increment report as an open decision rather than patched
    // here: closing it means counting in-flight rides as consumed, which
    // charges somebody for a ride they may cancel.
  });

  it('refuses a caller that cannot say how many rides somebody has completed', async () => {
    if (!databaseAvailable) return;
    // Fails closed rather than defaulting to zero. Defaulting would make every
    // caller that omits the count look like the customer's first ride — which
    // is exactly what a future caller wiring this up incorrectly would do, and
    // it would hand out the discount for ever. This guard survived the first
    // mutation run because every other test supplies the count.
    const customerId = await anAcquiredCustomer();
    const promotions = new PromotionsService(
      prisma,
      { record: () => Promise.resolve(undefined) } as unknown as AuditService,
      { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus,
      { credit: () => Promise.resolve(undefined) } as never,
    );

    const withoutCount = await promotions.previewPromotion({
      userId: customerId,
      domain: PromotionDomain.RIDE,
      subtotal: FARE,
      eligibility: { isReferral: true },
    });

    expect(withoutCount.discounts.find((d) => d.promotionId === INCENTIVE_ID)).toBeUndefined();
  });

  it('never marks the acquisition qualified or pays the promoter', async () => {
    if (!databaseAvailable) return;
    // The discount is a customer acquisition cost, not a promoter reward. It
    // must not touch the reward lifecycle at all.
    const customerId = await anAcquiredCustomer();

    const estimate = await quote(customerId);
    expect(estimate.promoDiscount).toBe(FARE * 0.2);

    const row = await prisma.referralRedemption.findUniqueOrThrow({
      where: { refereeUserId: customerId },
    });
    expect(row.status).toBe('PENDING');
    expect(row.qualifiedAt).toBeNull();
    expect(row.referrerRewardAmount).toBeNull();
    expect(row.referrerRewardPoints).toBeNull();
    expect(row.paidAt).toBeNull();
  });
});
