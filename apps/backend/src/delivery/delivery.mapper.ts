import { DeliveryStatus as PrismaDeliveryStatus } from '@prisma/client';

import { haversineMeters } from './delivery-fee.service';
import { DEFAULT_SPEED_MPS } from './delivery.constants';

import type {
  DeliveryEtaDto,
  DeliveryJobDto,
  DeliveryProofDto,
  DeliveryTrackingDto,
  RiderLocationDto,
} from '@dripplex/types';
import type {
  DeliveryJob,
  DeliveryProof,
  DeliveryTracking,
  RiderAvailability,
} from '@prisma/client';

export type { CustomerDeliveryDto, DeliveryJobDto, RiderLocationDto } from '@dripplex/types';
export type EtaDto = DeliveryEtaDto;
export type ProofDto = DeliveryProofDto;
export type TrackingDto = DeliveryTrackingDto;

function nullableDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toDeliveryJobDto(job: DeliveryJob): DeliveryJobDto {
  return {
    id: job.id,
    orderId: job.orderId,
    riderId: job.riderId,
    merchantId: job.merchantId,
    customerId: job.customerId,
    assignmentMethod: job.assignmentMethod,
    status: job.status,
    pickupLatitude: Number(job.pickupLatitude),
    pickupLongitude: Number(job.pickupLongitude),
    dropoffLatitude: Number(job.dropoffLatitude),
    dropoffLongitude: Number(job.dropoffLongitude),
    estimatedDistanceMeters: job.estimatedDistanceMeters,
    estimatedDurationSeconds: job.estimatedDurationSeconds,
    deliveryFee: Number(job.deliveryFee),
    assignedAt: nullableDate(job.assignedAt),
    acceptedAt: nullableDate(job.acceptedAt),
    pickedUpAt: nullableDate(job.pickedUpAt),
    arrivedAt: nullableDate(job.arrivedAt),
    deliveredAt: nullableDate(job.deliveredAt),
    failedAt: nullableDate(job.failedAt),
    cancelledAt: nullableDate(job.cancelledAt),
    returnedAt: nullableDate(job.returnedAt),
    cancellationReason: job.cancellationReason,
    cashCollectedAmount: job.cashCollectedAmount === null ? null : Number(job.cashCollectedAmount),
    cashConfirmedAt: nullableDate(job.cashConfirmedAt),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export function toTrackingDto(tracking: DeliveryTracking): DeliveryTrackingDto {
  return {
    id: tracking.id,
    deliveryJobId: tracking.deliveryJobId,
    latitude: Number(tracking.latitude),
    longitude: Number(tracking.longitude),
    heading: tracking.heading,
    speed: tracking.speed,
    accuracy: tracking.accuracy,
    createdAt: tracking.createdAt.toISOString(),
  };
}

export function toProofDto(proof: DeliveryProof): DeliveryProofDto {
  return {
    id: proof.id,
    deliveryJobId: proof.deliveryJobId,
    proofType: proof.proofType,
    photoUrl: proof.photoUrl,
    otp: proof.otp,
    signatureUrl: proof.signatureUrl,
    notes: proof.notes,
    createdAt: proof.createdAt.toISOString(),
    updatedAt: proof.updatedAt.toISOString(),
  };
}

export function toEtaDto(
  job: DeliveryJob,
  latestTracking?: DeliveryTracking | null,
): DeliveryEtaDto {
  const terminalStatuses: PrismaDeliveryStatus[] = [
    PrismaDeliveryStatus.DELIVERED,
    PrismaDeliveryStatus.CANCELLED,
    PrismaDeliveryStatus.FAILED,
    PrismaDeliveryStatus.RETURNED,
  ];
  const lastKnownLocation = latestTracking ? toTrackingDto(latestTracking) : null;
  const remainingDistance =
    lastKnownLocation && !terminalStatuses.includes(job.status)
      ? haversineMeters(
          lastKnownLocation.latitude,
          lastKnownLocation.longitude,
          Number(job.dropoffLatitude),
          Number(job.dropoffLongitude),
        )
      : null;
  const distanceMeters = remainingDistance ?? job.estimatedDistanceMeters;
  const durationSeconds =
    remainingDistance !== null
      ? Math.ceil(remainingDistance / DEFAULT_SPEED_MPS)
      : job.estimatedDurationSeconds;

  return {
    jobId: job.id,
    orderId: job.orderId,
    status: job.status,
    distanceMeters,
    durationSeconds,
    etaSeconds: terminalStatuses.includes(job.status) ? 0 : durationSeconds,
    lastKnownLocation,
  };
}

export function toRiderLocationDto(availability: RiderAvailability): RiderLocationDto {
  return {
    riderId: availability.riderId,
    online: availability.online,
    acceptingOrders: availability.acceptingOrders,
    latitude: availability.latitude === null ? null : Number(availability.latitude),
    longitude: availability.longitude === null ? null : Number(availability.longitude),
    activeJobCount: availability.activeJobCount,
    updatedAt: availability.updatedAt.toISOString(),
  };
}
