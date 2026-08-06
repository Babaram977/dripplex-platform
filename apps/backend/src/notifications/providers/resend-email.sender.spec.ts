import { ResendEmailSender } from './resend-email.sender';

import type { AppConfigService } from '../../config/app-config.service';

describe('ResendEmailSender', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function configured(overrides: Partial<AppConfigService> = {}): AppConfigService {
    return {
      resendConfigured: true,
      resendApiKey: 'test-key',
      resendFromEmail: 'DrippleX <no-reply@dripplex.com>',
      ...overrides,
    } as unknown as AppConfigService;
  }

  it('returns not-configured without calling fetch when Resend is unconfigured', async () => {
    global.fetch = jest.fn();
    const sender = new ResendEmailSender({
      resendConfigured: false,
    } as unknown as AppConfigService);

    const result = await sender.send('a@b.com', 'Subject', '<p>Body</p>');

    expect(result).toEqual({ success: false, errorMessage: 'Resend is not configured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends an email with the configured from address', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email-1' }),
    });

    const sender = new ResendEmailSender(configured());
    const result = await sender.send('a@b.com', 'Reset your password', '<p>code</p>');

    expect(result).toEqual({ success: true, providerMessageId: 'email-1' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('reports failure without throwing on a non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ message: 'Invalid from address' }),
    });

    const sender = new ResendEmailSender(configured());
    const result = await sender.send('a@b.com', 'Subject', '<p>Body</p>');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('Invalid from address');
  });

  it('reports failure without throwing when fetch itself rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const sender = new ResendEmailSender(configured());
    const result = await sender.send('a@b.com', 'Subject', '<p>Body</p>');

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe('network down');
  });
});
