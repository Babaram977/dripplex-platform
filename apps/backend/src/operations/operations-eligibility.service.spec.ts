import { randomUUID } from 'node:crypto';

import {
  KycDocumentType,
  KycVerificationStatus,
  PrismaClient,
  RideType,
  RiderStatus,
} from '@prisma/client';

import { OperationsEligibilityService } from './operations-eligibility.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * The panel exists to answer one live question: a rider is online, an order is
 * ready, and nothing is being assigned — why?
 *
 * The gates it reports are the ones `listAvailableRiders` and the ride
 * dispatcher already apply. What is pinned here is that a FAILING gate is
 * named specifically enough to act on, because "not eligible" is what the
 * platform already said and it is why this was debugged by reading source.
 */
describe('OperationsEligibilityService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsEligibilityService;
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
    service = new OperationsEligibilityService(prisma);
  });

  afterAll(async () => {
    if (databaseAvailable && createdUserIds.length > 0) {
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  /** An approved rider, online and accepting, with a position — everything
   *  except whatever the test then breaks. */
  const makeRider = async (options: {
    verifiedDocuments: KycDocumentType[];
    online?: boolean;
    withPosition?: boolean;
  }): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `elig-rider-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'Tunde',
        lastName: 'Baba',
        // From the uuid rather than random(), so a failing run repeats.
        phone: `0700${randomUUID().replace(/\D/g, '').padEnd(7, '0').slice(0, 7)}`,
      },
    });
    createdUserIds.push(user.id);
    await prisma.riderProfile.create({
      data: { userId: user.id, status: RiderStatus.APPROVED, isApproved: true },
    });
    for (const documentType of options.verifiedDocuments) {
      await prisma.riderKyc.create({
        data: {
          riderId: user.id,
          documentType,
          documentNumber: 'X',
          frontImage: 'https://example.test/a.jpg',
          verificationStatus: KycVerificationStatus.VERIFIED,
        },
      });
    }
    await prisma.riderAvailability.create({
      data: {
        riderId: user.id,
        online: options.online ?? true,
        acceptingOrders: true,
        ...(options.withPosition === false ? {} : { latitude: 12.0, longitude: 8.5 }),
      },
    });
    return user.id;
  };

  it('names the document that is blocking a rider, not just "not eligible"', async () => {
    if (!databaseAvailable) return;
    // Approved, online, accepting, positioned — and still invisible to
    // dispatch, because no document was ever verified. This is the shape of
    // the live incident. It used to be pinned on the guarantor ID, which
    // stopped being required on 2026-08-31.
    const riderId = await makeRider({ verifiedDocuments: [] });

    const result = await service.getRiderEligibility(riderId);

    expect(result.dispatchable).toBe(false);
    const kyc = result.gates.find((entry) => entry.key === 'KYC_VERIFIED');
    expect(kyc?.passed).toBe(false);
    // The whole point: an operator can read this and know what to open.
    expect(kyc?.detail).toContain('National ID');
    expect(kyc?.fixableBy).toBe('OPERATIONS');
    // And the gates the rider HAS cleared are not muddled in with it.
    expect(result.gates.find((entry) => entry.key === 'ONLINE')?.passed).toBe(true);
    expect(result.gates.find((entry) => entry.key === 'POSITION_KNOWN')?.passed).toBe(true);
  });

  it('says a rider is dispatchable only when every gate passes', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      verifiedDocuments: [KycDocumentType.NATIONAL_ID],
    });

    const result = await service.getRiderEligibility(riderId);

    expect(result.dispatchable).toBe(true);
    expect(result.gates.every((entry) => entry.passed)).toBe(true);
    expect(result.gates.filter((entry) => entry.detail !== null)).toHaveLength(0);
  });

  it('catches the rider who went online without ever sending a position', async () => {
    if (!databaseAvailable) return;
    // The failure `assignment.service.spec.ts` already pins from the dispatch
    // side: online and accepting, but unplaceable, so findNearestRider returns
    // null and the job is never assigned to anybody.
    const riderId = await makeRider({
      verifiedDocuments: [KycDocumentType.NATIONAL_ID],
      withPosition: false,
    });

    const result = await service.getRiderEligibility(riderId);

    expect(result.dispatchable).toBe(false);
    const position = result.gates.find((entry) => entry.key === 'POSITION_KNOWN');
    expect(position?.passed).toBe(false);
    expect(position?.detail).toContain('location access');
    // Not Operations' to fix — no amount of verifying documents helps here.
    expect(position?.fixableBy).toBe('DRIVER');
  });

  it('reports a signed-off rider as offline rather than as a compliance problem', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      verifiedDocuments: [KycDocumentType.NATIONAL_ID],
      online: false,
    });

    const result = await service.getRiderEligibility(riderId);

    expect(result.gates.find((entry) => entry.key === 'ONLINE')?.passed).toBe(false);
    // The standing gates are still green — an operator must not be sent
    // hunting through KYC for somebody who has simply gone home.
    expect(result.gates.find((entry) => entry.key === 'KYC_VERIFIED')?.passed).toBe(true);
    expect(result.gates.find((entry) => entry.key === 'PROFILE_APPROVED')?.passed).toBe(true);
  });

  it('refuses to invent an answer for somebody who is not a rider', async () => {
    if (!databaseAvailable) return;
    const user = await prisma.user.create({
      data: {
        email: `elig-nonrider-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'Not',
        lastName: 'ARider',
      },
    });
    createdUserIds.push(user.id);

    await expect(service.getRiderEligibility(user.id)).rejects.toThrow();
  });

  it('carries the vehicle so the fleet desk can see what a driver drives', async () => {
    if (!databaseAvailable) return;
    const user = await prisma.user.create({
      data: {
        email: `elig-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'Lawan',
        lastName: 'Sadiq',
      },
    });
    createdUserIds.push(user.id);
    await prisma.driverProfile.create({ data: { userId: user.id, status: 'APPROVED' } });
    await prisma.vehicle.create({
      data: {
        driverId: user.id,
        plateNumber: `ELG-${randomUUID().slice(0, 5)}`.toUpperCase(),
        make: 'Toyota',
        model: 'Corolla',
        color: 'Silver',
        year: 2019,
        rideCategory: RideType.ECONOMY,
      },
    });

    const result = await service.getDriverEligibility(user.id);

    // The founder's second ask, answered by the same query as the first.
    expect(result.vehicle?.make).toBe('Toyota');
    expect(result.vehicle?.model).toBe('Corolla');
    expect(result.vehicle?.colour).toBe('Silver');
    expect(result.vehicle?.rideCategory).toBe(RideType.ECONOMY);
  });
});
