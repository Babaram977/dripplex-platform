import type {
  AssignmentMethod,
  DeliveryJob,
  DeliveryProof,
  DeliveryStatus,
  DeliveryTracking,
  Prisma,
  ProofType,
  RiderAvailability,
} from '@prisma/client';

export interface CreateDeliveryJobInput {
  orderId: string;
  merchantId: string;
  customerId: string;
  pickupLatitude: Prisma.Decimal | number | string;
  pickupLongitude: Prisma.Decimal | number | string;
  dropoffLatitude: Prisma.Decimal | number | string;
  dropoffLongitude: Prisma.Decimal | number | string;
  deliveryFee: Prisma.Decimal | number | string;
  estimatedDistanceMeters?: number | null;
  estimatedDurationSeconds?: number | null;
  assignmentMethod?: AssignmentMethod;
}

export interface ListDeliveryJobsFilter {
  status?: DeliveryStatus;
  riderId?: string;
  merchantId?: string;
  customerId?: string;
  skip: number;
  take: number;
}

export interface UpdateDeliveryJobStatusInput {
  cancellationReason?: string | null;
}

export interface CreateDeliveryTrackingInput {
  deliveryJobId: string;
  latitude: Prisma.Decimal | number | string;
  longitude: Prisma.Decimal | number | string;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
}

export interface CreateDeliveryProofInput {
  deliveryJobId: string;
  proofType: ProofType;
  photoUrl?: string | null;
  otp?: string | null;
  signatureUrl?: string | null;
  notes?: string | null;
}

export interface UpsertRiderAvailabilityInput {
  riderId: string;
  online: boolean;
  acceptingOrders: boolean;
  latitude?: Prisma.Decimal | number | string | null;
  longitude?: Prisma.Decimal | number | string | null;
}

export interface DeliveryRepository {
  createJob(input: CreateDeliveryJobInput): Promise<DeliveryJob>;
  findJobById(id: string): Promise<DeliveryJob | null>;
  findJobByOrderId(orderId: string): Promise<DeliveryJob | null>;
  findJobByOrderForCustomer(orderId: string, customerId: string): Promise<DeliveryJob | null>;
  listJobs(filter: ListDeliveryJobsFilter): Promise<{ items: DeliveryJob[]; total: number }>;
  listRiderJobs(riderId: string): Promise<DeliveryJob[]>;
  updateJobStatus(
    id: string,
    status: DeliveryStatus,
    input?: UpdateDeliveryJobStatusInput,
  ): Promise<DeliveryJob>;
  /// DPX-COMMERCIAL-001 Slice 3 — records the rider's cash-collection
  /// confirmation. Idempotent at the service layer (DeliveryService checks
  /// `cashConfirmedAt` before calling this).
  confirmCash(id: string, amountCollected: number): Promise<DeliveryJob>;
  assignRider(
    id: string,
    riderId: string,
    assignmentMethod: AssignmentMethod,
  ): Promise<DeliveryJob>;
  clearRider(id: string): Promise<DeliveryJob>;
  /**
   * DPX-RIDER-004 — deliveries that are ready but still have nobody assigned
   * (PENDING with a null riderId), oldest first, for the re-dispatch sweep.
   */
  listUnassignedJobs(limit: number): Promise<DeliveryJob[]>;
  /**
   * DPX-RIDER-004 — riders who already rejected THIS job, read from the
   * `delivery.rejected` audit records the reject path already writes. The sweep
   * excludes them so a re-dispatch never hands a rider back a delivery they
   * have already turned down.
   */
  listRejectedRiderIds(jobId: string, rejectedSince: Date): Promise<string[]>;
  createTracking(input: CreateDeliveryTrackingInput): Promise<DeliveryTracking>;
  findLatestTracking(deliveryJobId: string): Promise<DeliveryTracking | null>;
  findTrackingHistory(deliveryJobId: string): Promise<DeliveryTracking[]>;
  createProof(input: CreateDeliveryProofInput): Promise<DeliveryProof>;
  findProofs(deliveryJobId: string): Promise<DeliveryProof[]>;
  upsertRiderAvailability(input: UpsertRiderAvailabilityInput): Promise<RiderAvailability>;
  findRiderAvailability(riderId: string): Promise<RiderAvailability | null>;
  listAvailableRiders(maxActiveJobs: number): Promise<RiderAvailability[]>;
  /**
   * DPX-RIDER-004 — whether this rider may be given a delivery at all:
   * APPROVED and every required KYC document VERIFIED. Same rule
   * `listAvailableRiders` applies, minus the availability half, so a manual
   * assignment from the Operations Console cannot bypass the approval gate.
   */
  isRiderEligibleForDelivery(riderId: string): Promise<boolean>;
  incrementRiderActiveJobCount(riderId: string): Promise<RiderAvailability>;
  decrementRiderActiveJobCount(riderId: string): Promise<RiderAvailability>;
}

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');
