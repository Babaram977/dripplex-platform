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
