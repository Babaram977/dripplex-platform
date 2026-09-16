import { describe, expect, it, vi } from 'vitest';

import { OrderClient } from './order-client.js';

import type { HttpClient } from '../client/http-client.js';
import type { OrderRecoveryActivationStateDto } from '@dripplex/types';

/**
 * DPX-ORDER-8D-RECOVERY — the SDK contract for the activation-state read.
 *
 * The PATH is what is pinned, because the path is where this breaks silently.
 * `admin/order-recoveries/activation-state` is a literal segment on a controller
 * that also declares `@Get(':orderId')` with a ParseUUIDPipe. The backend proves
 * the ordering over real HTTP (AOR-014/015) and mutating that ordering reddens
 * those tests; this side pins that the SDK asks for that exact URL. A typo here
 * produces a 400 or 404 no backend test can see.
 */
function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OrderClient — recovery activation state', () => {
  it('OCR-001 · calls admin/order-recoveries/activation-state, authenticated', async () => {
    const { http, request } = createHttpMock();
    const state: OrderRecoveryActivationStateDto = { activated: false, activationAt: null };
    request.mockResolvedValueOnce(state);
    const client = new OrderClient(http);

    await expect(client.adminGetOrderRecoveryActivationState()).resolves.toBe(state);
    expect(request).toHaveBeenCalledWith('/admin/order-recoveries/activation-state', {
      method: 'GET',
      auth: true,
    });
  });

  it('OCR-002 · returns the backend state verbatim, armed or not', async () => {
    // No transformation, no inference, no defaulting. What the backend resolved
    // is what the operator sees — this is the answer to "can the platform move
    // money right now", and a helpfully-massaged version of it is worse than
    // none.
    const { http, request } = createHttpMock();
    const armed: OrderRecoveryActivationStateDto = {
      activated: true,
      activationAt: '2026-10-01T09:30:00.000Z',
    };
    request.mockResolvedValueOnce(armed);
    const client = new OrderClient(http);

    await expect(client.adminGetOrderRecoveryActivationState()).resolves.toEqual(armed);
  });

  it('OCR-003 · propagates a failure rather than reporting OFF', async () => {
    // A request that failed tells you nothing about whether recovery is armed.
    // Swallowing the error into a safe-looking default is the defect this whole
    // programme keeps finding: the reassuring answer, asserted without evidence.
    const { http, request } = createHttpMock();
    request.mockRejectedValueOnce(new Error('network down'));
    const client = new OrderClient(http);

    await expect(client.adminGetOrderRecoveryActivationState()).rejects.toThrow('network down');
  });

  it('OCR-004 · exposes no way to arm, disarm or run recovery', () => {
    // The boundary is a code constant changed by reviewed deployment, precisely
    // so no runtime surface can move a financial safety boundary. An SDK method
    // for an action that does not exist would invite a console to be built
    // against it.
    const client = new OrderClient(createHttpMock().http) as unknown as Record<string, unknown>;
    const names = new Set([
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(client)),
      ...Object.keys(client),
    ]);

    for (const forbidden of [/activate/i, /deactivate/i, /arm/i, /disarm/i, /runSweep/i]) {
      expect([...names].filter((name) => forbidden.test(name))).toEqual([]);
    }
  });
});
