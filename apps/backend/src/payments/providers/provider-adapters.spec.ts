import { FlutterwaveProvider } from './flutterwave.provider';
import { PaystackProvider } from './paystack.provider';

import type { AppConfigService } from '../../config/app-config.service';

describe('provider HTTP adapters', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('initializes Paystack payments', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: true,
          message: 'ok',
          data: {
            authorization_url: 'https://checkout.paystack.com/abc',
            access_code: 'access',
            reference: 'ref-1',
          },
        }),
    });

    const provider = new PaystackProvider({
      paystackSecretKey: 'sk_test',
      paystackBaseUrl: 'https://api.paystack.co',
    } as unknown as AppConfigService);

    const result = await provider.initializePayment({
      email: 'a@b.com',
      amount: 50,
      currency: 'NGN',
      reference: 'ref-1',
      orderId: 'o1',
      orderNumber: 'DPX-1',
    });

    expect(result.authorizationUrl).toContain('paystack');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('verifies Paystack payments', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: true,
          message: 'ok',
          data: {
            status: 'success',
            reference: 'ref-1',
            amount: 5000,
            currency: 'NGN',
            id: 42,
            paid_at: '2026-07-21T12:00:00.000Z',
          },
        }),
    });

    const provider = new PaystackProvider({
      paystackSecretKey: 'sk_test',
      paystackBaseUrl: 'https://api.paystack.co',
    } as unknown as AppConfigService);

    const result = await provider.verifyPayment({ reference: 'ref-1' });
    expect(result.success).toBe(true);
    expect(result.amount).toBe(50);
  });

  it('initializes Flutterwave payments', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'success',
          message: 'ok',
          data: { link: 'https://checkout.flutterwave.com/x', id: 7 },
        }),
    });

    const provider = new FlutterwaveProvider({
      flutterwaveSecretKey: 'flw_test',
      flutterwaveBaseUrl: 'https://api.flutterwave.com',
    } as unknown as AppConfigService);

    const result = await provider.initializePayment({
      email: 'a@b.com',
      amount: 5000,
      currency: 'NGN',
      reference: 'ref-2',
      orderId: 'o1',
      orderNumber: 'DPX-1',
    });

    expect(result.authorizationUrl).toContain('flutterwave');
  });

  it('verifies Flutterwave payments', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'success',
          message: 'ok',
          data: {
            status: 'successful',
            tx_ref: 'ref-2',
            id: 7,
            amount: 5000,
            currency: 'NGN',
          },
        }),
    });

    const provider = new FlutterwaveProvider({
      flutterwaveSecretKey: 'flw_test',
      flutterwaveBaseUrl: 'https://api.flutterwave.com',
    } as unknown as AppConfigService);

    const result = await provider.verifyPayment({ reference: 'ref-2' });
    expect(result.success).toBe(true);
  });

  it('rejects Paystack initialize when unconfigured', async () => {
    const provider = new PaystackProvider({
      paystackSecretKey: '',
      paystackBaseUrl: 'https://api.paystack.co',
    } as unknown as AppConfigService);

    await expect(
      provider.initializePayment({
        email: 'a@b.com',
        amount: 1,
        currency: 'NGN',
        reference: 'r',
        orderId: 'o',
        orderNumber: 'n',
      }),
    ).rejects.toThrow(/not configured/);
  });

  it('rejects Flutterwave initialize when unconfigured', async () => {
    const provider = new FlutterwaveProvider({
      flutterwaveSecretKey: '',
      flutterwaveBaseUrl: 'https://api.flutterwave.com',
    } as unknown as AppConfigService);

    await expect(
      provider.initializePayment({
        email: 'a@b.com',
        amount: 1,
        currency: 'NGN',
        reference: 'r',
        orderId: 'o',
        orderNumber: 'n',
      }),
    ).rejects.toThrow(/not configured/);
  });
});
