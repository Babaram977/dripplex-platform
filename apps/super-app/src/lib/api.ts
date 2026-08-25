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
  // Set on the one retry a 401 is allowed. An endpoint that answers 401 for a
  // reason a fresh token cannot fix would otherwise refresh-and-retry forever.
  retried = false,
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  /**
   * Endpoints where a 401 means "those credentials are wrong", NOT "your
   * session ended".
   *
   * Signing in is how you get a session, so it cannot have lost one. Treating
   * a failed sign-in as an expiry did three harmful things at once: it told
   * the user "Session expired — please log in again" when they HAD just
   * logged in, which is a loop with no exit and no hint that the password was
   * simply wrong; it fired a token refresh using whatever stale token was
   * lying around; and it called auth.clear(), so a bad sign-in on one account
   * signed out a good session on another.
   *
   * Drivers and merchants coming back to finish their registration hit this
   * and could not get past it.
   */
  const isCredentialCheck = path.startsWith('/auth/login') || path.startsWith('/auth/register');

  const token = auth.getAccessToken();
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 → try silent refresh once. Never on a sign-in: there is no session to
  // refresh, and the stale token used to attempt it belongs to somebody else.
  if (res.status === 401 && !retried && !isCredentialCheck) {
    const refreshed = await tryRefresh();
    if (refreshed) return await dx(method, path, body, params, true);
  }
  if (res.status === 401 && !isCredentialCheck) {
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

/**
 * Silent token refresh — at most one in flight at a time.
 *
 * The backend rotates the refresh token on every refresh and treats a second
 * use of the old one as a stolen-token breach: it revokes the whole session
 * (RefreshService.handleReuseDetected). So two requests that 401 at the same
 * moment and each call refresh with the same token do not race harmlessly —
 * the first rotates, the second is read as reuse, and the user is signed out
 * for good.
 *
 * The driver app is the case that proves it: it polls for ride offers every
 * five seconds and pushes its location on its own timer, so the instant the
 * access token expires several requests 401 together. That is a driver being
 * logged out while sitting online waiting for work.
 *
 * Every caller now awaits the same refresh and then retries with whatever it
 * produced.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return await refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
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

/**
 * What the backend's paginated endpoints ACTUALLY return — `@dripplex/types`
 * `PaginatedResult`, with the counts nested under `meta`.
 *
 * `PaginatedResult` above declares a flat `{ items, total, page, pageSize }`,
 * which does not match the NestJS controllers. Declared separately rather than
 * corrected in place: every screen already reading the flat type would start
 * type-checking against a shape it does not use, and untangling that is its own
 * change. New code should use this one. Recorded so the discrepancy is a known
 * thing rather than a trap the next person rediscovers.
 */
export interface ApiPage<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * What `/products/smart-search` and `/merchants/smart-search` actually return.
 *
 * Both were typed here as a bare `CursorPaginatedResult`. They are not: the
 * page sits under `results`, alongside a `parsed` object describing how the
 * query was interpreted. Nothing read `results`, so the home screen's search
 * extracted an empty array from every response and reported "no results" for
 * queries the backend had answered — searching "rice" returned a product from
 * the API and nothing on screen.
 *
 * `parsed` is declared because it exists and is useful (it is how the backend
 * says it understood "near me" or "open now"), not because anything reads it
 * yet.
 */
export interface SmartSearchResult<T> {
  parsed: { keywords: string; nearMe: boolean; openNow: boolean };
  results: CursorPaginatedResult<T> & { hasMore?: boolean };
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

/** GET /customer/wallet/transfer/recipients[/recent] — mirrors the backend's
 *  WalletRecipientDto. The phone comes back masked; the API never returns a
 *  recipient's full number. */
export interface WalletRecipientDto {
  id: string;
  firstName: string;
  lastName: string;
  maskedPhone: string;
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
/**
 * What a merchant SELLS. `businessType` beside it is the LEGAL structure
 * (SOLE_PROPRIETORSHIP, PARTNERSHIP) — the two were conflated, which is why
 * the category chips used to run a name search and every merchant card drew
 * the same default icon. null = uncategorised, a real state for anyone
 * onboarded before the field existed.
 */
export type MerchantCategory =
  | 'SUPERMARKET'
  | 'RESTAURANT'
  | 'PHARMACY'
  | 'ELECTRONICS'
  | 'FASHION'
  | 'BEAUTY'
  | 'HARDWARE'
  | 'HOTEL'
  | 'FURNITURE'
  | 'SERVICES'
  | 'WHOLESALE'
  | 'OTHER';

export const MERCHANT_CATEGORY_LABEL: Record<MerchantCategory, string> = {
  SUPERMARKET: 'Supermarket',
  RESTAURANT: 'Restaurant',
  PHARMACY: 'Pharmacy',
  ELECTRONICS: 'Electronics',
  FASHION: 'Fashion',
  BEAUTY: 'Beauty',
  HARDWARE: 'Hardware',
  HOTEL: 'Hotel',
  FURNITURE: 'Furniture & Home',
  SERVICES: 'Services',
  WHOLESALE: 'Wholesale',
  OTHER: 'Other',
};

export interface MerchantSummaryDto {
  id: string;
  businessName: string;
  businessType: string;
  category: MerchantCategory | null;
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

// DPX-ORDER-PROOF-001 — a customer's bank receipt for a MERCHANT_DIRECT order.
// `receiptUrl` is a SHORT-LIVED SIGNED URL minted per read (receipts live in the
// private bucket) — render it, never cache or store it.
export interface OrderPaymentProofDto {
  id: string;
  orderId: string;
  submittedBy: string;
  receiptUrl: string;
  reference: string | null;
  /** What the customer says they sent; may differ from the order total. */
  amount: number | null;
  note: string | null;
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

export type RideSurchargeType = 'FLAT' | 'MULTIPLIER';
/** Which end of the trip puts it inside a zone. An airport surcharge is
 * usually EITHER — the run out and the run back both carry the cost. */
export type RideSurchargeTrigger = 'PICKUP' | 'DROPOFF' | 'EITHER';

/**
 * A named circle where trips cost more — the airport being the case that
 * prompted it. A centre and a radius rather than a polygon, so an operator can
 * set one up from a map pin and a distance.
 */
export interface RideSurchargeZoneDto {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  surchargeType: RideSurchargeType;
  /** Naira when FLAT, a factor when MULTIPLIER (1.25 = a quarter more). */
  amount: number;
  appliesTo: RideSurchargeTrigger;
  active: boolean;
  updatedAt: string;
}

/** One row of the Ops pricing table — GET/PUT /admin/rides/pricing/rates. */
export interface RideFareRateDto {
  rideType: RideType;
  /** From the same catalogue the passenger app reads, so the console and the
   * app can never disagree about a service name. */
  displayName: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  /** A floor under the computed fare, not an addition. */
  minimumFare: number;
}
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
  /**
   * Null until the fare settles. All three are `Decimal?` in Prisma and
   * `number | null` in @dripplex/types — this copy declared them non-null,
   * which is not a cosmetic disagreement: it is why
   * `ride.driverEarning.toLocaleString()` on the driver's trip-completed
   * screen compiled cleanly and then threw "null is not an object" on a real
   * trip. The split happens at completion, so between the trip ending and the
   * passenger paying there is genuinely no earning figure yet.
   */
  platformCommission: number | null;
  driverEarning: number | null;
  tipAmount: number | null;
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
  /** Whether the driver must enter the passenger's trip code to start. */
  requiresVerificationCode: boolean;
}

/**
 * The real shape of GET /customer/rides/:id/receipt.
 *
 * This was previously declared inline as `{ id, fare: number, currency,
 * items, driver: { name }, createdAt }` — a shape the endpoint has never
 * returned. `fare` is a breakdown object, so `naira(receipt.fare)` printed
 * "₦NaN" as the total charged on every completed trip.
 */
export interface RideReceiptDto {
  rideId: string;
  status: RideStatus;
  driver: { id: string; name: string; phone: string | null; vehicleType: RideType } | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  fare: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surchargeAmount: number;
    surchargeZoneName: string | null;
    totalFare: number;
    tipAmount: number | null;
    platformCommission: number | null;
    driverEarning: number | null;
  };
  paymentMethod: RidePaymentMethod | null;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  requestedAt: string;
  completedAt: string | null;
}

// ── Commercial (commission credit accounts) ─────────────────────────────────
export type CommissionOwnerType = 'MERCHANT' | 'DRIVER' | 'RIDER';
export type CommissionEntryType = 'ACCRUAL' | 'PAYMENT' | 'ADJUSTMENT';

export interface CommissionAccountDto {
  id: string;
  ownerType: CommissionOwnerType;
  ownerId: string;
  outstandingBalance: number;
  /** The ceiling in force — the negotiated limit if one exists, else the
   * owner-type default. */
  creditLimit: number;
  /** A limit agreed with this partner individually; null = using the default. */
  negotiatedCreditLimit: number | null;
  negotiatedAt: string | null;
  negotiationNote: string | null;
  blocked: boolean;
  blockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A commission account plus who it belongs to — the Ops commissions desk. */
export interface AdminCommissionAccountDto extends CommissionAccountDto {
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
}

/** DrippleX's whole financial position with one merchant, driver or rider.
 * Signs are from DrippleX's side: `walletAvailable` is money we owe out,
 * `commissionOutstanding` is money owed in, `netPosition` is what would change
 * hands if the relationship were settled today. */
export interface PartnerFinancialPositionDto {
  ownerType: CommissionOwnerType;
  ownerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  walletAvailable: number;
  walletPending: number;
  commissionOutstanding: number;
  commissionCreditLimit: number;
  negotiatedCreditLimit: number | null;
  negotiatedAt: string | null;
  negotiationNote: string | null;
  blocked: boolean;
  blockedAt: string | null;
  netPosition: number;
  lifetimeCommissionAccrued: number;
  lifetimeCommissionPaid: number;
  lifetimeWalletCredited: number;
  lifetimeWalletDebited: number;
  pendingWithdrawalAmount: number;
  pendingWithdrawalCount: number;
}

export interface CommissionLedgerEntryDto {
  id: string;
  accountId: string;
  type: CommissionEntryType;
  amount: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface CommercialCreditSettingDto {
  id: string;
  ownerType: CommissionOwnerType;
  creditLimit: number;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface RideShareLinkDto {
  token: string;
  /** Path to append to this app's own origin, e.g. `/t/9f3c…`. */
  path: string;
}

/** A live trip as the person it was shared with sees it. No login: the token
 * in the link is the credential, so this carries first names only and never
 * the trip code, a phone number, or the fare. */
export interface SharedRideDto {
  status: RideStatus;
  rideType: RideType;
  passengerFirstName: string | null;
  driverFirstName: string | null;
  vehicle: RideDriverVehicleDto | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  dropoffLatitude: number;
  dropoffLongitude: number;
  driverPosition: { latitude: number; longitude: number; updatedAt: string } | null;
  estimatedDurationSeconds: number | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/** The car the passenger is waiting for — sent to the passenger only. */
export interface RideDriverVehicleDto {
  plateNumber: string;
  make: string;
  model: string;
  color: string;
}

/** A ride as its passenger sees it — plus the assigned driver's name, the
 * mirror of CustomerDeliveryDto.riderName, the car to look for, and the trip
 * code the passenger reads out at pickup. */
export interface CustomerRideDto extends RideDto {
  driverName: string | null;
  verificationCode: string | null;
  driverVehicle: RideDriverVehicleDto | null;
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
  /** Naira a surcharge zone added, and which zone. Both have been on the wire
   * since surcharge zones shipped; neither was declared here, so the price
   * breakdown could not show them and an airport trip listed ₦564 of lines
   * under a ₦16,767 total. */
  surchargeAmount: number;
  surchargeZoneId: string | null;
  surchargeZoneName: string | null;
  /** base + distance + time — what the itemised lines sum to. */
  meteredFare: number;
  minimumFare: number;
  /** True when the floor, not the meter, set the price. */
  minimumFareApplied: boolean;
  totalFare: number;
  promotionId: string | null;
  promoDiscount: number;
  finalFare: number;
}

/**
 * Mirrors the backend's RideTypeCatalogEntryDto exactly.
 *
 * This declared `{ rideType, label, description, basePrice, currency }` — none
 * of which the API sends. `GET /customer/rides/types` returns `type`,
 * `displayName`, `description` and `emoji`, and has no price field at all
 * (fares are per-route, from `/rides/estimate`). Every consumer reading
 * `.rideType` or `.label` was reading `undefined`, so the ride-type chips
 * rendered blank and selecting one set the type to undefined.
 *
 * Keep this in step with packages/types/src/ride/index.ts — that is the
 * contract, this is a copy of it.
 */
export interface RideTypeCatalogEntryDto {
  type: RideType;
  displayName: string;
  description: string;
  emoji: string;
  /** Present only when `getRideTypes` is called with a pickup point. Undefined
   * means "not checked", which is not the same as "nobody available" — the UI
   * must not render an availability claim it was never given. */
  availableNow?: boolean;
  /** Straight-line metres to the nearest eligible driver of this type, or null
   * when there is none in range. */
  nearestDriverMeters?: number | null;
}

/**
 * A published CMS page — Privacy Policy, Terms of Service.
 *
 * `body` is `unknown` on the backend DTO because the CMS stores arbitrary
 * JSON. Legal pages use the narrow shape below; `renderCmsBody` in
 * accountPages.tsx is the only place that interprets it, and it degrades to a
 * plain message rather than throwing when a page carries something else.
 */
export interface CmsPageDto {
  id: string;
  slug: string;
  title: string;
  body: unknown;
  publishedAt: string | null;
  updatedAt: string;
}

export type DriverSupportCategory = 'PAYOUT' | 'ACCOUNT' | 'APP_BUG' | 'KYC' | 'OTHER';

export interface DriverSupportTicketDto {
  id: string;
  category: DriverSupportCategory;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
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

/**
 * One order's settlement, as `GET /merchant/settlements` actually returns it.
 *
 * This copy previously declared `netAmount`, `settledAt`, and a
 * `'PENDING' | 'SETTLED'` status. None of the three exist on the wire: the
 * backend's OrderSettlementDto (packages/types/src/order/index.ts) sends
 * `merchantAmount`, has no `settledAt`, and its status is
 * `'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED'`. Because the invented
 * names typecheck against an invented type, nothing caught it until a
 * merchant opened Earnings and `row.netAmount.toLocaleString()` threw
 * "Cannot read properties of undefined" — the whole screen replaced by an
 * error boundary. `SETTLED` likewise never matched a real row, so a completed
 * settlement could not render as completed.
 *
 * Kept in sync with OrderSettlementDto by hand; the fields the screens do not
 * read (reversal bookkeeping) are still declared so the next person can see
 * the real shape rather than re-guess it.
 */
export interface MerchantSettlementDto {
  id: string;
  orderId: string;
  /** Human-readable order number, so a merchant is never shown a raw UUID. */
  orderNumber: string;
  merchantId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  /** What the merchant actually receives — gross minus commission. */
  merchantAmount: number;
  currency: string;
  walletLedgerEntryId: string | null;
  failureReason: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  reversalLedgerEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Hotel booking (DPX-HOTEL-001) ────────────────────────────────────────────
// Mirrors apps/backend/src/bookings/booking.mapper.ts. Nights are 'YYYY-MM-DD',
// never timestamps: a night is a calendar day, and an ISO timestamp would
// render as the previous day for anyone west of UTC.

export type BookingStatus =
  | 'PENDING_HOTEL'
  /** The hotel said yes and the guest now has 24 hours to pay. Added 2026-08-22
   *  with the payment-through-DrippleX change; a client missing this value
   *  renders the most important state of a booking as unknown. */
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'NO_SHOW';

export interface RoomTypeDto {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  capacity: number;
  basePrice: number;
  totalRooms: number;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RoomAvailabilityDto {
  night: string;
  roomsOpen: number;
  roomsBooked: number;
  roomsLeft: number;
  /** The override if the hotel set one for this night, else the base price. */
  price: number;
}

export interface BookingDto {
  id: string;
  reference: string;
  businessId: string;
  roomTypeId: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  guests: number;
  totalAmount: number;
  guestName: string;
  guestPhone: string;
  guestNote: string | null;
  /** When the hotel's thirty minutes run out. The UI counts down to this. */
  acceptDeadline: string;
  /** When the guest's 24 hours to pay run out. Null until the hotel accepts. */
  paymentDeadline: string | null;
  paidAt: string | null;
  /** The five-character code for the hotel desk. Present ONLY once the money
   *  has arrived — its existence is the proof, which is why the UI shows the
   *  booking as assured on `pin !== null` rather than on a status alone. */
  pin: string | null;
  acceptedAt: string | null;
  /** Recorded at the desk when the guest actually arrived and left. */
  checkedInAt: string | null;
  checkedOutAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/** A quote for one stay: what it costs and, when it cannot be had, why not. */
export interface AvailabilityResult {
  available: boolean;
  /** Already a sentence a guest can act on ("No rooms left on 2026-09-11").
   *  Shown verbatim — the app must not paraphrase the hotel's own calendar. */
  reason: string | null;
  nights: number;
  totalAmount: number;
  perNight: { night: string; price: number }[];
}

/**
 * A booking as its guest sees it.
 *
 * `BookingDto` carries `businessId` and `roomTypeId` and nothing else about
 * either — enough for a hotel reading its own book, useless to a guest. Their
 * bookings list showed a reference, some dates and an amount, with no way to
 * tell a room in Kano from a room in Abuja. Both customer endpoints now send
 * the two names a person actually recognises.
 */
export interface CustomerBookingListItemDto extends BookingDto {
  hotelName: string;
  roomName: string;
}

export interface CustomerBookingDto extends CustomerBookingListItemDto {
  /** Set on rejected/expired bookings: "you were never charged". Server-owned
   *  wording, so one change of policy does not need a client release. */
  customerMessage: string | null;
}

export interface MerchantBookingDto extends BookingDto {
  /** Null while pending — no cut is owed on a booking nobody has agreed to. */
  commissionAmount: number | null;
  payoutAmount: number | null;
}

/**
 * One weekly hotel payout — mirrors the backend `BookingSettlementDto`.
 *
 * `weekFrom`/`weekTo` are sent by the server precisely so a client does not
 * have to know the settlement calendar. `weekTo` is the Sunday, not the
 * following Monday.
 */
export interface BookingSettlementDto {
  id: string;
  businessId: string;
  weekStarting: string;
  weekFrom: string;
  weekTo: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  bookingCount: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  failureReason: string | null;
  settledAt: string | null;
  createdAt: string;
}

/** What the next Monday run will pay — read-only, and shares the run's own
 *  query server-side so it cannot disagree with what actually happens. */
export interface SettlementPreviewDto {
  /** ISO timestamp of the Monday the run happens on. */
  runsOn: string;
  weekStarting: string;
  from: string;
  /** Exclusive end — the Monday itself, so Sunday is the last day paid for. */
  to: string;
  hotels: {
    businessId: string;
    businessName: string;
    bookingCount: number;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
  }[];
  hotelCount: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
}

export interface MerchantBusinessDto {
  id: string;
  businessName: string;
  /** Legal structure — NOT what they sell. See `category`. */
  businessType: string;
  /** What they sell. Drives the marketplace category chips and the store icon. */
  category: MerchantCategory | null;
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
    /** Legal structure — not what they sell. See `category`. */
    businessType: string;
    /** What they sell. null = uncategorised, so invisible to every
     *  marketplace category filter until Ops or the merchant sets one. */
    category: MerchantCategory | null;
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
  /** The driver's full name — an inspector cannot match "ae0b509c" to a person. */
  driverName: string | null;
  driverPhone: string | null;
  vehicleId: string;
  /** Plate number: how a vehicle is identified in a yard. */
  vehiclePlate: string | null;
  /** "Toyota Corolla · Blue", when the vehicle record carries it. */
  vehicleLabel: string | null;
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

// A driver's own inspection (the subset of AdminInspectionDto without the
// Operations-only enrichment). Same rows, read through the driver's endpoint.
export interface DriverInspectionDto {
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
  /** Set when this booking replaces a FAILED inspection. */
  reinspectionOfId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionCentreDto {
  id: string;
  name: string;
  /** Null when the centre has no published street address — show the city
   *  alone rather than an empty line. */
  address: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
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

/** What the approve/reject endpoints answer with. */
export interface DriverApprovalDto {
  driverId: string;
  status: DriverApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
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

/** The subset of GET /driver/profile the driver's own app needs. */
export type DriverApprovalStatus =
  'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface DriverOwnProfileDto {
  driverId: string;
  firstName: string;
  lastName: string;
  status: DriverApprovalStatus;
  isApproved: boolean;
  rejectedReason: string | null;
  suspendedAt: string | null;
}

/** What GET /driver/rides/availability returns. Was typed `unknown`, so the
 * app could not read back the position and vehicle type it had sent. */
export interface DriverAvailabilityDto {
  driverId: string;
  online: boolean;
  acceptingRides: boolean;
  vehicleType: RideType | null;
  latitude: number | null;
  longitude: number | null;
  activeRideCount: number;
  updatedAt: string;
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

/** What came of a payout request: how much went to clearing commission owed on
 * cash jobs, and the bank transfer that remains. `payout` is null when the debt
 * absorbed the whole request and there is nothing left to send. */
export interface PayoutResultDto {
  commissionSettled: number;
  payout: PayoutRequestDto | null;
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
  /** Which of the six activation checks this driver still fails, as
   * human-readable reasons. The backend has computed these per row since the
   * roster work; the client was dropping them, so the console showed a column
   * of identical badges and no way to tell who could actually take a trip.
   * Empty means nothing is blocking. */
  activationBlockers?: string[];
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
  /** The driver's own toggle — what their app shows them. */
  online: boolean;
  /** What the platform believes: toggled on AND pinging within the same
   * freshness window dispatch uses. `online && !reachable` is a driver whose
   * app says "Online" while we have lost them. */
  reachable: boolean;
  lastLocationAt: string | null;
  acceptingRides: boolean;
  latitude: number | null;
  longitude: number | null;
  vehicleType: string | null;
  activeRideId: string | null;
  shiftStatus: 'ACTIVE' | 'ON_BREAK' | null;
  vehiclePlateNumber: string | null;
}
/** onlineCount + staleCount + offlineCount === totalDrivers. The rest are
 *  status breakdowns that overlap and never sum to anything. */
export type DispatchGateKey =
  | 'PROFILE_APPROVED'
  | 'KYC_VERIFIED'
  | 'IDENTITY_VERIFIED'
  | 'VEHICLE_APPROVED'
  | 'INSPECTION_PASSED'
  | 'ONLINE'
  | 'ACCEPTING'
  | 'POSITION_KNOWN'
  | 'POSITION_FRESH'
  | 'CAPACITY';

export interface DispatchGateDto {
  key: DispatchGateKey;
  label: string;
  passed: boolean;
  /** Named specifically when it fails — "Guarantor ID is still PENDING" —
   *  never a bare "not eligible". Null when the gate passes. */
  detail: string | null;
  fixableBy: 'OPERATIONS' | 'DRIVER';
}

export interface DispatchVehicleDto {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  colour: string;
  year: number;
  rideCategory: string;
  approvalStatus: string;
  seats: number | null;
}

export interface DispatchEligibilityDto {
  subjectId: string;
  subjectName: string;
  phone: string | null;
  role: 'DRIVER' | 'RIDER';
  dispatchable: boolean;
  gates: DispatchGateDto[];
  vehicle: DispatchVehicleDto | null;
}

export interface AdminFleetSummaryDto {
  totalDrivers: number;
  onlineCount: number;
  staleCount: number;
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
  /** Money over rides COMPLETED in the range. `platformCommissionRevenue` is
   * DrippleX's own cut; `grossFareRevenue` is what passengers were charged.
   * Tips are reported separately and excluded from both — they are the
   * driver's. */
  grossFareRevenue: number;
  platformCommissionRevenue: number;
  driverEarnings: number;
  tipsCollected: number;
  revenueSeries: RevenueBucketDto[];
}

/** One point on the Ops dashboard's revenue chart. Hourly for a day-scale
 * range, daily beyond; empty buckets are present with zeroes. */
export interface RevenueBucketDto {
  bucketStart: string;
  grossFare: number;
  platformCommission: number;
  ridesCompleted: number;
}

/** Live ride queue counts by stage. `pendingCount` is rides still looking for
 * a driver — the Ops dashboard's "Pending Requests". */
export interface RideQueueSummaryDto {
  pendingCount: number;
  assignedCount: number;
  inProgressCount: number;
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

/** The statuses a campaign moves through, from the Prisma enum. */
export type PromotionStatus =
  'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED' | 'CANCELLED';

/** Which side of the platform a campaign applies to. */
export type PromotionDomain = 'RIDE' | 'MARKETPLACE' | 'DELIVERY' | 'WALLET' | 'MERCHANT';

/**
 * The full campaign as the admin API returns it. The engine supports far more
 * (BOGO, happy hour, referral, per-device limits, rule trees); the console
 * form below deliberately exposes the subset an operator can set safely
 * without a rules editor, and everything else is left to the API.
 */
export type PromotionType =
  | 'PERCENTAGE'
  | 'FIXED'
  | 'BOGO'
  | 'FLASH_SALE'
  | 'HAPPY_HOUR'
  | 'MERCHANT_CAMPAIGN'
  | 'PLATFORM_CAMPAIGN'
  | 'REFERRAL'
  | 'COUPON'
  | 'AUTOMATIC'
  | 'WALLET_CREDIT'
  | 'CASHBACK';

export interface AdminPromotionDto {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  domains: string[];
  percentOff: number | null;
  amountOff: number | null;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface CreatePromotionRequest {
  code?: string;
  name: string;
  type: PromotionType;
  status?: PromotionStatus;
  domains?: PromotionDomain[];
  percentOff?: number;
  amountOff?: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startsAt?: string;
  endsAt?: string;
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

// ── UTILITIES (bill payments, DPX-UTILITIES-001/-002) ────────────────────────
// Mirrors the BACKEND contract (apps/backend/src/utilities/*), not the shape
// this screen would find convenient. A client-shaped interface that drifts
// from the server is how a screen ends up rendering `undefined` for every
// field while the build stays green — this app has no tsconfig, so nothing
// would catch it but a browser.

export type UtilityServiceType =
  'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'CABLE_TV' | 'BETTING' | 'EDUCATION';
export type UtilityPaymentMethod = 'WALLET' | 'PAYSTACK' | 'FLUTTERWAVE';
export type UtilityPurchaseStatus =
  'AWAITING_PAYMENT' | 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED';

export interface CardProviderOptionDto {
  provider: 'PAYSTACK' | 'FLUTTERWAVE';
  label: string;
}

/** Which gateways can take a payment right now. Read from the server so a
 * rotated key never leaves a dead button on screen. */
export interface CustomerPaymentProvidersDto {
  cardProviders: CardProviderOptionDto[];
  defaultCardProvider: 'PAYSTACK' | 'FLUTTERWAVE' | null;
}

export interface UtilityCatalogueDto {
  /** False until Peyflex credentials exist. The tile badges itself from this
   * rather than looking live and failing after a bundle is chosen. */
  available: boolean;
  /** Whether a card gateway is configured server-side. */
  cardEnabled: boolean;
  services: UtilityServiceType[];
  airtimeMinAmount: number;
  airtimeMaxAmount: number;
  bettingMinAmount: number;
  bettingMaxAmount: number;
  /** Exam PINs are the only service bought in quantity. */
  educationMaxQuantity: number;
}

export interface UtilityNetworkDto {
  code: string;
  name: string;
}

/** A result-checker PIN. `unitPrice` is for ONE — the charge is unitPrice
 *  multiplied by the quantity, which no other utility does. */
export interface UtilityEducationPlanDto {
  id: string;
  planCode: string;
  unitPrice: number;
  label: string;
}

export interface UtilityDataPlanDto {
  /** `plan_code:amount`, not the bare plan code — the provider publishes the
   * same code at two different prices. */
  id: string;
  planCode: string;
  amount: number;
  label: string;
}

export interface UtilityCablePlanDto {
  id: string;
  planCode: string;
  amount: number;
  label: string;
  description?: string;
}

export interface UtilityElectricityDiscoDto {
  code: string;
  name: string;
  minAmount: number;
  maxAmount: number;
}

export interface UtilityCustomerLookupDto {
  customerName: string;
  identifier: string;
  providerName?: string;
}

export interface UtilityPurchaseDto {
  id: string;
  serviceType: UtilityServiceType;
  customerIdentifier: string;
  providerCode: string;
  planCode: string | null;
  amountCharged: number;
  /** Exam PINs only. Without it a receipt for ₦16,050 cannot explain itself. */
  quantity: number | null;
  /** Whose betting account was funded, as verified before payment. */
  beneficiaryName: string | null;
  paymentMethod: UtilityPaymentMethod;
  status: UtilityPurchaseStatus;
  providerReference: string | null;
  /** The electricity token or exam PIN(s) — every PIN a purchase sold, in one
   * `||`-separated string. Re-displayable, because a customer who closes the
   * app and loses it has lost the money. */
  deliveredToken: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface InitiateUtilityPurchaseResult {
  purchase: UtilityPurchaseDto;
  /** Card path only. */
  authorizationUrl?: string;
}

export interface CreateUtilityPurchaseRequest {
  serviceType: UtilityServiceType;
  provider: string;
  customerIdentifier: string;
  planId?: string;
  amount?: number;
  /** EDUCATION only — how many PINs. Defaults to 1. */
  quantity?: number;
  meterType?: 'prepaid' | 'postpaid';
  contactPhone?: string;
  /** Send 'CARD', never a named gateway — which gateway takes the money is a
   * server decision, so a client naming one breaks when its keys change. */
  paymentMethod: UtilityPaymentMethod | 'CARD';
  /** Where the gateway returns the customer after paying. See
   * `lib/gatewayReturn.ts`. */
  callbackUrl?: string;
}

export interface UtilityFloatStatusDto {
  configured: boolean;
  balance: number | null;
  currency: string;
  threshold: number;
  low: boolean;
  error?: string;
}

export interface AdminUtilityPurchaseDto extends UtilityPurchaseDto {
  /** Exactly what the provider replied. Ops-only — `failureReason` is the
   * customer's wording and says nothing about why a call failed. */
  providerResponse?: unknown;
  customerId: string;
  providerCost: number | null;
}

// Notifications
/**
 * A notification as `GET /customer/notifications` actually returns it — the
 * raw Prisma row, so the field names are the column names.
 *
 * This copy previously declared `read: boolean` and `data`. Neither exists:
 * the row carries `readAt: string | null` and `payload`. `n.read` was
 * therefore `undefined` on every notification ever fetched, so `!n.read` was
 * always true — every notification rendered as unread and the bell's dot
 * could never clear, no matter how many the customer opened or how often
 * mark-all-read succeeded.
 */
/** A channel the backend can deliver on. Mirrors the Prisma enum. */
export type NotificationChannel = 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP' | 'WHATSAPP';

export interface NotificationPreferenceInput {
  channel: NotificationChannel;
  /** The Prisma NotificationType. Only PROMOTION is written by the app today. */
  type: string;
  enabled: boolean;
}

export interface NotificationPreferenceDto extends NotificationPreferenceInput {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NotificationDto {
  id: string;
  userId: string;
  category: string;
  channel: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  body: string;
  payload: unknown;
  expiresAt: string | null;
  /** Null until the customer opens it. This is the read flag. */
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  /** Sets or replaces the payout PIN. The backend has one endpoint for both —
   * there is no separate "change" call and no old-PIN challenge, which is a
   * gap worth closing, recorded in the diff register rather than faked here. */
  setPin: (pin: string) => dx<{ set: true }>('POST', `/${prefix}/wallet/pin`, { pin }),
  requestPayout: (body: { amount: number; bankAccountId: string; pin: string }) =>
    dx<PayoutResultDto>('POST', `/${prefix}/wallet/payouts`, body),
  listPayouts: () => dx<PaginatedResult<PayoutRequestDto>>('GET', `/${prefix}/wallet/payouts`),
});

export const api = {
  // ── CMS (public, no auth) ──────────────────────────────────────────────────
  // Legal pages live in the CMS so Ops can revise them without a deploy — a
  // privacy policy hardcoded in a bundle is one nobody can correct in a hurry.
  cms: {
    getPage: (slug: string) => dx<CmsPageDto>('GET', `/cms/pages/${encodeURIComponent(slug)}`),
  },

  // ── DRIVER SUPPORT TICKETS ─────────────────────────────────────────────────
  driverSupport: {
    list: () => dx<DriverSupportTicketDto[]>('GET', '/driver/support-tickets'),
    create: (body: { category: DriverSupportCategory; subject: string; description: string }) =>
      dx<DriverSupportTicketDto>('POST', '/driver/support-tickets', body),
  },

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

    /**
     * Google sign-in, second half.
     *
     * The backend runs the whole OAuth dance itself and redirects the browser
     * back to `${CUSTOMER_APP_URL}/auth/google/callback?code=<handoff>`. That
     * handoff code is short-lived and single-use: real JWTs are deliberately
     * kept out of the redirect URL, which ends up in browser history and in
     * referrer headers. This trades it for the actual token pair, which is
     * why it is a POST and not part of the redirect.
     */
    exchangeGoogleCode: (code: string) =>
      dx<PortalLoginResponse>('POST', '/auth/google/exchange', { code }),

    /**
     * Where to send the browser to *start* Google sign-in.
     *
     * A full-page navigation, not a fetch: OAuth needs a top-level redirect so
     * Google can show its own consent screen and set its own cookies. The
     * backend owns the whole dance from there and lands the browser back on
     * /auth/google/callback.
     */
    googleSignInUrl: () => `${BASE}/auth/google`,

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
      dx<{ verified: true; email: string; status: string; emailVerifiedAt: string }>(
        'POST',
        '/auth/email/verify',
        body,
      ),
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
    // The shape the API actually returns. This was hand-written as
    // { name, phone } — fields the endpoint has never sent — so the search
    // result rendered a blank row and `r.name.slice(0, 2)` threw the moment a
    // recipient was found. Nobody hit it only because the phone lookup itself
    // never matched.
    findRecipient: (phone: string) =>
      dx<WalletRecipientDto[]>('GET', '/customer/wallet/transfer/recipients', undefined, { phone }),
    recentRecipients: () =>
      dx<WalletRecipientDto[]>('GET', '/customer/wallet/transfer/recipients/recent'),
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
      dx<SmartSearchResult<MerchantSummaryDto>>('GET', '/merchants/smart-search', undefined, {
        query,
        ...params,
      }).then((r) => r.results),
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
      dx<SmartSearchResult<ProductSummaryDto>>('GET', '/products/smart-search', undefined, {
        query,
        ...params,
      }).then((r) => r.results),
    getProduct: (id: string) =>
      dx<ProductSummaryDto & { description?: string }>('GET', `/products/${id}`),
    getSimilarProducts: (id: string) => dx<ProductSummaryDto[]>('GET', `/products/${id}/similar`),
    getCategories: () => dx<CategoryDto[]>('GET', '/categories'),
    getBrands: () =>
      dx<{ id: string; name: string; slug: string; logoUrl: string | null }[]>('GET', '/brands'),
  },

  // ── HOTEL BOOKING, CUSTOMER SIDE (DPX-HOTEL-001 / 002) ─────────────────────
  //
  // The money path here is NOT the one in the original plan. Founder decision
  // 2026-08-22 replaced the wallet hold entirely:
  //
  //   apply (nothing at stake, empty wallet is fine)
  //     → hotel accepts        → AWAITING_PAYMENT, 24 hours to pay
  //     → pay via the gateway  → CONFIRMED, and a 5-character PIN for the desk
  //
  // So there is no balance check before applying, and `pay` is an ordinary
  // gateway checkout — the same one utilities and wallet top-ups already use.
  bookings: {
    /** A hotel's rooms. Takes the `MerchantProfile.id` the marketplace card
     *  carries (`MerchantSummaryDto.id`), not a Business id — the two are
     *  different and the endpoint resolves the mapping server-side. */
    roomTypes: (merchantId: string) =>
      dx<RoomTypeDto[]>('GET', `/customer/bookings/hotels/${merchantId}/room-types`),
    calendar: (roomTypeId: string, from: string, to: string) =>
      dx<RoomAvailabilityDto[]>(
        'GET',
        `/customer/bookings/room-types/${roomTypeId}/calendar`,
        undefined,
        { from, to },
      ),
    /** The quote. The booking call re-runs this server-side, so a stale price
     *  on a phone can never become the amount charged. */
    availability: (
      roomTypeId: string,
      params: { checkIn: string; checkOut: string; rooms?: number },
    ) =>
      dx<AvailabilityResult>(
        'GET',
        `/customer/bookings/room-types/${roomTypeId}/availability`,
        undefined,
        params,
      ),
    create: (body: {
      roomTypeId: string;
      checkIn: string;
      checkOut: string;
      rooms?: number;
      guests?: number;
      guestName: string;
      guestPhone: string;
      guestNote?: string;
    }) => dx<BookingDto>('POST', '/customer/bookings', body),
    /** Start the checkout. `authorizationUrl` is null when the gateway is not
     *  configured — the caller must handle that rather than open `null`. */
    pay: (id: string, callbackUrl?: string) =>
      dx<{ booking: BookingDto; authorizationUrl: string | null }>(
        'POST',
        `/customer/bookings/${id}/pay`,
        { callbackUrl },
      ),
    /** Ask the gateway whether the money actually arrived. Coming back from a
     *  checkout page proves nothing on its own. */
    confirmPayment: (id: string) => dx<BookingDto>('POST', `/customer/bookings/${id}/pay/confirm`),
    // ApiPage, not PaginatedResult: the flat type declared above does not match
    // what the NestJS controllers actually send. See the note at ApiPage.
    list: (params?: { page?: number; pageSize?: number }) =>
      dx<ApiPage<CustomerBookingListItemDto>>('GET', '/customer/bookings', undefined, params),
    get: (id: string) => dx<CustomerBookingDto>('GET', `/customer/bookings/${id}`),
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
    // DPX-ORDER-PROOF-001 — file the bank receipt for a "Pay to Merchant Bank"
    // order. Does NOT mark the order paid: the merchant still confirms the
    // money reached their own account. This puts the customer's evidence on
    // file so a later dispute has something to reference.
    submitPaymentProof: (
      orderId: string,
      body: { receiptUrl: string; reference?: string; amount?: number; note?: string },
    ) => dx<OrderPaymentProofDto>('POST', `/customer/orders/${orderId}/payment-proof`, body),
    // Receipts already filed. `receiptUrl` on each is a short-lived signed URL
    // minted for this read — display it, never persist it.
    getPaymentProofs: (orderId: string) =>
      dx<OrderPaymentProofDto[]>('GET', `/customer/orders/${orderId}/payment-proofs`),
  },

  // ── RIDES (customer) ───────────────────────────────────────────────────────
  rides: {
    /** Pass a pickup point to have each entry also report whether a driver of
     * that type is actually reachable from it — so the fare screen can say so
     * before the passenger books, instead of after five failed dispatch
     * attempts. Without coordinates the catalog comes back with no
     * availability claim, exactly as before. */
    getRideTypes: (params?: { latitude: number; longitude: number }) =>
      dx<RideTypeCatalogEntryDto[]>('GET', '/customer/rides/types', undefined, params),
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
    getReceipt: (id: string) => dx<RideReceiptDto>('GET', `/customer/rides/${id}/receipt`),
    /** Mints (or returns) the public link for this trip. Idempotent. */
    share: (id: string) => dx<RideShareLinkDto>('POST', `/customer/rides/${id}/share`),
    /**
     * Reads a shared trip by its link token. Deliberately does NOT go through
     * dx(): whoever opens a shared link is family, not an account holder, so
     * no token is sent and a 401 handler has nothing to do here.
     */
    getShared: async (token: string): Promise<SharedRideDto> => {
      const res = await fetch(`${BASE}/public/rides/shared/${encodeURIComponent(token)}`);
      const json: unknown = await res.json().catch(() => null);
      const payload = json as { success?: boolean; data?: SharedRideDto; message?: string } | null;
      if (!res.ok || payload?.success === false || !payload?.data) {
        throw new ApiError(res.status, payload?.message ?? 'This trip link is not valid', 'SHARE');
      }
      return payload.data;
    },
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
    getAvailability: () => dx<DriverAvailabilityDto | null>('GET', '/driver/rides/availability'),
    getActive: () => dx<DriverRideDto | null>('GET', '/driver/rides/active'),
    getOffers: () => dx<RideOfferDto[]>('GET', '/driver/rides/offers'),
    getOfferPreview: (offerId: string) =>
      dx<RideOfferPreviewDto>('GET', `/driver/rides/offers/${offerId}`),
    acceptOffer: (offerId: string) => dx<RideDto>('POST', `/driver/rides/offers/${offerId}/accept`),
    declineOffer: (offerId: string) => dx<null>('POST', `/driver/rides/offers/${offerId}/decline`),
    arrive: (id: string) => dx<RideDto>('POST', `/driver/rides/${id}/arrive`),
    start: (id: string, verificationCode?: string) =>
      dx<RideDto>(
        'POST',
        `/driver/rides/${id}/start`,
        verificationCode !== undefined ? { verificationCode } : {},
      ),
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
    /** The driver's own approval state. Dispatch will only offer a ride to a
     * driver whose DriverProfile.status is APPROVED, so this is the difference
     * between "waiting for work" and "structurally unable to receive it". */
    getProfile: () => dx<DriverOwnProfileDto>('GET', '/driver/profile'),
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
    // Amend a vehicle the driver already registered. Photos-only updates do not
    // reset an approval (VehiclesService.updateOwnVehicle), so adding the four
    // inspection angles to an existing vehicle is safe — and is what the driver
    // needs, rather than registering the same car a second time.
    updateVehicle: (
      id: string,
      body: {
        make?: string;
        model?: string;
        color?: string;
        year?: number;
        rideCategory?: RideType;
        seats?: number;
        photos?: string[];
      },
    ) => dx<unknown>('PATCH', `/driver/vehicles/${id}`, body),
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
    // ── Physical vehicle inspection (DPX-DRIVER-002 Phase 3) ─────────────────
    // These routes shipped with the inspection module and nothing in the app
    // ever called them, so a driver could not see or book an inspection — and
    // Operations has no scheduling endpoint at all, which makes booking the
    // driver's to do and nobody else's.
    listInspectionCentres: () => dx<InspectionCentreDto[]>('GET', '/driver/inspections/centres'),
    listInspections: () => dx<DriverInspectionDto[]>('GET', '/driver/inspections'),
    // `reinspectionOfId` is how a failed inspection is retried. The backend
    // accepts it ONLY when the referenced inspection is FAILED, which is the
    // founder's rule ("it should be re-inspection") already enforced server-side.
    scheduleInspection: (body: {
      vehicleId: string;
      centreId: string;
      scheduledAt: string;
      reinspectionOfId?: string;
      notes?: string;
    }) => dx<DriverInspectionDto>('POST', '/driver/inspections', body),
    cancelInspection: (id: string) =>
      dx<DriverInspectionDto>('POST', `/driver/inspections/${id}/cancel`),
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
    // ── Hotel rooms and bookings (DPX-HOTEL-001) ────────────────────────────
    //
    // No route takes a businessId. The backend resolves the hotel from the
    // signed-in merchant, so there is nowhere in a request to name someone
    // else's business — see MerchantBookingsController.
    bookings: {
      listRoomTypes: () => dx<RoomTypeDto[]>('GET', '/merchant/bookings/room-types'),
      createRoomType: (body: {
        name: string;
        description?: string;
        capacity?: number;
        basePrice: number;
        totalRooms: number;
        photoUrl?: string;
      }) => dx<RoomTypeDto>('POST', '/merchant/bookings/room-types', body),
      updateRoomType: (
        id: string,
        body: {
          name?: string;
          description?: string;
          capacity?: number;
          basePrice?: number;
          totalRooms?: number;
          photoUrl?: string;
          isActive?: boolean;
        },
      ) => dx<RoomTypeDto>('PATCH', `/merchant/bookings/room-types/${id}`, body),
      /** `from`/`to` are YYYY-MM-DD, and `to` is exclusive like a check-out. */
      getCalendar: (id: string, from: string, to: string) =>
        dx<RoomAvailabilityDto[]>(
          'GET',
          `/merchant/bookings/room-types/${id}/calendar`,
          undefined,
          { from, to },
        ),
      openNights: (
        id: string,
        body: { from: string; to: string; roomsOpen: number; priceOverride?: number | null },
      ) => dx<RoomAvailabilityDto[]>('POST', `/merchant/bookings/room-types/${id}/calendar`, body),
      list: (params?: { page?: number; pageSize?: number; status?: BookingStatus }) =>
        dx<ApiPage<MerchantBookingDto>>(
          'GET',
          '/merchant/bookings',
          undefined,
          params as Record<string, string | number> | undefined,
        ),
      /** What this hotel is due at the next Monday run, before it happens. */
      nextSettlement: () => dx<SettlementPreviewDto>('GET', '/merchant/bookings/settlements/next'),
      /** What DrippleX has paid this hotel, week by week. Shipped in the
       *  backend with weekly settlement; this is the client that reads it. */
      settlements: (params?: { page?: number; pageSize?: number }) =>
        dx<ApiPage<BookingSettlementDto>>(
          'GET',
          '/merchant/bookings/settlements',
          undefined,
          params,
        ),
      /** Find a guest by the code they read out at the desk.
       *  A POST, not a GET: a check-in code is a credential and a URL is the
       *  part of a request that ends up in logs and history. */
      lookupByPin: (pin: string) =>
        dx<MerchantBookingDto>('POST', '/merchant/bookings/check-in/lookup', { pin }),
      checkIn: (id: string) => dx<MerchantBookingDto>('POST', `/merchant/bookings/${id}/check-in`),
      checkOut: (id: string) =>
        dx<MerchantBookingDto>('POST', `/merchant/bookings/${id}/check-out`),
      noShow: (id: string) => dx<MerchantBookingDto>('POST', `/merchant/bookings/${id}/no-show`),
      accept: (id: string) => dx<MerchantBookingDto>('POST', `/merchant/bookings/${id}/accept`),
      reject: (id: string, reason?: string) =>
        dx<MerchantBookingDto>('POST', `/merchant/bookings/${id}/reject`, { reason }),
    },

    // Business profile
    getBusiness: () => dx<MerchantBusinessDto>('GET', '/merchant/business'),
    // Registration: create the merchant's business record (minimal onboarding —
    // only businessName + businessType are required; it starts PENDING and
    // enters the Ops approval queue). Use this the first time; updateBusiness
    // PATCHes an existing one.
    createBusiness: (body: {
      businessName: string;
      /** The LEGAL structure (sole proprietorship, LLC…). Not what they sell. */
      businessType: string;
      /** What they SELL. Optional in the backend DTO, and it was missing from
       *  this type entirely — which is why onboarding never sent one and every
       *  merchant registered through the app landed uncategorised. */
      category?: MerchantCategory;
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
    // The receipts the customer filed for this order — what the merchant should
    // look at before confirming the transfer landed.
    getOrderPaymentProofs: (id: string) =>
      dx<OrderPaymentProofDto[]>('GET', `/merchant/orders/${id}/payment-proofs`),
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
    // ── Commissions ──────────────────────────────────────────────────────
    // Who owes DrippleX money, and who is blocked from trading because of
    // it. A merchant blocked here shows their customers "blocked due to an
    // outstanding commission balance" at checkout, so this desk is the only
    // place that error can be resolved.
    listCommissionAccounts: (params?: {
      ownerType?: CommissionOwnerType;
      blocked?: boolean;
      page?: number;
      limit?: number;
    }) =>
      dx<PaginatedResult<AdminCommissionAccountDto>>(
        'GET',
        '/admin/commercial/accounts',
        undefined,
        {
          ...(params?.ownerType ? { ownerType: params.ownerType } : {}),
          ...(params?.blocked !== undefined ? { blocked: params.blocked } : {}),
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
        },
      ),
    /** Everything DrippleX has with one partner: what we hold for them, what
     * they owe us, and the net. */
    getPartnerPosition: (ownerType: CommissionOwnerType, ownerId: string) =>
      dx<PartnerFinancialPositionDto>(
        'GET',
        `/admin/commercial/accounts/${ownerType}/${ownerId}/position`,
      ),
    getCommissionLedger: (ownerType: CommissionOwnerType, ownerId: string) =>
      dx<PaginatedResult<CommissionLedgerEntryDto>>(
        'GET',
        `/admin/commercial/accounts/${ownerType}/${ownerId}/ledger`,
      ),
    /** Records an external payment against the balance. Enough of one clears
     * the block and the merchant can take orders again. */
    recordCommissionPayment: (
      ownerType: CommissionOwnerType,
      ownerId: string,
      amount: number,
      description?: string,
    ) =>
      dx<CommissionAccountDto>(
        'POST',
        `/admin/commercial/accounts/${ownerType}/${ownerId}/payments`,
        { amount, ...(description ? { description } : {}) },
      ),
    /** Record (or, with null, clear) the credit limit agreed with ONE partner.
     * A negotiated limit overrides the owner-type default outright. */
    negotiateCreditLimit: (
      ownerType: CommissionOwnerType,
      ownerId: string,
      creditLimit: number | null,
      note?: string,
    ) =>
      dx<CommissionAccountDto>(
        'PATCH',
        `/admin/commercial/accounts/${ownerType}/${ownerId}/credit-limit`,
        { creditLimit, ...(note ? { note } : {}) },
      ),
    getCreditSetting: (ownerType: CommissionOwnerType) =>
      dx<CommercialCreditSettingDto>('GET', `/admin/commercial/credit-settings/${ownerType}`),
    updateCreditSetting: (ownerType: CommissionOwnerType, creditLimit: number) =>
      dx<CommercialCreditSettingDto>('PATCH', '/admin/commercial/credit-settings', {
        ownerType,
        creditLimit,
      }),

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
    /** Activate a driver so dispatch can reach them. The endpoint has existed
     * since the onboarding work and nothing called it, so a driver who passed
     * every activation check sat PENDING with no way to be approved — which is
     * why six drivers could be fully documented and still unreachable. The
     * backend re-runs the eligibility gate itself and refuses if anything is
     * genuinely unmet. */
    approveDriver: (driverId: string) =>
      dx<DriverApprovalDto>('POST', `/admin/driver/${driverId}/approve`),
    rejectDriver: (driverId: string, reason: string) =>
      dx<DriverApprovalDto>('POST', `/admin/driver/${driverId}/reject`, { reason }),
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
    /**
     * Why a driver or rider is — or is not — getting work.
     *
     * Every gate here already governed dispatch and every one was silent, so
     * "he is online but no order matches him" could only be answered by
     * reading the dispatcher's query. Read-only; it changes nothing.
     */
    getDriverEligibility: (id: string) =>
      dx<DispatchEligibilityDto>('GET', `/operations/fleet/drivers/${id}/eligibility`),
    getRiderEligibility: (id: string) =>
      dx<DispatchEligibilityDto>('GET', `/operations/fleet/riders/${id}/eligibility`),
    // Live ride queue (active rides only) for the Trips screen.
    getRideQueue: () =>
      dx<{
        rides: AdminLiveRideDto[];
        summary: RideQueueSummaryDto;
      }>('GET', '/operations/rides'),
    /**
     * Cancel a stranded ride from the Operations desk. Behind
     * `admin:rides:support` — the same permission as ride refunds and problem
     * reports. The reason is mandatory: it is the only account the passenger
     * and the driver will get, and it lands in the audit trail against the
     * operator who typed it. Allowed up to and including IN_PROGRESS; a
     * completed ride is refunded, not cancelled.
     */
    cancelRide: (rideId: string, reason: string) =>
      dx<RideDto>('POST', `/admin/rides/${rideId}/cancel`, { reason }),
    // Recent operations activity feed for the Dashboard.
    getActivityFeed: () =>
      dx<{ items: AdminActivityFeedItemDto[] }>('GET', '/operations/dashboard/activity-feed'),
    // Analytics overview KPIs. from/to are ISO timestamps (required).
    getAnalyticsOverview: (from: string, to: string) =>
      dx<AdminAnalyticsOverviewDto>('GET', '/operations/analytics/overview', undefined, {
        from,
        to,
      }),

    // Ride fare rates, one row per ride type. Behind
    // `admin:rides:pricing:manage` — the permission that went missing from the
    // production catalogue in #182 and 403'd this whole page.
    getRideFareRates: () => dx<RideFareRateDto[]>('GET', '/admin/rides/pricing/rates'),
    updateRideFareRate: (
      rideType: RideType,
      body: {
        baseFare: number;
        perKmRate: number;
        perMinuteRate: number;
        minimumFare: number;
      },
    ) => dx<RideFareRateDto>('PUT', `/admin/rides/pricing/rates/${rideType}`, body),

    // Surcharge zones — the airport premium and anything like it. The list
    // includes inactive zones on purpose: the console is where you go to turn
    // one back on, so hiding them would hide the control.
    getRideSurchargeZones: () => dx<RideSurchargeZoneDto[]>('GET', '/admin/rides/pricing/zones'),
    createRideSurchargeZone: (body: {
      name: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      surchargeType: RideSurchargeType;
      amount: number;
      appliesTo?: RideSurchargeTrigger;
      active?: boolean;
    }) => dx<RideSurchargeZoneDto>('POST', '/admin/rides/pricing/zones', body),
    /** Every field optional — switching a zone off must not mean resubmitting
     * its geometry, which is how a coordinate gets fat-fingered. */
    updateRideSurchargeZone: (
      id: string,
      body: Partial<{
        name: string;
        latitude: number;
        longitude: number;
        radiusMeters: number;
        surchargeType: RideSurchargeType;
        amount: number;
        appliesTo: RideSurchargeTrigger;
        active: boolean;
      }>,
    ) => dx<RideSurchargeZoneDto>('PATCH', `/admin/rides/pricing/zones/${id}`, body),

    // Promo campaigns. The engine and its admin API have existed all along
    // (POST/GET/PATCH /admin/promotions, promotions:admin:manage); the console
    // simply never called them and told the operator to go somewhere else —
    // somewhere that does not exist. Founder decision, 2026-08-19: promos are
    // created here.
    listPromotions: (params?: { status?: PromotionStatus; domain?: PromotionDomain }) =>
      dx<AdminPromotionDto[]>('GET', '/admin/promotions', undefined, params),
    createPromotion: (body: CreatePromotionRequest) =>
      dx<AdminPromotionDto>('POST', '/admin/promotions', body),
    updatePromotion: (id: string, body: Partial<CreatePromotionRequest>) =>
      dx<AdminPromotionDto>('PATCH', `/admin/promotions/${id}`, body),
    pausePromotion: (id: string) => dx<AdminPromotionDto>('POST', `/admin/promotions/${id}/pause`),
    resumePromotion: (id: string) =>
      dx<AdminPromotionDto>('POST', `/admin/promotions/${id}/resume`),
    expirePromotion: (id: string) =>
      dx<AdminPromotionDto>('POST', `/admin/promotions/${id}/force-expire`),

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
    /** Set what a merchant sells, on their behalf. null clears it back to
     *  uncategorised rather than forcing OTHER. */
    setMerchantCategory: (id: string, category: MerchantCategory | null) =>
      dx<unknown>('PATCH', `/admin/merchant/${id}/category`, { category }),

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

    /**
     * Notification preferences, one row per (channel, type). This is the only
     * preference store the backend has — there is no general "settings" model —
     * so it is what the Privacy Controls screen's marketing pills write to,
     * against type PROMOTION.
     *
     * The controller returns raw Prisma rows, so the field names here are the
     * column names. Declared to match, after three contract mismatches today
     * caused by client types that were merely plausible.
     */
    getPreferences: () =>
      dx<NotificationPreferenceDto[]>('GET', '/customer/notifications/preferences'),
    updatePreferences: (preferences: NotificationPreferenceInput[]) =>
      dx<NotificationPreferenceDto[]>('PUT', '/customer/notifications/preferences', {
        preferences,
      }),
  },

  // ── UTILITIES (customer bill payments) ──────────────────────────────────────
  // The catalogues are read from the provider on every call rather than
  // hardcoded: a stale plan list is how a customer pays for a bundle that no
  // longer exists.
  payments: {
    /** Both Paystack and Flutterwave stay configured and the customer picks
     * (founder, 2026-08-18) — one gateway can be down while the other works. */
    providers: () => dx<CustomerPaymentProvidersDto>('GET', '/customer/payments/providers'),
  },

  utilities: {
    getCatalogue: () => dx<UtilityCatalogueDto>('GET', '/customer/utilities'),
    airtimeNetworks: () => dx<UtilityNetworkDto[]>('GET', '/customer/utilities/airtime/networks'),
    dataNetworks: () => dx<UtilityNetworkDto[]>('GET', '/customer/utilities/data/networks'),
    dataPlans: (provider: string) =>
      dx<UtilityDataPlanDto[]>('GET', '/customer/utilities/data/plans', undefined, { provider }),
    cableProviders: () => dx<UtilityNetworkDto[]>('GET', '/customer/utilities/cable/providers'),
    cablePlans: (provider: string) =>
      dx<UtilityCablePlanDto[]>('GET', '/customer/utilities/cable/plans', undefined, { provider }),
    electricityProviders: () =>
      dx<UtilityElectricityDiscoDto[]>('GET', '/customer/utilities/electricity/providers'),
    bettingProviders: () => dx<UtilityNetworkDto[]>('GET', '/customer/utilities/betting/providers'),
    /** One flat list — exam PINs all sit under a single provider, so there is
     *  no provider to choose first. */
    educationPlans: () =>
      dx<UtilityEducationPlanDto[]>('GET', '/customer/utilities/education/plans'),
    verifyBetting: (body: { provider: string; customerId: string }) =>
      dx<UtilityCustomerLookupDto>('POST', '/customer/utilities/betting/verify', body),
    verifyCable: (body: { provider: string; smartcardNumber: string }) =>
      dx<UtilityCustomerLookupDto>('POST', '/customer/utilities/cable/verify', body),
    verifyElectricity: (body: {
      provider: string;
      meterNumber: string;
      meterType: 'prepaid' | 'postpaid';
    }) => dx<UtilityCustomerLookupDto>('POST', '/customer/utilities/electricity/verify', body),
    purchase: (body: CreateUtilityPurchaseRequest) =>
      dx<InitiateUtilityPurchaseResult>('POST', '/customer/utilities/purchase', body),
    confirm: (id: string) =>
      dx<UtilityPurchaseDto>('POST', `/customer/utilities/purchase/${id}/confirm`),
    history: (params?: { page?: number; pageSize?: number; serviceType?: UtilityServiceType }) =>
      dx<PaginatedResult<UtilityPurchaseDto>>(
        'GET',
        '/customer/utilities/purchases',
        undefined,
        params,
      ),
    receipt: (id: string) => dx<UtilityPurchaseDto>('GET', `/customer/utilities/purchases/${id}`),
  },

  // ── UTILITIES (ops) ─────────────────────────────────────────────────────────
  adminUtilities: {
    /** The provider float. It is shared by every utility purchase on the
     * platform, so it running dry fails all four services at once. */
    float: () => dx<UtilityFloatStatusDto>('GET', '/admin/utilities/float'),
    purchases: (params?: {
      page?: number;
      pageSize?: number;
      serviceType?: UtilityServiceType;
      status?: UtilityPurchaseStatus;
    }) =>
      dx<PaginatedResult<AdminUtilityPurchaseDto>>(
        'GET',
        '/admin/utilities/purchases',
        undefined,
        params,
      ),
    resolve: (
      id: string,
      body: {
        outcome: 'SUCCESSFUL' | 'REVERSED';
        note: string;
        providerReference?: string;
        deliveredToken?: string;
        providerCost?: number;
      },
    ) => dx<AdminUtilityPurchaseDto>('PATCH', `/admin/utilities/purchases/${id}/resolve`, body),
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
