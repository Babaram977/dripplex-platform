import { randomUUID } from 'node:crypto';

import {
  DriverStatus,
  KycVerificationStatus,
  PrismaClient,
  ReferralRefereeType,
  RideStatus,
  RideType,
} from '@prisma/client';

import { ReferralQualificationService } from './referral-qualification.service';

import type { PrismaService } from '../prisma/prisma.service';
import type { ReferralProgramme } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DRIVER joins the Referral Programmes desk — founder ruling, 2026-09-18.
 *
 * Two things this pins, and they pull in opposite directions on purpose:
 *
 *  - THE PROGRAMME EXISTS AND IS PRICED BY OPERATIONS, NOT BY THIS REPOSITORY.
 *    The founder's instruction was to add drivers "and do not always specify
 *    commission, give it an option to work with adjustable values". So the row
 *    ships INACTIVE with the table's defaults behind an off switch, and the
 *    console — where every field is already editable — is where it gets its
 *    amounts. An inactive programme qualifies nobody, which is what makes
 *    shipping it unpriced safe rather than merely undecided.
 *
 *  - THE MILESTONE IS THE SAME SHAPE AS THE OTHER THREE. Approved by DrippleX,
 *    and a first completed trip. Signing up as a driver proves nothing, and an
 *    approved driver who never switches on has earned DrippleX nothing to pay
 *    the reward out of.
 */
describe('DRIVER referral programme', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let qualification: ReferralQualificationService;
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
    }
    qualification = new ReferralQualificationService(prisma);
  });

  afterAll(async () => {
    if (databaseAvailable && createdUserIds.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  /** The DRIVER programme as the migration wrote it, or a stand-in carrying the
   * same settings when this spec runs without a database. */
  function programme(over: Partial<ReferralProgramme> = {}): ReferralProgramme {
    return {
      id: randomUUID(),
      refereeType: ReferralRefereeType.DRIVER,
      requireKycVerified: false,
      active: false,
      ...over,
    } as ReferralProgramme;
  }

  async function aDriver(over: { status?: DriverStatus } = {}): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `driver-ref-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'Tunde',
        lastName: 'Referred',
      },
    });
    createdUserIds.push(user.id);
    if (over.status !== undefined) {
      await prisma.driverProfile.create({
        data: { userId: user.id, status: over.status },
      });
    }
    return user.id;
  }

  describe('the programme row', () => {
    it('exists, so the desk can show drivers at all', async () => {
      if (!databaseAvailable) return;
      const row = await prisma.referralProgramme.findUnique({
        where: { refereeType: ReferralRefereeType.DRIVER },
      });
      expect(row).not.toBeNull();
    });

    it('ships INACTIVE, so no driver referral is priced before Operations sets it', async () => {
      if (!databaseAvailable) return;
      const row = await prisma.referralProgramme.findUnique({
        where: { refereeType: ReferralRefereeType.DRIVER },
      });
      // The whole safety argument for shipping without a founder-set amount.
      // If this ever ships active, the column defaults become a rate nobody
      // chose — which is exactly what "do not specify the commission" forbids.
      expect(row?.active).toBe(false);
    });

    it('leaves the three existing programmes exactly as they were', async () => {
      if (!databaseAvailable) return;
      const rows = await prisma.referralProgramme.findMany({
        where: { refereeType: { not: ReferralRefereeType.DRIVER } },
        orderBy: { refereeType: 'asc' },
      });
      // Adding a programme must not reprice the others. CUSTOMER's 150/150 is a
      // founder ruling of 2026-09-13 and FLEET's referee 0 is deliberate.
      const byType = Object.fromEntries(
        rows.map((r) => [
          r.refereeType,
          [Number(r.referrerRewardAmount), Number(r.refereeRewardAmount)],
        ]),
      );
      expect(byType['CUSTOMER']).toEqual([150, 150]);
      expect(byType['MERCHANT']).toEqual([350, 350]);
      expect(byType['FLEET']).toEqual([2500, 0]);
    });
  });

  describe('the milestone', () => {
    it('does not qualify somebody who never applied to drive', async () => {
      if (!databaseAvailable) return;
      const userId = await aDriver();
      const result = await qualification.evaluate(userId, programme());
      expect(result.qualified).toBe(false);
      expect(result.outstanding).toContain('not started a driver application');
    });

    it('does not qualify a driver DrippleX has not approved', async () => {
      if (!databaseAvailable) return;
      const userId = await aDriver({ status: DriverStatus.PENDING });
      const result = await qualification.evaluate(userId, programme());
      expect(result.qualified).toBe(false);
      expect(result.outstanding).toContain('not been approved');
    });

    it('does not qualify an approved driver who has never completed a trip', async () => {
      if (!databaseAvailable) return;
      const userId = await aDriver({ status: DriverStatus.APPROVED });
      const result = await qualification.evaluate(userId, programme());
      // Approval alone is not the milestone. A driver can be approved and never
      // switch on, and that is the case the milestone exists to keep off payroll.
      expect(result.qualified).toBe(false);
      expect(result.outstanding).toContain('not completed their first trip');
    });

    it('qualifies an approved driver on their first completed trip', async () => {
      if (!databaseAvailable) return;
      const userId = await aDriver({ status: DriverStatus.APPROVED });
      const customerId = await aDriver();
      await prisma.ride.create({
        data: {
          customerId,
          driverId: userId,
          status: RideStatus.COMPLETED,
          rideType: RideType.ECONOMY,
          pickupAddress: 'Ikeja',
          dropoffAddress: 'Yaba',
          pickupLatitude: 6.6,
          pickupLongitude: 3.35,
          dropoffLatitude: 6.51,
          dropoffLongitude: 3.38,
        },
      });
      const result = await qualification.evaluate(userId, programme());
      expect(result.qualified).toBe(true);
    });

    it('does not count a trip that was not completed', async () => {
      if (!databaseAvailable) return;
      const userId = await aDriver({ status: DriverStatus.APPROVED });
      const customerId = await aDriver();
      await prisma.ride.create({
        data: {
          customerId,
          driverId: userId,
          status: RideStatus.CANCELLED,
          rideType: RideType.ECONOMY,
          pickupAddress: 'Ikeja',
          dropoffAddress: 'Yaba',
          pickupLatitude: 6.6,
          pickupLongitude: 3.35,
          dropoffLatitude: 6.51,
          dropoffLongitude: 3.38,
        },
      });
      const result = await qualification.evaluate(userId, programme());
      // A cancelled trip is not a fare, so there is nothing to pay the reward
      // out of.
      expect(result.qualified).toBe(false);
      expect(result.outstanding).toContain('not completed their first trip');
    });

    it('reads DriverKyc, never CustomerKyc, when the programme requires verification', async () => {
      if (!databaseAvailable) return;
      const userId = await aDriver({ status: DriverStatus.APPROVED });
      const customerId = await aDriver();
      await prisma.ride.create({
        data: {
          customerId,
          driverId: userId,
          status: RideStatus.COMPLETED,
          rideType: RideType.ECONOMY,
          pickupAddress: 'Ikeja',
          dropoffAddress: 'Yaba',
          pickupLatitude: 6.6,
          pickupLongitude: 3.35,
          dropoffLatitude: 6.51,
          dropoffLongitude: 3.38,
        },
      });
      // Verified as a CUSTOMER. The two are separate models by founder decision,
      // and a driver who verified as a customer has not verified as a driver.
      await prisma.customerKyc.create({ data: { userId, status: 'VERIFIED' } });

      const gated = await qualification.evaluate(userId, programme({ requireKycVerified: true }));
      expect(gated.qualified).toBe(false);
      expect(gated.outstanding).toContain('no verified KYC document');

      await prisma.driverKyc.create({
        data: {
          driverId: userId,
          documentType: 'DRIVER_LICENSE',
          documentNumber: 'DL-000111',
          frontImage: 'https://example.test/front.jpg',
          verificationStatus: KycVerificationStatus.VERIFIED,
        },
      });
      const passed = await qualification.evaluate(userId, programme({ requireKycVerified: true }));
      expect(passed.qualified).toBe(true);
    });
  });
});
