import type { SosAlertDto } from '@dripplex/types';
import type { SosAlert } from '@prisma/client';

export function toSosAlertDto(alert: SosAlert): SosAlertDto {
  return {
    id: alert.id,
    driverId: alert.driverId,
    rideId: alert.rideId,
    vehicleId: alert.vehicleId,
    latitude: alert.latitude ? Number(alert.latitude) : null,
    longitude: alert.longitude ? Number(alert.longitude) : null,
    batteryLevel: alert.batteryLevel,
    status: alert.status,
    adminNotes: alert.adminNotes,
    acknowledgedBy: alert.acknowledgedBy,
    acknowledgedAt: alert.acknowledgedAt ? alert.acknowledgedAt.toISOString() : null,
    resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
    customerNotifiedAt: alert.customerNotifiedAt ? alert.customerNotifiedAt.toISOString() : null,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}
