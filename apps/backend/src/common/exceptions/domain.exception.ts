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

export class CartMerchantConflictDomainException extends DomainException {
  constructor(
    message = 'Cart already contains items from a different merchant',
    details?: unknown,
  ) {
    super('CART_MERCHANT_CONFLICT', message, 409, details);
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

export class AccountSuspendedDomainException extends DomainException {
  constructor(message = 'Account is suspended', details?: unknown) {
    super('ACCOUNT_SUSPENDED', message, 403, details);
  }
}

export class AccountBlockedDomainException extends DomainException {
  constructor(message = 'Account is blocked', details?: unknown) {
    super('ACCOUNT_BLOCKED', message, 403, details);
  }
}

export class EmailNotVerifiedDomainException extends DomainException {
  constructor(message = 'Email address is not verified', details?: unknown) {
    super('EMAIL_NOT_VERIFIED', message, 403, details);
  }
}

export class PhoneNotVerifiedDomainException extends DomainException {
  constructor(message = 'Phone number is not verified', details?: unknown) {
    super('PHONE_NOT_VERIFIED', message, 403, details);
  }
}

export class WrongPortalDomainException extends DomainException {
  constructor(message = 'Account is not permitted for this portal', details?: unknown) {
    super('WRONG_PORTAL', message, 403, details);
  }
}

export class LoginAttemptsExceededDomainException extends DomainException {
  public readonly retryAfterSeconds: number;

  constructor(
    message = 'Too many failed login attempts',
    retryAfterSeconds = 900,
    details?: unknown,
  ) {
    super('LOGIN_ATTEMPTS_EXCEEDED', message, 429, details);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
