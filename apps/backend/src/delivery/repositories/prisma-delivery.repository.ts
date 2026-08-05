import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreateDeliveryJobInput,
  CreateDeliveryProofInput,
  CreateDeliveryTrackingInput,
  DeliveryRepository,
  ListDeliveryJobsFilter,
  UpdateDeliveryJobStatusInput,
  UpsertRiderAvailabilityInput,
} from './delivery.repository';
import type {
  AssignmentMethod,
  DeliveryJob,
  DeliveryProof,
  DeliveryTracking,
  Prisma,
  RiderAvailability,
} from '@prisma/client';

const ACTIVE_RIDER_JOB_STATUSES = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ACCEPTED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.ON_THE_WAY,
  DeliveryStatus.ARRIVED,
] as const;

@Injectable()
export class PrismaDeliveryRepository implements DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async createJob(input: CreateDeliveryJobInput): Promise<DeliveryJob> {
    return await this.prisma.deliveryJob.create({
      data: {
        id: randomUUID(),
        orderId: input.orderId,
        merchantId: input.merchantId,
        customerId: input.customerId,
        pickupLatitude: input.pickupLatitude,
        pickupLongitude: input.pickupLongitude,
        dropoffLatitude: input.dropoffLatitude,
        dropoffLongitude: input.dropoffLongitude,
        deliveryFee: input.deliveryFee,
        status: DeliveryStatus.PENDING,
        ...(input.assignmentMethod !== undefined
          ? { assignmentMethod: input.assignmentMethod }
          : {}),
        ...(input.estimatedDistanceMeters !== undefined
          ? { estimatedDistanceMeters: input.estimatedDistanceMeters }
          : {}),
        ...(input.estimatedDurationSeconds !== undefined
          ? { estimatedDurationSeconds: input.estimatedDurationSeconds }
          : {}),
      },
    });
  }

  public async findJobById(id: string): Promise<DeliveryJob | null> {
    return await this.prisma.deliveryJob.findUnique({ where: { id } });
  }

  public async findJobByOrderId(orderId: string): Promise<DeliveryJob | null> {
    return await this.prisma.deliveryJob.findUnique({ where: { orderId } });
  }

  public async findJobByOrderForCustomer(
    orderId: string,
    customerId: string,
  ): Promise<DeliveryJob | null> {
    return await this.prisma.deliveryJob.findFirst({ where: { orderId, customerId } });
  }

  public async listJobs(
    filter: ListDeliveryJobsFilter,
  ): Promise<{ items: DeliveryJob[]; total: number }> {
    const where: Prisma.DeliveryJobWhereInput = {
      ...(filter.status !== undefined ? { status: filter.status } : {}),
      ...(filter.riderId !== undefined ? { riderId: filter.riderId } : {}),
      ...(filter.merchantId !== undefined ? { merchantId: filter.merchantId } : {}),
      ...(filter.customerId !== undefined ? { customerId: filter.customerId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.deliveryJob.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.deliveryJob.count({ where }),
    ]);

    return { items, total };
  }

  public async listRiderJobs(riderId: string): Promise<DeliveryJob[]> {
    return await this.prisma.deliveryJob.findMany({
      where: {
        riderId,
        status: { in: [...ACTIVE_RIDER_JOB_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async updateJobStatus(
    id: string,
    status: DeliveryStatus,
    input?: UpdateDeliveryJobStatusInput,
  ): Promise<DeliveryJob> {
    return await this.prisma.deliveryJob.update({
      where: { id },
      data: {
        status,
        ...this.statusTimestampData(status),
        ...(input?.cancellationReason !== undefined
          ? { cancellationReason: input.cancellationReason }
          : {}),
      },
    });
  }

  public async confirmCash(id: string, amountCollected: number): Promise<DeliveryJob> {
    return await this.prisma.deliveryJob.update({
      where: { id },
      data: {
        cashCollectedAmount: amountCollected,
        cashConfirmedAt: new Date(),
      },
    });
  }

  public async assignRider(
    id: string,
    riderId: string,
    assignmentMethod: AssignmentMethod,
  ): Promise<DeliveryJob> {
    return await this.prisma.deliveryJob.update({
      where: { id },
      data: {
        riderId,
        assignmentMethod,
        status: DeliveryStatus.ASSIGNED,
        assignedAt: new Date(),
      },
    });
  }

  public async clearRider(id: string): Promise<DeliveryJob> {
    return await this.prisma.deliveryJob.update({
      where: { id },
      data: {
        riderId: null,
        status: DeliveryStatus.PENDING,
        assignedAt: null,
      },
    });
  }

  public async createTracking(input: CreateDeliveryTrackingInput): Promise<DeliveryTracking> {
    return await this.prisma.deliveryTracking.create({
      data: {
        id: randomUUID(),
        deliveryJobId: input.deliveryJobId,
        latitude: input.latitude,
        longitude: input.longitude,
        ...(input.heading !== undefined ? { heading: input.heading } : {}),
        ...(input.speed !== undefined ? { speed: input.speed } : {}),
        ...(input.accuracy !== undefined ? { accuracy: input.accuracy } : {}),
      },
    });
  }

  public async findLatestTracking(deliveryJobId: string): Promise<DeliveryTracking | null> {
    return await this.prisma.deliveryTracking.findFirst({
      where: { deliveryJobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findTrackingHistory(deliveryJobId: string): Promise<DeliveryTracking[]> {
    return await this.prisma.deliveryTracking.findMany({
      where: { deliveryJobId },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async createProof(input: CreateDeliveryProofInput): Promise<DeliveryProof> {
    return await this.prisma.deliveryProof.create({
      data: {
        id: randomUUID(),
        deliveryJobId: input.deliveryJobId,
        proofType: input.proofType,
        ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
        ...(input.otp !== undefined ? { otp: input.otp } : {}),
        ...(input.signatureUrl !== undefined ? { signatureUrl: input.signatureUrl } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  public async findProofs(deliveryJobId: string): Promise<DeliveryProof[]> {
    return await this.prisma.deliveryProof.findMany({
      where: { deliveryJobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async upsertRiderAvailability(
    input: UpsertRiderAvailabilityInput,
  ): Promise<RiderAvailability> {
    return await this.prisma.riderAvailability.upsert({
      where: { riderId: input.riderId },
      create: {
        riderId: input.riderId,
        online: input.online,
        acceptingOrders: input.acceptingOrders,
        activeJobCount: 0,
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      },
      update: {
        online: input.online,
        acceptingOrders: input.acceptingOrders,
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      },
    });
  }

  public async findRiderAvailability(riderId: string): Promise<RiderAvailability | null> {
    return await this.prisma.riderAvailability.findUnique({ where: { riderId } });
  }

  public async listAvailableRiders(maxActiveJobs: number): Promise<RiderAvailability[]> {
    return await this.prisma.riderAvailability.findMany({
      where: {
        online: true,
        acceptingOrders: true,
        activeJobCount: { lt: maxActiveJobs },
      },
    });
  }

  public async incrementRiderActiveJobCount(riderId: string): Promise<RiderAvailability> {
    return await this.prisma.riderAvailability.upsert({
      where: { riderId },
      create: {
        riderId,
        online: false,
        acceptingOrders: false,
        activeJobCount: 1,
      },
      update: {
        activeJobCount: { increment: 1 },
      },
    });
  }

  public async decrementRiderActiveJobCount(riderId: string): Promise<RiderAvailability> {
    await this.prisma.riderAvailability.updateMany({
      where: { riderId, activeJobCount: { gt: 0 } },
      data: { activeJobCount: { decrement: 1 } },
    });

    return await this.prisma.riderAvailability.upsert({
      where: { riderId },
      create: {
        riderId,
        online: false,
        acceptingOrders: false,
        activeJobCount: 0,
      },
      update: {},
    });
  }

  private statusTimestampData(status: DeliveryStatus): Prisma.DeliveryJobUpdateInput {
    if (status === DeliveryStatus.ACCEPTED) {
      return { acceptedAt: new Date() };
    }
    if (status === DeliveryStatus.PICKED_UP) {
      return { pickedUpAt: new Date() };
    }
    if (status === DeliveryStatus.ARRIVED) {
      return { arrivedAt: new Date() };
    }
    if (status === DeliveryStatus.DELIVERED) {
      return { deliveredAt: new Date() };
    }
    if (status === DeliveryStatus.FAILED) {
      return { failedAt: new Date() };
    }
    if (status === DeliveryStatus.CANCELLED) {
      return { cancelledAt: new Date() };
    }
    if (status === DeliveryStatus.RETURNED) {
      return { returnedAt: new Date() };
    }
    return {};
  }
}
