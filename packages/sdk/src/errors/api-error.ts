import type { ApiErrorResponse, ApiResponse } from '@dripplex/types';

export class DripplexApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: unknown;
  public readonly path: string;
  public readonly correlationId?: string;

  public constructor(error: ApiErrorResponse) {
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
  }
}

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.success) {
    throw new DripplexApiError(payload);
  }

  return payload.data;
}
