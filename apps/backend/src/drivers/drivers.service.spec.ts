import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { DriverActivationService } from './activation/driver-activation.service';
import { DriversService } from './drivers.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
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
      sendPhoneOtp: jest.fn(),
      notifyMerchantLifecycle: jest.fn(),
      notifyOrderCreated: jest.fn(),
      notifyOrderLifecycle: jest.fn(),
      notifyPaymentResult: jest.fn(),
      notifyDeliveryLifecycle: jest.fn(),
      notifyDriverLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRideLifecycle: jest.fn(),
      notifyRideEarning: jest.fn(),
    };
    const activationService = new DriverActivationService(prisma);
    service = new DriversService(prisma, auditService, notifications, activationService);

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
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.inspection.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.vehicle.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.inspectionCentre.delete({ where: { id: centreId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
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

    const approval = await service.approveDriver(driverId, adminId, context);

    expect(approval.status).toBe('APPROVED');
    expect(approval.approvedBy).toBe(adminId);
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
});
