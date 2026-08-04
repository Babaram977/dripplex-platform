import type { VehicleDto } from '@dripplex/types';
import type { Vehicle } from '@prisma/client';

export function toVehicleDto(vehicle: Vehicle): VehicleDto {
  return {
    id: vehicle.id,
    driverId: vehicle.driverId,
    plateNumber: vehicle.plateNumber,
    make: vehicle.make,
    model: vehicle.model,
    color: vehicle.color,
    year: vehicle.year,
    rideCategory: vehicle.rideCategory,
    isActive: vehicle.isActive,
    approvalStatus: vehicle.approvalStatus,
    approvedAt: vehicle.approvedAt ? vehicle.approvedAt.toISOString() : null,
    approvedBy: vehicle.approvedBy,
    rejectedReason: vehicle.rejectedReason,
    photos: vehicle.photos,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}
