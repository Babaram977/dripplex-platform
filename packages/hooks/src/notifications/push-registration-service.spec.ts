import { describe, expect, it, vi } from 'vitest';

import { registerDeviceWithRetry } from './push-registration-service';

import type { PushDevicesClient } from './push-types';

describe('registerDeviceWithRetry', () => {
  it('returns the registration on first success', async () => {
    const devicesClient: PushDevicesClient = {
      register: vi.fn().mockResolvedValue({ id: 'device-1' }),
      deactivate: vi.fn(),
    };

    const result = await registerDeviceWithRetry(devicesClient, { platform: 'WEB', token: 'tok' });

    expect(result).toEqual({ id: 'device-1' });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- assertion only, never invoked with `this`
    expect(devicesClient.register).toHaveBeenCalledTimes(1);
  });

  it('retries after a network failure and succeeds on a later attempt', async () => {
    const register = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ id: 'device-2' });
    const devicesClient: PushDevicesClient = { register, deactivate: vi.fn() };

    const result = await registerDeviceWithRetry(devicesClient, {
      platform: 'ANDROID',
      token: 'tok',
    });

    expect(result).toEqual({ id: 'device-2' });
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('returns null after exhausting all attempts', async () => {
    const register = vi.fn().mockRejectedValue(new Error('down'));
    const devicesClient: PushDevicesClient = { register, deactivate: vi.fn() };

    const result = await registerDeviceWithRetry(devicesClient, { platform: 'IOS', token: 'tok' });

    expect(result).toBeNull();
    expect(register).toHaveBeenCalledTimes(3);
  });
});
