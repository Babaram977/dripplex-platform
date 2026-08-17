import type {
  AdminInspectionDto,
  InspectionCentreDto,
  InspectionChecklistItem,
  InspectionDto,
} from '@dripplex/types';
import type { Inspection, InspectionCentre, Prisma, User, Vehicle } from '@prisma/client';

export function toInspectionCentreDto(centre: InspectionCentre): InspectionCentreDto {
  return {
    id: centre.id,
    name: centre.name,
    address: centre.address,
    city: centre.city,
    latitude: centre.latitude ? Number(centre.latitude) : null,
    longitude: centre.longitude ? Number(centre.longitude) : null,
    isActive: centre.isActive,
    createdAt: centre.createdAt.toISOString(),
    updatedAt: centre.updatedAt.toISOString(),
  };
}

export function toInspectionDto(inspection: Inspection): InspectionDto {
  return {
    id: inspection.id,
    driverId: inspection.driverId,
    vehicleId: inspection.vehicleId,
    centreId: inspection.centreId,
    inspectorId: inspection.inspectorId,
    decidedBy: inspection.decidedBy,
    status: inspection.status,
    scheduledAt: inspection.scheduledAt.toISOString(),
    completedAt: inspection.completedAt ? inspection.completedAt.toISOString() : null,
    checklist: toChecklist(inspection.checklist),
    notes: inspection.notes,
    photos: inspection.photos,
    reinspectionOfId: inspection.reinspectionOfId,
    createdAt: inspection.createdAt.toISOString(),
    updatedAt: inspection.updatedAt.toISOString(),
  };
}

function toChecklist(value: Prisma.JsonValue | null): InspectionChecklistItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value as unknown as InspectionChecklistItem[];
}

/**
 * The Operations view: the same inspection with the driver and vehicle named.
 *
 * Nulls are deliberate rather than defensive — a driver or vehicle row that has
 * since been removed should read as unknown, never as somebody else.
 */
export function toAdminInspectionDto(
  inspection: Inspection,
  driver: Pick<User, 'firstName' | 'lastName' | 'phone'> | null,
  vehicle: Pick<Vehicle, 'plateNumber' | 'make' | 'model' | 'color'> | null,
): AdminInspectionDto {
  // make/model/color are non-nullable on Vehicle, so the only case worth
  // guarding is an empty string — a blank part would leave a dangling separator.
  const label = vehicle
    ? [[vehicle.make, vehicle.model].filter((part) => part !== '').join(' '), vehicle.color]
        .filter((part) => part !== '')
        .join(' · ')
    : '';

  return {
    ...toInspectionDto(inspection),
    driverName: driver ? `${driver.firstName} ${driver.lastName}`.trim() : null,
    driverPhone: driver?.phone ?? null,
    vehiclePlate: vehicle?.plateNumber ?? null,
    vehicleLabel: label.length > 0 ? label : null,
  };
}
