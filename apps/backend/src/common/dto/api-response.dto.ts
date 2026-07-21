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
