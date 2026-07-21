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
  assignRider(
    id: string,
    riderId: string,
    assignmentMethod: AssignmentMethod,
  ): Promise<DeliveryJob>;
  clearRider(id: string): Promise<DeliveryJob>;
  createTracking(input: CreateDeliveryTrackingInput): Promise<DeliveryTracking>;
  findLatestTracking(deliveryJobId: string): Promise<DeliveryTracking | null>;
  findTrackingHistory(deliveryJobId: string): Promise<DeliveryTracking[]>;
  createProof(input: CreateDeliveryProofInput): Promise<DeliveryProof>;
  findProofs(deliveryJobId: string): Promise<DeliveryProof[]>;
  upsertRiderAvailability(input: UpsertRiderAvailabilityInput): Promise<RiderAvailability>;
  findRiderAvailability(riderId: string): Promise<RiderAvailability | null>;
  listAvailableRiders(maxActiveJobs: number): Promise<RiderAvailability[]>;
  incrementRiderActiveJobCount(riderId: string): Promise<RiderAvailability>;
  decrementRiderActiveJobCount(riderId: string): Promise<RiderAvailability>;
}

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');
