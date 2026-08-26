import { randomUUID } from 'node:crypto';

import { KycDocumentType, KycVerificationStatus, PrismaClient, RiderStatus } from '@prisma/client';

import { MAX_RIDER_ACTIVE_JOBS } from '../delivery.constants';

import { PrismaDeliveryRepository } from './prisma-delivery.repository';

import type { PrismaService } from '../../prisma/prisma.service';

/**
 * DPX-RIDER-004 — who dispatch is allowed to offer a delivery to.
 *
 * The eligibility rule lives entirely in a Prisma `where`, so a mocked
 * repository cannot prove it. These run against a real Postgres and skip
 * (rather than fail) when none is configured, matching the convention in
 * rides.service.spec.ts.
 *
 * The rule: online + accepting + under the job cap, AND the rider is APPROVED,
 * AND every document in REQUIRED_RIDER_KYC_DOCUMENT_TYPES is VERIFIED. Before
 * this, availability alone was enough — approving a rider gated nothing.
 */
describe('PrismaDeliveryRepository.listAvailableRiders eligibility', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let repository: PrismaDeliveryRepository;
  let databaseAvailable = false;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }
    repository = new PrismaDeliveryRepository(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (databaseAvailable && createdUserIds.length > 0) {
      // RiderProfile / RiderKyc / RiderAvailability all cascade from User.
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  /** A rider with the given approval state, documents and availability. */
  const makeRider = async (options: {
    status: RiderStatus;
    isApproved: boolean;
    verifiedDocumentTypes: KycDocumentType[];
    pendingDocumentTypes?: KycDocumentType[];
    online?: boolean;
    acceptingOrders?: boolean;
    activeJobCount?: number;
  }): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `rider-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'Sani',
        lastName: 'Tunde',
      },
    });
    createdUserIds.push(user.id);

    await prisma.riderProfile.create({
      data: { userId: user.id, status: options.status, isApproved: options.isApproved },
    });

    for (const documentType of options.verifiedDocumentTypes) {
      await prisma.riderKyc.create({
        data: {
          riderId: user.id,
          documentType,
          documentNumber: `DOC-${randomUUID().slice(0, 8)}`,
          frontImage: 'https://cdn.example/doc.jpg',
          verificationStatus: KycVerificationStatus.VERIFIED,
        },
      });
    }
    for (const documentType of options.pendingDocumentTypes ?? []) {
      await prisma.riderKyc.create({
        data: {
          riderId: user.id,
          documentType,
          documentNumber: `DOC-${randomUUID().slice(0, 8)}`,
          frontImage: 'https://cdn.example/doc.jpg',
          verificationStatus: KycVerificationStatus.PENDING,
        },
      });
    }

    await prisma.riderAvailability.create({
      data: {
        riderId: user.id,
        online: options.online ?? true,
        acceptingOrders: options.acceptingOrders ?? true,
        latitude: 6.53,
        longitude: 3.38,
        activeJobCount: options.activeJobCount ?? 0,
      },
    });

    return user.id;
  };

  const eligibleIds = async (): Promise<string[]> =>
    (await repository.listAvailableCouriers(MAX_RIDER_ACTIVE_JOBS)).map((row) => row.userId);

  const bothDocuments = [KycDocumentType.NATIONAL_ID, KycDocumentType.GUARANTOR_ID];

  it('offers deliveries to an approved rider with every required document verified', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      status: RiderStatus.APPROVED,
      isApproved: true,
      verifiedDocumentTypes: bothDocuments,
    });

    expect(await eligibleIds()).toContain(riderId);
  });

  it('never offers a delivery to an unapproved rider, even when they are online', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      status: RiderStatus.PENDING,
      isApproved: false,
      verifiedDocumentTypes: bothDocuments,
    });

    expect(await eligibleIds()).not.toContain(riderId);
  });

  it('never offers a delivery to a suspended rider', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      status: RiderStatus.SUSPENDED,
      isApproved: false,
      verifiedDocumentTypes: bothDocuments,
    });

    expect(await eligibleIds()).not.toContain(riderId);
  });

  it('excludes an approved rider whose guarantor ID is still pending review', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      status: RiderStatus.APPROVED,
      isApproved: true,
      verifiedDocumentTypes: [KycDocumentType.NATIONAL_ID],
      pendingDocumentTypes: [KycDocumentType.GUARANTOR_ID],
    });

    expect(await eligibleIds()).not.toContain(riderId);
  });

  it('excludes an approved rider who submitted no documents at all', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      status: RiderStatus.APPROVED,
      isApproved: true,
      verifiedDocumentTypes: [],
    });

    expect(await eligibleIds()).not.toContain(riderId);
  });

  it('still respects availability: an offline but fully approved rider is skipped', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      status: RiderStatus.APPROVED,
      isApproved: true,
      verifiedDocumentTypes: bothDocuments,
      online: false,
    });

    expect(await eligibleIds()).not.toContain(riderId);
  });

  it('still respects the active-job cap', async () => {
    if (!databaseAvailable) return;
    const riderId = await makeRider({
      status: RiderStatus.APPROVED,
      isApproved: true,
      verifiedDocumentTypes: bothDocuments,
      activeJobCount: MAX_RIDER_ACTIVE_JOBS,
    });

    expect(await eligibleIds()).not.toContain(riderId);
  });
});
