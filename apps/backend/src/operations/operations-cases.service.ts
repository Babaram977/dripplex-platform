import { Injectable } from '@nestjs/common';
import {
  DriverSupportTicketStatus,
  IncidentReportStatus,
  IncidentSeverity,
  OperationsAssigneeRole,
  OperationsCaseEventType,
  OperationsCaseType,
  OperationsLifecycleStatus,
  OperationsPriority,
  SosAlertStatus,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { IncidentReportService } from '../drivers/incidents/incident-report.service';
import { SosAlertService } from '../drivers/sos/sos-alert.service';
import { DriverSupportService } from '../drivers/support/driver-support.service';
import { PrismaService } from '../prisma/prisma.service';

import { OPERATIONS_AUDIT_ACTIONS, OPERATIONS_PERMISSIONS } from './operations.constants';
import {
  toCaseEventDto,
  toIncidentQueueItemDto,
  toSosQueueItemDto,
  toSupportQueueItemDto,
} from './operations.mapper';

import type {
  IncidentQueueDto,
  OperationsCaseDetailDto,
  OperationsQueueCountersByStatus,
  OperationsStaffMemberDto,
  SosQueueDto,
  SupportQueueDto,
  UpdateOperationsCaseRequest,
} from '@dripplex/types';
import type { OperationsCase, User } from '@prisma/client';

/** Maps a report's own severity onto the unified priority scale — the two
 * enums deliberately share the same four values. */
export const INCIDENT_SEVERITY_TO_PRIORITY: Record<IncidentSeverity, OperationsPriority> = {
  [IncidentSeverity.CRITICAL]: OperationsPriority.CRITICAL,
  [IncidentSeverity.HIGH]: OperationsPriority.HIGH,
  [IncidentSeverity.MEDIUM]: OperationsPriority.MEDIUM,
  [IncidentSeverity.LOW]: OperationsPriority.LOW,
};

/** Role names (`Role.name` from `prisma/seed-data/roles.ts`) that surface
 * a `operations:queues:manage`-holder as a supervisor rather than an
 * operator in `getAssignableStaff()`. */
const SUPERVISOR_ROLE_NAMES = new Set(['administrator', 'super_administrator']);

export interface OperationsQueueFilter {
  status?: OperationsLifecycleStatus;
  priority?: OperationsPriority;
  assignedToId?: string;
  driverId?: string;
}

function emptyCounters(): OperationsQueueCountersByStatus {
  return {
    newCount: 0,
    assignedCount: 0,
    inProgressCount: 0,
    waitingCount: 0,
    resolvedCount: 0,
    closedCount: 0,
  };
}

function summarize(statuses: OperationsLifecycleStatus[]): OperationsQueueCountersByStatus {
  const counters = emptyCounters();
  for (const status of statuses) {
    switch (status) {
      case OperationsLifecycleStatus.NEW:
        counters.newCount += 1;
        break;
      case OperationsLifecycleStatus.ASSIGNED:
        counters.assignedCount += 1;
        break;
      case OperationsLifecycleStatus.IN_PROGRESS:
        counters.inProgressCount += 1;
        break;
      case OperationsLifecycleStatus.WAITING:
        counters.waitingCount += 1;
        break;
      case OperationsLifecycleStatus.RESOLVED:
        counters.resolvedCount += 1;
        break;
      case OperationsLifecycleStatus.CLOSED:
        counters.closedCount += 1;
        break;
    }
  }
  return counters;
}

/** True for the lifecycle stages that represent "an operator has started
 * working this," used both to gate the SOS/Incident source
 * acknowledge-equivalent call-through and to decide whether to stamp
 * `firstRespondedAt`. */
function isPastNew(status: OperationsLifecycleStatus): boolean {
  return status !== OperationsLifecycleStatus.NEW;
}

/**
 * DPX-OPS-001 Slice 2 — Operations Work Queues (founder-approved
 * 2026-08-04). `OperationsCase` wraps `SosAlert`/`IncidentReport`/
 * `DriverSupportTicket` rows with the operational concepts those frozen
 * Driver Slice 2 tables don't have (priority, unified lifecycle,
 * assignment, SLA timestamps, immutable timeline) — it never modifies
 * `drivers/sos`, `drivers/incidents`, or `drivers/support` themselves,
 * only composes their existing public service methods (`updateAlert`/
 * `updateReport`/`updateTicket`) so the source table's own driver-facing
 * status stays in sync and driver notifications keep firing exactly as
 * they did before this module existed.
 */
@Injectable()
export class OperationsCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sosAlertService: SosAlertService,
    private readonly incidentReportService: IncidentReportService,
    private readonly driverSupportService: DriverSupportService,
  ) {}

  public async getSosQueue(filter: OperationsQueueFilter = {}): Promise<SosQueueDto> {
    const alerts = await this.prisma.sosAlert.findMany({
      where: filter.driverId ? { driverId: filter.driverId } : {},
      include: { driver: true },
      orderBy: { createdAt: 'desc' },
    });

    const casesBySource = await this.ensureCases(
      OperationsCaseType.SOS,
      alerts.map((alert) => ({ id: alert.id, defaultPriority: OperationsPriority.CRITICAL })),
    );

    const userMap = await this.loadUserMap([...casesBySource.values()], []);
    let items = alerts.map((alert) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- every alert.id was just used to seed casesBySource above
      toSosQueueItemDto(alert, casesBySource.get(alert.id)!, userMap),
    );
    items = this.applyFilter(items, filter);

    return { items, summary: summarize(items.map((item) => item.status)) };
  }

  public async getIncidentQueue(filter: OperationsQueueFilter = {}): Promise<IncidentQueueDto> {
    const reports = await this.prisma.incidentReport.findMany({
      where: filter.driverId ? { driverId: filter.driverId } : {},
      include: { driver: true },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });

    const casesBySource = await this.ensureCases(
      OperationsCaseType.INCIDENT,
      reports.map((report) => ({
        id: report.id,
        defaultPriority: INCIDENT_SEVERITY_TO_PRIORITY[report.severity],
      })),
    );

    const userMap = await this.loadUserMap([...casesBySource.values()], []);
    let items = reports.map((report) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- every report.id was just used to seed casesBySource above
      toIncidentQueueItemDto(report, casesBySource.get(report.id)!, userMap),
    );
    items = this.applyFilter(items, filter);

    return { items, summary: summarize(items.map((item) => item.status)) };
  }

  public async getSupportQueue(filter: OperationsQueueFilter = {}): Promise<SupportQueueDto> {
    const tickets = await this.prisma.driverSupportTicket.findMany({
      where: filter.driverId ? { driverId: filter.driverId } : {},
      include: { driver: true },
      orderBy: { createdAt: 'desc' },
    });

    const casesBySource = await this.ensureCases(
      OperationsCaseType.SUPPORT,
      tickets.map((ticket) => ({ id: ticket.id, defaultPriority: OperationsPriority.MEDIUM })),
    );

    const userMap = await this.loadUserMap([...casesBySource.values()], []);
    let items = tickets.map((ticket) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- every ticket.id was just used to seed casesBySource above
      toSupportQueueItemDto(ticket, casesBySource.get(ticket.id)!, userMap),
    );
    items = this.applyFilter(items, filter);

    return { items, summary: summarize(items.map((item) => item.status)) };
  }

  public async getCaseDetail(caseId: string): Promise<OperationsCaseDetailDto> {
    const kase = await this.requireCase(caseId);
    const events = await this.prisma.operationsCaseEvent.findMany({
      where: { caseId: kase.id },
      orderBy: { createdAt: 'asc' },
    });
    const actorIds = events.map((event) => event.actorId).filter((id): id is string => id !== null);
    const userMap = await this.loadUserMap([kase], actorIds);
    const eventDtos = events.map((event) => toCaseEventDto(event, userMap));

    switch (kase.caseType) {
      case OperationsCaseType.SOS: {
        const alert = await this.prisma.sosAlert.findUnique({
          where: { id: kase.sourceId },
          include: { driver: true },
        });
        if (!alert) throw new NotFoundDomainException('SOS alert not found for this case');
        return { ...toSosQueueItemDto(alert, kase, userMap), events: eventDtos };
      }
      case OperationsCaseType.INCIDENT: {
        const report = await this.prisma.incidentReport.findUnique({
          where: { id: kase.sourceId },
          include: { driver: true },
        });
        if (!report) throw new NotFoundDomainException('Incident report not found for this case');
        return { ...toIncidentQueueItemDto(report, kase, userMap), events: eventDtos };
      }
      case OperationsCaseType.SUPPORT: {
        const ticket = await this.prisma.driverSupportTicket.findUnique({
          where: { id: kase.sourceId },
          include: { driver: true },
        });
        if (!ticket) throw new NotFoundDomainException('Support ticket not found for this case');
        return { ...toSupportQueueItemDto(ticket, kase, userMap), events: eventDtos };
      }
    }
  }

  public async updateCase(
    caseId: string,
    dto: UpdateOperationsCaseRequest,
    actorUserId: string,
    context: AuditContext,
  ): Promise<OperationsCaseDetailDto> {
    const existing = await this.requireCase(caseId);
    const now = new Date();
    const data: Parameters<typeof this.prisma.operationsCase.update>[0]['data'] = {};
    const eventsToLog: { eventType: OperationsCaseEventType; description: string }[] = [];

    if (dto.priority !== undefined && dto.priority !== existing.priority) {
      data.priority = dto.priority;
      eventsToLog.push({
        eventType: OperationsCaseEventType.PRIORITY_CHANGED,
        description: `Priority changed from ${existing.priority} to ${dto.priority}.`,
      });
    }

    if (dto.assignedToId !== undefined) {
      if (dto.assignedToId === null) {
        data.assignedToId = null;
        data.assignedToRole = null;
        data.assignedById = null;
        data.assignedAt = null;
        eventsToLog.push({
          eventType: OperationsCaseEventType.UNASSIGNED,
          description: 'Case unassigned.',
        });
      } else {
        data.assignedToId = dto.assignedToId;
        data.assignedToRole = dto.assignedToRole ?? OperationsAssigneeRole.OPERATOR;
        data.assignedById = actorUserId;
        data.assignedAt = now;
        if (existing.status === OperationsLifecycleStatus.NEW) {
          data.status = OperationsLifecycleStatus.ASSIGNED;
        }
        eventsToLog.push({
          eventType: OperationsCaseEventType.ASSIGNED,
          description: `Assigned to ${data.assignedToRole === OperationsAssigneeRole.SUPERVISOR ? 'supervisor' : 'operator'}.`,
        });
      }
    }

    if (dto.status !== undefined && dto.status !== (data.status ?? existing.status)) {
      data.status = dto.status;
      eventsToLog.push({
        eventType: OperationsCaseEventType.STATUS_CHANGED,
        description: `Status changed from ${existing.status} to ${dto.status}.`,
      });
    }

    const nextStatus = (data.status as OperationsLifecycleStatus | undefined) ?? existing.status;
    if (
      existing.firstRespondedAt === null &&
      isPastNew(nextStatus) &&
      (data.status !== undefined || data.assignedToId !== undefined)
    ) {
      data.firstRespondedAt = now;
    }
    if (nextStatus === OperationsLifecycleStatus.RESOLVED && existing.resolvedAt === null) {
      data.resolvedAt = now;
    }
    if (nextStatus === OperationsLifecycleStatus.CLOSED && existing.closedAt === null) {
      data.closedAt = now;
      // A case closed directly from an unresolved state is still "resolved"
      // for SLA purposes — closure implies resolution.
      if (existing.resolvedAt === null) {
        data.resolvedAt = now;
      }
    }

    if (Object.keys(data).length === 0 && eventsToLog.length === 0) {
      return await this.getCaseDetail(caseId);
    }

    const updated = await this.prisma.operationsCase.update({ where: { id: caseId }, data });

    if (eventsToLog.length > 0) {
      await this.prisma.operationsCaseEvent.createMany({
        data: eventsToLog.map((event) => ({
          caseId: updated.id,
          eventType: event.eventType,
          actorId: actorUserId,
          description: event.description,
        })),
      });
    }

    await this.syncSourceStatus(updated, actorUserId, context);

    if (dto.assignedToId !== undefined) {
      await this.auditService.record(
        OPERATIONS_AUDIT_ACTIONS.CASE_ASSIGNED,
        { ...context, userId: actorUserId },
        {
          resource: 'operations_case',
          resourceId: updated.id,
          metadata: { assignedToId: dto.assignedToId },
        },
      );
    }
    if (dto.priority !== undefined) {
      await this.auditService.record(
        OPERATIONS_AUDIT_ACTIONS.CASE_PRIORITY_CHANGED,
        { ...context, userId: actorUserId },
        {
          resource: 'operations_case',
          resourceId: updated.id,
          metadata: { priority: dto.priority },
        },
      );
    }
    if (dto.status !== undefined) {
      await this.auditService.record(
        OPERATIONS_AUDIT_ACTIONS.CASE_STATUS_CHANGED,
        { ...context, userId: actorUserId },
        { resource: 'operations_case', resourceId: updated.id, metadata: { status: dto.status } },
      );
    }

    return await this.getCaseDetail(caseId);
  }

  public async addNote(
    caseId: string,
    note: string,
    actorUserId: string,
    context: AuditContext,
  ): Promise<OperationsCaseDetailDto> {
    const kase = await this.requireCase(caseId);
    await this.prisma.operationsCaseEvent.create({
      data: {
        caseId: kase.id,
        eventType: OperationsCaseEventType.NOTE_ADDED,
        actorId: actorUserId,
        description: note.trim(),
      },
    });
    await this.auditService.record(
      OPERATIONS_AUDIT_ACTIONS.CASE_NOTE_ADDED,
      { ...context, userId: actorUserId },
      { resource: 'operations_case', resourceId: kase.id },
    );
    return await this.getCaseDetail(caseId);
  }

  /** Counts across all three queues, for the Slice 1 dashboard extension —
   * pure aggregate reads over the existing source tables and
   * `OperationsCase`, no new domain logic duplicated. */
  public async getQueueCounters(): Promise<{
    activeSosCount: number;
    openIncidentsCount: number;
    openSupportTicketsCount: number;
    waitingReviewCount: number;
  }> {
    const [activeSosCount, openIncidentsCount, openSupportTicketsCount, waitingReviewCount] =
      await Promise.all([
        this.prisma.sosAlert.count({
          where: { status: { in: [SosAlertStatus.OPEN, SosAlertStatus.ACKNOWLEDGED] } },
        }),
        this.prisma.incidentReport.count({
          where: { status: { in: [IncidentReportStatus.OPEN, IncidentReportStatus.ACKNOWLEDGED] } },
        }),
        this.prisma.driverSupportTicket.count({
          where: {
            status: { in: [DriverSupportTicketStatus.OPEN, DriverSupportTicketStatus.IN_PROGRESS] },
          },
        }),
        this.prisma.operationsCase.count({ where: { status: OperationsLifecycleStatus.WAITING } }),
      ]);

    return { activeSosCount, openIncidentsCount, openSupportTicketsCount, waitingReviewCount };
  }

  /** Every user holding `operations:queues:manage` — the assignable pool
   * for the "Assign operator"/"Assign supervisor" controls. A user
   * holding `administrator` or `super_administrator` is surfaced as a
   * supervisor; everyone else holding the permission (i.e.
   * `operations_staff`) is an operator. */
  public async getAssignableStaff(): Promise<OperationsStaffMemberDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              permissions: {
                some: { permission: { code: OPERATIONS_PERMISSIONS.QUEUES_MANAGE } },
              },
            },
          },
        },
      },
      include: { roles: { include: { role: true } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return users.map((user) => {
      const isSupervisor = user.roles.some((userRole) =>
        SUPERVISOR_ROLE_NAMES.has(userRole.role.name),
      );
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: isSupervisor ? OperationsAssigneeRole.SUPERVISOR : OperationsAssigneeRole.OPERATOR,
      };
    });
  }

  /** Idempotent get-or-create, batched: one `findMany` to see what already
   * has a case, one `createMany` (only for the missing ones) plus the
   * follow-up reads needed to log a CREATED event for each. Keeps this
   * cheap enough to run on every queue-list request regardless of queue
   * size, without an N+1 per source row. */
  private async ensureCases(
    caseType: OperationsCaseType,
    sources: { id: string; defaultPriority: OperationsPriority }[],
  ): Promise<Map<string, OperationsCase>> {
    const map = new Map<string, OperationsCase>();
    if (sources.length === 0) return map;

    const sourceIds = sources.map((source) => source.id);
    const existing = await this.prisma.operationsCase.findMany({
      where: { caseType, sourceId: { in: sourceIds } },
    });
    for (const kase of existing) map.set(kase.sourceId, kase);

    const missing = sources.filter((source) => !map.has(source.id));
    if (missing.length > 0) {
      await this.prisma.operationsCase.createMany({
        data: missing.map((source) => ({
          caseType,
          sourceId: source.id,
          priority: source.defaultPriority,
        })),
        skipDuplicates: true,
      });
      const created = await this.prisma.operationsCase.findMany({
        where: { caseType, sourceId: { in: missing.map((source) => source.id) } },
      });
      await this.prisma.operationsCaseEvent.createMany({
        data: created.map((kase) => ({
          caseId: kase.id,
          eventType: OperationsCaseEventType.CREATED,
          description: `Case created (${kase.priority} priority).`,
        })),
      });
      for (const kase of created) map.set(kase.sourceId, kase);
    }

    return map;
  }

  private async requireCase(caseId: string): Promise<OperationsCase> {
    const kase = await this.prisma.operationsCase.findUnique({ where: { id: caseId } });
    if (!kase) {
      throw new NotFoundDomainException('Operations case not found');
    }
    return kase;
  }

  private async loadUserMap(
    cases: OperationsCase[],
    extraUserIds: string[],
  ): Promise<Map<string, User>> {
    const ids = new Set<string>(extraUserIds);
    for (const kase of cases) {
      if (kase.assignedToId) ids.add(kase.assignedToId);
      if (kase.assignedById) ids.add(kase.assignedById);
    }
    if (ids.size === 0) return new Map();
    const users = await this.prisma.user.findMany({ where: { id: { in: [...ids] } } });
    return new Map(users.map((user) => [user.id, user]));
  }

  private applyFilter<
    T extends {
      status: OperationsLifecycleStatus;
      priority: OperationsPriority;
      assignedToId: string | null;
    },
  >(items: T[], filter: OperationsQueueFilter): T[] {
    return items.filter(
      (item) =>
        (filter.status === undefined || item.status === filter.status) &&
        (filter.priority === undefined || item.priority === filter.priority) &&
        (filter.assignedToId === undefined || item.assignedToId === filter.assignedToId),
    );
  }

  /** Keeps the source table's own driver-facing status roughly in step
   * with the case's unified lifecycle, by calling through to the existing
   * (frozen) service methods — never writing to those tables directly.
   * SOS/Incident only have OPEN/ACKNOWLEDGED/RESOLVED; anything past NEW
   * maps to ACKNOWLEDGED, RESOLVED/CLOSED maps to RESOLVED (they have no
   * CLOSED concept — CLOSED stays a case-only distinction for those two).
   * Support tickets have a closer 4-state match. Best-effort: if the
   * source is already past the target state (e.g. already RESOLVED),
   * these calls are no-ops on the source service's own idempotency. */
  private async syncSourceStatus(
    kase: OperationsCase,
    actorUserId: string,
    context: AuditContext,
  ): Promise<void> {
    switch (kase.caseType) {
      case OperationsCaseType.SOS: {
        const alert = await this.prisma.sosAlert.findUnique({ where: { id: kase.sourceId } });
        if (!alert) return;
        if (
          kase.status === OperationsLifecycleStatus.RESOLVED ||
          kase.status === OperationsLifecycleStatus.CLOSED
        ) {
          if (alert.status !== SosAlertStatus.RESOLVED) {
            await this.sosAlertService.updateAlert(
              kase.sourceId,
              actorUserId,
              { status: SosAlertStatus.RESOLVED },
              context,
            );
          }
        } else if (isPastNew(kase.status) && alert.status === SosAlertStatus.OPEN) {
          await this.sosAlertService.updateAlert(
            kase.sourceId,
            actorUserId,
            { status: SosAlertStatus.ACKNOWLEDGED },
            context,
          );
        }
        return;
      }
      case OperationsCaseType.INCIDENT: {
        const report = await this.prisma.incidentReport.findUnique({
          where: { id: kase.sourceId },
        });
        if (!report) return;
        if (
          kase.status === OperationsLifecycleStatus.RESOLVED ||
          kase.status === OperationsLifecycleStatus.CLOSED
        ) {
          if (report.status !== IncidentReportStatus.RESOLVED) {
            await this.incidentReportService.updateReport(
              kase.sourceId,
              actorUserId,
              { status: IncidentReportStatus.RESOLVED },
              context,
            );
          }
        } else if (isPastNew(kase.status) && report.status === IncidentReportStatus.OPEN) {
          await this.incidentReportService.updateReport(
            kase.sourceId,
            actorUserId,
            { status: IncidentReportStatus.ACKNOWLEDGED },
            context,
          );
        }
        return;
      }
      case OperationsCaseType.SUPPORT: {
        const ticket = await this.prisma.driverSupportTicket.findUnique({
          where: { id: kase.sourceId },
        });
        if (!ticket) return;
        const target = this.mapLifecycleToSupportStatus(kase.status);
        if (target !== null && ticket.status !== target) {
          await this.driverSupportService.updateTicket(
            kase.sourceId,
            actorUserId,
            { status: target },
            context,
          );
        }
        return;
      }
    }
  }

  private mapLifecycleToSupportStatus(
    status: OperationsLifecycleStatus,
  ): DriverSupportTicketStatus | null {
    switch (status) {
      case OperationsLifecycleStatus.NEW:
        return null;
      case OperationsLifecycleStatus.ASSIGNED:
      case OperationsLifecycleStatus.IN_PROGRESS:
      case OperationsLifecycleStatus.WAITING:
        return DriverSupportTicketStatus.IN_PROGRESS;
      case OperationsLifecycleStatus.RESOLVED:
        return DriverSupportTicketStatus.RESOLVED;
      case OperationsLifecycleStatus.CLOSED:
        return DriverSupportTicketStatus.CLOSED;
    }
  }
}
