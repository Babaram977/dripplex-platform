export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  errorCode: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
  correlationId?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function isApiSuccessResponse<T>(value: ApiResponse<T>): value is ApiSuccessResponse<T> {
  return value.success;
}

export function isApiErrorResponse(value: ApiResponse<unknown>): value is ApiErrorResponse {
  return !value.success;
}
