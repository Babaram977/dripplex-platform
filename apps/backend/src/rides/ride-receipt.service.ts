import { Injectable } from '@nestjs/common';
import { RideStatus } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import type { RideReceiptDto } from '@dripplex/types';

/**
 * Pure read model composed from the existing Ride row plus the driver's
 * User and DriverAvailability records — no new storage. There is no vehicle
 * plate/model/colour anywhere in the schema (confirmed by audit: driver KYC
 * and onboarding never capture it, only DriverAvailability.vehicleType, an
 * ECONOMY/TRICYCLE category), so the receipt surfaces what's actually
 * available rather than fabricating vehicle details.
 */
@Injectable()
export class RideReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  public async getReceipt(customerId: string, rideId: string): Promise<RideReceiptDto> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, customerId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    if (ride.status !== RideStatus.COMPLETED) {
      throw new ValidationDomainException(
        `Receipt not available until ride is completed (status: ${ride.status})`,
      );
    }

    let driver: RideReceiptDto['driver'] = null;
    if (ride.driverId) {
      const [driverUser, availability] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: ride.driverId } }),
        this.prisma.driverAvailability.findUnique({ where: { driverId: ride.driverId } }),
      ]);
      if (driverUser) {
        driver = {
          id: driverUser.id,
          name: `${driverUser.firstName} ${driverUser.lastName}`,
          phone: driverUser.phone,
          vehicleType: availability?.vehicleType ?? ride.rideType,
        };
      }
    }

    return {
      rideId: ride.id,
      status: ride.status,
      driver,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      distanceMeters: ride.estimatedDistanceMeters,
      durationSeconds: ride.estimatedDurationSeconds,
      fare: {
        baseFare: Number(ride.baseFare),
        distanceFare: Number(ride.distanceFare),
        timeFare: Number(ride.timeFare),
        totalFare: Number(ride.totalFare),
        tipAmount: ride.tipAmount !== null ? Number(ride.tipAmount) : null,
        platformCommission:
          ride.platformCommission !== null ? Number(ride.platformCommission) : null,
        driverEarning: ride.driverEarning !== null ? Number(ride.driverEarning) : null,
      },
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      requestedAt: ride.requestedAt.toISOString(),
      completedAt: ride.completedAt ? ride.completedAt.toISOString() : null,
    };
  }
}
