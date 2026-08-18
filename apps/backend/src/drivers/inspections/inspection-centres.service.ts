import { Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS } from '../driver.constants';

import { toInspectionCentreDto } from './inspection.mapper';

import type { CreateInspectionCentreDto } from '../dto/create-inspection-centre.dto';
import type { UpdateInspectionCentreDto } from '../dto/update-inspection-centre.dto';
import type { InspectionCentreDto } from '@dripplex/types';
import type { InspectionCentre } from '@prisma/client';

/** DPX-DRIVER-002 Phase 3 — physical inspection locations. Admin-managed;
 * drivers get read-only access to the active list when booking. */
@Injectable()
export class InspectionCentresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async create(
    dto: CreateInspectionCentreDto,
    adminUserId: string,
    context: AuditContext,
  ): Promise<InspectionCentreDto> {
    const centre = await this.prisma.inspectionCentre.create({
      data: {
        name: dto.name.trim(),
        // Optional (founder decision, 2026-08-17). Stored as NULL rather than an
        // empty string so "has no address" is one state, not two.
        address: dto.address === undefined ? null : dto.address.trim(),
        city: dto.city.trim(),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.INSPECTION_CENTRE_CREATED,
      { ...context, userId: adminUserId },
      { resource: 'inspection_centre', resourceId: centre.id },
    );

    return toInspectionCentreDto(centre);
  }

  public async update(
    centreId: string,
    dto: UpdateInspectionCentreDto,
    adminUserId: string,
    context: AuditContext,
  ): Promise<InspectionCentreDto> {
    await this.requireCentre(centreId);

    const updated = await this.prisma.inspectionCentre.update({
      where: { id: centreId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.INSPECTION_CENTRE_UPDATED,
      { ...context, userId: adminUserId },
      { resource: 'inspection_centre', resourceId: updated.id },
    );

    return toInspectionCentreDto(updated);
  }

  public async listActive(): Promise<InspectionCentreDto[]> {
    const centres = await this.prisma.inspectionCentre.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return centres.map(toInspectionCentreDto);
  }

  public async listAll(): Promise<InspectionCentreDto[]> {
    const centres = await this.prisma.inspectionCentre.findMany({ orderBy: { name: 'asc' } });
    return centres.map(toInspectionCentreDto);
  }

  public async get(centreId: string): Promise<InspectionCentreDto> {
    const centre = await this.requireCentre(centreId);
    return toInspectionCentreDto(centre);
  }

  private async requireCentre(centreId: string): Promise<InspectionCentre> {
    const centre = await this.prisma.inspectionCentre.findUnique({ where: { id: centreId } });
    if (!centre) {
      throw new NotFoundDomainException('Inspection centre not found');
    }
    return centre;
  }
}
