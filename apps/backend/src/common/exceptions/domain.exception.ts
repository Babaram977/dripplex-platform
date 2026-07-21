export class DomainException extends Error {
  constructor(
    public readonly errorCode: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedDomainException extends DomainException {
  constructor(message = 'Unauthorized', details?: unknown) {
    super('UNAUTHORIZED', message, 401, details);
  }
}

export class ForbiddenDomainException extends DomainException {
  constructor(message = 'Forbidden', details?: unknown) {
    super('FORBIDDEN', message, 403, details);
  }
}

export class NotFoundDomainException extends DomainException {
  constructor(message = 'Resource not found', details?: unknown) {
    super('NOT_FOUND', message, 404, details);
  }
}

export class ConflictDomainException extends DomainException {
  constructor(message = 'Conflict', details?: unknown) {
    super('CONFLICT', message, 409, details);
  }
}

export class ValidationDomainException extends DomainException {
  constructor(message = 'Validation failed', details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}

export class OtpInvalidDomainException extends DomainException {
  constructor(message = 'Invalid OTP', details?: unknown) {
    super('OTP_INVALID', message, 401, details);
  }
}

export class OtpExpiredDomainException extends DomainException {
  constructor(message = 'OTP expired or not requested', details?: unknown) {
    super('OTP_EXPIRED', message, 401, details);
  }
}

export class RateLimitedDomainException extends DomainException {
  public readonly retryAfterSeconds: number;

  constructor(message = 'Too many requests', retryAfterSeconds = 60, details?: unknown) {
    super('RATE_LIMITED', message, 429, details);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OtpAttemptsExceededDomainException extends DomainException {
  public readonly retryAfterSeconds: number;

  constructor(
    message = 'OTP verification attempts exceeded',
    retryAfterSeconds = 900,
    details?: unknown,
  ) {
    super('OTP_ATTEMPTS_EXCEEDED', message, 429, details);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
