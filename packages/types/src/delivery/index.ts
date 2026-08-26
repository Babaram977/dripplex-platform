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
  /// DPX-COMMERCIAL-001 Slice 3 — the rider's confirmation of cash
  /// physically collected (paymentMethod=CASH orders only). Independent
  /// of the merchant commission accrual, which is always derived from
  /// order.subtotal — see docs/DPX-COMMERCIAL-001-SLICE-3-COD-CORRECTION.md.
  cashCollectedAmount: number | null;
  cashConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Customer-facing delivery detail, enriched with the assigned rider's
 * public name/phone (resolved server-side — DeliveryJobDto only carries
 * riderId) so the customer-web tracking UI can show who's delivering
 * without a separate rider-lookup endpoint. */
export interface CustomerDeliveryDto extends DeliveryJobDto {
  riderName: string | null;
  riderPhone: string | null;
}

/** Rider-facing delivery detail, enriched with the customer's display name.
 *
 * Deliberately **name only, no phone number**. The rider needs to know who
 * they are delivering to — to greet them, to open a chat thread with a human
 * name on it — and that is what a name gives them. A phone number is a
 * different thing: it outlives the job, leaves the platform, and cannot be
 * withdrawn once handed over. In-app chat covers the "I need to reach them"
 * case without publishing the customer's number to every rider who is briefly
 * assigned to them. (Founder decision, 2026-08-16.) */
export interface RiderDeliveryJobDto extends DeliveryJobDto {
  customerName: string | null;
  /// What the rider earned on this delivery. Null until settlement runs —
  /// never 0, which would read as "you earned nothing for this".
  ///
  /// Deliberately on the RIDER view and not on `DeliveryJobDto`, which the
  /// CUSTOMER also receives: the courier's pay and, by subtraction from the
  /// delivery fee, the platform's margin, are not the customer's business.
  riderEarning: number | null;
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

/// DPX-COMMERCIAL-001 Slice 3 — the rider's cash-collection confirmation.
export interface ConfirmCashDto {
  amountCollected: number;
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
  CASH_CONFIRMED: 'delivery.cash_confirmed',
} as const;

export type DeliveryAuditAction =
  (typeof DELIVERY_AUDIT_ACTIONS)[keyof typeof DELIVERY_AUDIT_ACTIONS];
