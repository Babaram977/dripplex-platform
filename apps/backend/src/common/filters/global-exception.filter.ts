import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';

import {
  DomainException,
  RateLimitedDomainException,
  OtpAttemptsExceededDomainException,
} from '../exceptions/domain.exception';

import type { ApiErrorResponse } from '../dto/api-response.dto';
import type { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const { statusCode, errorCode, message, details } = this.mapException(exception);

    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      errorCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (details !== undefined) {
      body.details = details;
    }

    if (typeof request.id === 'string' && request.id.length > 0) {
      body.correlationId = request.id;
    }

    if (statusCode >= 500) {
      this.logger.error({ err: exception, path: request.url }, message);
    } else {
      this.logger.warn({ err: exception, path: request.url }, message);
    }

    if (
      exception instanceof RateLimitedDomainException ||
      exception instanceof OtpAttemptsExceededDomainException
    ) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }

    response.status(statusCode).json(body);
  }

  private mapException(exception: unknown): {
    statusCode: number;
    errorCode: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof DomainException) {
      return {
        statusCode: exception.statusCode,
        errorCode: exception.errorCode,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : this.extractHttpMessage(exceptionResponse);

      return {
        statusCode,
        errorCode: HttpStatus[statusCode] ?? 'HTTP_EXCEPTION',
        message,
        details: typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          errorCode: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with the same unique field already exists',
          details: exception.meta,
        };
      }
      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          errorCode: 'RECORD_NOT_FOUND',
          message: 'Record not found',
          details: exception.meta,
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
  }

  private extractHttpMessage(exceptionResponse: unknown): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const message: unknown = Reflect.get(exceptionResponse, 'message');
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.map(String).join(', ');
      }
    }
    return 'Request failed';
  }
}
