import {
  composePlanId,
  decomposePlanId,
  isFloatExhausted,
  isUsableToken,
  PeyflexUtilityProvider,
  roundToKobo,
  toNumber,
} from './peyflex.provider';

import type { AppConfigService } from '../../config/app-config.service';

/**
 * The adapter is where Peyflex's wire format stops being anyone else's
 * problem, so this suite is deliberately about the format's traps rather than
 * about happy-path plumbing: HTTP codes that disagree with the body, a
 * `plan_code` that is not unique, 28-significant-figure decimals, and a
 * `token` field that sometimes contains prose instead of a token.
 *
 * Every fixture below is copied from the documented examples in
 * DPX-UTILITIES-002 — not invented, and not derived from the client's own
 * interface.
 */

const config = {
  peyflexBaseUrl: 'https://client.peyflex.example',
  peyflexApiToken: 'test-token',
  peyflexConfigured: true,
  peyflexFloatLowBalanceThreshold: 50_000,
} as unknown as AppConfigService;

function stubFetch(status: number, body: unknown): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  global.fetch = mock;
  return mock;
}

describe('Peyflex wire-format helpers', () => {
  it('parses the absurd precision Peyflex sends, and rounds it once', () => {
    // The documented airtime success carries this exact string.
    expect(toNumber('98.99999999999999997918331829')).toBeCloseTo(99, 5);
    // Written as a string, because the literal itself cannot be represented.
    expect(roundToKobo(Number('98.99999999999999997918331829'))).toBe(99);
    expect(roundToKobo(1505.005)).toBe(1505.01);
  });

  it('never turns a missing or unparseable number into NaN', () => {
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber('not a number')).toBeNull();
    expect(toNumber(0)).toBe(0);
  });

  it('keys a data plan on code AND amount, because plan_code is not unique', () => {
    // G5: Peyflex publishes M2GBS twice — ₦800 for 2 days, ₦1,505 for 1 month.
    const twoDay = composePlanId('M2GBS', 800);
    const monthly = composePlanId('M2GBS', 1505);
    expect(twoDay).not.toBe(monthly);
    expect(decomposePlanId(twoDay)).toEqual({ planCode: 'M2GBS', amount: 800 });
    expect(decomposePlanId(monthly)).toEqual({ planCode: 'M2GBS', amount: 1505 });
  });

  it('survives a plan code that itself contains the separator', () => {
    const id = composePlanId('MTN:SME:2GB', 800);
    expect(decomposePlanId(id)).toEqual({ planCode: 'MTN:SME:2GB', amount: 800 });
  });

  it('rejects the prose Peyflex puts in `token` when there is no token', () => {
    // The published electricity failure carries exactly this.
    expect(isUsableToken('Please contact Admin for Token')).toBe(false);
    expect(isUsableToken('')).toBe(false);
    expect(isUsableToken(undefined)).toBe(false);
    expect(isUsableToken('1234-5678-9012-3456-7890')).toBe(true);
  });

  it('recognises the DrippleX float running dry, whatever the wording', () => {
    expect(isFloatExhausted('Insufficient wallet balance')).toBe(true);
    expect(isFloatExhausted('INSUFFICIENT FUNDS')).toBe(true);
    expect(isFloatExhausted('Invalid meter number')).toBe(false);
  });
});

describe('PeyflexUtilityProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reads the body, not the HTTP code — a 200 saying FAILED is a failure', async () => {
    // Electricity returns HTTP 200 carrying status FAILED. Trusting the
    // status line here would credit a customer for power they never got.
    stubFetch(200, { status: 'FAILED', message: 'Electricity recharge failed' });
    const provider = new PeyflexUtilityProvider(config);
    const result = await provider.purchaseElectricity({
      providerCode: 'kaduna',
      customerIdentifier: '12345678901',
      amount: 2000,
    });
    expect(result.outcome).toBe('FAILED');
    expect(result.providerMessage).toBe('Electricity recharge failed');
  });

  it('reads the body, not the HTTP code — a 400 saying why is still a readable failure', async () => {
    // Cable signals the same class of failure with HTTP 400. Throwing on the
    // status code would turn a known failure into an unresolvable UNKNOWN and
    // strand the customer's money in a manual queue for no reason.
    stubFetch(400, { status: 'FAILED', message: 'Insufficient wallet balance' });
    const provider = new PeyflexUtilityProvider(config);
    const result = await provider.purchaseCable({
      providerCode: 'gotv',
      customerIdentifier: '1234567890',
      amount: 3600,
      planCode: 'gotv-max',
    });
    expect(result.outcome).toBe('FAILED');
    expect(result.floatExhausted).toBe(true);
  });

  it('reports SUCCESS with the reference and the rounded provider cost', async () => {
    stubFetch(200, {
      status: 'SUCCESS',
      reference: '202603091914NdL3liJe',
      amount: '100',
      charged: '98.99999999999999997918331829',
      discount: '1.000000000000000020816681712',
      network: 'MTN',
      mobile_number: '08144216361',
      message: 'Airtime topup successful',
      transaction_id: 6268,
    });
    const provider = new PeyflexUtilityProvider(config);
    const result = await provider.purchaseAirtime({
      providerCode: 'mtn',
      customerIdentifier: '08144216361',
      amount: 100,
    });
    expect(result.outcome).toBe('SUCCESS');
    expect(result.providerReference).toBe('202603091914NdL3liJe');
    // The margin is face value minus this. Both numbers are recorded, so it
    // is auditable rather than inferred.
    expect(result.providerCost).toBe(99);
  });

  it('treats a body with no status as UNKNOWN, never as a failure', async () => {
    // An answer we cannot read is not the same as a "no". Reversing it would
    // hand back money for a purchase that may have gone through.
    stubFetch(200, { message: 'something else entirely' });
    const provider = new PeyflexUtilityProvider(config);
    const result = await provider.purchaseData({
      providerCode: 'mtn',
      customerIdentifier: '08144216361',
      amount: 800,
      planCode: 'M2GBS',
    });
    expect(result.outcome).toBe('UNKNOWN');
  });

  it('treats a network failure as UNKNOWN rather than throwing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('socket hang up'));
    const provider = new PeyflexUtilityProvider(config);
    const result = await provider.purchaseAirtime({
      providerCode: 'mtn',
      customerIdentifier: '08144216361',
      amount: 100,
    });
    expect(result.outcome).toBe('UNKNOWN');
  });

  it('does not store the "contact Admin" prose as an electricity token', async () => {
    stubFetch(200, {
      status: 'SUCCESS',
      reference: 'ref-1',
      charged: '1980.00',
      token: 'Please contact Admin for Token',
    });
    const provider = new PeyflexUtilityProvider(config);
    const result = await provider.purchaseElectricity({
      providerCode: 'kano',
      customerIdentifier: '12345678901',
      amount: 2000,
    });
    expect(result.outcome).toBe('SUCCESS');
    expect(result.deliveredToken).toBeUndefined();
  });

  it('reads data networks by `identifier`, not by `id`', async () => {
    // Airtime networks come back keyed `id`; data networks keyed
    // `identifier`. Reading the wrong key yields a list of nameless blanks.
    stubFetch(200, { networks: [{ name: 'MTN', identifier: 'mtn' }] });
    const provider = new PeyflexUtilityProvider(config);
    expect(await provider.listDataNetworks()).toEqual([{ code: 'mtn', name: 'MTN' }]);
  });

  it('reads airtime networks by `id`', async () => {
    stubFetch(200, { networks: [{ id: 'glo', name: 'GLO' }] });
    const provider = new PeyflexUtilityProvider(config);
    expect(await provider.listAirtimeNetworks()).toEqual([{ code: 'glo', name: 'GLO' }]);
  });

  it('carries the per-disco amount bounds through, so they can be enforced before payment', async () => {
    stubFetch(200, {
      plans: [
        { plan_code: 'kaduna', plan_name: 'Kaduna Electric', min_amount: 1100, max_amount: 100000 },
        { plan_code: 'kano', plan_name: 'Kano Electric', min_amount: 500, max_amount: 500000 },
      ],
    });
    const provider = new PeyflexUtilityProvider(config);
    const discos = await provider.listElectricityDiscos();
    expect(discos).toEqual([
      { code: 'kaduna', name: 'Kaduna Electric', minAmount: 1100, maxAmount: 100_000 },
      { code: 'kano', name: 'Kano Electric', minAmount: 500, maxAmount: 500_000 },
    ]);
  });

  it('sends `Token`, not `Bearer`, and keeps the trailing slash', async () => {
    const mock = stubFetch(200, { networks: [] });
    const provider = new PeyflexUtilityProvider(config);
    await provider.listAirtimeNetworks();
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://client.peyflex.example/api/airtime/networks/');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Token test-token');
  });

  it('refuses to call out at all when no token is configured', async () => {
    const mock = stubFetch(200, {});
    const unconfigured = {
      peyflexBaseUrl: config.peyflexBaseUrl,
      peyflexApiToken: '',
      peyflexConfigured: false,
    } as unknown as AppConfigService;
    const provider = new PeyflexUtilityProvider(unconfigured);
    await expect(provider.listAirtimeNetworks()).rejects.toThrow('Peyflex is not configured');
    expect(mock).not.toHaveBeenCalled();
  });
});
