import { describe, expect, it, vi } from 'vitest';

import { OperationsPromotionsClient } from './operations-promotions-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('OperationsPromotionsClient', () => {
  it('campaigns() gets the campaign list with auth', async () => {
    const { http, request } = createHttpMock();
    await new OperationsPromotionsClient(http).campaigns();
    expect(request).toHaveBeenCalledWith('/operations/promotions/campaigns', {
      method: 'GET',
      auth: true,
    });
  });

  it('campaign() gets one campaign by id', async () => {
    const { http, request } = createHttpMock();
    await new OperationsPromotionsClient(http).campaign('abc-123');
    expect(request).toHaveBeenCalledWith('/operations/promotions/campaigns/abc-123', {
      method: 'GET',
      auth: true,
    });
  });

  it('addPromoter() posts the reward the operator entered, unaltered', async () => {
    const { http, request } = createHttpMock();
    await new OperationsPromotionsClient(http).addPromoter('camp-1', {
      userId: 'user-1',
      participantType: 'PIONEER_DRIVER',
      rewardAmountNgn: 350,
    });
    expect(request).toHaveBeenCalledWith('/operations/promotions/campaigns/camp-1/promoters', {
      method: 'POST',
      auth: true,
      body: { userId: 'user-1', participantType: 'PIONEER_DRIVER', rewardAmountNgn: 350 },
    });
  });

  it('addPromoter() passes a points reward through as points, never as naira', async () => {
    const { http, request } = createHttpMock();
    await new OperationsPromotionsClient(http).addPromoter('camp-1', {
      userId: 'user-1',
      participantType: 'INFLUENCER',
      rewardPoints: 15_000,
    });
    const body = request.mock.calls[0]?.[1] as { body: Record<string, unknown> };
    expect(body.body).toEqual({
      userId: 'user-1',
      participantType: 'INFLUENCER',
      rewardPoints: 15_000,
    });
    // No naira field is invented from the points value. Converting 15,000
    // points to ₦150 here would be the client deciding what somebody earns.
    expect(body.body).not.toHaveProperty('rewardAmountNgn');
  });

  it('removePromoter() deletes by promoter id, not by campaign', async () => {
    const { http, request } = createHttpMock();
    await new OperationsPromotionsClient(http).removePromoter('promoter-9');
    expect(request).toHaveBeenCalledWith('/operations/promotions/promoters/promoter-9', {
      method: 'DELETE',
      auth: true,
    });
  });

  it('acquisitionIncentive() reads the single platform-wide incentive', async () => {
    const { http, request } = createHttpMock();
    await new OperationsPromotionsClient(http).acquisitionIncentive();
    expect(request).toHaveBeenCalledWith('/operations/promotions/acquisition-incentive', {
      method: 'GET',
      auth: true,
    });
  });

  it('exposes no way to create an acquisition incentive', () => {
    const surface = Object.getOwnPropertyNames(OperationsPromotionsClient.prototype);
    expect(surface).toEqual([
      'constructor',
      'campaigns',
      'campaign',
      'addPromoter',
      'removePromoter',
      'acquisitionIncentive',
    ]);
  });

  it('escapes ids so a crafted id cannot reach another path', async () => {
    const { http, request } = createHttpMock();
    await new OperationsPromotionsClient(http).campaign('../acquisition-incentive');
    expect(request).toHaveBeenCalledWith(
      '/operations/promotions/campaigns/..%2Facquisition-incentive',
      { method: 'GET', auth: true },
    );
  });
});
