import { Injectable } from '@nestjs/common';
import {
  IncidentReportStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { NotificationCenterService } from '../../notification-center/notification-center.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS } from '../driver.constants';

import { toIncidentReportDto } from './incident-report.mapper';

import type { CreateIncidentReportDto } from '../dto/create-incident-report.dto';
import type { ListIncidentReportsQueryDto } from '../dto/list-incident-reports-query.dto';
import type { UpdateIncidentReportDto } from '../dto/update-incident-report.dto';
import type { IncidentReportDto, IncidentReportListDto } from '@dripplex/types';
import type { IncidentReport } from '@prisma/client';

/** Driver Slice 2 item 4 — Incident Reporting (founder-approved
 * 2026-08-04): safety-relevant (accident, passenger altercation, vehicle
 * breakdown) — distinct from the general Driver Support ticket and from
 * the ride-scoped `RideProblemReport`. `rideId`, when present, is a plain
 * id (no Prisma relation to `Ride` — see the schema comment) so this
 * respects the frozen Ride module without needing a back-relation field
 * on it. */
@Injectable()
export class IncidentReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationCenter: NotificationCenterService,
  ) {}

  public async createReport(
    driverUserId: string,
    dto: CreateIncidentReportDto,
    context: AuditContext,
  ): Promise<IncidentReportDto> {
    const report = await this.prisma.incidentReport.create({
      data: {
        driverId: driverUserId,
        category: dto.category,
        severity: dto.severity,
        description: dto.description.trim(),
        ...(dto.rideId !== undefined ? { rideId: dto.rideId } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.INCIDENT_REPORT_SUBMITTED,
      { ...context, userId: driverUserId },
      {
        resource: 'incident_report',
        resourceId: report.id,
        metadata: { category: report.category, severity: report.severity },
      },
    );

    return toIncidentReportDto(report);
  }

  public async listOwnReports(driverUserId: string): Promise<IncidentReportDto[]> {
    const reports = await this.prisma.incidentReport.findMany({
      where: { driverId: driverUserId },
      orderBy: { createdAt: 'desc' },
    });
    return reports.map(toIncidentReportDto);
  }

  public async getOwnReport(driverUserId: string, reportId: string): Promise<IncidentReportDto> {
    const report = await this.requireOwnedReport(driverUserId, reportId);
    return toIncidentReportDto(report);
  }

  public async listReports(query: ListIncidentReportsQueryDto): Promise<IncidentReportListDto> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
    };
    const [reports, total] = await Promise.all([
      this.prisma.incidentReport.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.incidentReport.count({ where }),
    ]);

    return {
      items: reports.map(toIncidentReportDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Admin-only. Any status/notes change notifies the driver in-app. */
  public async updateReport(
    reportId: string,
    adminUserId: string,
    dto: UpdateIncidentReportDto,
    context: AuditContext,
  ): Promise<IncidentReportDto> {
    const existing = await this.requireReport(reportId);

    const isAcknowledging =
      dto.status === IncidentReportStatus.ACKNOWLEDGED &&
      existing.status === IncidentReportStatus.OPEN;
    const isResolving =
      dto.status === IncidentReportStatus.RESOLVED &&
      existing.status !== IncidentReportStatus.RESOLVED;

    const updated = await this.prisma.incidentReport.update({
      where: { id: reportId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes.trim() } : {}),
        ...(isAcknowledging ? { acknowledgedBy: adminUserId, acknowledgedAt: new Date() } : {}),
        ...(isResolving ? { resolvedAt: new Date() } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.INCIDENT_REPORT_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'incident_report',
        resourceId: updated.id,
        metadata: { status: updated.status, hasNotes: dto.adminNotes !== undefined },
      },
    );

    await this.notificationCenter.send({
      userId: updated.driverId,
      category: NotificationCategory.EMERGENCY,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.INCIDENT_REPORT_UPDATED,
      title: 'Incident report updated',
      body: dto.adminNotes ?? `Your incident report is now ${updated.status.toLowerCase()}.`,
      payload: { incidentReportId: updated.id, status: updated.status },
    });

    return toIncidentReportDto(updated);
  }

  private async requireReport(reportId: string): Promise<IncidentReport> {
    const report = await this.prisma.incidentReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundDomainException('Incident report not found');
    }
    return report;
  }

  private async requireOwnedReport(
    driverUserId: string,
    reportId: string,
  ): Promise<IncidentReport> {
    const report = await this.requireReport(reportId);
    if (report.driverId !== driverUserId) {
      throw new ForbiddenDomainException('You do not have access to this incident report');
    }
    return report;
  }
}
