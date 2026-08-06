import { TermiiSmsSender } from './termii-sms.sender';

import type { AppConfigService } from '../../config/app-config.service';

describe('TermiiSmsSender', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function configured(overrides: Partial<AppConfigService> = {}): AppConfigService {
    return {
      termiiConfigured: true,
      termiiApiKey: 'test-key',
      termiiSenderId: 'DrippleX',
      termiiBaseUrl: 'https://api.ng.termii.com',
      ...overrides,
    } as unknown as AppConfigService;
  }

  it('returns not-configured without calling fetch when Termii is unconfigured', async () => {
    global.fetch = jest.fn();
    const sender = new TermiiSmsSender({ termiiConfigured: false } as unknown as AppConfigService);

    const result = await sender.send('+2348012345678', 'hello');

    expect(result).toEqual({ success: false, errorMessage: 'Termii is not configured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends an SMS and strips the leading + from the phone number', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message_id: 'msg-1', message: 'Successfully Sent' }),
    });

    const sender = new TermiiSmsSender(configured());
    const result = await sender.send('+2348012345678', 'Your code is 123456');

    expect(result).toEqual({ success: true, providerMessageId: 'msg-1' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.ng.termii.com/api/sms/send',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"to":"2348012345678"'),
      }),
    );
  });

  it('reports failure without throwing on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid API key' }),
    });

    const sender = new TermiiSmsSender(configured());
    const result = await sender.send('+2348012345678', 'hello');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Invalid API key');
  });

  it('reports failure without throwing when fetch itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const sender = new TermiiSmsSender(configured());
    const result = await sender.send('+2348012345678', 'hello');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('network down');
  });
});
