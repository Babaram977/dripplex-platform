import { Injectable } from '@nestjs/common';
import { Prisma, VehicleApprovalStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ConflictDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS } from '../driver.constants';

import { toVehicleDto } from './vehicle.mapper';

import type { CreateVehicleDto } from '../dto/create-vehicle.dto';
import type { ListVehiclesQueryDto } from '../dto/list-vehicles-query.dto';
import type { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import type { VehicleDto } from '@dripplex/types';
import type { Vehicle } from '@prisma/client';

/** DPX-DRIVER-002 — vehicle registration + admin approval workflow. A driver
 * may register multiple vehicles; each is independently reviewed. Inspection
 * pass/fail is tracked separately on `Inspection`, not here — see
 * InspectionsService. */
@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async createVehicle(
    driverUserId: string,
    dto: CreateVehicleDto,
    context: AuditContext,
  ): Promise<VehicleDto> {
    let vehicle: Vehicle;
    try {
      vehicle = await this.prisma.vehicle.create({
        data: {
          driverId: driverUserId,
          plateNumber: dto.plateNumber.trim().toUpperCase(),
          make: dto.make.trim(),
          model: dto.model.trim(),
          color: dto.color.trim(),
          year: dto.year,
          rideCategory: dto.rideCategory,
          photos: dto.photos ?? [],
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictDomainException('A vehicle with this plate number is already registered');
      }
      throw error;
    }

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.VEHICLE_SUBMITTED,
      { ...context, userId: driverUserId },
      {
        resource: 'vehicle',
        resourceId: vehicle.id,
        metadata: { plateNumber: vehicle.plateNumber },
      },
    );

    return toVehicleDto(vehicle);
  }

  public async listOwnVehicles(driverUserId: string): Promise<VehicleDto[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { driverId: driverUserId },
      orderBy: { createdAt: 'desc' },
    });
    return vehicles.map(toVehicleDto);
  }

  public async getOwnVehicle(driverUserId: string, vehicleId: string): Promise<VehicleDto> {
    const vehicle = await this.requireOwnedVehicle(driverUserId, vehicleId);
    return toVehicleDto(vehicle);
  }

  public async updateOwnVehicle(
    driverUserId: string,
    vehicleId: string,
    dto: UpdateVehicleDto,
    context: AuditContext,
  ): Promise<VehicleDto> {
    const existing = await this.requireOwnedVehicle(driverUserId, vehicleId);

    // Any change to the physical vehicle's identifying/category details
    // invalidates a prior approval — it must be re-reviewed. Toggling
    // isActive or updating photos alone does not.
    const changesReviewableFields =
      (dto.make !== undefined && dto.make.trim() !== existing.make) ||
      (dto.model !== undefined && dto.model.trim() !== existing.model) ||
      (dto.color !== undefined && dto.color.trim() !== existing.color) ||
      (dto.year !== undefined && dto.year !== existing.year) ||
      (dto.rideCategory !== undefined && dto.rideCategory !== existing.rideCategory);

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(dto.make !== undefined ? { make: dto.make.trim() } : {}),
        ...(dto.model !== undefined ? { model: dto.model.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color.trim() } : {}),
        ...(dto.year !== undefined ? { year: dto.year } : {}),
        ...(dto.rideCategory !== undefined ? { rideCategory: dto.rideCategory } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.photos !== undefined ? { photos: dto.photos } : {}),
        ...(changesReviewableFields && existing.approvalStatus !== VehicleApprovalStatus.PENDING
          ? {
              approvalStatus: VehicleApprovalStatus.PENDING,
              approvedAt: null,
              approvedBy: null,
              rejectedReason: null,
            }
          : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.VEHICLE_SUBMITTED,
      { ...context, userId: driverUserId },
      {
        resource: 'vehicle',
        resourceId: updated.id,
        metadata: { reReview: changesReviewableFields },
      },
    );

    return toVehicleDto(updated);
  }

  public async listVehicles(query: ListVehiclesQueryDto): Promise<{
    items: VehicleDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = query.approvalStatus ? { approvalStatus: query.approvalStatus } : {};
    const [vehicles, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      items: vehicles.map(toVehicleDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async approveVehicle(
    vehicleId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<VehicleDto> {
    const vehicle = await this.requireVehicle(vehicleId);

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        approvalStatus: VehicleApprovalStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: adminUserId,
        rejectedReason: null,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.VEHICLE_APPROVED,
      { ...context, userId: adminUserId },
      { resource: 'vehicle', resourceId: updated.id },
    );

    return toVehicleDto(updated);
  }

  public async rejectVehicle(
    vehicleId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<VehicleDto> {
    const vehicle = await this.requireVehicle(vehicleId);

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        approvalStatus: VehicleApprovalStatus.REJECTED,
        approvedAt: null,
        approvedBy: adminUserId,
        rejectedReason: reason,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.VEHICLE_REJECTED,
      { ...context, userId: adminUserId },
      { resource: 'vehicle', resourceId: updated.id, metadata: { reason } },
    );

    return toVehicleDto(updated);
  }

  private async requireVehicle(vehicleId: string): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundDomainException('Vehicle not found');
    }
    return vehicle;
  }

  private async requireOwnedVehicle(driverUserId: string, vehicleId: string): Promise<Vehicle> {
    const vehicle = await this.requireVehicle(vehicleId);
    if (vehicle.driverId !== driverUserId) {
      throw new ForbiddenDomainException('You do not have access to this vehicle');
    }
    return vehicle;
  }
}
