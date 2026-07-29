import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCustomerSdk } from '../sdk.js';

import { installFetchMock, jsonErr, jsonOk, pathsOf, sampleTokens, sampleUser } from './helpers.js';

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('C2 Customer flow (SDK contract E2E)', () => {
  it('registers, verifies email, logs in, and refreshes session', async () => {
    const { fetchMock, calls } = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(
        jsonOk({
          userId: 'user-1',
          email: sampleUser.email,
          status: 'PENDING_VERIFICATION',
          verification: { emailOtpSent: true, phoneOtpSent: false, expiresInSeconds: 600 },
        }),
      )
      .mockResolvedValueOnce(
        jsonOk({
          verified: true,
          email: sampleUser.email,
          status: 'ACTIVE',
          emailVerifiedAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(
        jsonOk({
          user: sampleUser,
          session: {
            id: 'sess-1',
            portal: 'customer',
            ipAddress: null,
            userAgent: null,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          },
          accessToken: sampleTokens.accessToken,
          refreshToken: sampleTokens.refreshToken,
          expiresIn: sampleTokens.expiresIn,
          tokenType: 'Bearer',
        }),
      )
      .mockResolvedValueOnce(jsonOk(sampleTokens));

    const sdk = createCustomerSdk({ baseUrl: 'https://api.test/api/v1' });
    await sdk.auth.registerCustomer({
      firstName: 'Ada',
      lastName: 'Okafor',
      email: sampleUser.email,
      password: 'Password1',
    });
    await sdk.auth.verifyEmail({ email: sampleUser.email, otp: '123456' });
    await sdk.auth.loginCustomer({ email: sampleUser.email, password: 'Password1' });
    await sdk.auth.refresh(sampleTokens.refreshToken);

    expect(pathsOf(calls())).toEqual([
      { method: 'POST', path: '/auth/register/customer' },
      { method: 'POST', path: '/auth/verify/email' },
      { method: 'POST', path: '/auth/login/customer' },
      { method: 'POST', path: '/auth/refresh' },
    ]);
  });

  it('covers location, search, cart, checkout, promo, payment, tracking, review, wallet, history', async () => {
    const { fetchMock, calls } = installFetchMock();
    const orderId = 'order-1';
    fetchMock
      .mockResolvedValueOnce(jsonOk({ items: [], total: 0 }))
      .mockResolvedValueOnce(
        jsonOk({
          id: 'addr-1',
          customerId: 'c-1',
          label: 'HOME',
          recipientName: 'Ada',
          phone: '+2348012345678',
          addressLine1: '12 Admiralty',
          addressLine2: null,
          landmark: null,
          city: 'Lagos',
          state: 'LA',
          country: 'NG',
          postalCode: null,
          latitude: 6.4,
          longitude: 3.4,
          isDefault: true,
          isActive: true,
          verifiedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(jsonOk({ items: [], total: 0, page: 1, limit: 10, tookMs: 12 }))
      .mockResolvedValueOnce(jsonOk([]))
      .mockResolvedValueOnce(jsonOk(null))
      .mockResolvedValueOnce(
        jsonOk({
          id: 'cart-1',
          customerId: 'c-1',
          merchantId: 'm-1',
          currency: 'NGN',
          status: 'ACTIVE',
          items: [],
          totals: {
            subtotal: 1000,
            discount: 0,
            tax: 0,
            deliveryFee: 0,
            total: 1000,
            currency: 'NGN',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(jsonOk([{ id: 'promo-1', code: 'SAVE10' }]))
      .mockResolvedValueOnce(
        jsonOk({
          valid: true,
          discountAmount: 100,
          currency: 'NGN',
          promotionId: 'promo-1',
        }),
      )
      .mockResolvedValueOnce(jsonOk({ order: { id: orderId, status: 'PENDING_PAYMENT' } }))
      .mockResolvedValueOnce(
        jsonOk({
          authorizationUrl: 'https://pay.test/auth',
          reference: 'ref-1',
          accessCode: 'acc-1',
        }),
      )
      .mockResolvedValueOnce(jsonOk({ verified: true, status: 'SUCCESS', reference: 'ref-1' }))
      .mockResolvedValueOnce(
        jsonOk({ id: 'job-1', orderId, status: 'ASSIGNED', riderId: 'rider-1' }),
      )
      .mockResolvedValueOnce(
        jsonOk([{ id: 'tr-1', status: 'IN_TRANSIT', recordedAt: new Date().toISOString() }]),
      )
      .mockResolvedValueOnce(
        jsonOk({
          id: 'rev-1',
          rating: 5,
          comment: 'Great',
          targetType: 'ORDER',
          targetId: orderId,
        }),
      )
      .mockResolvedValueOnce(jsonOk({ items: [], total: 0, page: 1, limit: 20 }))
      .mockResolvedValueOnce(jsonOk({ id: 'wallet-1', balance: 0, currency: 'NGN' }))
      .mockResolvedValueOnce(
        jsonOk({
          items: [{ id: orderId, status: 'COMPLETED' }],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      )
      .mockResolvedValueOnce(jsonOk({ loggedOut: true }));

    const sdk = createCustomerSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => sampleTokens.accessToken,
      getRefreshToken: () => sampleTokens.refreshToken,
    });

    await sdk.addresses.list();
    await sdk.addresses.create({
      label: 'HOME',
      recipientName: 'Ada',
      phone: '+2348012345678',
      addressLine1: '12 Admiralty',
      city: 'Lagos',
      state: 'LA',
      country: 'NG',
      latitude: 6.4,
      longitude: 3.4,
    });
    await sdk.search.search({ q: 'jollof' });
    await sdk.search.popular({ limit: 5 });
    await sdk.cart.get();
    await sdk.cart.addItem({
      merchantId: 'm-1',
      productId: 'p-1',
      productName: 'Jollof',
      unitPrice: 1000,
      quantity: 1,
    });
    await sdk.promotions.active();
    await sdk.promotions.validate({ subtotal: 1000, couponCode: 'SAVE10' });
    await sdk.orders.checkout({});
    await sdk.payments.payOrder(orderId, {});
    await sdk.payments.verifyOrderPayment(orderId, { reference: 'ref-1' });
    await sdk.delivery.getDelivery(orderId);
    await sdk.delivery.getTracking(orderId);
    await sdk.reviews.create({
      targetType: 'MERCHANT',
      targetId: 'm-1',
      orderId,
      rating: 5,
      comment: 'Great',
    });
    await sdk.notifications.list({ page: 1, limit: 20 });
    await sdk.wallet.customerWallet();
    await sdk.orders.getOrders({ page: 1, pageSize: 10 });
    await sdk.auth.logout();

    const sequence = pathsOf(calls()).map((p) => `${p.method} ${p.path}`);
    expect(sequence).toEqual(
      expect.arrayContaining([
        'GET /customer/addresses',
        'POST /customer/addresses',
        'GET /search',
        'GET /search/popular',
        'GET /customer/cart',
        'POST /customer/cart/items',
        'GET /customer/promotions/active',
        'POST /customer/promotions/validate',
        'POST /customer/checkout',
        `POST /customer/orders/${orderId}/pay`,
        `POST /customer/orders/${orderId}/verify`,
        `GET /customer/orders/${orderId}/delivery`,
        `GET /customer/orders/${orderId}/tracking`,
        'POST /customer/reviews',
        'GET /customer/notifications',
        'GET /customer/wallet',
        'GET /customer/orders',
        'POST /auth/logout',
      ]),
    );
  });

  it('exposes marketplace product/merchant browsing (R1.3/R1.5) on the customer SDK', () => {
    const sdk = createCustomerSdk({ baseUrl: 'https://api.test/api/v1' });
    expect(sdk.search).toBeDefined();
    expect(sdk.products).toBeDefined();
    expect(sdk.merchants).toBeDefined();
    // Categories/brands are methods on `products`, not separate top-level clients.
    expect(sdk).not.toHaveProperty('categories');
    expect(sdk).not.toHaveProperty('stores');
  });
});

describe('C2 Customer negatives', () => {
  it('rejects invalid login with 401 without clearing session callbacks', async () => {
    const onUnauthorized = vi.fn();
    const { fetchMock } = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      jsonErr(401, 'Invalid credentials', 'UNAUTHORIZED', '/auth/login/customer'),
    );

    const sdk = createCustomerSdk({
      baseUrl: 'https://api.test/api/v1',
      onUnauthorized,
    });

    await expect(
      sdk.auth.loginCustomer({ email: 'bad@example.com', password: 'Password1' }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('maps payment failure 422 and cancelled order 409', async () => {
    const { fetchMock } = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonErr(422, 'Payment declined', 'PAYMENT_FAILED'))
      .mockResolvedValueOnce(jsonErr(409, 'Order already cancelled', 'CONFLICT'));

    const sdk = createCustomerSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'tok',
    });

    await expect(sdk.payments.payOrder('order-1')).rejects.toMatchObject({ statusCode: 422 });
    await expect(sdk.orders.cancelOrder('order-1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('maps invalid OTP as 422', async () => {
    const { fetchMock } = installFetchMock();
    fetchMock.mockResolvedValueOnce(jsonErr(422, 'Invalid OTP', 'OTP_INVALID'));
    const sdk = createCustomerSdk({ baseUrl: 'https://api.test/api/v1' });
    await expect(
      sdk.auth.verifyEmail({ email: sampleUser.email, otp: '000000' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
