import { describe, expect, it } from 'vitest';

import { isApiErrorResponse, isApiSuccessResponse } from './response.js';

describe('api response guards', () => {
  it('detects success responses', () => {
    expect(isApiSuccessResponse({ success: true, data: { ok: true } })).toBe(true);
  });

  it('detects error responses', () => {
    expect(
      isApiErrorResponse({
        success: false,
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid',
        path: '/api/v1/auth/login',
        timestamp: new Date().toISOString(),
      }),
    ).toBe(true);
  });
});
