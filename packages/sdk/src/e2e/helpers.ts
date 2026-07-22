import { afterEach, beforeEach, vi } from 'vitest';

export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonErr(
  statusCode: number,
  message: string,
  errorCode = 'ERROR',
  path = '/api/v1',
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      statusCode,
      errorCode,
      message,
      path,
      timestamp: new Date().toISOString(),
    }),
    { status: statusCode, headers: { 'Content-Type': 'application/json' } },
  );
}

export function installFetchMock(): {
  fetchMock: ReturnType<typeof vi.fn>;
  calls: () => { url: string; method: string; body?: unknown; auth?: string }[];
} {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    calls: () =>
      fetchMock.mock.calls.map((call) => {
        const url = String(call[0]);
        const init = (call[1] ?? {}) as RequestInit;
        const headers = init.headers as Record<string, string> | undefined;
        let body: unknown;
        if (typeof init.body === 'string') {
          try {
            body = JSON.parse(init.body) as unknown;
          } catch {
            body = init.body;
          }
        }
        return {
          url,
          method: init.method ?? 'GET',
          ...(body !== undefined ? { body } : {}),
          ...(headers?.['Authorization'] ? { auth: headers['Authorization'] } : {}),
        };
      }),
  };
}

export function pathsOf(
  calls: { url: string; method: string }[],
): { method: string; path: string }[] {
  return calls.map((c) => {
    const u = new URL(c.url);
    return { method: c.method, path: u.pathname.replace(/^\/api\/v1/, '') || u.pathname };
  });
}

export function setupE2e(): void {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

export const sampleUser = {
  id: 'user-1',
  email: 'customer@example.com',
  phone: '+2348012345678',
  firstName: 'Ada',
  lastName: 'Okafor',
  status: 'ACTIVE' as const,
  roles: ['CUSTOMER'],
  permissions: ['order:read', 'wallet:read'],
};

export const sampleTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer' as const,
  expiresIn: '15m',
};
