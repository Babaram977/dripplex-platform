import type { ApiErrorResponse, ApiResponse } from '@dripplex/types';

export class DripplexApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: unknown;
  public readonly path: string;
  public readonly correlationId?: string;
  /** Seconds to wait before retrying (from Retry-After), when present. */
  public readonly retryAfterSeconds?: number;

  public constructor(error: ApiErrorResponse, options: { retryAfterSeconds?: number } = {}) {
    super(error.message);
    this.name = 'DripplexApiError';
    this.statusCode = error.statusCode;
    this.errorCode = error.errorCode;
    this.path = error.path;
    if (error.details !== undefined) {
      this.details = error.details;
    }
    if (error.correlationId !== undefined) {
      this.correlationId = error.correlationId;
    }
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export function parseRetryAfterSeconds(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }
  const asInt = Number.parseInt(headerValue, 10);
  if (Number.isFinite(asInt) && asInt >= 0) {
    return asInt;
  }
  const asDate = Date.parse(headerValue);
  if (Number.isFinite(asDate)) {
    const seconds = Math.ceil((asDate - Date.now()) / 1000);
    return seconds > 0 ? seconds : 0;
  }
  return undefined;
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.success) {
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'));
    throw new DripplexApiError(
      payload,
      retryAfterSeconds === undefined ? {} : { retryAfterSeconds },
    );
  }

  return payload.data;
}
