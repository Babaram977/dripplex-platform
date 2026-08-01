import { Injectable } from '@nestjs/common';
import { RideProblemStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { RIDE_AUDIT_ACTIONS } from './ride.constants';
import { toRideProblemReportDto } from './ride.mapper';

import type { ReportRideProblemDto } from './dto/ride-problem-report.dto';
import type { RideProblemReportDto } from '@dripplex/types';

/**
 * No support/ticket system exists anywhere in this codebase (confirmed by a
 * schema-wide audit before writing this service). RideProblemReport is a
 * small, scoped model that stands in as the "ticket" until a real support
 * platform exists — see docs/RIDE-002.8-POST-RIDE-DESIGN.md.
 */
@Injectable()
export class RideProblemReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async reportProblem(
    customerId: string,
    rideId: string,
    dto: ReportRideProblemDto,
    context: AuditContext,
  ): Promise<RideProblemReportDto> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, customerId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }

    const report = await this.prisma.rideProblemReport.create({
      data: {
        rideId: ride.id,
        reporterId: customerId,
        category: dto.category,
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.PROBLEM_REPORTED,
      { ...context, userId: customerId },
      { resource: 'ride', resourceId: ride.id, metadata: { category: dto.category } },
    );

    return toRideProblemReportDto(report);
  }

  public async listReports(status?: RideProblemStatus): Promise<RideProblemReportDto[]> {
    const reports = await this.prisma.rideProblemReport.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { createdAt: 'desc' },
    });
    return reports.map(toRideProblemReportDto);
  }

  public async resolveReport(
    reportId: string,
    adminId: string,
    context: AuditContext,
  ): Promise<RideProblemReportDto> {
    const report = await this.prisma.rideProblemReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundDomainException('Problem report not found');
    }
    if (report.status === RideProblemStatus.RESOLVED) {
      throw new ValidationDomainException('Problem report is already resolved');
    }

    const updated = await this.prisma.rideProblemReport.update({
      where: { id: reportId },
      data: { status: RideProblemStatus.RESOLVED, resolvedAt: new Date() },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.PROBLEM_RESOLVED,
      { ...context, userId: adminId },
      { resource: 'ride_problem_report', resourceId: report.id },
    );

    return toRideProblemReportDto(updated);
  }
}
