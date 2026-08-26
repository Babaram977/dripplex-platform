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

/**
 * Who is carrying this delivery.
 *
 * `RIDER` is a Marketplace courier; `DRIVER` is a ride-hailing driver who has
 * opted in (founder decision, 2026-08-25). The distinction is not cosmetic —
 * it selects the availability row that holds the active-job counter and the
 * `CommissionOwnerType` a cash delivery's commission is accrued against, and
 * getting either wrong misfiles money.
 */
export type CourierType = 'RIDER' | 'DRIVER';

/** One dispatchable courier, flattened out of whichever availability table
 *  they live in so the ranking code never branches on it. */
export interface DeliveryCandidate {
  userId: string;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  courierType: CourierType;
}

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
  /**
   * A rider's finished deliveries, newest first — what `listRiderJobs`
   * deliberately excludes. Riders had no history endpoint at all, so a
   * courier could see today's queue and no record of anything they had ever
   * completed, next to a wallet balance nothing explained.
   */
  listRiderJobHistory(
    riderId: string,
    skip: number,
    take: number,
  ): Promise<{ items: DeliveryJob[]; total: number }>;
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
    courierType: CourierType,
  ): Promise<DeliveryJob>;
  clearRider(id: string): Promise<DeliveryJob>;
  /**
   * DPX-RIDER-004 — deliveries that are ready but still have nobody assigned
   * (PENDING with a null riderId), oldest first, for the re-dispatch sweep.
   */
  listUnassignedJobs(limit: number): Promise<DeliveryJob[]>;
  /**
   * Jobs still sitting at ASSIGNED whose rider has not accepted them within the
   * accept window — oldest assignment first, so the longest-waiting merchant is
   * unblocked first. These are invisible to `listUnassignedJobs` (they have a
   * rider and are not PENDING), which is exactly how they used to get stuck.
   */
  listStaleAssignedJobs(assignedBefore: Date, limit: number): Promise<DeliveryJob[]>;
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
  /**
   * Everyone dispatch may offer this delivery to, couriers and opted-in
   * drivers alike, in one normalized list.
   *
   * Returns `DeliveryCandidate` rather than `RiderAvailability` rows because
   * the two pools live in different tables with different column names —
   * `acceptingOrders`/`activeJobCount` against `acceptingRides`/
   * `activeRideCount` — and nothing downstream should have to know which
   * table a candidate came from. `courierType` is carried through because two
   * things genuinely do differ later: which availability row holds the active
   * job counter, and which `CommissionOwnerType` the cash commission lands on.
   */
  listAvailableCouriers(maxActiveJobs: number): Promise<DeliveryCandidate[]>;
  /**
   * DPX-RIDER-004 — whether this person may be given a delivery at all:
   * APPROVED and every required KYC document VERIFIED. Same rule
   * `listAvailableCouriers` applies, minus the availability half, so a manual
   * assignment from the Operations Console cannot bypass the approval gate.
   *
   * Resolves the courier type itself rather than taking it as an argument:
   * Ops assigns a person, and asking the caller to already know which pool
   * they belong to is how a driver gets checked against rider KYC they will
   * never hold. Null means eligible under neither.
   */
  resolveEligibleCourier(userId: string): Promise<CourierType | null>;
  /**
   * Move a courier's active-job counter, on whichever availability row is
   * actually theirs.
   *
   * Takes `courierType` rather than inferring it, because the old pair
   * upserted `rider_availability` keyed by user id unconditionally: pointing
   * a driver at a delivery would have silently created a phantom courier row
   * for them — online:false, but present — quietly polluting the very pool
   * dispatch reads from.
   */
  incrementActiveJobCount(userId: string, courierType: CourierType): Promise<void>;
  decrementActiveJobCount(userId: string, courierType: CourierType): Promise<void>;
}

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');
