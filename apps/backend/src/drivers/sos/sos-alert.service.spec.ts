import { randomUUID } from 'node:crypto';

import { PrismaClient, RideStatus, RideType, VehicleApprovalStatus } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';

import { SosAlertService } from './sos-alert.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../../notification-center/notification-center.service';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('SosAlertService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: SosAlertService;
  let notificationCenter: jest.Mocked<Pick<NotificationCenterService, 'send' | 'broadcast'>>;
  let driverId: string;
  let customerId: string;
  let adminId: string;
  let opsUserId: string;
  let opsRoleId: string;
  let permissionId: string;
  let rideIds: string[] = [];
  let vehicleIds: string[] = [];

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
    notificationCenter = {
      send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
      broadcast: jest.fn().mockResolvedValue({ notificationIds: [], requested: 0, sent: 0 }),
    };
    service = new SosAlertService(
      prisma,
      auditService,
      notificationCenter as unknown as NotificationCenterService,
    );

    const driver = await prisma.user.create({
      data: {
        email: `sos-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;

    const customer = await prisma.user.create({
      data: {
        email: `sos-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Jane',
        lastName: 'Passenger',
      },
    });
    customerId = customer.id;

    const admin = await prisma.user.create({
      data: {
        email: `sos-admin-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ops',
        lastName: 'Admin',
      },
    });
    adminId = admin.id;

    // A real ops user, real role, real permission, real grant — so
    // notifyOperations()'s Prisma-driven recipient query is exercised for
    // real rather than mocked out.
    const opsUser = await prisma.user.create({
      data: {
        email: `sos-ops-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Sos',
        lastName: 'Responder',
      },
    });
    opsUserId = opsUser.id;

    const permission = await prisma.permission.upsert({
      where: { code: 'admin:drivers:sos-alert:manage' },
      update: {},
      create: {
        code: 'admin:drivers:sos-alert:manage',
        description: 'View and acknowledge/resolve the driver SOS/emergency alert queue',
      },
    });
    permissionId = permission.id;

    const role = await prisma.role.create({
      data: { name: `sos-responder-${randomUUID()}`, description: 'Test-only SOS responder role' },
    });
    opsRoleId = role.id;

    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    await prisma.userRole.create({ data: { userId: opsUser.id, roleId: role.id } });
  });

  afterEach(async () => {
    if (databaseAvailable) {
      notificationCenter.send.mockClear();
      notificationCenter.broadcast.mockClear();
      if (rideIds.length > 0) {
        await prisma.ride.deleteMany({ where: { id: { in: rideIds } } }).catch(() => undefined);
        rideIds = [];
      }
      if (vehicleIds.length > 0) {
        await prisma.vehicle
          .deleteMany({ where: { id: { in: vehicleIds } } })
          .catch(() => undefined);
        vehicleIds = [];
      }
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.sosAlert.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.userRole
        .delete({ where: { userId_roleId: { userId: opsUserId, roleId: opsRoleId } } })
        .catch(() => undefined);
      await prisma.rolePermission
        .delete({ where: { roleId_permissionId: { roleId: opsRoleId, permissionId } } })
        .catch(() => undefined);
      await prisma.role.delete({ where: { id: opsRoleId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: opsUserId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('triggers with no active ride/vehicle, broadcasts to ops, no customer notice', async () => {
    if (!databaseAvailable) return;

    const alert = await service.trigger(
      driverId,
      { latitude: 6.5244, longitude: 3.3792, batteryLevel: 42 },
      {},
    );

    expect(alert.driverId).toBe(driverId);
    expect(alert.rideId).toBeNull();
    expect(alert.vehicleId).toBeNull();
    expect(alert.status).toBe('OPEN');
    expect(alert.batteryLevel).toBe(42);
    expect(alert.customerNotifiedAt).toBeNull();
    expect(notificationCenter.send).not.toHaveBeenCalled();
    expect(notificationCenter.broadcast).toHaveBeenCalledTimes(1);
    expect(notificationCenter.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [opsUserId],
        type: 'SOS_ALERT_TRIGGERED',
        priority: 'CRITICAL',
      }),
    );
  });

  it('auto-resolves the active ride and approved vehicle, notifies the customer', async () => {
    if (!databaseAvailable) return;

    const vehicle = await prisma.vehicle.create({
      data: {
        driverId,
        plateNumber: `SOS-${randomUUID().slice(0, 6).toUpperCase()}`,
        make: 'Toyota',
        model: 'Camry',
        color: 'Black',
        year: 2020,
        rideCategory: RideType.ECONOMY,
        isActive: true,
        approvalStatus: VehicleApprovalStatus.APPROVED,
      },
    });
    vehicleIds.push(vehicle.id);

    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        rideType: RideType.ECONOMY,
        status: RideStatus.IN_PROGRESS,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        dropoffLatitude: 6.601,
        dropoffLongitude: 3.3489,
      },
    });
    rideIds.push(ride.id);

    const alert = await service.trigger(driverId, {}, {});

    expect(alert.rideId).toBe(ride.id);
    expect(alert.vehicleId).toBe(vehicle.id);
    expect(alert.customerNotifiedAt).not.toBeNull();
    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: customerId, type: 'SOS_ALERT_CUSTOMER_NOTICE' }),
    );
  });

  it("lists only the calling driver's own alerts", async () => {
    if (!databaseAvailable) return;

    const alerts = await service.listOwnAlerts(driverId);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.driverId === driverId)).toBe(true);
  });

  it('acknowledges then resolves, setting timestamps and notifying the driver each time', async () => {
    if (!databaseAvailable) return;

    const created = await service.trigger(driverId, {}, {});
    notificationCenter.send.mockClear();

    const acknowledged = await service.updateAlert(
      created.id,
      adminId,
      { status: 'ACKNOWLEDGED' },
      {},
    );
    expect(acknowledged.status).toBe('ACKNOWLEDGED');
    expect(acknowledged.acknowledgedBy).toBe(adminId);
    expect(acknowledged.acknowledgedAt).not.toBeNull();

    const resolved = await service.updateAlert(
      created.id,
      adminId,
      { status: 'RESOLVED', adminNotes: 'False alarm, driver confirmed safe.' },
      {},
    );
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).not.toBeNull();
    expect(notificationCenter.send).toHaveBeenCalledTimes(2);
    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: driverId, type: 'SOS_ALERT_UPDATED' }),
    );
  });

  it('filters the admin queue by status', async () => {
    if (!databaseAvailable) return;

    const result = await service.listAlerts({ page: 1, limit: 20, status: 'OPEN' });
    expect(result.items.every((a) => a.status === 'OPEN')).toBe(true);
  });
});
