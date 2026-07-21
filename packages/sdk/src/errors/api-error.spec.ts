import { describe, expect, it } from 'vitest';

import { DripplexApiError } from './api-error.js';

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
});
