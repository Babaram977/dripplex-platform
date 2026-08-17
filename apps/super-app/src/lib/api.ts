// ─── DrippleX API Client ──────────────────────────────────────────────────────
// Wired to the real backend contract (2026-08-10).
// Base: https://api.dripplex.com/api/v1
// Every response is unwrapped from { success, data } before returning.

import { auth, DxUser } from './auth';

const BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://api.dripplex.com/api/v1';

// ─── Envelope unwrapper ────────────────────────────────────────────────────────
// Backend always responds { success: true, data: T } on 2xx
// or { success: false, statusCode, errorCode, message } on errors.
async function dx<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const token = auth.getAccessToken();
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 → try silent refresh once
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return dx(method, path, body, params);
    auth.clear();
    window.dispatchEvent(new Event('dx:session-expired'));
    throw new ApiError(401, 'Session expired — please log in again.', 'SESSION_EXPIRED');
  }

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.success === false) {
    throw new ApiError(
      json?.statusCode ?? res.status,
      json?.message ?? res.statusText,
      json?.errorCode ?? 'UNKNOWN_ERROR',
    );
  }

  // 204 No Content or envelope-less
  if (json === null) return undefined as T;
  // Unwrap { success: true, data: T }
  return ('data' in json ? json.data : json) as T;
}

// Silent token refresh
async function tryRefresh(): Promise<boolean> {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    const tokens: AuthTokens = 'data' in json ? json.data : json;
    auth.setTokens(tokens.accessToken, tokens.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errorCode: string = 'UNKNOWN_ERROR',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Shared Types (from backend contract) ────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface PortalLoginResponse extends AuthTokens {
  user: DxUser;
  session: Record<string, unknown>;
}

export interface RegistrationResponse {
  userId: string;
  email: string | null;
  status: string;
  verification: Record<string, unknown>;
  profileId?: string;
  onboardingId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

// Wallet
export interface WalletDto {
  id: string;
  ownerType: string;
  ownerId: string;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  version: number;
  dailyLimit: number | null;
  singleTransactionLimit: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletLedgerEntryDto {
  id: string;
  walletId: string;
  type: 'CREDIT' | 'DEBIT' | 'REFUND' | 'SETTLEMENT' | 'CASHBACK' | 'WITHDRAWAL' | 'TRANSFER';
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface CustomerBankAccountDto {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  isDefault: boolean;
  createdAt: string;
}

export interface WithdrawalRequestDto {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

// Marketplace
export interface MerchantSummaryDto {
  id: string;
  businessName: string;
  businessType: string;
  logoUrl: string | null;
  coverPhotoUrl: string | null;
  verificationStatus: string;
  city: string;
  state: string;
  rating: { average: number; count: number };
  distanceKm: number | null;
  // null = hours not set → show "Hours unavailable", NOT "Closed"
  isOpenNow: boolean | null;
}

export interface ProductSummaryDto {
  id: string;
  merchantId: string;
  merchantName: string;
  categoryId: string | null;
  brandId: string | null;
  name: string;
  slug: string;
  basePrice: number;
  currency: string;
  primaryImageUrl: string | null;
  rating: { average: number; count: number };
  inStock: boolean;
  isFeatured: boolean;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Cart
export interface CartItemDto {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  imageSnapshot: string | null;
  unitPriceSnapshot: number;
  quantity: number;
  subtotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddressDto {
  id: string;
  label: 'HOME' | 'WORK' | 'OTHER';
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode?: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface CartDto {
  id: string;
  customerId: string;
  merchantId: string;
  currency: string;
  status: string;
  items: CartItemDto[];
  totals: {
    subtotal: number;
    discount: number;
    tax: number;
    deliveryFee: number;
    total: number;
    currency: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Orders
export type OrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DRIVER_ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'DISPUTED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUND';
export type FulfillmentType = 'DELIVERY' | 'PICKUP';
export type OrderPaymentMethod =
  'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY' | 'WALLET' | 'CASH' | 'MERCHANT_DIRECT';

export interface OrderItemDto {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  merchantId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  snapshotName: string;
  snapshotImage: string | null;
  snapshotSku: string | null;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  customerId: string;
  merchantId: string;
  cartId: string | null;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: OrderPaymentMethod | null;
  fulfillmentType: FulfillmentType;
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  currency: string;
  couponCode: string | null;
  deliveryAddressId: string | null;
  notes: string | null;
  estimatedReadyAt: string | null;
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: 'CUSTOMER' | 'MERCHANT' | 'ADMIN' | 'SYSTEM' | null;
  cancellationReason: string | null;
  items: OrderItemDto[];
  createdAt: string;
  updatedAt: string;
}

// Rides
export type RideStatus =
  | 'REQUESTED'
  | 'SEARCHING'
  | 'DRIVER_ASSIGNED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_DRIVERS_FOUND';

export type RideType = 'ECONOMY' | 'COMFORT' | 'XL' | 'TRICYCLE';
export type RidePaymentMethod = 'WALLET' | 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY' | 'CASH';

export interface RideDto {
  id: string;
  customerId: string;
  driverId: string | null;
  rideType: RideType;
  status: RideStatus;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string | null;
  estimatedDistanceMeters: number;
  estimatedDurationSeconds: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
  promotionId: string | null;
  promoDiscount: number;
  paymentMethod: RidePaymentMethod | null;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  platformCommission: number;
  driverEarning: number;
  tipAmount: number;
  requestedAt: string | null;
  assignedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A ride as its driver sees it — plus the passenger's name. Name only: the
 * driver reaches the passenger through in-app chat, not their phone book. */
export interface DriverRideDto extends RideDto {
  customerName: string | null;
}

/** A ride as its passenger sees it — plus the assigned driver's name, the
 * mirror of CustomerDeliveryDto.riderName. */
export interface CustomerRideDto extends RideDto {
  driverName: string | null;
}

// Driver ride offers (dispatch)
export interface RideOfferDto {
  id: string;
  rideId: string;
  driverId: string;
  status: string;
  offeredAt: string;
  expiresAt: string;
  respondedAt: string | null;
}

export interface RideOfferPreviewDto {
  id: string;
  rideId: string;
  status: string;
  expiresAt: string;
  rideType: RideType;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string | null;
  estimatedDistanceMeters: number;
  estimatedDurationSeconds: number;
  totalFare: number;
  paymentMethod: RidePaymentMethod | null;
}

export interface EstimateRideFareResponse {
  distanceMeters: number;
  durationSeconds: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
  promotionId: string | null;
  promoDiscount: number;
  finalFare: number;
}

export interface RideTypeCatalogEntryDto {
  rideType: RideType;
  label: string;
  description: string | null;
  basePrice: number;
  currency: string;
}

export interface NearbyDriverDto {
  latitude: number;
  longitude: number;
  vehicleType: RideType;
}

// Delivery
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

export interface DeliveryJobDto {
  id: string;
  orderId: string;
  riderId: string | null;
  merchantId: string;
  customerId: string;
  status: DeliveryStatus;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffLatitude: number;
  dropoffLongitude: number;
  estimatedDistanceMeters: number;
  estimatedDurationSeconds: number;
  deliveryFee: number;
  assignedAt: string | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  arrivedAt: string | null;
  deliveredAt: string | null;
  cashCollectedAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDeliveryDto extends DeliveryJobDto {
  riderName: string | null;
  riderPhone: string | null;
}

/** What the rider sees of the person they are delivering to: a name, and
 * deliberately no phone number — in-app chat is the channel. */
export interface RiderDeliveryJobDto extends DeliveryJobDto {
  customerName: string | null;
}

export interface DeliveryTrackingDto {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
}

export interface DeliveryEtaDto {
  estimatedArrivalAt: string;
  remainingSeconds: number;
}

// ── Messaging (DPX-CHAT-001) ────────────────────────────────────────────────
// A thread belongs to a delivery or a ride; the backend resolves who may read
// it from that job's own parties, so there is no thread id to manage here.
export interface MessageDto {
  id: string;
  contextType: 'DELIVERY' | 'RIDE';
  contextId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  body: string;
  /** True when the signed-in user sent it — drives which side it renders on. */
  mine: boolean;
  readAt: string | null;
  createdAt: string;
}

// Merchant types
export interface MerchantOrderDto extends OrderDto {}

export interface MerchantProductVariantDto {
  id: string;
  name: string;
  sku: string | null;
  priceOverride: number | null;
  isActive: boolean;
}

export interface MerchantProductDto {
  id: string;
  name: string;
  description: string | null;
  /** Flat alias of basePrice, kept for existing dashboard cards. */
  price: number;
  basePrice: number;
  currency: string;
  /** Display alias of categoryId (the UI shows/edits categoryId). */
  category: string | null;
  categoryId: string | null;
  sku: string | null;
  imageUrl: string | null;
  /** Derived: has sellable stock and is not manually disabled. */
  inStock: boolean;
  /** True when the backend product status is PUBLISHED. */
  published: boolean;
  status: string;
  /** Product-level inventory quantity (0 when untracked/none). */
  stockQty: number;
  variants: MerchantProductVariantDto[];
  createdAt: string;
  updatedAt: string;
}

// Raw product entity as returned by GET /merchant/products (before UI normalization).
export interface RawMerchantProduct {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  currency: string;
  categoryId: string | null;
  sku?: string | null;
  status: string;
  publishedAt: string | null;
  images?: { id: string; url: string; position: number }[];
  inventory?: {
    available?: number;
    quantity?: number;
    trackInventory?: boolean;
    manuallyDisabled?: boolean;
  } | null;
  variants?: {
    id: string;
    name: string;
    sku?: string | null;
    priceOverride?: number | null;
    isActive?: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface MerchantSettlementDto {
  id: string;
  orderId: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  status: 'PENDING' | 'SETTLED';
  settledAt: string | null;
  createdAt: string;
}

export interface MerchantBusinessDto {
  id: string;
  businessName: string;
  businessType: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  logoUrl: string | null;
  coverPhotoUrl: string | null;
  // Operating hours keyed by day (mon–sun), each an { open, close } pair or null
  // for a closed day — the same persisted shape the customer marketplace reads.
  operatingHours: Record<string, { open: string; close: string } | null> | null;
  isOpen: boolean;
  verificationStatus: string;
}

// One merchant KYC submission (matches the backend MerchantKyc record). The
// merchant submits documents one at a time; each is a full record with its own
// documentType + documentNumber + image and its own review status.
export interface MerchantKycDto {
  id: string;
  merchantId: string;
  businessId: string;
  documentType: string;
  documentNumber: string;
  frontImage: string;
  backImage: string | null;
  selfieImage: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

// GET /merchant/kyc returns the full submission history plus the newest one.
export interface MerchantKycStatusDto {
  latest: MerchantKycDto | null;
  items: MerchantKycDto[];
}

// One merchant settlement/payout bank account (backend BankAccount record).
export interface MerchantBankAccountDto {
  id: string;
  merchantId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  isDefault: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

// ─── Operations Console (admin) DTOs ────────────────────────────────────────
// A vehicle awaiting / holding an approval decision (backend VehicleDto). Used
// by the Ops Console Vehicles queue. photos[] are hosted image URLs.
export interface AdminVehicleDto {
  id: string;
  driverId: string;
  plateNumber: string;
  make: string;
  model: string;
  color: string;
  year: number;
  rideCategory: string;
  seats: number | null;
  isActive: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedAt: string | null;
  rejectedReason: string | null;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

// One driver KYC document (backend DriverKyc). frontImage/backImage are hosted
// URLs. verificationStatus drives the per-document review chip.
export interface AdminDriverKycDto {
  id: string;
  driverId: string;
  documentType: string;
  documentNumber: string;
  frontImage: string;
  backImage: string | null;
  expiresAt: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

// A merchant row for the Ops Console review desk (subset of MerchantProfileDto).
// `business`/`kyc` are embedded, so the queue shows the business + KYC state
// without an extra fetch.
export interface AdminMerchantDto {
  id: string;
  merchantId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  isApproved: boolean;
  rejectedReason: string | null;
  createdAt: string;
  business: {
    businessName: string;
    businessType: string;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'UNDER_REVIEW';
    city: string | null;
    state: string | null;
  } | null;
  // The document Operations must act on next (oldest PENDING first), or the
  // representative one when nothing is pending. The backend returns the full
  // record with signed image URLs, so the approvals desk can show the document
  // itself rather than just a status chip.
  kyc: MerchantKycDto | null;
}

// The rider's own profile (GET /rider/profile). `kyc` carries every document
// the rider submitted with its review state, which is what the pending-review
// screen needs to know whether documents are still outstanding.
export interface RiderProfileDto {
  id: string;
  riderId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  companyName: string | null;
  isApproved: boolean;
  rejectedReason: string | null;
  createdAt: string;
  kyc: {
    id: string;
    documentType: string;
    documentNumber: string;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
    remarks: string | null;
    createdAt: string;
  }[];
}

// The rider's dispatch availability (RiderAvailability). latitude/longitude are
// null until the rider goes online with a device position — and dispatch skips
// riders without coordinates.
export interface RiderAvailabilityDto {
  riderId: string;
  online: boolean;
  acceptingOrders: boolean;
  latitude: number | null;
  longitude: number | null;
  activeJobCount: number;
  updatedAt: string;
}

// One physical vehicle inspection (DPX-DRIVER-002 Phase 3). An officer records
// the walkthrough checklist; a supervisor then passes or fails it. `inspectionPassed`
// in the driver activation gate reads the latest DECIDED inspection per vehicle.
export interface InspectionChecklistItemDto {
  key: string;
  label: string;
  passed: boolean;
  notes?: string;
}

export interface AdminInspectionDto {
  id: string;
  driverId: string;
  vehicleId: string;
  centreId: string;
  inspectorId: string | null;
  decidedBy: string | null;
  status: 'SCHEDULED' | 'PASSED' | 'FAILED' | 'CANCELLED';
  scheduledAt: string;
  completedAt: string | null;
  checklist: InspectionChecklistItemDto[] | null;
  notes: string | null;
  photos: string[];
  reinspectionOfId: string | null;
  createdAt: string;
  updatedAt: string;
}

// The driver activation gate (DriverActivationService). Every condition the
// backend checks before a driver may go Active — the driver app shows this as
// its onboarding checklist instead of guessing at progress.
export interface DriverActivationChecks {
  identityVerified: boolean;
  requiredDocumentsApproved: boolean;
  vehicleApproved: boolean;
  inspectionPassed: boolean;
  agreementAccepted: boolean;
  accountNotLocked: boolean;
}

export interface DriverActivationEligibilityDto {
  driverId: string;
  eligible: boolean;
  checks: DriverActivationChecks;
  /** Human-readable reason per unmet check; empty when eligible. */
  missingReasons: string[];
  qualifyingVehicleId: string | null;
}

// A rider row for the Ops Console review desk (subset of RiderProfileDto).
export interface AdminRiderDto {
  id: string;
  riderId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  companyName: string | null;
  isApproved: boolean;
  rejectedReason: string | null;
  createdAt: string;
  kyc: {
    id: string;
    documentType: string;
    documentNumber: string;
    // Signed, short-lived GET URLs — a reviewer must be able to open the image.
    frontImage: string;
    backImage: string | null;
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
    remarks: string | null;
  }[];
}

// A driver row for the Ops Console (subset of backend DriverProfileDto). The
// admin list embeds the driver's KYC documents, so the KYC review queue needs
// no extra fetch.
/** A bank account a partner has linked for payouts. */
export interface PartnerBankAccountDto {
  id: string;
  bankName: string;
  bankCode: string | null;
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
  createdAt: string;
}

/** A payout request. The money leaves the wallet the moment this is created;
 * Operations pays it out by bank transfer on the weekly Monday run. */
export interface PayoutRequestDto {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  bankAccountId: string;
  failureReason: string | null;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
}

/** One line of the Monday settlement run, as Operations sees it. */
export interface SettlementLineDto {
  withdrawalId: string;
  userId: string;
  partnerType: 'RIDER' | 'DRIVER';
  name: string;
  phone: string | null;
  bankName: string;
  accountName: string;
  accountNumber: string;
  amount: number;
  currency: string;
  requestedAt: string;
  outstandingCommission: number;
}

export interface SettlementReportDto {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  lines: SettlementLineDto[];
  totals: {
    riderCount: number;
    driverCount: number;
    riderAmount: number;
    driverAmount: number;
    totalAmount: number;
  };
}

export interface AdminDriverDto {
  id: string;
  driverId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
  kyc: AdminDriverKycDto[];
}

// A single Operations work-queue case (SOS alert or incident report), as
// returned by /operations/queues/{sos,incidents}. Both share OperationsCaseBase
// fields; the type-specific fields (severity/category/description for incidents,
// lat/long/battery for SOS) are optional here so one shape covers both queues.
export interface AdminOperationsCaseDto {
  caseId: string;
  caseType: 'SOS' | 'INCIDENT' | 'SUPPORT';
  sourceId: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToRole: 'OPERATOR' | 'SUPERVISOR' | null;
  createdAt: string;
  updatedAt: string;
  driverId: string;
  driverName: string;
  driverPhone: string | null;
  // Optimistic-concurrency token — echo it back on every PATCH (409 on mismatch).
  version: number;
  // Incident-only
  category?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description?: string;
  rideId?: string | null;
  adminNotes?: string | null;
  // SOS-only
  latitude?: number | null;
  longitude?: number | null;
  batteryLevel?: number | null;
  // Support-only
  subject?: string;
  adminResponse?: string | null;
}

// One driver in the live fleet snapshot (GET /operations/fleet).
export interface AdminFleetDriverDto {
  driverId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: 'SOS' | 'SUSPENDED' | 'NEEDS_INSPECTION' | 'BUSY' | 'AVAILABLE' | 'OFFLINE';
  hasOpenSos: boolean;
  isSuspended: boolean;
  needsInspection: boolean;
  online: boolean;
  acceptingRides: boolean;
  latitude: number | null;
  longitude: number | null;
  vehicleType: string | null;
  activeRideId: string | null;
  shiftStatus: 'ACTIVE' | 'ON_BREAK' | null;
  vehiclePlateNumber: string | null;
}
export interface AdminFleetSummaryDto {
  totalDrivers: number;
  onlineCount: number;
  availableCount: number;
  busyCount: number;
  offlineCount: number;
  sosCount: number;
  suspendedCount: number;
  needsInspectionCount: number;
}

// One live ride in the operations ride queue (GET /operations/rides).
export interface AdminLiveRideDto {
  rideId: string;
  status: 'REQUESTED' | 'SEARCHING' | 'DRIVER_ASSIGNED' | 'ARRIVED' | 'IN_PROGRESS';
  rideType: string;
  customerId: string;
  customerName: string;
  driverId: string | null;
  driverName: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupAddress: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  dropoffAddress: string | null;
  requestedAt: string;
  assignedAt: string | null;
}

// One activity-feed event (GET /operations/dashboard/activity-feed).
export interface AdminActivityFeedItemDto {
  id: string;
  type: string;
  message: string;
  occurredAt: string;
  driverId: string | null;
  driverName: string | null;
}

// Operations analytics overview KPIs (GET /operations/analytics/overview).
export interface AdminAnalyticsOverviewDto {
  range: { from: string; to: string };
  ridesRequested: number;
  ridesCompleted: number;
  completionRate: number;
  cancellationRate: number;
  noDriversFoundRate: number;
  onlineDriversNow: number;
  activeDriversInRange: number;
  averageUtilizationRate: number | null;
  averageTimeToAcceptSeconds: number | null;
  repeatedOfferRideRate: number;
  openCasesCount: number;
  averageTimeToFirstResponseSeconds: number | null;
}

// One customer row for the Ops Console roster (GET /admin/customers). tripsCount
// and totalSpent are aggregated from the customer's COMPLETED rides.
export interface AdminCustomerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'BLOCKED';
  tripsCount: number;
  totalSpent: number;
  createdAt: string;
}

// Customer KYC
export interface CustomerKycStatusDto {
  level: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2';
  status:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'PENDING_REVIEW'
    | 'VERIFIED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'REQUIRES_RESUBMISSION';
  documentType: string | null;
  documentNumber: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  selfieUrl: string | null;
  remarks: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  levelAccess: { level0: boolean; level1: boolean };
}

// One active login session/device (GET /auth/sessions). `current` flags the
// caller's own session (must not be revocable in the UI).
export interface SessionDto {
  sessionId: string;
  current: boolean;
  portal: string | null;
  browser: string | null;
  operatingSystem: string | null;
  device: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  ip: string | null;
  location: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

// Loyalty (customer). Points accrue automatically on domain events; balance is
// `account.pointsBalance`, lifetime is `account.lifetimePoints`.
export interface LoyaltyLedgerEntryDto {
  id: string;
  points: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  expiresAt: string | null;
  createdAt: string;
}
/**
 * A live campaign from the promotions engine (GET /customer/promotions/active).
 * Only the fields the app needs to describe an offer honestly — the discount
 * itself is calculated server-side at pricing time, never here.
 */
export interface PromotionActiveDto {
  id: string;
  code: string | null;
  name: string;
  type: string;
  domains: string[];
  percentOff: number | null;
  amountOff: number | null;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  perUserLimit: number | null;
  endsAt: string | null;
}

export interface LoyaltyOverviewDto {
  account: {
    id: string;
    userId: string;
    pointsBalance: number;
    lifetimePoints: number;
    tier: string;
    createdAt: string;
    updatedAt: string;
  };
  nextTier: { tier: string; pointsRequired: number } | null;
  achievements: {
    id: string;
    earnedAt: string;
    achievement: {
      id: string;
      code: string;
      name: string;
      description: string | null;
      pointsReward: number;
      active: boolean;
      createdAt: string;
      updatedAt: string;
    };
  }[];
}

// Notifications
export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, unknown>;
  createdAt: string;
}

// ─── API Namespaces ───────────────────────────────────────────────────────────

/**
 * Payout surface shared by riders and drivers — identical routes under a
 * different prefix, because the backend exposes the same withdrawal machinery
 * to both. Built once so the two cannot drift apart.
 */
const partnerPayouts = (prefix: 'rider' | 'driver') => ({
  listBankAccounts: () => dx<PartnerBankAccountDto[]>('GET', `/${prefix}/wallet/bank-accounts`),
  addBankAccount: (body: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    bankCode?: string;
  }) => dx<PartnerBankAccountDto>('POST', `/${prefix}/wallet/bank-accounts`, body),
  setDefaultBankAccount: (id: string) =>
    dx<PartnerBankAccountDto>('PATCH', `/${prefix}/wallet/bank-accounts/${id}/default`),
  removeBankAccount: (id: string) =>
    dx<{ removed: boolean }>('DELETE', `/${prefix}/wallet/bank-accounts/${id}`),
  hasPin: () => dx<{ set: boolean }>('GET', `/${prefix}/wallet/pin`),
  setPin: (pin: string) => dx<{ set: true }>('POST', `/${prefix}/wallet/pin`, { pin }),
  requestPayout: (body: { amount: number; bankAccountId: string; pin: string }) =>
    dx<PayoutRequestDto>('POST', `/${prefix}/wallet/payouts`, body),
  listPayouts: () => dx<PaginatedResult<PayoutRequestDto>>('GET', `/${prefix}/wallet/payouts`),
});

export const api = {
  // ── AUTH ───────────────────────────────────────────────────────────────────
  auth: {
    // Registration
    registerCustomer: (body: {
      name?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      password: string;
    }) => dx<RegistrationResponse>('POST', '/auth/register/customer', body),
    registerMerchant: (body: Record<string, unknown>) =>
      dx<RegistrationResponse>('POST', '/auth/register/merchant', body),
    registerDriver: (body: Record<string, unknown>) =>
      dx<RegistrationResponse>('POST', '/auth/register/driver', body),
    registerRider: (body: Record<string, unknown>) =>
      dx<RegistrationResponse>('POST', '/auth/register/rider', body),
    becomeDriver: () => dx<{ userId: string }>('POST', '/auth/roles/driver'),
    becomeMerchant: () => dx<{ userId: string }>('POST', '/auth/roles/merchant'),

    // Login — one per portal
    loginCustomer: (body: { email?: string; phone?: string; password: string }) =>
      dx<PortalLoginResponse>('POST', '/auth/login/customer', body),
    loginDriver: (body: { email?: string; phone?: string; password: string }) =>
      dx<PortalLoginResponse>('POST', '/auth/login/driver', body),
    loginRider: (body: { email?: string; phone?: string; password: string }) =>
      dx<PortalLoginResponse>('POST', '/auth/login/rider', body),
    loginMerchant: (body: { email?: string; phone?: string; password: string }) =>
      dx<PortalLoginResponse>('POST', '/auth/login/merchant', body),
    loginAdmin: (body: { email?: string; phone?: string; password: string }) =>
      dx<PortalLoginResponse>('POST', '/auth/login/admin', body),
    loginOperations: (body: { email?: string; phone?: string; password: string }) =>
      dx<PortalLoginResponse>('POST', '/auth/login/operations', body),

    // Phone verification (OTP) — real routes are under /auth/phone/*.
    // The backend has NO /auth/otp/* endpoints; registration dispatches a
    // phone OTP that is confirmed here with { phone, otp }, which activates
    // the account (PENDING_VERIFICATION → ACTIVE) so login can succeed.
    sendPhoneOtp: (body: { phone: string }) =>
      dx<{ submitted: true }>('POST', '/auth/phone/send-otp', body),
    verifyPhoneOtp: (body: { phone: string; otp: string }) =>
      dx<{ phone: string; status: string; phoneVerifiedAt: string }>(
        'POST',
        '/auth/phone/verify',
        body,
      ),
    resendPhoneOtp: (body: { phone: string }) =>
      dx<{ submitted: true }>('POST', '/auth/phone/resend', body),

    // Email verification (OTP CODE) — real routes are under /auth/verify/*.
    // Registration dispatches a numeric email OTP; this confirms it with
    // { email, otp } and activates the account (for portals that don't require
    // phone verification, e.g. customer). This is the email counterpart to
    // verifyPhoneOtp and the path a new customer uses when onboarding by email
    // (works today; SMS via Termii is pending sender-ID approval).
    verifyEmailOtp: (body: { email: string; otp: string }) =>
      dx<{ email: string; status: string; emailVerifiedAt: string }>(
        'POST',
        '/auth/verify/email',
        body,
      ),
    resendEmailOtp: (body: { email: string }) =>
      dx<{ submitted: true }>('POST', '/auth/verify/email/resend', body),

    // Email verification (token / magic-link) — a DIFFERENT feature under
    // /auth/email/*, kept for completeness. Not used by the OTP-code flow above.
    sendEmailVerification: (body: { email: string }) =>
      dx<unknown>('POST', '/auth/email/send-verification', body),
    verifyEmail: (body: { email: string; token: string }) =>
      dx<unknown>('POST', '/auth/email/verify', body),
    resendEmailVerification: (body: { email: string }) =>
      dx<unknown>('POST', '/auth/email/resend', body),

    // Session
    refresh: () =>
      dx<AuthTokens>('POST', '/auth/refresh', { refreshToken: auth.getRefreshToken() }),
    logout: () => dx<{ loggedOut: boolean }>('POST', '/auth/logout'),
    logoutAll: () => dx<{ loggedOut: boolean }>('POST', '/auth/logout-all'),
    me: () => dx<DxUser>('GET', '/auth/me'),
    updateMe: (body: {
      firstName?: string;
      lastName?: string;
      profilePhotoUrl?: string;
      dateOfBirth?: string;
      gender?: string;
    }) => dx<DxUser>('PATCH', '/auth/me', body),

    // Password reset: request an emailed OTP, then submit that code + a new
    // password. (Reset is verified by the OTP — the email is the only channel.)
    forgotPassword: (body: { email: string }) => dx<unknown>('POST', '/auth/password/forgot', body),
    resetPassword: (body: { email: string; otp: string; password: string }) =>
      dx<unknown>('POST', '/auth/password/reset', body),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      dx<unknown>('POST', '/auth/password/change', body),

    // Active sessions / devices. Revoking the current session is disallowed by
    // the backend; the UI must hide the revoke action on the `current` row.
    listSessions: () => dx<{ items: SessionDto[] }>('GET', '/auth/sessions'),
    revokeSession: (sessionId: string) => dx<void>('DELETE', `/auth/sessions/${sessionId}`),
    revokeOtherSessions: () => dx<{ revokedCount: number }>('DELETE', '/auth/sessions'),

    // Change phone / email — two-step, OTP-confirmed. `request` sends an OTP to
    // the NEW phone/email; `confirm` applies the change once the code verifies.
    requestPhoneChange: (body: { newPhone: string }) =>
      dx<{ expiresInSeconds: number }>('POST', '/auth/me/phone/change', body),
    confirmPhoneChange: (body: { otp: string }) =>
      dx<DxUser>('POST', '/auth/me/phone/change/confirm', body),
    requestEmailChange: (body: { newEmail: string }) =>
      dx<{ expiresInSeconds: number }>('POST', '/auth/me/email/change', body),
    confirmEmailChange: (body: { otp: string }) =>
      dx<DxUser>('POST', '/auth/me/email/change/confirm', body),
  },

  // ── WALLET (customer) ───────────────────────────────────────────────────────
  wallet: {
    get: () => dx<WalletDto>('GET', '/customer/wallet'),
    getTransactions: (params?: { page?: number; pageSize?: number; type?: string }) =>
      dx<PaginatedResult<WalletLedgerEntryDto>>(
        'GET',
        '/customer/wallet/transactions',
        undefined,
        params,
      ),
    transfer: (body: {
      toUserId: string;
      amount: number;
      currency?: string;
      description?: string;
    }) =>
      dx<{ source: WalletDto; destination: WalletDto }>('POST', '/customer/wallet/transfer', body),
    findRecipient: (phone: string) =>
      dx<{ id: string; name: string; phone: string }[]>(
        'GET',
        '/customer/wallet/transfer/recipients',
        undefined,
        { phone },
      ),
    fund: (body: { amount: number; provider?: string; callbackUrl?: string }) =>
      dx<{ authorizationUrl: string; reference: string }>('POST', '/customer/wallet/fund', body),
    verifyFunding: (body: { reference?: string }) =>
      dx<WalletDto>('POST', '/customer/wallet/fund/verify', body),
    getStatement: (params: { month: number; year: number }) =>
      dx<unknown>('GET', '/customer/wallet/statement', undefined, params),
    getPinStatus: () => dx<{ hasPinSet: boolean }>('GET', '/customer/wallet/pin/status'),
    setPin: (body: { pin: string }) =>
      dx<{ hasPinSet: boolean }>('POST', '/customer/wallet/pin', body),
    verifyPin: (body: { pin: string }) =>
      dx<{ valid: boolean }>('POST', '/customer/wallet/pin/verify', body),
    getBankAccounts: () => dx<CustomerBankAccountDto[]>('GET', '/customer/wallet/bank-accounts'),
    addBankAccount: (body: {
      bankCode: string;
      accountNumber: string;
      bankName: string;
      accountName: string;
    }) => dx<CustomerBankAccountDto>('POST', '/customer/wallet/bank-accounts', body),
    requestWithdrawal: (body: { amount: number; bankAccountId: string }) =>
      dx<WithdrawalRequestDto>('POST', '/customer/wallet/withdrawals', body),
    getWithdrawals: (params?: { page?: number; pageSize?: number; status?: string }) =>
      dx<PaginatedResult<WithdrawalRequestDto>>(
        'GET',
        '/customer/wallet/withdrawals',
        undefined,
        params,
      ),
  },

  // ── MARKETPLACE (public, no auth) ──────────────────────────────────────────
  marketplace: {
    getMerchants: (params?: Record<string, string | number | boolean>) =>
      dx<CursorPaginatedResult<MerchantSummaryDto>>('GET', '/merchants', undefined, params),
    searchMerchants: (
      query: string,
      params?: { lat?: number; lng?: number; cursor?: string; limit?: number },
    ) =>
      dx<CursorPaginatedResult<MerchantSummaryDto>>('GET', '/merchants/smart-search', undefined, {
        query,
        ...params,
      }),
    getMerchant: (id: string, params?: { lat?: number; lng?: number }) =>
      dx<MerchantSummaryDto & { products?: ProductSummaryDto[] }>(
        'GET',
        `/merchants/${id}`,
        undefined,
        params,
      ),
    getProducts: (params?: Record<string, string | number | boolean>) =>
      dx<CursorPaginatedResult<ProductSummaryDto>>('GET', '/products', undefined, params),
    getFeaturedProducts: (params?: Record<string, string | number | boolean>) =>
      dx<CursorPaginatedResult<ProductSummaryDto>>('GET', '/products/featured', undefined, params),
    getTrendingProducts: (params?: Record<string, string | number | boolean>) =>
      dx<CursorPaginatedResult<ProductSummaryDto>>('GET', '/products/trending', undefined, params),
    searchProducts: (
      query: string,
      params?: { lat?: number; lng?: number; cursor?: string; limit?: number },
    ) =>
      dx<CursorPaginatedResult<ProductSummaryDto>>('GET', '/products/smart-search', undefined, {
        query,
        ...params,
      }),
    getProduct: (id: string) =>
      dx<ProductSummaryDto & { description?: string }>('GET', `/products/${id}`),
    getSimilarProducts: (id: string) => dx<ProductSummaryDto[]>('GET', `/products/${id}/similar`),
    getCategories: () => dx<CategoryDto[]>('GET', '/categories'),
    getBrands: () =>
      dx<{ id: string; name: string; slug: string; logoUrl: string | null }[]>('GET', '/brands'),
  },

  // ── CART ───────────────────────────────────────────────────────────────────
  cart: {
    get: () => dx<CartDto | null>('GET', '/customer/cart'),
    addItem: (body: {
      merchantId: string;
      productId: string;
      variantId?: string;
      productName: string;
      imageUrl?: string;
      unitPrice: number;
      quantity: number;
      currency?: string;
      sku?: string;
    }) => dx<CartDto>('POST', '/customer/cart/items', body),
    updateItem: (itemId: string, quantity: number) =>
      dx<CartDto>('PATCH', `/customer/cart/items/${itemId}`, { quantity }),
    removeItem: (itemId: string) => dx<CartDto>('DELETE', `/customer/cart/items/${itemId}`),
    clear: () => dx<{ cleared: boolean; cartId: string | null }>('DELETE', '/customer/cart'),
    recalculate: () => dx<CartDto>('POST', '/customer/cart/recalculate'),
  },

  // ── DELIVERY ADDRESSES (customer) ──────────────────────────────────────────
  addresses: {
    list: () => dx<{ items: CustomerAddressDto[]; total: number }>('GET', '/customer/addresses'),
    getDefault: () => dx<CustomerAddressDto | null>('GET', '/customer/addresses/default'),
    create: (body: {
      label: 'HOME' | 'WORK' | 'OTHER';
      recipientName: string;
      phone: string;
      addressLine1: string;
      addressLine2?: string;
      landmark?: string;
      city: string;
      state: string;
      country: string;
      postalCode?: string;
      latitude: number;
      longitude: number;
      isDefault?: boolean;
    }) => dx<CustomerAddressDto>('POST', '/customer/addresses', body),
    setDefault: (id: string) =>
      dx<CustomerAddressDto>('PATCH', `/customer/addresses/${id}/default`),
  },

  // ── ORDERS (customer) ──────────────────────────────────────────────────────
  orders: {
    checkout: (body: {
      cartId?: string;
      fulfillmentType?: FulfillmentType;
      deliveryAddressId?: string;
      couponCode?: string;
      notes?: string;
    }) => dx<{ order: OrderDto }>('POST', '/customer/checkout', body),
    list: (params?: { page?: number; pageSize?: number }) =>
      dx<PaginatedResult<OrderDto>>('GET', '/customer/orders', undefined, params),
    get: (id: string) => dx<OrderDto>('GET', `/customer/orders/${id}`),
    cancel: (id: string, reason?: string) =>
      dx<OrderDto>('POST', `/customer/orders/${id}/cancel`, { reason }),
    pay: (id: string, body: { provider?: string; callbackUrl?: string }) =>
      dx<{ authorizationUrl?: string; reference?: string }>(
        'POST',
        `/customer/orders/${id}/pay`,
        body,
      ),
    verifyPayment: (id: string, body: { reference?: string }) =>
      dx<unknown>('POST', `/customer/orders/${id}/verify`, body),
    getPaymentStatus: (id: string) =>
      dx<{ status: PaymentStatus }>('GET', `/customer/orders/${id}/payment`),

    // Delivery tracking (REST poll — no WebSocket for orders)
    getDelivery: (orderId: string) =>
      dx<CustomerDeliveryDto>('GET', `/customer/orders/${orderId}/delivery`),
    getTracking: (orderId: string) =>
      dx<DeliveryTrackingDto[]>('GET', `/customer/orders/${orderId}/tracking`),
    getEta: (orderId: string) => dx<DeliveryEtaDto>('GET', `/customer/orders/${orderId}/eta`),
    getMerchantBank: (orderId: string) =>
      dx<{ bankName: string; accountName: string; accountNumber: string; currency: string }>(
        'GET',
        `/customer/orders/${orderId}/merchant-bank`,
      ),
  },

  // ── RIDES (customer) ───────────────────────────────────────────────────────
  rides: {
    getRideTypes: () => dx<RideTypeCatalogEntryDto[]>('GET', '/customer/rides/types'),
    estimate: (body: {
      rideType: RideType;
      pickupLatitude: number;
      pickupLongitude: number;
      dropoffLatitude: number;
      dropoffLongitude: number;
      couponCode?: string;
    }) => dx<EstimateRideFareResponse>('POST', '/customer/rides/estimate', body),
    book: (body: {
      rideType: RideType;
      pickupLatitude: number;
      pickupLongitude: number;
      pickupAddress?: string;
      dropoffLatitude: number;
      dropoffLongitude: number;
      dropoffAddress?: string;
      couponCode?: string;
    }) => dx<RideDto>('POST', '/customer/rides', body),
    list: (params?: { page?: number; limit?: number; status?: RideStatus }) =>
      dx<PaginatedResult<RideDto>>('GET', '/customer/rides', undefined, params),
    get: (id: string) => dx<CustomerRideDto>('GET', `/customer/rides/${id}`),
    getNearbyDrivers: (params: {
      latitude: number;
      longitude: number;
      rideType: RideType;
      radiusMeters?: number;
    }) => dx<NearbyDriverDto[]>('GET', '/customer/rides/nearby-drivers', undefined, params),
    getTracking: (id: string) =>
      dx<{ latitude: number; longitude: number; at: string }[]>(
        'GET',
        `/customer/rides/${id}/tracking`,
      ),
    cancel: (id: string, reason?: string) =>
      dx<RideDto>('POST', `/customer/rides/${id}/cancel`, { reason }),
    pay: (id: string, body: { method: RidePaymentMethod; callbackUrl?: string }) =>
      dx<{ ride: RideDto; authorizationUrl?: string; reference?: string }>(
        'POST',
        `/customer/rides/${id}/pay`,
        body,
      ),
    verifyPayment: (id: string, body: { reference?: string }) =>
      dx<RideDto>('POST', `/customer/rides/${id}/pay/verify`, body),
    getReceipt: (id: string) =>
      dx<{
        id: string;
        fare: number;
        currency: string;
        items: Record<string, number>;
        driver: { name: string };
        createdAt: string;
      }>('GET', `/customer/rides/${id}/receipt`),
    rateDriver: (
      id: string,
      body: { rating: number; comment?: string; categoryRatings?: Record<string, number> },
    ) => dx<unknown>('POST', `/customer/rides/${id}/rate-driver`, body),
    tip: (id: string, amount: number) =>
      dx<RideDto>('POST', `/customer/rides/${id}/tip`, { amount }),
    report: (id: string, body: { category: string; description?: string }) =>
      dx<unknown>('POST', `/customer/rides/${id}/report`, body),
  },

  // ── RIDES (driver) ─────────────────────────────────────────────────────────
  driverRides: {
    ...partnerPayouts('driver'),
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      dx<PaginatedResult<RideDto>>('GET', '/driver/rides', undefined, params),
    setAvailability: (body: {
      online: boolean;
      acceptingRides: boolean;
      vehicleType: RideType;
      latitude?: number;
      longitude?: number;
      deviceId?: string;
    }) => dx<unknown>('POST', '/driver/rides/availability', body),
    getAvailability: () => dx<unknown | null>('GET', '/driver/rides/availability'),
    getActive: () => dx<DriverRideDto | null>('GET', '/driver/rides/active'),
    getOffers: () => dx<RideOfferDto[]>('GET', '/driver/rides/offers'),
    getOfferPreview: (offerId: string) =>
      dx<RideOfferPreviewDto>('GET', `/driver/rides/offers/${offerId}`),
    acceptOffer: (offerId: string) => dx<RideDto>('POST', `/driver/rides/offers/${offerId}/accept`),
    declineOffer: (offerId: string) => dx<null>('POST', `/driver/rides/offers/${offerId}/decline`),
    arrive: (id: string) => dx<RideDto>('POST', `/driver/rides/${id}/arrive`),
    start: (id: string) => dx<RideDto>('POST', `/driver/rides/${id}/start`),
    complete: (id: string) => dx<RideDto>('POST', `/driver/rides/${id}/complete`),
    cancel: (id: string, reason?: string) =>
      dx<RideDto>('POST', `/driver/rides/${id}/cancel`, { reason }),
    confirmCash: (id: string) => dx<RideDto>('POST', `/driver/rides/${id}/cash-confirm`),
    rateCustomer: (id: string, body: { rating: number; comment?: string }) =>
      dx<unknown>('POST', `/driver/rides/${id}/rate-customer`, body),
    getWallet: () => dx<WalletDto>('GET', '/driver/wallet'),
    getWalletTransactions: (params?: { page?: number; pageSize?: number }) =>
      dx<PaginatedResult<WalletLedgerEntryDto>>(
        'GET',
        '/driver/wallet/transactions',
        undefined,
        params,
      ),
  },

  // ── DRIVER onboarding (KYC docs + vehicle) ──────────────────────────────────
  driver: {
    // POST /driver/kyc — the document image must already be a hosted URL
    // (upload it first via uploadFile → R2). documentType is the KycDocumentType
    // enum (DRIVER_LICENSE | VEHICLE_REGISTRATION | GUARANTOR_ID | …).
    submitKyc: (body: {
      documentType: string;
      documentNumber: string;
      frontImage: string;
      backImage?: string;
    }) => dx<unknown>('POST', '/driver/kyc', body),
    // The driver's own vehicles — dispatch matches a ride's type against
    // DriverAvailability.vehicleType, so going online has to send the category
    // of the vehicle they actually drive.
    listVehicles: () => dx<AdminVehicleDto[]>('GET', '/driver/vehicles'),
    createVehicle: (body: {
      plateNumber: string;
      make: string;
      model: string;
      color: string;
      year: number;
      rideCategory: RideType;
      seats: number;
      photos?: string[];
    }) => dx<unknown>('POST', '/driver/vehicles', body),
    // Onboarding: persist the driver's emergency contact. relationship must be one
    // of the fixed backend set (Spouse | Parent | Sibling | Child | Relative |
    // Friend | Other).
    submitEmergencyContact: (body: {
      emergencyContactName: string;
      emergencyContactPhone: string;
      emergencyContactRelationship: string;
      emergencyContactEmail?: string;
    }) => dx<unknown>('POST', '/driver/onboarding/emergency-contact', body),
    // Record acceptance of the driver agreement (version string).
    acceptAgreement: (agreementVersion: string) =>
      dx<unknown>('POST', '/driver/onboarding/agreement', { agreementVersion }),
    // The driver's OWN submitted documents with review state — so the app can
    // show what is verified, pending or rejected instead of relisting every
    // document as outstanding on every visit.
    getKyc: () => dx<AdminDriverKycDto[]>('GET', '/driver/kyc'),
    // The six conditions the backend requires before a driver can be Active
    // (DriverActivationService is the single platform-wide gate). This is the
    // driver's own read-only view of what is still blocking them.
    getActivationEligibility: () =>
      dx<DriverActivationEligibilityDto>('GET', '/driver/activation-eligibility'),
    // Submit the completed onboarding for Ops review (moves to pending review).
    submitOnboarding: () => dx<unknown>('POST', '/driver/onboarding/submit'),
  },

  // ── In-app messaging ────────────────────────────────────────────────────────
  messages: {
    listForDelivery: (deliveryJobId: string) =>
      dx<MessageDto[]>('GET', `/messages/delivery/${deliveryJobId}`),
    sendForDelivery: (deliveryJobId: string, body: string) =>
      dx<MessageDto>('POST', `/messages/delivery/${deliveryJobId}`, { body }),
    listForRide: (rideId: string) => dx<MessageDto[]>('GET', `/messages/ride/${rideId}`),
    sendForRide: (rideId: string, body: string) =>
      dx<MessageDto>('POST', `/messages/ride/${rideId}`, { body }),
    unreadCount: () => dx<{ unread: number }>('GET', '/messages/unread-count'),
  },

  // ── Signed uploads (R2 object storage) ──────────────────────────────────────
  uploads: {
    // POST /uploads/sign — returns a short-lived pre-signed PUT URL. folder is
    // one of the backend UPLOAD_FOLDERS (e.g. 'kyc-documents'); permission-gated.
    sign: (body: { folder: string; contentType: string; contentLength: number }) =>
      dx<{
        method: 'PUT';
        // Pre-signed URL to PUT the bytes to. NOTE: the backend field is
        // `uploadUrl` (not `url`) — reading the wrong name yields undefined and
        // makes the browser PUT fail with "Failed to fetch".
        uploadUrl: string;
        key: string;
        publicUrl: string;
        expiresAt: string;
        maxBytes: number;
        // Headers the PUT MUST send — both are bound into the signature, so the
        // upload is rejected if they don't match exactly (DPX-STORAGE-001).
        requiredHeaders: { 'Content-Type': string; 'Content-Length': string };
      }>('POST', '/uploads/sign', body),
  },

  // ── RIDER (delivery) ────────────────────────────────────────────────────────
  rider: {
    ...partnerPayouts('rider'),
    getJobs: () => dx<RiderDeliveryJobDto[]>('GET', '/rider/jobs'),
    getJob: (id: string) => dx<RiderDeliveryJobDto>('GET', `/rider/jobs/${id}`),
    acceptJob: (id: string) => dx<DeliveryJobDto>('POST', `/rider/jobs/${id}/accept`),
    rejectJob: (id: string) => dx<DeliveryJobDto>('POST', `/rider/jobs/${id}/reject`),
    pickup: (id: string) => dx<DeliveryJobDto>('POST', `/rider/jobs/${id}/pickup`),
    arrived: (id: string) => dx<DeliveryJobDto>('POST', `/rider/jobs/${id}/arrived`),
    deliver: (
      id: string,
      body: { proofType: string; photoUrl?: string; otp?: string; notes?: string },
    ) => dx<DeliveryJobDto>('POST', `/rider/jobs/${id}/deliver`, body),
    confirmCash: (id: string, amountCollected: number) =>
      dx<DeliveryJobDto>('POST', `/rider/jobs/${id}/confirm-cash`, { amountCollected }),
    pushLocation: (
      id: string,
      body: { latitude: number; longitude: number; heading?: number; speed?: number },
    ) => dx<DeliveryTrackingDto>('POST', `/rider/jobs/${id}/location`, body),
    // Going online without coordinates makes the rider invisible to dispatch:
    // AssignmentService drops every candidate whose latitude/longitude is null,
    // so always send the device position here.
    setAvailability: (body: {
      online: boolean;
      acceptingOrders: boolean;
      latitude?: number;
      longitude?: number;
    }) => dx<RiderAvailabilityDto>('POST', '/rider/availability', body),
    // Stored availability, so the app shows the server's truth instead of
    // assuming offline on every load. Null until the rider first goes online.
    getAvailability: () => dx<RiderAvailabilityDto | null>('GET', '/rider/availability'),
    // Own profile — includes the submitted KYC documents and their review state.
    getProfile: () => dx<RiderProfileDto>('GET', '/rider/profile'),
    getWallet: () => dx<WalletDto>('GET', '/rider/wallet'),

    // ── Onboarding: KYC docs (ID + Guarantor ID) + company name ───────────────
    // documentType is the KycDocumentType enum (NATIONAL_ID | GUARANTOR_ID | …);
    // frontImage/backImage are hosted URLs (upload first via uploadFile → R2).
    submitKyc: (body: {
      documentType: string;
      documentNumber: string;
      frontImage: string;
      backImage?: string;
    }) => dx<unknown>('POST', '/rider/kyc', body),
    updateProfile: (body: { companyName?: string }) => dx<unknown>('PATCH', '/rider/profile', body),
  },

  // ── MERCHANT ───────────────────────────────────────────────────────────────
  merchant: {
    // Business profile
    getBusiness: () => dx<MerchantBusinessDto>('GET', '/merchant/business'),
    // Registration: create the merchant's business record (minimal onboarding —
    // only businessName + businessType are required; it starts PENDING and
    // enters the Ops approval queue). Use this the first time; updateBusiness
    // PATCHes an existing one.
    createBusiness: (body: {
      businessName: string;
      businessType: string;
      description?: string;
      phone?: string;
      address?: string;
      email?: string;
      city?: string;
      state?: string;
      country?: string;
      registrationNumber?: string;
    }) => dx<MerchantBusinessDto>('POST', '/merchant/business', body),
    updateBusiness: (body: Partial<MerchantBusinessDto>) =>
      dx<MerchantBusinessDto>('PATCH', '/merchant/business', body),
    pauseStore: () => dx<void>('POST', '/merchant/business/pause'),
    resumeStore: () => dx<void>('POST', '/merchant/business/resume'),

    // KYC. Documents must first be uploaded via uploadFile(file, 'kyc-documents')
    // — the backend only accepts DrippleX-owned URLs in that folder. documentType
    // must be a real KycDocumentType (e.g. CAC_CERTIFICATE, NATIONAL_ID) and
    // documentNumber is required (min 3 chars). Only one submission may be pending
    // review at a time.
    getKyc: () => dx<MerchantKycStatusDto>('GET', '/merchant/kyc'),
    submitKyc: (body: {
      documentType: string;
      documentNumber: string;
      frontImage: string;
      backImage?: string;
      selfieImage?: string;
    }) => dx<MerchantKycDto>('POST', '/merchant/kyc', body),

    // Settlement bank account. bankName is free text (any Nigerian bank),
    // accountName is the resolved holder name (typed by the merchant — the
    // backend has no NUBAN resolution service yet), accountNumber is 8–20 digits.
    listBankAccounts: () => dx<MerchantBankAccountDto[]>('GET', '/merchant/bank-account'),
    createBankAccount: (body: {
      bankName: string;
      accountName: string;
      accountNumber: string;
      currency?: string;
      isDefault?: boolean;
    }) => dx<MerchantBankAccountDto>('POST', '/merchant/bank-account', body),

    // Products: the backend returns a paginated { items, meta } envelope of RAW
    // product entities (basePrice / status / images[] / inventory), so normalize
    // each to the MerchantProductDto shape the UI renders.
    getProducts: async () => {
      const res = await dx<{ items: RawMerchantProduct[]; meta: unknown }>(
        'GET',
        '/merchant/products',
      );
      const items: MerchantProductDto[] = (res.items ?? []).map((p) => {
        const qty = p.inventory?.available ?? p.inventory?.quantity ?? 0;
        // Mirror the backend availability rule exactly (computeInStock /
        // hasStock): the merchant's manual "out of stock" always wins; otherwise
        // a product not tracking unit inventory is in stock, and a tracked one
        // needs sellable quantity. Prevents the Dashboard and Products page from
        // disagreeing about stock.
        const tracks = p.inventory?.trackInventory ?? false;
        const inStock = !p.inventory?.manuallyDisabled && (!tracks || qty > 0);
        return {
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          price: p.basePrice,
          basePrice: p.basePrice,
          currency: p.currency,
          category: p.categoryId ?? null,
          categoryId: p.categoryId ?? null,
          sku: p.sku ?? null,
          imageUrl: p.images?.[0]?.url ?? null,
          inStock,
          published: p.status === 'PUBLISHED' || !!p.publishedAt,
          status: p.status,
          stockQty: qty,
          variants: (p.variants ?? []).map((v) => ({
            id: v.id,
            name: v.name,
            sku: v.sku ?? null,
            priceOverride: v.priceOverride ?? null,
            isActive: v.isActive ?? true,
          })),
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      });
      return { items, meta: res.meta };
    },
    // Create/update only accept the backend's scalar product fields
    // (CreateProductDto/UpdateProductDto): categoryId (a UUID, not a name),
    // name, description, basePrice, currency, sku. Publishing, stock and
    // variants are managed through the dedicated endpoints below.
    createProduct: (body: {
      categoryId?: string;
      name: string;
      description?: string;
      basePrice: number;
      currency?: string;
      sku?: string;
    }) => dx<RawMerchantProduct>('POST', '/merchant/products', body),
    updateProduct: (
      id: string,
      body: {
        categoryId?: string;
        name?: string;
        description?: string;
        basePrice?: number;
        currency?: string;
        sku?: string;
        isFeatured?: boolean;
      },
    ) => dx<RawMerchantProduct>('PATCH', `/merchant/products/${id}`, body),
    deleteProduct: (id: string) => dx<void>('DELETE', `/merchant/products/${id}`),

    // Publish state is a status transition, not an updatable field.
    publishProduct: (id: string) =>
      dx<RawMerchantProduct>('POST', `/merchant/products/${id}/publish`),
    unpublishProduct: (id: string) =>
      dx<RawMerchantProduct>('POST', `/merchant/products/${id}/unpublish`),

    // Stock: `outOfStock` toggles inventory.manuallyDisabled; setInventory
    // adjusts the tracked quantity.
    setProductStock: (id: string, outOfStock: boolean) =>
      dx<RawMerchantProduct>('PATCH', `/merchant/products/${id}/stock-status`, { outOfStock }),
    setProductInventory: (
      id: string,
      body: { quantity?: number; lowStockAlert?: number; trackInventory?: boolean },
    ) => dx<RawMerchantProduct>('PATCH', `/merchant/products/${id}/inventory`, body),

    // Variants — base price + per-variant priceOverride.
    createVariant: (id: string, body: { name: string; sku?: string; priceOverride?: number }) =>
      dx<RawMerchantProduct>('POST', `/merchant/products/${id}/variants`, body),
    updateVariant: (
      id: string,
      variantId: string,
      body: { name?: string; sku?: string; priceOverride?: number; isActive?: boolean },
    ) => dx<RawMerchantProduct>('PATCH', `/merchant/products/${id}/variants/${variantId}`, body),
    deleteVariant: (id: string, variantId: string) =>
      dx<RawMerchantProduct>('DELETE', `/merchant/products/${id}/variants/${variantId}`),

    // Product images — upload the file to storage first (uploadFile → the
    // 'product-images' folder) then attach its URL here.
    addProductImage: (id: string, url: string) =>
      dx<RawMerchantProduct>('POST', `/merchant/products/${id}/images`, { url }),
    removeProductImage: (id: string, imageId: string) =>
      dx<RawMerchantProduct>('DELETE', `/merchant/products/${id}/images/${imageId}`),

    // Orders — accept moves to PREPARING (no separate preparing endpoint)
    getOrders: (params?: { page?: number; pageSize?: number; status?: string }) =>
      dx<PaginatedResult<MerchantOrderDto>>('GET', '/merchant/orders', undefined, params),
    getOrder: (id: string) => dx<MerchantOrderDto>('GET', `/merchant/orders/${id}`),
    acceptOrder: (id: string, body?: { estimatedReadyAt?: string }) =>
      dx<MerchantOrderDto>('PATCH', `/merchant/orders/${id}/accept`, body ?? {}),
    rejectOrder: (id: string, reason: string) =>
      dx<MerchantOrderDto>('PATCH', `/merchant/orders/${id}/reject`, { reason }),
    markReady: (id: string) => dx<MerchantOrderDto>('PATCH', `/merchant/orders/${id}/ready`),
    // DPX-ORDER-B — "Pay to Merchant Bank" money lands in the merchant's own
    // account, so only they can confirm it arrived. Until they do, the order
    // stays PENDING and no rider is dispatched.
    confirmPaymentReceived: (id: string) =>
      dx<MerchantOrderDto>('PATCH', `/merchant/orders/${id}/payment-received`),
    delayOrder: (id: string, body: { estimatedReadyAt: string }) =>
      dx<MerchantOrderDto>('PATCH', `/merchant/orders/${id}/delay`, body),
    cancelOrder: (id: string, reason?: string) =>
      dx<MerchantOrderDto>('PATCH', `/merchant/orders/${id}/cancel`, { reason }),

    // Earnings / settlements
    getSettlements: () =>
      dx<{ items: MerchantSettlementDto[]; meta: unknown }>('GET', '/merchant/settlements'),

    // Wallet
    getWallet: () => dx<WalletDto>('GET', '/merchant/wallet'),
    getWalletTransactions: (params?: { page?: number; pageSize?: number; type?: string }) =>
      dx<PaginatedResult<WalletLedgerEntryDto>>(
        'GET',
        '/merchant/wallet/transactions',
        undefined,
        params,
      ),
  },

  // ── OPERATIONS CONSOLE (admin) ─────────────────────────────────────────────
  // Reuses the same /admin/* endpoints the production Operations Console
  // (ops.dripplex.com) uses — no new/duplicate backend. All require an
  // operations_staff session (see api.auth.loginOperations).
  admin: {
    // Vehicles review queue. Pass 'PENDING' to scope to the approval queue.
    // The backend returns { items, meta } (page/limit/total/totalPages).
    listVehicles: (approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED') =>
      dx<{ items: AdminVehicleDto[]; meta: { total: number } }>(
        'GET',
        '/admin/vehicles',
        undefined,
        approvalStatus ? { approvalStatus } : undefined,
      ),
    approveVehicle: (id: string) => dx<AdminVehicleDto>('POST', `/admin/vehicles/${id}/approve`),
    // rejectedReason must be 5–1000 chars (RejectVehicleDto).
    rejectVehicle: (id: string, rejectedReason: string) =>
      dx<AdminVehicleDto>('POST', `/admin/vehicles/${id}/reject`, { rejectedReason }),

    // Drivers. The list embeds each driver's KYC documents (kyc[]). Pass a
    // status to scope (e.g. 'UNDER_REVIEW' for the KYC review queue).
    listDrivers: (status?: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED') =>
      dx<{ items: AdminDriverDto[]; meta: { total: number } }>(
        'GET',
        '/admin/drivers',
        undefined,
        status ? { status } : undefined,
      ),
    getDriver: (driverId: string) => dx<AdminDriverDto>('GET', `/admin/driver/${driverId}`),
    // Driver lifecycle actions (driverId = the driver's user id).
    suspendDriver: (driverId: string, reason: string) =>
      dx<unknown>('POST', `/admin/driver/${driverId}/suspend`, { reason }),
    reactivateDriver: (driverId: string) =>
      dx<unknown>('POST', `/admin/driver/${driverId}/reactivate`),
    // Per-document KYC review — kycId is a DriverKyc.id from a driver's kyc[].
    verifyDriverKyc: (kycId: string, remarks?: string) =>
      dx<AdminDriverKycDto>(
        'POST',
        `/admin/driver/kyc/${kycId}/verify`,
        remarks ? { remarks } : {},
      ),
    rejectDriverKyc: (kycId: string, remarks: string) =>
      dx<AdminDriverKycDto>('POST', `/admin/driver/kyc/${kycId}/reject`, { remarks }),
    /**
     * Mark a driver's identity verified after an operations reviewer has matched
     * them against their documents. This endpoint has existed since DPX-DS-001
     * but nothing in the Ops Console called it, so `identityVerified` — one of
     * the six activation conditions — could never be satisfied and every driver
     * sat at "5 of 6 steps" forever. Until an automated IDV provider is chosen
     * (task #15), this manual review is the only way it is ever set.
     */
    /** The Monday payout run: everyone waiting to be paid, and where to send it. */
    getSettlementReport: (weekOf?: string) =>
      dx<SettlementReportDto>(
        'GET',
        '/admin/wallet/withdrawals/settlement-report',
        undefined,
        weekOf ? { weekOf } : undefined,
      ),
    completeWithdrawal: (id: string, adminNote?: string) =>
      dx<PayoutRequestDto>(
        'POST',
        `/admin/wallet/withdrawals/${id}/complete`,
        adminNote ? { adminNote } : {},
      ),
    verifyDriverIdentity: (driverId: string, remarks?: string) =>
      dx<unknown>(
        'POST',
        `/admin/drivers/${driverId}/identity-verification/verify`,
        remarks ? { remarks } : {},
      ),

    // Operations queue counters (for the dashboard tiles + sidebar badges).
    getOpsCounters: () =>
      dx<{
        activeSosCount: number;
        openIncidentsCount: number;
        openSupportTicketsCount: number;
        waitingReviewCount: number;
      }>('GET', '/operations/dashboard/counters'),

    // Operations work queues. Each returns { items, summary }.
    getIncidentQueue: () =>
      dx<{ items: AdminOperationsCaseDto[]; summary: Record<string, number> }>(
        'GET',
        '/operations/queues/incidents',
      ),
    getSosQueue: () =>
      dx<{ items: AdminOperationsCaseDto[]; summary: Record<string, number> }>(
        'GET',
        '/operations/queues/sos',
      ),
    getSupportQueue: () =>
      dx<{ items: AdminOperationsCaseDto[]; summary: Record<string, number> }>(
        'GET',
        '/operations/queues/support',
      ),
    // Mutate a case. version is REQUIRED (optimistic concurrency, 409 on stale).
    updateCase: (
      caseId: string,
      body: {
        version: number;
        status?: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
        priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
        assignedToId?: string | null;
        assignedToRole?: 'OPERATOR' | 'SUPERVISOR';
      },
    ) => dx<AdminOperationsCaseDto>('PATCH', `/operations/cases/${caseId}`, body),
    // Append an operator note to a case's timeline.
    addCaseNote: (caseId: string, note: string) =>
      dx<AdminOperationsCaseDto>('POST', `/operations/cases/${caseId}/notes`, { note }),

    // Live fleet snapshot (drivers + summary) for the Live Map.
    getFleet: () =>
      dx<{ drivers: AdminFleetDriverDto[]; summary: AdminFleetSummaryDto }>(
        'GET',
        '/operations/fleet',
      ),
    // Live ride queue (active rides only) for the Trips screen.
    getRideQueue: () =>
      dx<{
        rides: AdminLiveRideDto[];
        summary: { pendingCount: number; assignedCount: number; inProgressCount: number };
      }>('GET', '/operations/rides'),
    // Recent operations activity feed for the Dashboard.
    getActivityFeed: () =>
      dx<{ items: AdminActivityFeedItemDto[] }>('GET', '/operations/dashboard/activity-feed'),
    // Analytics overview KPIs. from/to are ISO timestamps (required).
    getAnalyticsOverview: (from: string, to: string) =>
      dx<AdminAnalyticsOverviewDto>('GET', '/operations/analytics/overview', undefined, {
        from,
        to,
      }),

    // Merchants review desk. Pass a status to scope (e.g. 'PENDING'/'UNDER_REVIEW').
    listMerchants: (status?: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED') =>
      dx<{ items: AdminMerchantDto[]; meta: { total: number } }>(
        'GET',
        '/admin/merchants',
        undefined,
        status ? { status } : undefined,
      ),
    approveMerchant: (id: string) => dx<unknown>('POST', `/admin/merchant/${id}/approve`),
    rejectMerchant: (id: string, reason: string) =>
      dx<unknown>('POST', `/admin/merchant/${id}/reject`, { reason }),
    verifyMerchantKyc: (id: string, remarks?: string) =>
      dx<unknown>('POST', `/admin/merchant/${id}/kyc/verify`, remarks ? { remarks } : {}),
    rejectMerchantKyc: (id: string, remarks: string) =>
      dx<unknown>('POST', `/admin/merchant/${id}/kyc/reject`, { remarks }),
    suspendMerchant: (id: string, reason: string) =>
      dx<unknown>('POST', `/admin/merchant/${id}/suspend`, { reason }),
    reactivateMerchant: (id: string) => dx<unknown>('POST', `/admin/merchant/${id}/reactivate`),

    // Riders review desk. Pass a status to scope (e.g. 'PENDING'/'UNDER_REVIEW').
    listRiders: (status?: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED') =>
      dx<{ items: AdminRiderDto[]; meta: { total: number } }>(
        'GET',
        '/admin/riders',
        undefined,
        status ? { status } : undefined,
      ),
    approveRider: (id: string) => dx<unknown>('POST', `/admin/rider/${id}/approve`),
    rejectRider: (id: string, reason: string) =>
      dx<unknown>('POST', `/admin/rider/${id}/reject`, { reason }),
    suspendRider: (id: string, reason: string) =>
      dx<unknown>('POST', `/admin/rider/${id}/suspend`, { reason }),
    reactivateRider: (id: string) => dx<unknown>('POST', `/admin/rider/${id}/reactivate`),
    // DPX-RIDER-003 — review a rider's submitted KYC document. Keyed by the KYC
    // document id (not the rider id), mirroring the driver KYC routes.
    verifyRiderKyc: (kycId: string, remarks?: string) =>
      dx<unknown>('POST', `/admin/rider/kyc/${kycId}/verify`, remarks ? { remarks } : {}),
    rejectRiderKyc: (kycId: string, remarks: string) =>
      dx<unknown>('POST', `/admin/rider/kyc/${kycId}/reject`, { remarks }),

    // Physical vehicle inspections (DPX-DRIVER-002 Phase 3). The backend has
    // had these routes since the inspection module shipped; nothing called them,
    // so Operations had no way to record or decide an inspection.
    listInspections: (status?: 'SCHEDULED' | 'PASSED' | 'FAILED' | 'CANCELLED') =>
      dx<{ items: AdminInspectionDto[]; meta: { total: number } }>(
        'GET',
        '/admin/inspections',
        undefined,
        status ? { status } : undefined,
      ),
    getInspection: (id: string) => dx<AdminInspectionDto>('GET', `/admin/inspections/${id}`),
    // Officer records the walkthrough (INSPECTION_CHECKLIST_MANAGE).
    recordInspectionChecklist: (
      id: string,
      body: { checklist: InspectionChecklistItemDto[]; notes?: string; photos?: string[] },
    ) => dx<AdminInspectionDto>('POST', `/admin/inspections/${id}/checklist`, body),
    // Supervisor decides pass/fail (INSPECTION_APPROVE) — a separate permission
    // on purpose: officers record, supervisors decide.
    decideInspection: (id: string, passed: boolean, notes?: string) =>
      dx<AdminInspectionDto>('POST', `/admin/inspections/${id}/decide`, {
        passed,
        ...(notes ? { notes } : {}),
      }),

    // Delivery dispatch. Auto-assignment runs once, when the merchant marks the
    // order ready; if no rider was online and located at that moment the job
    // sits PENDING with no rider forever. These give Operations the manual
    // fallback the backend already exposed but nothing called.
    listDeliveryJobs: (status?: DeliveryStatus) =>
      dx<{ items: DeliveryJobDto[]; meta: { total: number } }>(
        'GET',
        '/admin/delivery',
        undefined,
        status ? { status } : undefined,
      ),
    assignDeliveryRider: (jobId: string, riderId: string) =>
      dx<DeliveryJobDto>('POST', `/admin/delivery/${jobId}/assign`, { riderId }),

    // Customer roster (name/phone/email/status + trips/spend). Returns { items, meta }.
    listCustomers: (params?: {
      page?: number;
      limit?: number;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' | 'BLOCKED';
      search?: string;
    }) =>
      dx<{ items: AdminCustomerDto[]; meta: { total: number } }>(
        'GET',
        '/admin/customers',
        undefined,
        params,
      ),
  },

  // ── CUSTOMER KYC ───────────────────────────────────────────────────────────
  kyc: {
    get: () => dx<CustomerKycStatusDto>('GET', '/kyc/me'),
    start: () => dx<CustomerKycStatusDto>('POST', '/kyc/me/start'),
    submit: (body: {
      documentType: string;
      documentNumber?: string;
      frontImageUrl: string;
      backImageUrl?: string;
      selfieUrl?: string;
    }) => dx<CustomerKycStatusDto>('POST', '/kyc/me/submit', body),
  },

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  notifications: {
    list: (params?: { unreadOnly?: boolean; page?: number; limit?: number }) =>
      dx<{ items: NotificationDto[]; total: number }>(
        'GET',
        '/customer/notifications',
        undefined,
        params,
      ),
    markRead: (id: string) => dx<void>('PATCH', `/customer/notifications/${id}/read`),
    markAllRead: () => dx<void>('POST', '/customer/notifications/mark-all-read'),
  },

  // ── LOYALTY (customer) ──────────────────────────────────────────────────────
  // ── PROMOTIONS (customer) ───────────────────────────────────────────────────
  // Real campaigns from the promotions engine. Codeless campaigns apply
  // automatically at pricing time (cart totals / ride estimate already carry the
  // discount) — this is only for SHOWING customers what is currently on offer,
  // so the app never advertises a discount the backend would not actually give.
  promotions: {
    active: () => dx<PromotionActiveDto[]>('GET', '/customer/promotions/active'),
  },

  // Points accrue automatically server-side on domain events (order paid +50,
  // delivery completed +25, registration +100, coupon +10). The app only reads.
  loyalty: {
    get: () => dx<LoyaltyOverviewDto>('GET', '/customer/loyalty'),
    history: (params?: { page?: number; pageSize?: number }) =>
      dx<PaginatedResult<LoyaltyLedgerEntryDto>>(
        'GET',
        '/customer/loyalty/history',
        undefined,
        params,
      ),
    redeem: (points: number) =>
      dx<LoyaltyOverviewDto>('POST', '/customer/loyalty/redeem', { points }),
  },
};

// ─── Signed direct-to-R2 upload helper ─────────────────────────────────────────
// Mints a pre-signed PUT URL from the backend, uploads the file straight to R2
// (the signature is in the URL — no auth header on the PUT), and returns the
// object's stored URL to hand to a KYC/vehicle endpoint. Throws ApiError on a
// failed sign; throws a plain Error if the R2 PUT itself fails.
export async function uploadFile(file: File, folder: string): Promise<string> {
  // Proxy upload through our own API (POST /uploads/direct) rather than a direct
  // browser→R2 PUT. The backend streams the bytes to object storage server-side,
  // so uploads don't depend on R2 bucket CORS allowing a cross-origin PUT (which
  // the app doesn't control). api.dripplex.com already permits the app origin,
  // and errors come back as structured ApiErrors, not opaque "network" failures.
  const form = new FormData();
  form.append('folder', folder);
  form.append('file', file);
  const token = auth.getAccessToken();
  const res = await fetch(`${BASE}/uploads/direct`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return uploadFile(file, folder);
  }
  const json: unknown = await res.json().catch(() => null);
  const envelope = json as {
    success?: boolean;
    statusCode?: number;
    message?: string;
    errorCode?: string;
    data?: unknown;
  } | null;
  if (!res.ok || envelope?.success === false) {
    throw new ApiError(
      envelope?.statusCode ?? res.status,
      envelope?.message ?? 'Upload failed. Please try again.',
      envelope?.errorCode ?? 'UPLOAD_FAILED',
    );
  }
  const data = (envelope && 'data' in envelope ? envelope.data : envelope) as { publicUrl: string };
  return data.publicUrl;
}
