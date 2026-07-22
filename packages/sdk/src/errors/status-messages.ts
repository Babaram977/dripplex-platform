import { DripplexApiError } from './api-error.js';
import { DripplexNetworkError } from './network-error.js';

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session has expired or credentials are invalid. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This action conflicts with the current state. Refresh and try again.',
  422: 'Some of the information provided is invalid. Check the form and retry.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again shortly.',
};

export function messageForHttpStatus(statusCode: number, fallback?: string): string {
  return STATUS_MESSAGES[statusCode] ?? fallback ?? 'Request failed. Please try again.';
}

export function describeSdkError(error: unknown): {
  title: string;
  description: string;
  statusCode?: number;
  retryable: boolean;
  retryAfterSeconds?: number;
} {
  if (error instanceof DripplexNetworkError) {
    const result: {
      title: string;
      description: string;
      statusCode?: number;
      retryable: boolean;
      retryAfterSeconds?: number;
    } = {
      title: error.code === 'TIMEOUT' ? 'Request timed out' : 'Connection problem',
      description: error.message,
      retryable: true,
    };
    if (error.statusCode > 0) {
      result.statusCode = error.statusCode;
    }
    return result;
  }

  if (error instanceof DripplexApiError) {
    const retryable = error.statusCode >= 500 || error.statusCode === 429;
    let description = error.message || messageForHttpStatus(error.statusCode);
    if (error.statusCode === 429 && error.retryAfterSeconds !== undefined) {
      description = `${description} Retry after ${String(error.retryAfterSeconds)}s.`;
    }
    const result: {
      title: string;
      description: string;
      statusCode?: number;
      retryable: boolean;
      retryAfterSeconds?: number;
    } = {
      title: `Error ${String(error.statusCode)}`,
      description,
      statusCode: error.statusCode,
      retryable,
    };
    if (error.retryAfterSeconds !== undefined) {
      result.retryAfterSeconds = error.retryAfterSeconds;
    }
    return result;
  }

  if (error instanceof Error) {
    return {
      title: 'Unexpected error',
      description: error.message || 'Something went wrong.',
      retryable: true,
    };
  }

  return {
    title: 'Unexpected error',
    description: 'Something went wrong.',
    retryable: false,
  };
}
