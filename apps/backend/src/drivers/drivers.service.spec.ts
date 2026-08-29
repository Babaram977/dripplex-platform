import { randomUUID } from 'node:crypto';

import { PrismaClient, RideRatingRole, RideStatus, RideType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { ForbiddenDomainException } from '../common/exceptions/domain.exception';
import { StorageAssetService } from '../uploads/storage-asset.service';

import { DriverActivationService } from './activation/driver-activation.service';
import { DriversService } from './drivers.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { AppConfigService } from '../config/app-config.service';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('DriversService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriversService;
  let driverId: string;
  let adminId: string;
  let centreId: string;
  let customerId: string;
  const rideIds: string[] = [];
  const userIds: string[] = [];
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
    const notifications: jest.Mocked<NotificationService> = {
      sendPasswordReset: jest.fn(),
      sendPasswordChanged: jest.fn(),
      sendEmailVerification: jest.fn(),
      sendEmailOtp: jest.fn(),
      sendPhoneOtp: jest.fn(),
      notifyMerchantLifecycle: jest.fn(),
      notifyOrderCreated: jest.fn(),
      notifyOrderLifecycle: jest.fn(),
      notifyPaymentResult: jest.fn(),
      notifyDeliveryLifecycle: jest.fn(),
      notifyDriverLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRiderLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRideLifecycle: jest.fn(),
      notifyRideEarning: jest.fn(),
    };
    const activationService = new DriverActivationService(prisma);
    // Storage unconfigured in this real-DB test: StorageAssetService behaves as
    // the production dev no-op — ownership passes and URLs round-trip unchanged.
    const storageAssets = new StorageAssetService(
      { objectStorageConfigured: false } as unknown as AppConfigService,
      { createPresignedPutUrl: jest.fn(), createPresignedGetUrl: jest.fn() },
    );
    service = new DriversService(
      prisma,
      auditService,
      notifications,
      activationService,
      storageAssets,
    );

    const driver = await prisma.user.create({
      data: {
        email: `driver-service-test-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    await prisma.driverProfile.create({ data: { userId: driver.id } });

    const admin = await prisma.user.create({
      data: {
        email: `driver-service-admin-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Admin',
      },
    });
    adminId = admin.id;

    const centre = await prisma.inspectionCentre.create({
      data: {
        name: `Drivers Service Test Centre ${randomUUID().slice(0, 6)}`,
        address: '1 Road',
        city: 'Lagos',
      },
    });
    centreId = centre.id;

    const customer = await prisma.user.create({
      data: {
        email: `driver-service-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      if (rideIds.length > 0) {
        await prisma.rideRating
          .deleteMany({ where: { rideId: { in: rideIds } } })
          .catch(() => undefined);
        await prisma.ride.deleteMany({ where: { id: { in: rideIds } } }).catch(() => undefined);
      }
      await prisma.inspection.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.vehicle.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.inspectionCentre.delete({ where: { id: centreId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  /** Satisfies the four DPX-DRIVER-002 Phase 4 activation conditions that
   * `DriversService` itself has no API surface for (identity verification,
   * vehicle+inspection, agreement) — written directly, the same way this
   * suite already seeds KYC/profile rows, so `approveDriver()`/
   * `reactivateDriver()` can be exercised without depending on
   * VehiclesService/InspectionsService/OnboardingService as collaborators. */
  async function satisfyNonKycActivationRequirements(): Promise<void> {
    await prisma.driverProfile.update({
      where: { userId: driverId },
      data: {
        lastIdentityVerifiedAt: new Date(),
        agreementAcceptedAt: new Date(),
        agreementVersion: 'v1',
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        driverId,
        plateNumber: `dsv-${randomUUID().slice(0, 6)}`.toUpperCase(),
        make: 'Toyota',
        model: 'Camry',
        color: 'Black',
        year: 2021,
        rideCategory: 'ECONOMY',
        approvalStatus: 'APPROVED',
      },
    });
    await prisma.inspection.create({
      data: {
        driverId,
        vehicleId: vehicle.id,
        centreId,
        status: 'PASSED',
        scheduledAt: new Date(Date.now() - 3_600_000),
        completedAt: new Date(),
      },
    });
  }

  it('submits a KYC document for a driver with an existing profile', async () => {
    if (!databaseAvailable) return;

    const kyc = await service.submitKyc(
      driverId,
      {
        documentType: 'GUARANTOR_ID',
        documentNumber: 'A1234567',
        frontImage: 'https://example.com/id.jpg',
      },
      context,
    );

    expect(kyc.driverId).toBe(driverId);
    expect(kyc.verificationStatus).toBe('PENDING');
  });

  it('returns the driver their OWN documents with review state, newest first', async () => {
    if (!databaseAvailable) return;
    // Drivers could not read their own submissions, so the app relisted every
    // document as outstanding on every visit — which read as a duplicate
    // upload page to a driver who had already submitted at sign-up.
    await service.submitKyc(
      driverId,
      {
        documentType: 'DRIVER_LICENSE',
        documentNumber: 'LIC-001',
        frontImage: 'https://example.com/licence.jpg',
      },
      context,
    );

    const own = await service.listOwnKyc(driverId);

    expect(own.length).toBeGreaterThan(0);
    expect(own.every((doc) => doc.driverId === driverId)).toBe(true);
    expect(own[0]?.documentType).toBe('DRIVER_LICENSE');
    expect(own[0]?.verificationStatus).toBe('PENDING');
  });

  it('shows a rejected document with the reviewer’s remarks so it can be replaced', async () => {
    if (!databaseAvailable) return;
    const submitted = await service.submitKyc(
      driverId,
      {
        documentType: 'VEHICLE_REGISTRATION',
        documentNumber: 'VR-001',
        frontImage: 'https://example.com/vr.jpg',
      },
      context,
    );
    await service.rejectKyc(submitted.id, adminId, 'Plate number is unreadable', context);

    const own = await service.listOwnKyc(driverId);
    const rejected = own.find((doc) => doc.id === submitted.id);

    expect(rejected?.verificationStatus).toBe('REJECTED');
    expect(rejected?.remarks).toBe('Plate number is unreadable');
  });

  it('(DPX-STORAGE-001 D) rejects a KYC / avatar URL that is foreign or cross-user', async () => {
    if (!databaseAvailable) return;
    // A drivers service wired with configured storage so the ownership guard runs.
    const guarded = new DriversService(
      prisma,
      new AuditService({ create: jest.fn().mockResolvedValue(undefined) }),
      {
        notifyDriverLifecycle: jest.fn().mockResolvedValue(undefined),
        notifyRiderLifecycle: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationService,
      new DriverActivationService(prisma),
      new StorageAssetService(
        {
          objectStorageConfigured: true,
          objectStorageEndpoint: 'https://s3.example.com',
          objectStorageBucket: 'dripplex-assets',
          objectStoragePublicBaseUrl: '',
        } as unknown as AppConfigService,
        {
          createPresignedPutUrl: jest.fn(),
          createPresignedGetUrl: jest.fn(),
        },
      ),
    );

    await expect(
      guarded.submitKyc(
        driverId,
        {
          documentType: 'DRIVER_LICENSE',
          documentNumber: 'FOREIGN-1',
          frontImage: 'https://evil.example.com/kyc-documents/other/id.jpg',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenDomainException);

    await expect(
      guarded.updateOwnProfile(
        driverId,
        { avatarUrl: 'https://evil.example.com/profile-photos/other/a.jpg' },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenDomainException);
  });

  it('rejects approval until all activation requirements (documents, identity, vehicle, inspection, agreement) are met', async () => {
    if (!databaseAvailable) return;

    await expect(service.approveDriver(driverId, adminId, context)).rejects.toThrow(
      'Driver does not meet activation requirements',
    );
  });

  it('rejects approval when only the KYC documents are satisfied — the unified gate also requires identity/vehicle/inspection/agreement', async () => {
    if (!databaseAvailable) return;

    const licenseKyc = await service.submitKyc(
      driverId,
      {
        documentType: 'DRIVER_LICENSE',
        documentNumber: 'L9988',
        frontImage: 'https://example.com/license.jpg',
      },
      context,
    );
    const vehicleKyc = await service.submitKyc(
      driverId,
      {
        documentType: 'VEHICLE_REGISTRATION',
        documentNumber: 'V5566',
        frontImage: 'https://example.com/vehicle.jpg',
      },
      context,
    );
    const profile = await service.getOwnProfile(driverId);
    const guarantorKyc = profile.kyc.find((doc) => doc.documentType === 'GUARANTOR_ID');
    if (!guarantorKyc) {
      throw new Error('expected guarantor ID KYC from the earlier test to exist');
    }

    await service.verifyKyc(licenseKyc.id, adminId, undefined, context);
    await service.verifyKyc(vehicleKyc.id, adminId, undefined, context);
    await service.verifyKyc(guarantorKyc.id, adminId, undefined, context);

    await expect(service.approveDriver(driverId, adminId, context)).rejects.toThrow(
      'Driver does not meet activation requirements',
    );
  });

  it('approves a driver once every DPX-DRIVER-002 Phase 4 activation condition is met', async () => {
    if (!databaseAvailable) return;

    await satisfyNonKycActivationRequirements();

    // DPX-DRIVER-008 — seed a submitted onboarding record so we can assert the
    // driver lifecycle keeps the onboarding state machine in sync.
    const profile = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: driverId } });
    await prisma.driverOnboarding.upsert({
      where: { driverProfileId: profile.id },
      create: { driverProfileId: profile.id, status: 'SUBMITTED' },
      update: { status: 'SUBMITTED' },
    });

    const approval = await service.approveDriver(driverId, adminId, context);

    expect(approval.status).toBe('APPROVED');
    expect(approval.approvedBy).toBe(adminId);

    const onboarding = await prisma.driverOnboarding.findUniqueOrThrow({
      where: { driverProfileId: profile.id },
    });
    expect(onboarding.status).toBe('APPROVED');
  });

  it('rejects approving a driver twice', async () => {
    if (!databaseAvailable) return;

    await expect(service.approveDriver(driverId, adminId, context)).rejects.toThrow(
      'Driver is already approved',
    );
  });

  it('suspends an approved driver and blocks suspending a non-approved one', async () => {
    if (!databaseAvailable) return;

    const suspended = await service.suspendDriver(driverId, adminId, 'Customer complaint', context);
    expect(suspended.status).toBe('SUSPENDED');

    await expect(
      service.suspendDriver(driverId, adminId, 'Another reason', context),
    ).rejects.toThrow('Only approved drivers can be suspended');
  });

  it('reactivates a suspended driver and blocks reactivating a non-suspended one', async () => {
    if (!databaseAvailable) return;

    const reactivated = await service.reactivateDriver(driverId, adminId, context);
    expect(reactivated.status).toBe('APPROVED');

    await expect(service.reactivateDriver(driverId, adminId, context)).rejects.toThrow(
      'Only suspended drivers can be reactivated',
    );
  });

  it('rejects a KYC document with remarks', async () => {
    if (!databaseAvailable) return;

    const kyc = await service.submitKyc(
      driverId,
      {
        documentType: 'DRIVER_LICENSE',
        documentNumber: 'EXPIRED-1',
        frontImage: 'https://example.com/x.jpg',
      },
      context,
    );

    const rejected = await service.rejectKyc(kyc.id, adminId, 'Document expired', context);

    expect(rejected.verificationStatus).toBe('REJECTED');
    expect(rejected.remarks).toBe('Document expired');
  });

  it('throws for an unknown driver profile', async () => {
    if (!databaseAvailable) return;

    await expect(service.getDriverProfile(randomUUID())).rejects.toThrow(
      'Driver profile not found',
    );
  });

  describe('updateOwnProfile', () => {
    it('updates name and the new Slice 2 item 9 profile fields together', async () => {
      if (!databaseAvailable) return;

      const updated = await service.updateOwnProfile(
        driverId,
        {
          firstName: 'Ada',
          lastName: 'Lovelace',
          avatarUrl: 'https://example.com/avatar.jpg',
          languagesSpoken: ['English', 'Yoruba'],
          preferredServiceAreas: ['Lekki', 'Ikeja'],
          drivingExperienceYears: 5,
        },
        context,
      );

      expect(updated.firstName).toBe('Ada');
      expect(updated.lastName).toBe('Lovelace');
      expect(updated.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(updated.languagesSpoken).toEqual(['English', 'Yoruba']);
      expect(updated.preferredServiceAreas).toEqual(['Lekki', 'Ikeja']);
      expect(updated.drivingExperienceYears).toBe(5);
    });

    it('leaves fields untouched when a partial update omits them', async () => {
      if (!databaseAvailable) return;

      const updated = await service.updateOwnProfile(
        driverId,
        { drivingExperienceYears: 7 },
        context,
      );

      // firstName/lastName from the previous test are untouched.
      expect(updated.firstName).toBe('Ada');
      expect(updated.lastName).toBe('Lovelace');
      expect(updated.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(updated.drivingExperienceYears).toBe(7);
    });

    it('rejects updating an unknown driver profile', async () => {
      if (!databaseAvailable) return;

      await expect(
        service.updateOwnProfile(randomUUID(), { firstName: 'Ghost' }, context),
      ).rejects.toThrow('Driver profile not found');
    });
  });

  describe('getOwnPerformanceStats', () => {
    it('returns zero trips and no rating for a driver with no completed rides', async () => {
      if (!databaseAvailable) return;

      const stats = await service.getOwnPerformanceStats(driverId);

      expect(stats.completedTrips).toBe(0);
      expect(stats.averageRating).toBeNull();
      expect(stats.ratingCount).toBe(0);
    });

    it('computes completed-trip count and average customer rating from Ride/RideRating', async () => {
      if (!databaseAvailable) return;

      function baseRideData(status: RideStatus): Parameters<typeof prisma.ride.create>[0]['data'] {
        return {
          customerId,
          driverId,
          rideType: RideType.ECONOMY,
          status,
          pickupLatitude: 6.5244,
          pickupLongitude: 3.3792,
          dropoffLatitude: 6.601,
          dropoffLongitude: 3.3489,
        };
      }

      const completedRideOne = await prisma.ride.create({
        data: baseRideData(RideStatus.COMPLETED),
      });
      const completedRideTwo = await prisma.ride.create({
        data: baseRideData(RideStatus.COMPLETED),
      });
      const ongoingRide = await prisma.ride.create({
        data: baseRideData(RideStatus.IN_PROGRESS),
      });
      rideIds.push(completedRideOne.id, completedRideTwo.id, ongoingRide.id);

      await prisma.rideRating.create({
        data: {
          rideId: completedRideOne.id,
          raterId: customerId,
          rateeId: driverId,
          raterRole: RideRatingRole.CUSTOMER,
          rating: 5,
        },
      });
      await prisma.rideRating.create({
        data: {
          rideId: completedRideTwo.id,
          raterId: customerId,
          rateeId: driverId,
          raterRole: RideRatingRole.CUSTOMER,
          rating: 4,
        },
      });
      // A driver->customer rating must not count toward the driver's own average.
      await prisma.rideRating.create({
        data: {
          rideId: completedRideOne.id,
          raterId: driverId,
          rateeId: customerId,
          raterRole: RideRatingRole.DRIVER,
          rating: 1,
        },
      });

      const stats = await service.getOwnPerformanceStats(driverId);

      expect(stats.completedTrips).toBe(2);
      expect(stats.averageRating).toBe(4.5);
      expect(stats.ratingCount).toBe(2);
    });
  });

  // DPX-REVIEWS-001 — public driver rating. Uses a fresh driver per test so
  // ratings left on the shared `driverId` by other tests don't interfere.
  describe('getPublicDriverRating', () => {
    async function freshDriver(): Promise<string> {
      const user = await prisma.user.create({
        data: {
          email: `public-rating-driver-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Rated',
          lastName: 'Driver',
        },
      });
      userIds.push(user.id);
      return user.id;
    }

    it('returns a zero/empty summary for an unrated driver', async () => {
      if (!databaseAvailable) return;

      const rating = await service.getPublicDriverRating(await freshDriver());

      expect(rating).toEqual({ average: 0, count: 0 });
    });

    it('computes the aggregate from customer→driver ratings only', async () => {
      if (!databaseAvailable) return;

      const ratedDriver = await freshDriver();
      const ride = await prisma.ride.create({
        data: {
          customerId,
          driverId: ratedDriver,
          rideType: RideType.ECONOMY,
          status: RideStatus.COMPLETED,
          pickupLatitude: 6.5244,
          pickupLongitude: 3.3792,
          dropoffLatitude: 6.601,
          dropoffLongitude: 3.3489,
        },
      });
      rideIds.push(ride.id);

      await prisma.rideRating.create({
        data: {
          rideId: ride.id,
          raterId: customerId,
          rateeId: ratedDriver,
          raterRole: RideRatingRole.CUSTOMER,
          rating: 4,
        },
      });
      // A driver→customer rating must not affect the driver's public rating.
      await prisma.rideRating.create({
        data: {
          rideId: ride.id,
          raterId: ratedDriver,
          rateeId: customerId,
          raterRole: RideRatingRole.DRIVER,
          rating: 1,
        },
      });

      const rating = await service.getPublicDriverRating(ratedDriver);

      expect(rating).toEqual({ average: 4, count: 1 });
    });
  });
  describe('listDrivers', () => {
    /**
     * The dinner bug, 2026-08-29. An operator deleted a driver, the roster kept
     * showing him, so they pressed delete again and got "This account has
     * already been deleted" — which reads as the system refusing. The first
     * delete had worked all along; the roster simply ignored `deletedAt`.
     */
    it('drops a driver from the roster once the account is deleted', async () => {
      if (!databaseAvailable) return;

      const ghost = await prisma.user.create({
        data: {
          email: `driver-service-ghost-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Deleted',
          lastName: 'Driver',
        },
      });
      userIds.push(ghost.id);
      await prisma.driverProfile.create({ data: { userId: ghost.id } });

      const before = await service.listDrivers({ page: 1, limit: 200 });
      expect(before.items.some((item) => item.driverId === ghost.id)).toBe(true);

      // Exactly what AccountDeletionService stamps on the profile.
      await prisma.driverProfile.update({
        where: { userId: ghost.id },
        data: { deletedAt: new Date() },
      });

      const after = await service.listDrivers({ page: 1, limit: 200 });
      expect(after.items.some((item) => item.driverId === ghost.id)).toBe(false);
      // The count drives pagination, so it has to agree with the rows.
      expect(after.meta.total).toBe(before.meta.total - 1);
    });

    /**
     * The deletedAt filter is ANDed with the status filter, so this guards the
     * other direction: that adding it did not quietly narrow a status query.
     * Uses its own driver — the suite's shared one is approved, suspended and
     * reactivated by earlier tests, so its status is not PENDING by now.
     */
    it('still lists a live driver when filtering by status', async () => {
      if (!databaseAvailable) return;

      const pending = await prisma.user.create({
        data: {
          email: `driver-service-pending-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Pending',
          lastName: 'Driver',
        },
      });
      userIds.push(pending.id);
      await prisma.driverProfile.create({ data: { userId: pending.id } });

      const live = await service.listDrivers({ page: 1, limit: 200, status: 'PENDING' });

      expect(live.items.some((item) => item.driverId === pending.id)).toBe(true);
    });
  });
});
