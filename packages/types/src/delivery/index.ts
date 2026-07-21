export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETURNED'
  | 'CANCELLED';

export type AssignmentMethod = 'AUTO' | 'MANUAL';

export type ProofType = 'PHOTO' | 'OTP' | 'SIGNATURE' | 'PHOTO_AND_OTP';

export interface DeliveryJobDto {
  id: string;
  orderId: string;
  riderId: string | null;
  merchantId: string;
  customerId: string;
  assignmentMethod: AssignmentMethod;
  status: DeliveryStatus;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  estimatedDistanceMeters: number | null;
  estimatedDurationSeconds: number | null;
  deliveryFee: number;
  assignedAt: string | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  arrivedAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  returnedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryTrackingDto {
  id: string;
  deliveryJobId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  createdAt: string;
}

export interface DeliveryProofDto {
  id: string;
  deliveryJobId: string;
  proofType: ProofType;
  photoUrl: string | null;
  otp: string | null;
  signatureUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiderLocationDto {
  riderId: string;
  online: boolean;
  acceptingOrders: boolean;
  latitude: number | null;
  longitude: number | null;
  activeJobCount: number;
  updatedAt: string;
}

export interface DeliveryEtaDto {
  jobId: string;
  orderId: string;
  status: DeliveryStatus;
  distanceMeters: number | null;
  durationSeconds: number | null;
  etaSeconds: number | null;
  lastKnownLocation: DeliveryTrackingDto | null;
}

export interface UpdateRiderAvailabilityDto {
  online: boolean;
  acceptingOrders: boolean;
  latitude?: number;
  longitude?: number;
}

export interface DeliverOrderDto {
  proofType: ProofType;
  photoUrl?: string;
  otp?: string;
  signatureUrl?: string;
  notes?: string;
}

export interface DeliveryLocationUpdateDto {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export interface AssignDeliveryRiderDto {
  riderId: string;
  method?: AssignmentMethod;
}

export interface DeliveryReasonDto {
  reason?: string;
}

export interface AdminDeliveryJobQuery {
  status?: DeliveryStatus;
  riderId?: string;
  merchantId?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export const DELIVERY_AUDIT_ACTIONS = {
  ASSIGNED: 'delivery.assigned',
  ACCEPTED: 'delivery.accepted',
  PICKED_UP: 'delivery.picked_up',
  ARRIVED: 'delivery.arrived',
  COMPLETED: 'delivery.completed',
  CANCELLED: 'delivery.cancelled',
  RETURNED: 'delivery.returned',
  FAILED: 'delivery.failed',
  LOCATION_UPDATED: 'delivery.location_updated',
  REJECTED: 'delivery.rejected',
} as const;

export type DeliveryAuditAction =
  (typeof DELIVERY_AUDIT_ACTIONS)[keyof typeof DELIVERY_AUDIT_ACTIONS];
