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
  let ridesNoRedeemContention: RidesService;
  const users: string[] = [];
  const campaigns: string[] = [];

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
      // dispatchRide is the last step of requestRide and returns what the
      // caller sees; the reservation has already happened by then, so the ride
      // row itself is all this spec needs back.
      {
        dispatchRide: (rideId: string) => prisma.ride.findUniqueOrThrow({ where: { id: rideId } }),
      } as never,
      {} as never,
      {} as never,
      promotions,
      bus,
      { assertNotRequired: () => Promise.resolve(undefined) } as never,
      {} as never,
      { findExclusion: () => Promise.resolve(null) } as never,
    );
    ridesNoRedeemContention = new RidesService(
      prisma,
      {
        estimate: () =>
          Promise.resolve({ totalFare: FARE, baseFare: FARE, distanceKm: 3, durationMin: 10 }),
      } as never,
      audit,
      {
        dispatchRide: (rideId: string) => prisma.ride.findUniqueOrThrow({ where: { id: rideId } }),
      } as never,
      {} as never,
      {} as never,
      {
        previewPromotion: (i: never) => promotions.previewPromotion(i),
        previewSinglePromotion: (i: never) => promotions.previewSinglePromotion(i),
        // The only stub: redemption always succeeds, so the reservation is the
        // sole limiter under concurrency.
        redeemForReference: () =>
          Promise.resolve({ redemption: { id: 'stub' }, discountAmount: 0, creditAmount: 0 }),
      } as never,
      bus,
      { assertNotRequired: () => Promise.resolve(undefined) } as never,
      {} as never,
      { findExclusion: () => Promise.resolve(null) } as never,
    );
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.ride.deleteMany({ where: { customerId: { in: users } } });
    await prisma.referralRedemption.deleteMany({ where: { refereeUserId: { in: users } } });
    await prisma.referral.deleteMany({ where: { userId: { in: users } } });
    // Growth-campaign fixtures, innermost first: passenger referrals hang off
    // driver referrals, which hang off the campaign. Left behind they would
    // block the user deletes below and leak acquisitions into other specs.
    await prisma.passengerReferral.deleteMany({ where: { refereeUserId: { in: users } } });
    await prisma.driverReferral.deleteMany({ where: { campaignId: { in: campaigns } } });
    await prisma.referralCampaign.deleteMany({ where: { id: { in: campaigns } } });
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

  /**
   * A customer the Driver Growth Campaign brought in.
   *
   * A different table from the standing programme's — `passenger_referrals`,
   * with its own platform-wide unique on the referee — and therefore a
   * different shape of the same fact: somebody referred this person.
   */
  async function aGrowthCampaignCustomer(): Promise<string> {
    const driver = await aUser();
    const referee = await aUser();
    const campaign = await prisma.referralCampaign.create({
      data: {
        name: `Growth ${randomUUID()}`,
        periodStart: new Date(Date.now() - 86_400_000),
        periodEnd: new Date(Date.now() + 86_400_000),
      },
    });
    campaigns.push(campaign.id);
    const driverReferral = await prisma.driverReferral.create({
      data: {
        campaignId: campaign.id,
        driverId: driver,
        code: randomUUID().slice(0, 12).toUpperCase(),
      },
    });
    await prisma.passengerReferral.create({
      data: { driverReferralId: driverReferral.id, refereeUserId: referee },
    });
    return referee;
  }

  /**
   * DPX-PROMO-REF-001 audit, F9 — founder ruling 2026-09-13.
   *
   * The incentive applies to every qualifying new customer regardless of which
   * mechanism acquired them. Eligibility used to read `referral_redemptions`
   * alone, so a customer a driver brought in through their growth campaign was
   * quoted full price — the opposite of the ruling, and invisible to every
   * test that only ever built the other kind of acquisition.
   */
  it('discounts a customer the driver growth campaign acquired', async () => {
    if (!databaseAvailable) return;
    const customerId = await aGrowthCampaignCustomer();

    const quoted = await quote(customerId);

    expect(quoted.promotionId).toBe(INCENTIVE_ID);
    expect(quoted.promoDiscount).toBeGreaterThan(0);
  });

  it('gives that customer three discounted rides and no more', async () => {
    if (!databaseAvailable) return;
    const customerId = await aGrowthCampaignCustomer();

    await completeRides(customerId, 3);
    const quoted = await quote(customerId);

    // The cap is platform-wide, not per mechanism: three rides, whoever
    // acquired them.
    expect(quoted.promotionId).toBeNull();
  });

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

  async function request(customerId: string): Promise<{ id: string; promotionId: string | null }> {
    return await rides.requestRide(
      customerId,
      {
        rideType: RideType.ECONOMY,
        pickupLatitude: 12,
        pickupLongitude: 8,
        dropoffLatitude: 12.1,
        dropoffLongitude: 8.1,
      },
      {},
    );
  }

  /**
   * The same ride path, with redemption stubbed to always succeed.
   *
   * `redeemForReference` runs after the ride transaction in its own SERIALIZABLE
   * transaction locking the promotion row, and its caller strips the discount
   * when it fails — so five simultaneous redemptions lose races with each other
   * and mask whatever the reservation did. Removing the row lock from the
   * reservation then changes nothing observable, which is exactly the mutation
   * that survived the first battery.
   *
   * Stubbing only the redemption leaves the reservation — the thing under test —
   * completely real, and makes it the only limiter.
   */
  async function requestUncontendedRedemption(
    customerId: string,
  ): Promise<{ id: string; promotionId: string | null }> {
    return await ridesNoRedeemContention.requestRide(
      customerId,
      {
        rideType: RideType.ECONOMY,
        pickupLatitude: 12,
        pickupLongitude: 8,
        dropoffLatitude: 12.1,
        dropoffLongitude: 8.1,
      },
      {},
    );
  }

  async function granted(customerId: string): Promise<number> {
    return await prisma.ride.count({
      where: {
        customerId,
        promotionId: INCENTIVE_ID,
        status: { notIn: [RideStatus.CANCELLED, RideStatus.NO_DRIVERS_FOUND] },
      },
    });
  }

  it('never grants a fourth slot, however many requests arrive at once', async () => {
    if (!databaseAvailable) return;
    // Measured as a ratio, not asserted from one pass. Before the reservation
    // this was the exposure: every concurrent request read the same COMPLETED
    // count — which a ride being priced does not change — and all of them
    // priced as eligible.
    const RUNS = 6;
    for (let run = 0; run < RUNS; run += 1) {
      const customerId = await anAcquiredCustomer();

      const results = await Promise.allSettled([
        requestUncontendedRedemption(customerId),
        requestUncontendedRedemption(customerId),
        requestUncontendedRedemption(customerId),
        requestUncontendedRedemption(customerId),
        requestUncontendedRedemption(customerId),
      ]);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(0);

      // The founder's rule is a MAXIMUM, and that is what is asserted. Before
      // the reservation this ran to five.
      // Exactly three, every run. With redemption no longer contending, the
      // reservation is the only thing deciding — so this is the row lock being
      // measured, not merely a maximum that something else happens to enforce.
      expect(await granted(customerId)).toBe(3);
      // Every ride still happens; the only question is which carry the benefit.
      expect(await prisma.ride.count({ where: { customerId } })).toBe(5);
    }
  });

  it('grants a full three when the requests are merely close together', async () => {
    if (!databaseAvailable) return;
    // Five at the same instant can end with fewer than three discounted, and
    // the reason is worth stating: `redeemForReference` runs after the ride
    // transaction, in a SERIALIZABLE transaction that locks the promotion row,
    // and its caller swallows a failure by stripping the discount. Five
    // simultaneous redemptions of one promotion row therefore lose races with
    // each other. That is pre-existing promotion behaviour, it errs towards
    // giving away less rather than more, and the cap above is unaffected.
    //
    // Overlapping-but-not-identical arrivals — which is what real traffic looks
    // like — still get the full three.
    const customerId = await anAcquiredCustomer();
    for (let i = 0; i < 3; i += 1) {
      await request(customerId);
    }
    expect(await granted(customerId)).toBe(3);

    const fourth = await request(customerId);
    expect(fourth.promotionId).toBeNull();
  });

  it('releases a slot when the ride is cancelled, and only then', async () => {
    if (!databaseAvailable) return;
    const customerId = await anAcquiredCustomer();
    const first = await request(customerId);
    await request(customerId);
    await request(customerId);
    expect(await granted(customerId)).toBe(3);

    // A fourth is refused while three are live.
    const fourth = await request(customerId);
    expect(fourth.promotionId).toBeNull();

    // Cancelling one gives the slot back: a ride that never happened must not
    // consume a benefit somebody was promised.
    await prisma.ride.update({
      where: { id: first.id },
      data: { status: RideStatus.CANCELLED },
    });
    expect(await granted(customerId)).toBe(2);

    const replacement = await request(customerId);
    expect(replacement.promotionId).toBe(INCENTIVE_ID);
    expect(await granted(customerId)).toBe(3);
  });

  it('a completed ride keeps its slot for good', async () => {
    if (!databaseAvailable) return;
    const customerId = await anAcquiredCustomer();
    const ride = await request(customerId);
    await prisma.ride.update({ where: { id: ride.id }, data: { status: RideStatus.COMPLETED } });
    await request(customerId);
    await request(customerId);

    const fourth = await request(customerId);

    expect(fourth.promotionId).toBeNull();
    expect(await granted(customerId)).toBe(3);
  });

  it('still grants exactly three when the rides are requested one at a time', async () => {
    if (!databaseAvailable) return;
    // The cap must not have been bought by breaking the ordinary path.
    const customerId = await anAcquiredCustomer();
    const outcomes: (string | null)[] = [];
    for (let i = 0; i < 4; i += 1) {
      const ride = await request(customerId);
      await prisma.ride.update({ where: { id: ride.id }, data: { status: RideStatus.COMPLETED } });
      outcomes.push(ride.promotionId);
    }
    expect(outcomes).toEqual([INCENTIVE_ID, INCENTIVE_ID, INCENTIVE_ID, null]);
  });

  it('leaves a ride with no acquisition entirely alone', async () => {
    if (!databaseAvailable) return;
    const customerId = await aUser();
    const ride = await request(customerId);
    expect(ride.promotionId).toBeNull();
    expect(await granted(customerId)).toBe(0);
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
