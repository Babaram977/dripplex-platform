import { randomUUID } from 'node:crypto';

import {
  DriverSupportCategory,
  DriverSupportTicketStatus,
  IncidentCategory,
  IncidentReportStatus,
  IncidentSeverity,
  OperationsAssigneeRole,
  OperationsLifecycleStatus,
  OperationsPriority,
  PrismaClient,
  SosAlertStatus,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { ConflictDomainException } from '../common/exceptions/domain.exception';
import { IncidentReportService } from '../drivers/incidents/incident-report.service';
import { SosAlertService } from '../drivers/sos/sos-alert.service';
import { DriverSupportService } from '../drivers/support/driver-support.service';

import { INCIDENT_SEVERITY_TO_PRIORITY, OperationsCasesService } from './operations-cases.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OperationsCaseDetailDto } from '@dripplex/types';

describe('INCIDENT_SEVERITY_TO_PRIORITY', () => {
  it('maps every severity onto the matching unified priority', () => {
    expect(INCIDENT_SEVERITY_TO_PRIORITY[IncidentSeverity.CRITICAL]).toBe('CRITICAL');
    expect(INCIDENT_SEVERITY_TO_PRIORITY[IncidentSeverity.HIGH]).toBe('HIGH');
    expect(INCIDENT_SEVERITY_TO_PRIORITY[IncidentSeverity.MEDIUM]).toBe('MEDIUM');
    expect(INCIDENT_SEVERITY_TO_PRIORITY[IncidentSeverity.LOW]).toBe('LOW');
  });
});

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('OperationsCasesService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsCasesService;
  let driverId: string;
  let operatorId: string;
  let supervisorId: string;
  let operatorRoleId: string;
  let supervisorRoleId: string;
  let managePermissionId: string;

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
    const notificationCenter = {
      send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
      broadcast: jest.fn().mockResolvedValue({ notificationIds: [], requested: 0, sent: 0 }),
    } as unknown as NotificationCenterService;

    const sosAlertService = new SosAlertService(prisma, auditService, notificationCenter);
    const incidentReportService = new IncidentReportService(
      prisma,
      auditService,
      notificationCenter,
    );
    const driverSupportService = new DriverSupportService(prisma, auditService, notificationCenter);

    service = new OperationsCasesService(
      prisma,
      auditService,
      sosAlertService,
      incidentReportService,
      driverSupportService,
    );

    const driver = await prisma.user.create({
      data: {
        email: `ops-case-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Case',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;

    const operator = await prisma.user.create({
      data: {
        email: `ops-case-operator-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ops',
        lastName: 'Operator',
      },
    });
    operatorId = operator.id;

    const supervisor = await prisma.user.create({
      data: {
        email: `ops-case-supervisor-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ops',
        lastName: 'Supervisor',
      },
    });
    supervisorId = supervisor.id;

    const managePermission = await prisma.permission.upsert({
      where: { code: 'operations:queues:manage' },
      create: { code: 'operations:queues:manage', description: 'Test-only manage permission' },
      update: {},
    });
    managePermissionId = managePermission.id;

    const operatorRole = await prisma.role.create({
      data: {
        name: `operations_staff_test_${randomUUID()}`,
        description: 'Test-only operator role',
      },
    });
    operatorRoleId = operatorRole.id;
    await prisma.rolePermission.create({
      data: { roleId: operatorRole.id, permissionId: managePermissionId },
    });
    await prisma.userRole.create({ data: { userId: operatorId, roleId: operatorRole.id } });

    // 'administrator' is a real seeded role name (globally unique) — reuse
    // it via upsert rather than assuming it's free to create, and only
    // clean up this test's own grant on it afterward, never the role
    // itself.
    const supervisorRole = await prisma.role.upsert({
      where: { name: 'administrator' },
      create: { name: 'administrator', description: 'Administrator' },
      update: {},
    });
    supervisorRoleId = supervisorRole.id;
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: supervisorRole.id, permissionId: managePermissionId },
      },
      create: { roleId: supervisorRole.id, permissionId: managePermissionId },
      update: {},
    });
    await prisma.userRole.create({ data: { userId: supervisorId, roleId: supervisorRole.id } });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.userRole
        .delete({ where: { userId_roleId: { userId: operatorId, roleId: operatorRoleId } } })
        .catch(() => undefined);
      await prisma.userRole
        .delete({ where: { userId_roleId: { userId: supervisorId, roleId: supervisorRoleId } } })
        .catch(() => undefined);
      await prisma.rolePermission
        .delete({
          where: {
            roleId_permissionId: { roleId: operatorRoleId, permissionId: managePermissionId },
          },
        })
        .catch(() => undefined);
      // The 'administrator' role (and its grant of this permission) is
      // real/shared, reused via upsert above — only this test's own
      // userRole assignment on it (removed above) belongs to this spec.
      await prisma.role.delete({ where: { id: operatorRoleId } }).catch(() => undefined);

      // Cases/events are keyed by (caseType, sourceId), not a Prisma
      // relation to the source tables — collect this test's own source ids
      // first so cleanup only ever touches rows this spec created.
      const [sosAlerts, incidentReports, supportTickets] = await Promise.all([
        prisma.sosAlert.findMany({ where: { driverId }, select: { id: true } }),
        prisma.incidentReport.findMany({ where: { driverId }, select: { id: true } }),
        prisma.driverSupportTicket.findMany({ where: { driverId }, select: { id: true } }),
      ]);
      const sourceIds = [
        ...sosAlerts.map((a) => a.id),
        ...incidentReports.map((r) => r.id),
        ...supportTickets.map((t) => t.id),
      ];
      if (sourceIds.length > 0) {
        const cases = await prisma.operationsCase.findMany({
          where: { sourceId: { in: sourceIds } },
          select: { id: true },
        });
        const caseIds = cases.map((c) => c.id);
        await prisma.operationsCaseEvent
          .deleteMany({ where: { caseId: { in: caseIds } } })
          .catch(() => undefined);
        await prisma.operationsCase
          .deleteMany({ where: { id: { in: caseIds } } })
          .catch(() => undefined);
      }

      await prisma.sosAlert.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.incidentReport.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.driverSupportTicket.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.vehicle.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: operatorId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: supervisorId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('lazily creates a CRITICAL-priority case for a new SOS alert', async () => {
    if (!databaseAvailable) return;

    const alert = await prisma.sosAlert.create({
      data: { driverId, status: SosAlertStatus.OPEN },
    });

    const queue = await service.getSosQueue({ driverId });
    const item = queue.items.find((i) => i.sourceId === alert.id);
    expect(item).toBeDefined();
    expect(item?.priority).toBe('CRITICAL');
    expect(item?.status).toBe('NEW');
    expect(item?.driverId).toBe(driverId);

    // Idempotent: fetching again reuses the same case, doesn't duplicate it.
    const queueAgain = await service.getSosQueue({ driverId });
    const itemAgain = queueAgain.items.find((i) => i.sourceId === alert.id);
    expect(itemAgain?.caseId).toBe(item?.caseId);
  });

  it('derives an incident case priority from the report severity', async () => {
    if (!databaseAvailable) return;

    const report = await prisma.incidentReport.create({
      data: {
        driverId,
        category: IncidentCategory.VEHICLE_BREAKDOWN,
        severity: IncidentSeverity.HIGH,
        description: 'Engine failure on the highway.',
      },
    });

    const queue = await service.getIncidentQueue({ driverId });
    const item = queue.items.find((i) => i.sourceId === report.id);
    expect(item?.priority).toBe('HIGH');
    expect(item?.category).toBe('VEHICLE_BREAKDOWN');
  });

  it('defaults a support ticket case to MEDIUM priority', async () => {
    if (!databaseAvailable) return;

    const ticket = await prisma.driverSupportTicket.create({
      data: {
        driverId,
        category: DriverSupportCategory.PAYOUT,
        subject: 'Missing payout',
        description: 'Payout from last week never arrived.',
      },
    });

    const queue = await service.getSupportQueue({ driverId });
    const item = queue.items.find((i) => i.sourceId === ticket.id);
    expect(item?.priority).toBe('MEDIUM');
  });

  it('assigning a NEW case moves it to ASSIGNED, syncs the source alert to ACKNOWLEDGED, and logs a timeline event', async () => {
    if (!databaseAvailable) return;

    const alert = await prisma.sosAlert.create({
      data: { driverId, status: SosAlertStatus.OPEN },
    });
    const queue = await service.getSosQueue({ driverId });
    const caseId = queue.items.find((i) => i.sourceId === alert.id)?.caseId;
    if (!caseId) throw new Error('expected a case to have been lazily created for the SOS alert');

    const detail = await service.updateCase(
      caseId,
      { assignedToId: operatorId, assignedToRole: OperationsAssigneeRole.OPERATOR, version: 0 },
      supervisorId,
      {},
    );

    expect(detail.status).toBe('ASSIGNED');
    expect(detail.assignedToId).toBe(operatorId);
    expect(detail.assignedToRole).toBe('OPERATOR');
    expect(detail.firstRespondedAt).not.toBeNull();
    expect(detail.events.some((e) => e.eventType === 'ASSIGNED')).toBe(true);

    const sourceAlert = await prisma.sosAlert.findUnique({ where: { id: alert.id } });
    expect(sourceAlert?.status).toBe(SosAlertStatus.ACKNOWLEDGED);
  });

  it('resolving a case syncs the source incident report to RESOLVED and stamps resolvedAt', async () => {
    if (!databaseAvailable) return;

    const report = await prisma.incidentReport.create({
      data: {
        driverId,
        category: IncidentCategory.SAFETY_CONCERN,
        severity: IncidentSeverity.MEDIUM,
        description: 'Passenger reported a safety concern.',
      },
    });
    const queue = await service.getIncidentQueue({ driverId });
    const caseId = queue.items.find((i) => i.sourceId === report.id)?.caseId;
    if (!caseId) throw new Error('expected a case to have been lazily created for the incident');

    const detail = await service.updateCase(
      caseId,
      { status: OperationsLifecycleStatus.RESOLVED, version: 0 },
      supervisorId,
      {},
    );

    expect(detail.status).toBe('RESOLVED');
    expect(detail.resolvedAt).not.toBeNull();

    const sourceReport = await prisma.incidentReport.findUnique({ where: { id: report.id } });
    expect(sourceReport?.status).toBe(IncidentReportStatus.RESOLVED);
  });

  it('closing a support case syncs the ticket to CLOSED and also stamps resolvedAt if unset', async () => {
    if (!databaseAvailable) return;

    const ticket = await prisma.driverSupportTicket.create({
      data: {
        driverId,
        category: DriverSupportCategory.APP_BUG,
        subject: 'App crash',
        description: 'App crashes on login.',
      },
    });
    const queue = await service.getSupportQueue({ driverId });
    const caseId = queue.items.find((i) => i.sourceId === ticket.id)?.caseId;
    if (!caseId) throw new Error('expected a case to have been lazily created for the ticket');

    const detail = await service.updateCase(
      caseId,
      { status: OperationsLifecycleStatus.CLOSED, version: 0 },
      supervisorId,
      {},
    );

    expect(detail.status).toBe('CLOSED');
    expect(detail.closedAt).not.toBeNull();
    expect(detail.resolvedAt).not.toBeNull();

    const sourceTicket = await prisma.driverSupportTicket.findUnique({ where: { id: ticket.id } });
    expect(sourceTicket?.status).toBe(DriverSupportTicketStatus.CLOSED);
  });

  it('adds a note as an immutable timeline event', async () => {
    if (!databaseAvailable) return;

    const ticket = await prisma.driverSupportTicket.create({
      data: {
        driverId,
        category: DriverSupportCategory.OTHER,
        subject: 'General question',
        description: 'How do I update my bank details?',
      },
    });
    const queue = await service.getSupportQueue({ driverId });
    const caseId = queue.items.find((i) => i.sourceId === ticket.id)?.caseId;
    if (!caseId) throw new Error('expected a case to have been lazily created for the ticket');

    const detail = await service.addNote(
      caseId,
      'Called the driver, awaiting response.',
      operatorId,
      {},
    );

    const noteEvent = detail.events.find((e) => e.eventType === 'NOTE_ADDED');
    expect(noteEvent).toBeDefined();
    expect(noteEvent?.description).toBe('Called the driver, awaiting response.');
    expect(noteEvent?.actorId).toBe(operatorId);
  });

  it('surfaces assignable staff, classifying administrator-role holders as supervisors', async () => {
    if (!databaseAvailable) return;

    const staff = await service.getAssignableStaff();
    const operatorEntry = staff.find((s) => s.id === operatorId);
    const supervisorEntry = staff.find((s) => s.id === supervisorId);

    expect(operatorEntry?.role).toBe('OPERATOR');
    expect(supervisorEntry?.role).toBe('SUPERVISOR');
  });

  it('counts active SOS alerts, open incidents, open support tickets, and waiting cases', async () => {
    if (!databaseAvailable) return;

    const alert = await prisma.sosAlert.create({
      data: { driverId, status: SosAlertStatus.OPEN },
    });

    try {
      const counters = await service.getQueueCounters();
      expect(counters.activeSosCount).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.sosAlert.delete({ where: { id: alert.id } }).catch(() => undefined);
    }
  });

  describe('Date/Ride/Vehicle filters (founder-approved 2026-08-05)', () => {
    it('filters the SOS queue by rideId and vehicleId — both real columns on SosAlert', async () => {
      if (!databaseAvailable) return;

      const rideId = randomUUID();
      // vehicleId is a real FK to Vehicle (sos_alerts.vehicle_id -> vehicles.id),
      // so it must reference an existing vehicle — a random UUID violates the
      // constraint. Create a real vehicle owned by this driver. (rideId has no FK,
      // so a random UUID is fine there.)
      const vehicle = await prisma.vehicle.create({
        data: {
          driverId,
          plateNumber: `SOS-${randomUUID().slice(0, 8)}`,
          make: 'Toyota',
          model: 'Corolla',
          color: 'Blue',
          year: 2020,
          rideCategory: 'ECONOMY',
        },
      });
      const vehicleId = vehicle.id;
      const matching = await prisma.sosAlert.create({
        data: { driverId, status: SosAlertStatus.OPEN, rideId, vehicleId },
      });
      const nonMatching = await prisma.sosAlert.create({
        data: { driverId, status: SosAlertStatus.OPEN },
      });

      const byRide = await service.getSosQueue({ driverId, rideId });
      expect(byRide.items.map((i) => i.sourceId)).toContain(matching.id);
      expect(byRide.items.map((i) => i.sourceId)).not.toContain(nonMatching.id);

      const byVehicle = await service.getSosQueue({ driverId, vehicleId });
      expect(byVehicle.items.map((i) => i.sourceId)).toContain(matching.id);
      expect(byVehicle.items.map((i) => i.sourceId)).not.toContain(nonMatching.id);
    });

    it('filters the SOS queue by an inclusive createdAt date range', async () => {
      if (!databaseAvailable) return;

      const alert = await prisma.sosAlert.create({
        data: { driverId, status: SosAlertStatus.OPEN },
      });

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const inRange = await service.getSosQueue({
        driverId,
        dateFrom: yesterday,
        dateTo: tomorrow,
      });
      expect(inRange.items.map((i) => i.sourceId)).toContain(alert.id);

      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const outOfRange = await service.getSosQueue({
        driverId,
        dateFrom: new Date(lastWeek.getTime() - 24 * 60 * 60 * 1000),
        dateTo: lastWeek,
      });
      expect(outOfRange.items.map((i) => i.sourceId)).not.toContain(alert.id);
    });

    it('filters the Incident queue by rideId (real column) and always empties on a vehicleId filter (no such column)', async () => {
      if (!databaseAvailable) return;

      const rideId = randomUUID();
      const matching = await prisma.incidentReport.create({
        data: {
          driverId,
          category: IncidentCategory.ACCIDENT,
          severity: IncidentSeverity.LOW,
          description: 'Fender bender.',
          rideId,
        },
      });

      const byRide = await service.getIncidentQueue({ driverId, rideId });
      expect(byRide.items.map((i) => i.sourceId)).toContain(matching.id);

      const byVehicle = await service.getIncidentQueue({ driverId, vehicleId: randomUUID() });
      expect(byVehicle.items).toHaveLength(0);
    });

    it('always empties the Support queue on a rideId or vehicleId filter — DriverSupportTicket has neither column', async () => {
      if (!databaseAvailable) return;

      await prisma.driverSupportTicket.create({
        data: {
          driverId,
          category: DriverSupportCategory.OTHER,
          subject: 'Filter test',
          description: 'Should never match a ride/vehicle filter.',
        },
      });

      const byRide = await service.getSupportQueue({ driverId, rideId: randomUUID() });
      expect(byRide.items).toHaveLength(0);

      const byVehicle = await service.getSupportQueue({ driverId, vehicleId: randomUUID() });
      expect(byVehicle.items).toHaveLength(0);
    });
  });

  describe('concurrent lazy case creation (Slice 2 Production Audit)', () => {
    it('creates exactly one OperationsCase and logs exactly one CREATED event when two requests race on the same new SOS alert', async () => {
      if (!databaseAvailable) return;

      const alert = await prisma.sosAlert.create({
        data: { driverId, status: SosAlertStatus.OPEN },
      });

      // Simulates two operators (or one operator's UI double-firing) polling
      // the same queue at the same instant, before either has a case row
      // for this brand-new alert yet.
      const [queueA, queueB] = await Promise.all([
        service.getSosQueue({ driverId }),
        service.getSosQueue({ driverId }),
      ]);

      const caseIdA = queueA.items.find((i) => i.sourceId === alert.id)?.caseId;
      const caseIdB = queueB.items.find((i) => i.sourceId === alert.id)?.caseId;
      expect(caseIdA).toBeDefined();
      expect(caseIdA).toBe(caseIdB);

      const cases = await prisma.operationsCase.findMany({
        where: { caseType: 'SOS', sourceId: alert.id },
      });
      expect(cases).toHaveLength(1);
      const soleCase = cases[0];
      if (!soleCase) throw new Error('expected exactly one case to have been created');

      const events = await prisma.operationsCaseEvent.findMany({
        where: { caseId: soleCase.id, eventType: 'CREATED' },
      });
      expect(events).toHaveLength(1);
    });

    it('handles a higher-fan-out race (5 concurrent requests) without duplicate cases or CREATED events', async () => {
      if (!databaseAvailable) return;

      const alert = await prisma.sosAlert.create({
        data: { driverId, status: SosAlertStatus.OPEN },
      });

      const results = await Promise.all(
        Array.from({ length: 5 }, () => service.getSosQueue({ driverId })),
      );
      const caseIds = new Set(
        results.map((queue) => queue.items.find((i) => i.sourceId === alert.id)?.caseId),
      );
      expect(caseIds.size).toBe(1);

      const cases = await prisma.operationsCase.findMany({
        where: { caseType: 'SOS', sourceId: alert.id },
      });
      expect(cases).toHaveLength(1);
      const soleCase = cases[0];
      if (!soleCase) throw new Error('expected exactly one case to have been created');

      const events = await prisma.operationsCaseEvent.findMany({
        where: { caseId: soleCase.id, eventType: 'CREATED' },
      });
      expect(events).toHaveLength(1);
    });
  });

  describe('concurrent case updates (module-closure audit, 2026-08-05)', () => {
    it('rejects a stale write when two operators race an update on the same case, and the surviving state matches only the winner', async () => {
      if (!databaseAvailable) return;

      const alert = await prisma.sosAlert.create({
        data: { driverId, status: SosAlertStatus.OPEN },
      });
      const queue = await service.getSosQueue({ driverId });
      const caseId = queue.items.find((i) => i.sourceId === alert.id)?.caseId;
      if (!caseId) throw new Error('expected a case to have been lazily created for the SOS alert');

      // Two operators, both having read the same freshly-created case
      // (version 0), race to assign it to themselves at the same instant —
      // the exact multi-operator scenario the founder named. Fired without
      // an intervening `await` so both `requireCase()` reads interleave
      // before either write lands, the same technique the lazy-creation
      // race tests above use.
      const results = await Promise.allSettled([
        service.updateCase(
          caseId,
          { assignedToId: operatorId, assignedToRole: OperationsAssigneeRole.OPERATOR, version: 0 },
          supervisorId,
          {},
        ),
        service.updateCase(
          caseId,
          {
            assignedToId: supervisorId,
            assignedToRole: OperationsAssigneeRole.SUPERVISOR,
            version: 0,
          },
          operatorId,
          {},
        ),
      ]);

      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<OperationsCaseDetailDto> =>
          result.status === 'fulfilled',
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      // Exactly one write lands — a genuine race, not two independent
      // successes that happened to both look fine in isolation.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(ConflictDomainException);

      // The persisted row reflects only the winner — never a merge of both,
      // never the loser's assignment silently taking effect after the
      // winner's.
      const finalCase = await prisma.operationsCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(finalCase.assignedToId).toBe(fulfilled[0]?.value.assignedToId);
      expect(finalCase.version).toBe(1);

      // The timeline has exactly the winner's ASSIGNED event — not two
      // (one per racer), which would misrepresent what actually happened
      // to an operator reading the case history afterward.
      const assignedEvents = await prisma.operationsCaseEvent.findMany({
        where: { caseId, eventType: 'ASSIGNED' },
      });
      expect(assignedEvents).toHaveLength(1);
    });

    it('a rejected stale write can be retried once the caller refreshes to the current version', async () => {
      if (!databaseAvailable) return;

      const alert = await prisma.sosAlert.create({
        data: { driverId, status: SosAlertStatus.OPEN },
      });
      const queue = await service.getSosQueue({ driverId });
      const caseId = queue.items.find((i) => i.sourceId === alert.id)?.caseId;
      if (!caseId) throw new Error('expected a case to have been lazily created for the SOS alert');

      const first = await service.updateCase(
        caseId,
        { priority: OperationsPriority.HIGH, version: 0 },
        supervisorId,
        {},
      );
      expect(first.version).toBe(1);

      // Still holding the version from before `first` landed — this is
      // exactly what "silently overwrite a newer operator's action" would
      // look like if the guard weren't there.
      await expect(
        service.updateCase(
          caseId,
          { priority: OperationsPriority.LOW, version: 0 },
          operatorId,
          {},
        ),
      ).rejects.toBeInstanceOf(ConflictDomainException);

      // Refresh to the version the conflict implies, per
      // `UpdateOperationsCaseRequest.version`'s documented contract, and
      // the same write now succeeds.
      const retried = await service.updateCase(
        caseId,
        { priority: OperationsPriority.LOW, version: first.version },
        operatorId,
        {},
      );
      expect(retried.version).toBe(2);
      expect(retried.priority).toBe('LOW');
    });
  });
});
