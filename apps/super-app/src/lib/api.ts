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

export interface MerchantProductDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  category: string | null;
  imageUrl: string | null;
  inStock: boolean;
  published: boolean;
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

export interface MerchantKycDto {
  id: string;
  overallStatus: string;
  documents: {
    type: string;
    status: string;
    uploadedAt: string | null;
    rejectionReason: string | null;
  }[];
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

    // Email verification (token-based) — real routes are under /auth/email/*.
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
  },

  // ── MERCHANT ───────────────────────────────────────────────────────────────
  merchant: {
    // Business profile
    getBusiness: () => dx<MerchantBusinessDto>('GET', '/merchant/business'),
    updateBusiness: (body: Partial<MerchantBusinessDto>) =>
      dx<MerchantBusinessDto>('PATCH', '/merchant/business', body),
    pauseStore: () => dx<void>('POST', '/merchant/business/pause'),
    resumeStore: () => dx<void>('POST', '/merchant/business/resume'),

    // KYC
    getKyc: () => dx<MerchantKycDto>('GET', '/merchant/kyc'),
    submitKycDoc: (body: { documentType: string; frontImageUrl: string; backImageUrl?: string }) =>
      dx<MerchantKycDto>('POST', '/merchant/kyc', body),

    // Products
    getProducts: () => dx<MerchantProductDto[]>('GET', '/merchant/products'),
    createProduct: (body: {
      name: string;
      description?: string;
      price: number;
      currency?: string;
      category?: string;
      imageUrl?: string;
      inStock?: boolean;
      published?: boolean;
    }) => dx<MerchantProductDto>('POST', '/merchant/products', body),
    updateProduct: (id: string, body: Partial<MerchantProductDto>) =>
      dx<MerchantProductDto>('PATCH', `/merchant/products/${id}`, body),
    deleteProduct: (id: string) => dx<void>('DELETE', `/merchant/products/${id}`),

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
    getSettlements: () => dx<MerchantSettlementDto[]>('GET', '/merchant/settlements'),

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
