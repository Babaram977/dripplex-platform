import { describe, expect, it } from 'vitest';

import { DripplexApiError, parseApiResponse, parseRetryAfterSeconds } from './api-error.js';
import { describeSdkError } from './status-messages.js';

describe('DripplexApiError', () => {
  it('maps API error payloads', () => {
    const error = new DripplexApiError({
      success: false,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      message: 'Invalid credentials',
      path: '/api/v1/auth/login',
      timestamp: new Date().toISOString(),
    });

    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Invalid credentials');
  });

  it('parses Retry-After integer and date forms', () => {
    expect(parseRetryAfterSeconds('12')).toBe(12);
    expect(parseRetryAfterSeconds(null)).toBeUndefined();
  });

  it('attaches retryAfterSeconds from response headers on API errors', async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        statusCode: 429,
        errorCode: 'RATE_LIMITED',
        message: 'Too many requests',
        path: '/api/v1/auth/login',
        timestamp: new Date().toISOString(),
      }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '7' } },
    );

    await expect(parseApiResponse(response)).rejects.toMatchObject({
      statusCode: 429,
      retryAfterSeconds: 7,
    });
  });

  it('surfaces retry after seconds in describeSdkError', () => {
    const error = new DripplexApiError(
      {
        success: false,
        statusCode: 429,
        errorCode: 'RATE_LIMITED',
        message: 'Too many requests',
        path: '/api/v1/x',
        timestamp: new Date().toISOString(),
      },
      { retryAfterSeconds: 9 },
    );
    const described = describeSdkError(error);
    expect(described.retryable).toBe(true);
    expect(described.retryAfterSeconds).toBe(9);
    expect(described.description).toContain('9s');
  });
});
