import type { DriverPlannedAvailabilityDto, DriverShiftDto } from '@dripplex/types';
import type { DriverPlannedAvailability, DriverShift } from '@prisma/client';

export function toDriverShiftDto(shift: DriverShift): DriverShiftDto {
  return {
    id: shift.id,
    driverId: shift.driverId,
    status: shift.status,
    startedAt: shift.startedAt.toISOString(),
    endedAt: shift.endedAt ? shift.endedAt.toISOString() : null,
    breakStartedAt: shift.breakStartedAt ? shift.breakStartedAt.toISOString() : null,
    continuousSince: shift.continuousSince.toISOString(),
    totalBreakSeconds: shift.totalBreakSeconds,
    forceEndedBy: shift.forceEndedBy,
    adminNotes: shift.adminNotes,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
  };
}

export function toDriverPlannedAvailabilityDto(
  entry: DriverPlannedAvailability,
): DriverPlannedAvailabilityDto {
  return {
    id: entry.id,
    driverId: entry.driverId,
    dayOfWeek: entry.dayOfWeek,
    startMinute: entry.startMinute,
    endMinute: entry.endMinute,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}
