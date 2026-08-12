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
  images?: { url: string }[];
  inventory?: {
    available?: number;
    quantity?: number;
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
  openingTime: string | null;
  closingTime: string | null;
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

    // Password
    forgotPassword: (body: { email?: string; phone?: string }) =>
      dx<unknown>('POST', '/auth/password/forgot', body),
    resetPassword: (body: { token: string; password: string }) =>
      dx<unknown>('POST', '/auth/password/reset', body),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      dx<unknown>('POST', '/auth/password/change', body),
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
    get: (id: string) => dx<RideDto>('GET', `/customer/rides/${id}`),
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
    getActive: () => dx<RideDto | null>('GET', '/driver/rides/active'),
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
    // Submit the completed onboarding for Ops review (moves to pending review).
    submitOnboarding: () => dx<unknown>('POST', '/driver/onboarding/submit'),
  },

  // ── Signed uploads (R2 object storage) ──────────────────────────────────────
  uploads: {
    // POST /uploads/sign — returns a short-lived pre-signed PUT URL. folder is
    // one of the backend UPLOAD_FOLDERS (e.g. 'kyc-documents'); permission-gated.
    sign: (body: { folder: string; contentType: string; contentLength: number }) =>
      dx<{
        method: 'PUT';
        url: string;
        key: string;
        publicUrl: string;
        expiresInSeconds: number;
      }>('POST', '/uploads/sign', body),
  },

  // ── RIDER (delivery) ────────────────────────────────────────────────────────
  rider: {
    getJobs: () => dx<DeliveryJobDto[]>('GET', '/rider/jobs'),
    getJob: (id: string) => dx<DeliveryJobDto>('GET', `/rider/jobs/${id}`),
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
    setAvailability: (body: {
      online: boolean;
      acceptingOrders: boolean;
      latitude?: number;
      longitude?: number;
    }) => dx<unknown>('POST', '/rider/availability', body),
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
          // A product only counts as in stock when it has sellable quantity and
          // the merchant hasn't manually marked it out of stock.
          inStock: qty > 0 && !p.inventory?.manuallyDisabled,
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
};

// ─── Signed direct-to-R2 upload helper ─────────────────────────────────────────
// Mints a pre-signed PUT URL from the backend, uploads the file straight to R2
// (the signature is in the URL — no auth header on the PUT), and returns the
// object's stored URL to hand to a KYC/vehicle endpoint. Throws ApiError on a
// failed sign; throws a plain Error if the R2 PUT itself fails.
export async function uploadFile(file: File, folder: string): Promise<string> {
  const signed = await api.uploads.sign({
    folder,
    contentType: file.type || 'application/octet-stream',
    contentLength: file.size,
  });
  const res = await fetch(signed.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${String(res.status)}). Please try again.`);
  }
  return signed.publicUrl;
}
