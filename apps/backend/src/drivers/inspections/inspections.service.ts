import { Injectable } from '@nestjs/common';
import { InspectionStatus, Prisma, VehicleApprovalStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS } from '../driver.constants';

import { toInspectionDto } from './inspection.mapper';

import type { DecideInspectionDto } from '../dto/decide-inspection.dto';
import type { ListInspectionsQueryDto } from '../dto/list-inspections-query.dto';
import type { RecordInspectionChecklistDto } from '../dto/record-inspection-checklist.dto';
import type { ScheduleInspectionDto } from '../dto/schedule-inspection.dto';
import type { InspectionDto } from '@dripplex/types';
import type { Inspection } from '@prisma/client';

/** DPX-DRIVER-002 Phase 3 — appointment booking + checklist recording +
 * pass/fail decision. Officer-vs-supervisor split per the standard: officers
 * record (`recordChecklist`), supervisors decide (`decide`). Both act on the
 * same `Inspection` row via distinct actor fields (`inspectorId`/`decidedBy`)
 * so accountability for each step is separately auditable. */
@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async scheduleInspection(
    driverUserId: string,
    dto: ScheduleInspectionDto,
    context: AuditContext,
  ): Promise<InspectionDto> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) {
      throw new NotFoundDomainException('Vehicle not found');
    }
    if (vehicle.driverId !== driverUserId) {
      throw new NotFoundDomainException('Vehicle not found');
    }

    const centre = await this.prisma.inspectionCentre.findUnique({ where: { id: dto.centreId } });
    if (!centre) {
      throw new NotFoundDomainException('Inspection centre not found or inactive');
    }
    if (!centre.isActive) {
      throw new NotFoundDomainException('Inspection centre not found or inactive');
    }

    if (dto.reinspectionOfId !== undefined) {
      const original = await this.prisma.inspection.findUnique({
        where: { id: dto.reinspectionOfId },
      });
      if (!original) {
        throw new NotFoundDomainException('Original inspection not found');
      }
      if (original.driverId !== driverUserId) {
        throw new NotFoundDomainException('Original inspection not found');
      }
      if (original.status !== InspectionStatus.FAILED) {
        throw new ValidationDomainException('Only a failed inspection can be re-scheduled');
      }
    }

    const inspection = await this.prisma.inspection.create({
      data: {
        driverId: driverUserId,
        vehicleId: dto.vehicleId,
        centreId: dto.centreId,
        scheduledAt: new Date(dto.scheduledAt),
        ...(dto.reinspectionOfId !== undefined ? { reinspectionOfId: dto.reinspectionOfId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.INSPECTION_SCHEDULED,
      { ...context, userId: driverUserId },
      { resource: 'inspection', resourceId: inspection.id, metadata: { centreId: dto.centreId } },
    );

    return toInspectionDto(inspection);
  }

  public async listOwnInspections(driverUserId: string): Promise<InspectionDto[]> {
    const inspections = await this.prisma.inspection.findMany({
      where: { driverId: driverUserId },
      orderBy: { scheduledAt: 'desc' },
    });
    return inspections.map(toInspectionDto);
  }

  public async getOwnInspection(
    driverUserId: string,
    inspectionId: string,
  ): Promise<InspectionDto> {
    const inspection = await this.requireInspection(inspectionId);
    if (inspection.driverId !== driverUserId) {
      throw new ForbiddenDomainException('You do not have access to this inspection');
    }
    return toInspectionDto(inspection);
  }

  public async cancelOwnInspection(
    driverUserId: string,
    inspectionId: string,
    context: AuditContext,
  ): Promise<InspectionDto> {
    const inspection = await this.requireInspection(inspectionId);
    if (inspection.driverId !== driverUserId) {
      throw new ForbiddenDomainException('You do not have access to this inspection');
    }
    if (inspection.status !== InspectionStatus.SCHEDULED) {
      throw new ValidationDomainException('Only a scheduled inspection can be cancelled');
    }

    const updated = await this.prisma.inspection.update({
      where: { id: inspectionId },
      data: { status: InspectionStatus.CANCELLED },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.INSPECTION_CANCELLED,
      { ...context, userId: driverUserId },
      { resource: 'inspection', resourceId: updated.id },
    );

    return toInspectionDto(updated);
  }

  public async listInspections(query: ListInspectionsQueryDto): Promise<{
    items: InspectionDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.centreId ? { centreId: query.centreId } : {}),
    };
    const [inspections, total] = await Promise.all([
      this.prisma.inspection.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.inspection.count({ where }),
    ]);

    return {
      items: inspections.map(toInspectionDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async getInspection(inspectionId: string): Promise<InspectionDto> {
    const inspection = await this.requireInspection(inspectionId);
    return toInspectionDto(inspection);
  }

  /** Inspection Officer — records the checklist/photos on an assigned
   * appointment. First officer to record on a SCHEDULED inspection becomes
   * its `inspectorId` — Slice 1 has no separate assignment/queue system. */
  public async recordChecklist(
    inspectionId: string,
    officerUserId: string,
    dto: RecordInspectionChecklistDto,
    context: AuditContext,
  ): Promise<InspectionDto> {
    const inspection = await this.requireInspection(inspectionId);
    if (inspection.status !== InspectionStatus.SCHEDULED) {
      throw new ValidationDomainException(
        'Only a scheduled inspection can have its checklist recorded',
      );
    }

    const updated = await this.prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        inspectorId: officerUserId,
        checklist: dto.checklist as unknown as Prisma.InputJsonValue,
        ...(dto.photos !== undefined ? { photos: dto.photos } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.INSPECTION_CHECKLIST_RECORDED,
      { ...context, userId: officerUserId },
      { resource: 'inspection', resourceId: updated.id },
    );

    return toInspectionDto(updated);
  }

  /** Inspection Supervisor — final pass/fail call. Distinct actor from
   * `inspectorId` per the officer/supervisor role split. */
  public async decide(
    inspectionId: string,
    supervisorUserId: string,
    dto: DecideInspectionDto,
    context: AuditContext,
  ): Promise<InspectionDto> {
    const inspection = await this.requireInspection(inspectionId);
    if (inspection.status !== InspectionStatus.SCHEDULED) {
      throw new ValidationDomainException('Only a scheduled inspection can be decided');
    }
    if (!inspection.checklist) {
      throw new ValidationDomainException(
        'Checklist must be recorded before a decision can be made',
      );
    }

    const status = dto.passed ? InspectionStatus.PASSED : InspectionStatus.FAILED;
    const updated = await this.prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        status,
        decidedBy: supervisorUserId,
        completedAt: new Date(),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    if (status === InspectionStatus.PASSED) {
      // A passed inspection is the final Phase-3 gate for its vehicle —
      // reflect that on the vehicle's own approval status too, so vehicle
      // listing/filtering doesn't require joining through Inspection.
      await this.prisma.vehicle.update({
        where: { id: updated.vehicleId },
        data: {
          approvalStatus: VehicleApprovalStatus.APPROVED,
          approvedAt: updated.completedAt,
          approvedBy: supervisorUserId,
        },
      });
    }

    await this.auditService.record(
      status === InspectionStatus.PASSED
        ? DRIVER_AUDIT_ACTIONS.INSPECTION_PASSED
        : DRIVER_AUDIT_ACTIONS.INSPECTION_FAILED,
      { ...context, userId: supervisorUserId },
      { resource: 'inspection', resourceId: updated.id },
    );

    return toInspectionDto(updated);
  }

  private async requireInspection(inspectionId: string): Promise<Inspection> {
    const inspection = await this.prisma.inspection.findUnique({ where: { id: inspectionId } });
    if (!inspection) {
      throw new NotFoundDomainException('Inspection not found');
    }
    return inspection;
  }
}
