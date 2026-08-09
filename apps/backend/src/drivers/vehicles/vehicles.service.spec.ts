import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';
import { StorageAssetService } from '../../uploads/storage-asset.service';

import { VehiclesService } from './vehicles.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('VehiclesService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: VehiclesService;
  let driverId: string;
  let otherDriverId: string;
  let adminId: string;
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
    // Storage unconfigured in this real-DB test: ownership checks are no-ops.
    const storageAssets = new StorageAssetService(
      { objectStorageConfigured: false } as unknown as AppConfigService,
      { createPresignedPutUrl: jest.fn(), createPresignedGetUrl: jest.fn() },
    );
    service = new VehiclesService(prisma, auditService, storageAssets);

    const driver = await prisma.user.create({
      data: {
        email: `vehicles-test-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    await prisma.driverProfile.create({ data: { userId: driver.id } });

    const otherDriver = await prisma.user.create({
      data: {
        email: `vehicles-test-other-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Other',
        lastName: 'Driver',
      },
    });
    otherDriverId = otherDriver.id;
    await prisma.driverProfile.create({ data: { userId: otherDriver.id } });

    const admin = await prisma.user.create({
      data: {
        email: `vehicles-test-admin-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Admin',
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: otherDriverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates a vehicle in PENDING status, uppercasing the plate number', async () => {
    if (!databaseAvailable) return;

    const vehicle = await service.createVehicle(
      driverId,
      {
        plateNumber: `abc-${randomUUID().slice(0, 6)}`,
        make: 'Toyota',
        model: 'Corolla',
        color: 'Blue',
        year: 2020,
        rideCategory: 'ECONOMY',
        seats: 4,
      },
      context,
    );

    expect(vehicle.driverId).toBe(driverId);
    expect(vehicle.approvalStatus).toBe('PENDING');
    expect(vehicle.plateNumber).toBe(vehicle.plateNumber.toUpperCase());
    // DPX-DRIVER-017 — passenger capacity is persisted and returned.
    expect(vehicle.seats).toBe(4);
  });

  it('(DPX-STORAGE-001 D) rejects photos that are foreign / cross-user URLs', async () => {
    if (!databaseAvailable) return;
    // A vehicles service wired with configured storage so the ownership guard runs.
    const guarded = new VehiclesService(
      prisma,
      new AuditService({ create: jest.fn().mockResolvedValue(undefined) }),
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
      guarded.createVehicle(
        driverId,
        {
          plateNumber: `evil-${randomUUID().slice(0, 6)}`,
          make: 'Toyota',
          model: 'Corolla',
          color: 'Blue',
          year: 2020,
          rideCategory: 'ECONOMY',
          seats: 4,
          photos: ['https://evil.example.com/vehicle-photos/other/car.jpg'],
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenDomainException);
  });

  it('rejects a duplicate plate number', async () => {
    if (!databaseAvailable) return;
    const plateNumber = `dup-${randomUUID().slice(0, 6)}`;

    await service.createVehicle(
      driverId,
      {
        plateNumber,
        make: 'Honda',
        model: 'Civic',
        color: 'Red',
        year: 2019,
        rideCategory: 'ECONOMY',
        seats: 4,
      },
      context,
    );

    await expect(
      service.createVehicle(
        otherDriverId,
        {
          plateNumber,
          make: 'Honda',
          model: 'Civic',
          color: 'Red',
          year: 2019,
          rideCategory: 'ECONOMY',
          seats: 4,
        },
        context,
      ),
    ).rejects.toThrow('already registered');
  });

  it("blocks a driver from reading another driver's vehicle", async () => {
    if (!databaseAvailable) return;

    const vehicle = await service.createVehicle(
      otherDriverId,
      {
        plateNumber: `own-${randomUUID().slice(0, 6)}`,
        make: 'Kia',
        model: 'Rio',
        color: 'Black',
        year: 2021,
        rideCategory: 'ECONOMY',
        seats: 4,
      },
      context,
    );

    await expect(service.getOwnVehicle(driverId, vehicle.id)).rejects.toThrow(
      'You do not have access to this vehicle',
    );
  });

  it('re-review: changing make/model resets an approved vehicle back to PENDING', async () => {
    if (!databaseAvailable) return;

    const vehicle = await service.createVehicle(
      driverId,
      {
        plateNumber: `rev-${randomUUID().slice(0, 6)}`,
        make: 'Ford',
        model: 'Focus',
        color: 'White',
        year: 2018,
        rideCategory: 'ECONOMY',
        seats: 4,
      },
      context,
    );
    await service.approveVehicle(vehicle.id, adminId, context);

    const updated = await service.updateOwnVehicle(
      driverId,
      vehicle.id,
      { make: 'Ford (updated)' },
      context,
    );

    expect(updated.approvalStatus).toBe('PENDING');
    expect(updated.approvedAt).toBeNull();
  });

  it('does not reset approval when only isActive/photos change', async () => {
    if (!databaseAvailable) return;

    const vehicle = await service.createVehicle(
      driverId,
      {
        plateNumber: `noreset-${randomUUID().slice(0, 6)}`,
        make: 'Mazda',
        model: '3',
        color: 'Grey',
        year: 2022,
        rideCategory: 'ECONOMY',
        seats: 4,
      },
      context,
    );
    await service.approveVehicle(vehicle.id, adminId, context);

    const updated = await service.updateOwnVehicle(
      driverId,
      vehicle.id,
      { isActive: false },
      context,
    );

    expect(updated.approvalStatus).toBe('APPROVED');
    expect(updated.isActive).toBe(false);
  });

  it('approves and rejects vehicles as admin', async () => {
    if (!databaseAvailable) return;

    const vehicle = await service.createVehicle(
      driverId,
      {
        plateNumber: `adm-${randomUUID().slice(0, 6)}`,
        make: 'Nissan',
        model: 'Altima',
        color: 'Silver',
        year: 2020,
        rideCategory: 'COMFORT',
        seats: 4,
      },
      context,
    );

    const rejected = await service.rejectVehicle(vehicle.id, adminId, 'Blurry photos', context);
    expect(rejected.approvalStatus).toBe('REJECTED');
    expect(rejected.rejectedReason).toBe('Blurry photos');

    const approved = await service.approveVehicle(vehicle.id, adminId, context);
    expect(approved.approvalStatus).toBe('APPROVED');
    expect(approved.approvedBy).toBe(adminId);
    expect(approved.rejectedReason).toBeNull();
  });

  it('lists vehicles filtered by approval status', async () => {
    if (!databaseAvailable) return;

    const result = await service.listVehicles({ page: 1, limit: 100, approvalStatus: 'APPROVED' });
    expect(result.items.every((v) => v.approvalStatus === 'APPROVED')).toBe(true);
  });
});
