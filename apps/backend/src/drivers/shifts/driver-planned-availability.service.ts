import { Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS } from '../driver.constants';

import { toDriverPlannedAvailabilityDto } from './shift.mapper';

import type { SetDriverPlannedAvailabilityDto } from '../dto/set-driver-planned-availability.dto';
import type { DriverPlannedAvailabilityDto } from '@dripplex/types';

/** Driver Slice 2 item 6 — Shift Management: a driver's recurring weekly
 * intent to be online, for Operations staffing visibility only (see the
 * schema doc comment on `DriverPlannedAvailability` — it does not
 * automatically toggle the driver's real dispatch flag). */
@Injectable()
export class DriverPlannedAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async setEntry(
    driverUserId: string,
    dto: SetDriverPlannedAvailabilityDto,
    context: AuditContext,
  ): Promise<DriverPlannedAvailabilityDto> {
    if (dto.endMinute <= dto.startMinute) {
      throw new ValidationDomainException('endMinute must be after startMinute');
    }

    const entry = await this.prisma.driverPlannedAvailability.create({
      data: {
        driverId: driverUserId,
        dayOfWeek: dto.dayOfWeek,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.PLANNED_AVAILABILITY_SET,
      { ...context, userId: driverUserId },
      { resource: 'driver_planned_availability', resourceId: entry.id },
    );

    return toDriverPlannedAvailabilityDto(entry);
  }

  public async listOwn(driverUserId: string): Promise<DriverPlannedAvailabilityDto[]> {
    const entries = await this.prisma.driverPlannedAvailability.findMany({
      where: { driverId: driverUserId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
    return entries.map(toDriverPlannedAvailabilityDto);
  }

  public async deleteOwn(
    driverUserId: string,
    entryId: string,
    context: AuditContext,
  ): Promise<void> {
    const entry = await this.prisma.driverPlannedAvailability.findUnique({
      where: { id: entryId },
    });
    if (!entry) {
      throw new NotFoundDomainException('Planned availability entry not found');
    }
    if (entry.driverId !== driverUserId) {
      throw new ForbiddenDomainException('You do not have access to this entry');
    }

    await this.prisma.driverPlannedAvailability.delete({ where: { id: entryId } });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.PLANNED_AVAILABILITY_DELETED,
      { ...context, userId: driverUserId },
      { resource: 'driver_planned_availability', resourceId: entryId },
    );
  }

  /** Admin visibility — a specific driver's planned availability. */
  public async listForDriver(driverId: string): Promise<DriverPlannedAvailabilityDto[]> {
    const entries = await this.prisma.driverPlannedAvailability.findMany({
      where: { driverId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
    return entries.map(toDriverPlannedAvailabilityDto);
  }
}
