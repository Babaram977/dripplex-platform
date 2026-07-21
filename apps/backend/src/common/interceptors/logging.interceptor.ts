import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';

import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            {
              method,
              url,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
            },
            'HTTP request completed',
          );
        },
        error: (error: unknown) => {
          this.logger.warn(
            {
              method,
              url,
              durationMs: Date.now() - startedAt,
              err: error,
            },
            'HTTP request failed',
          );
        },
      }),
    );
  }
}
