import type { InspectionCentreDto, InspectionChecklistItem, InspectionDto } from '@dripplex/types';
import type { Inspection, InspectionCentre, Prisma } from '@prisma/client';

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
