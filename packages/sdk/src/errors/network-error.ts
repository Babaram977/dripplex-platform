export type NetworkErrorCode = 'OFFLINE' | 'TIMEOUT' | 'NETWORK';

export class DripplexNetworkError extends Error {
  public readonly code: NetworkErrorCode;
  public readonly statusCode: number;

  public constructor(code: NetworkErrorCode, message: string) {
    super(message);
    this.name = 'DripplexNetworkError';
    this.code = code;
    this.statusCode = code === 'TIMEOUT' ? 408 : 0;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}
