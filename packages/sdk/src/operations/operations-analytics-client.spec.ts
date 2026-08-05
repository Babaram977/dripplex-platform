import { describe, expect, it, vi } from 'vitest';

import { OperationsAnalyticsClient } from './operations-analytics-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

const RANGE = { from: '2026-08-01T00:00:00.000Z', to: '2026-08-05T00:00:00.000Z' };

describe('OperationsAnalyticsClient', () => {
  it('getOverview() gets /operations/analytics/overview with the range and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsAnalyticsClient(http);

    await client.getOverview(RANGE);

    expect(request).toHaveBeenCalledWith(
      `/operations/analytics/overview?from=${encodeURIComponent(RANGE.from)}&to=${encodeURIComponent(RANGE.to)}`,
      { method: 'GET', auth: true },
    );
  });

  it('getDriverUtilization() gets /operations/analytics/driver-utilization', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsAnalyticsClient(http);

    await client.getDriverUtilization(RANGE);

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/operations/analytics/driver-utilization?'),
      { method: 'GET', auth: true },
    );
  });

  it('getShiftAnalytics() gets /operations/analytics/shifts', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsAnalyticsClient(http);

    await client.getShiftAnalytics(RANGE);

    expect(request).toHaveBeenCalledWith(expect.stringContaining('/operations/analytics/shifts?'), {
      method: 'GET',
      auth: true,
    });
  });

  it('getRideOperations() gets /operations/analytics/rides', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsAnalyticsClient(http);

    await client.getRideOperations(RANGE);

    expect(request).toHaveBeenCalledWith(expect.stringContaining('/operations/analytics/rides?'), {
      method: 'GET',
      auth: true,
    });
  });

  it('getDispatchPerformance() gets /operations/analytics/dispatch', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsAnalyticsClient(http);

    await client.getDispatchPerformance(RANGE);

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/operations/analytics/dispatch?'),
      {
        method: 'GET',
        auth: true,
      },
    );
  });

  it('getOperationsResponse() gets /operations/analytics/response', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsAnalyticsClient(http);

    await client.getOperationsResponse(RANGE);

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/operations/analytics/response?'),
      {
        method: 'GET',
        auth: true,
      },
    );
  });

  it('getGeographicDemand() gets /operations/analytics/geography, including cellSizeDegrees when given', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsAnalyticsClient(http);

    await client.getGeographicDemand({ ...RANGE, cellSizeDegrees: 0.05 });

    const [url] = request.mock.calls[0] as [string, unknown];
    expect(url).toContain('/operations/analytics/geography?');
    expect(url).toContain('cellSizeDegrees=0.05');
  });

  it('getGeographicDemand() omits cellSizeDegrees when not given', async () => {
    const { http, request } = createHttpMock();
    const client = new OperationsAnalyticsClient(http);

    await client.getGeographicDemand(RANGE);

    const [url] = request.mock.calls[0] as [string, unknown];
    expect(url).not.toContain('cellSizeDegrees');
  });
});
