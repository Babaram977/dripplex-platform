import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import {
  DeliveryCourierType,
  DeliveryStatus,
  DriverStatus,
  KycVerificationStatus,
  RiderStatus,
} from '@prisma/client';

import { REQUIRED_DRIVER_KYC_DOCUMENT_TYPES } from '../../drivers/driver.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRED_RIDER_KYC_DOCUMENT_TYPES } from '../../riders/rider.constants';
import { DELIVERY_AUDIT_ACTIONS } from '../delivery.constants';

import type {
  CourierType,
  CreateDeliveryJobInput,
  CreateDeliveryProofInput,
  CreateDeliveryTrackingInput,
  DeliveryCandidate,
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

/**
 * A rider's finished work — everything the active queue deliberately hides.
 *
 * FAILED and RETURNED are included alongside DELIVERED because a courier's
 * history is not only their successes: a job that came back is one they were
 * paid or not paid for, and hiding it makes their wallet unexplainable.
 * CANCELLED is not, since a job cancelled before they touched it is not their
 * record.
 */
const COMPLETED_RIDER_JOB_STATUSES = [
  DeliveryStatus.DELIVERED,
  DeliveryStatus.FAILED,
  DeliveryStatus.RETURNED,
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

  public async listRiderJobHistory(
    riderId: string,
    skip: number,
    take: number,
  ): Promise<{ items: DeliveryJob[]; total: number }> {
    const where = {
      riderId,
      status: { in: [...COMPLETED_RIDER_JOB_STATUSES] },
    };
    const [items, total] = await Promise.all([
      this.prisma.deliveryJob.findMany({
        where,
        // Finished-at, not created-at: a job assigned days ago and delivered
        // this morning belongs at the top of the rider's history.
        orderBy: [{ deliveredAt: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.deliveryJob.count({ where }),
    ]);
    return { items, total };
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
    courierType: CourierType,
  ): Promise<DeliveryJob> {
    return await this.prisma.deliveryJob.update({
      where: { id },
      data: {
        riderId,
        // Written with the assignee, in the same statement. A job that names
        // a courier but not which pool they came from would settle against
        // the wrong commission account.
        courierType:
          courierType === 'DRIVER' ? DeliveryCourierType.DRIVER : DeliveryCourierType.RIDER,
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

  public async listUnassignedJobs(limit: number): Promise<DeliveryJob[]> {
    return await this.prisma.deliveryJob.findMany({
      where: {
        status: DeliveryStatus.PENDING,
        riderId: null,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  public async listStaleAssignedJobs(assignedBefore: Date, limit: number): Promise<DeliveryJob[]> {
    return await this.prisma.deliveryJob.findMany({
      where: {
        status: DeliveryStatus.ASSIGNED,
        riderId: { not: null },
        assignedAt: { lt: assignedBefore },
      },
      orderBy: { assignedAt: 'asc' },
      take: limit,
    });
  }

  public async listRejectedRiderIds(jobId: string, rejectedSince: Date): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        action: DELIVERY_AUDIT_ACTIONS.REJECTED,
        resource: 'delivery_job',
        resourceId: jobId,
        createdAt: { gte: rejectedSince },
      },
      select: { metadata: true },
    });

    const riderIds = new Set<string>();
    for (const row of rows) {
      const metadata = row.metadata as Record<string, unknown> | null;
      const riderId = metadata?.['riderId'];
      if (typeof riderId === 'string' && riderId !== '') {
        riderIds.add(riderId);
      }
    }
    return [...riderIds];
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

  /**
   * Riders dispatch may offer a delivery to.
   *
   * Availability (online / accepting / under the job cap) is necessary but not
   * sufficient: the rider must also be APPROVED and hold a VERIFIED document
   * for every type in REQUIRED_RIDER_KYC_DOCUMENT_TYPES. Before DPX-RIDER-004
   * this filtered on availability alone, so approving a rider gated nothing and
   * an unapproved rider who toggled online was auto-assigned real orders.
   *
   * The KYC condition is one AND-ed relation filter per required type — "has at
   * least one VERIFIED document of this type" for each — which is how "all
   * required documents verified" is expressed without loading the documents.
   */
  public async listAvailableCouriers(maxActiveJobs: number): Promise<DeliveryCandidate[]> {
    // Two pools, queried separately because they are two tables with two
    // column vocabularies, then flattened. Concurrently: neither depends on
    // the other, and dispatch runs on a 30-second sweep.
    const [riders, drivers] = await Promise.all([
      this.prisma.riderAvailability.findMany({
        where: {
          online: true,
          acceptingOrders: true,
          activeJobCount: { lt: maxActiveJobs },
          rider: {
            deletedAt: null,
            riderProfile: {
              status: RiderStatus.APPROVED,
              isApproved: true,
              deletedAt: null,
            },
            AND: REQUIRED_RIDER_KYC_DOCUMENT_TYPES.map((documentType) => ({
              riderKycDocuments: {
                some: {
                  documentType,
                  verificationStatus: KycVerificationStatus.VERIFIED,
                },
              },
            })),
          },
        },
        select: { riderId: true, latitude: true, longitude: true },
      }),
      // Drivers who opted in. `acceptingRides` is deliberately NOT required:
      // a driver may want parcels without wanting passengers, and the two
      // toggles are independent by design. `activeRideCount` is the cap here
      // — a driver already on a fare is not offered a delivery on top of it,
      // which is the same rule as the courier job cap by another name.
      this.prisma.driverAvailability.findMany({
        where: {
          online: true,
          acceptingDeliveries: true,
          activeRideCount: { lt: maxActiveJobs },
          driver: {
            deletedAt: null,
            driverProfile: {
              status: DriverStatus.APPROVED,
              isApproved: true,
              suspendedAt: null,
              deletedAt: null,
            },
            AND: REQUIRED_DRIVER_KYC_DOCUMENT_TYPES.map((documentType) => ({
              driverKycDocuments: {
                some: {
                  documentType,
                  verificationStatus: KycVerificationStatus.VERIFIED,
                },
              },
            })),
          },
        },
        select: { driverId: true, latitude: true, longitude: true },
      }),
    ]);

    return [
      ...riders.map((r) => ({
        userId: r.riderId,
        latitude: r.latitude,
        longitude: r.longitude,
        courierType: 'RIDER' as const,
      })),
      ...drivers.map((d) => ({
        userId: d.driverId,
        latitude: d.latitude,
        longitude: d.longitude,
        courierType: 'DRIVER' as const,
      })),
    ];
  }

  public async resolveEligibleCourier(userId: string): Promise<CourierType | null> {
    const asRider = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        riderProfile: {
          status: RiderStatus.APPROVED,
          isApproved: true,
          deletedAt: null,
        },
        AND: REQUIRED_RIDER_KYC_DOCUMENT_TYPES.map((documentType) => ({
          riderKycDocuments: {
            some: {
              documentType,
              verificationStatus: KycVerificationStatus.VERIFIED,
            },
          },
        })),
      },
      select: { id: true },
    });
    // Courier first. A user who is somehow both is a courier for delivery
    // purposes — that is the identity the delivery domain was built around,
    // and the one whose earnings and commission already reconcile here.
    if (asRider !== null) return 'RIDER';

    const asDriver = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        driverProfile: {
          status: DriverStatus.APPROVED,
          isApproved: true,
          suspendedAt: null,
          deletedAt: null,
        },
        AND: REQUIRED_DRIVER_KYC_DOCUMENT_TYPES.map((documentType) => ({
          driverKycDocuments: {
            some: {
              documentType,
              verificationStatus: KycVerificationStatus.VERIFIED,
            },
          },
        })),
      },
      select: { id: true },
    });
    return asDriver !== null ? 'DRIVER' : null;
  }

  public async incrementActiveJobCount(userId: string, courierType: CourierType): Promise<void> {
    if (courierType === 'DRIVER') {
      // updateMany, not upsert: DriverAvailability.vehicleType is required and
      // has no sane default, so there is nothing honest to create a row from.
      // A driver who has a delivery necessarily already went online, which is
      // the only way that row comes into being.
      await this.prisma.driverAvailability.updateMany({
        where: { driverId: userId },
        data: { activeRideCount: { increment: 1 } },
      });
      return;
    }
    await this.prisma.riderAvailability.upsert({
      where: { riderId: userId },
      create: {
        riderId: userId,
        online: false,
        acceptingOrders: false,
        activeJobCount: 1,
      },
      update: {
        activeJobCount: { increment: 1 },
      },
    });
  }

  public async decrementActiveJobCount(userId: string, courierType: CourierType): Promise<void> {
    if (courierType === 'DRIVER') {
      await this.prisma.driverAvailability.updateMany({
        where: { driverId: userId, activeRideCount: { gt: 0 } },
        data: { activeRideCount: { decrement: 1 } },
      });
      return;
    }
    await this.prisma.riderAvailability.updateMany({
      where: { riderId: userId, activeJobCount: { gt: 0 } },
      data: { activeJobCount: { decrement: 1 } },
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
