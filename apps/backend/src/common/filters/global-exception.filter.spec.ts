import { type ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  UtilityProviderRejectedError,
  isProviderRejection,
} from '../../utilities/providers/utility-provider.port';
import { DomainException } from '../exceptions/domain.exception';

import { GlobalExceptionFilter } from './global-exception.filter';

import type { Response } from 'express';
import type { Logger } from 'nestjs-pino';

describe('GlobalExceptionFilter', () => {
  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
  } as unknown as Logger;

  const createHost = (statusSpy: jest.Mock, jsonSpy: jest.Mock): ArgumentsHost => {
    const response = {
      status: statusSpy.mockReturnValue({ json: jsonSpy }),
    } as unknown as Response;

    return {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url: '/api/v1/test', id: 'corr-1' }),
      }),
    } as ArgumentsHost;
  };

  it('maps DomainException to the standard error envelope', () => {
    const filter = new GlobalExceptionFilter(logger);
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const host = createHost(statusSpy, jsonSpy);

    filter.catch(new DomainException('CUSTOM', 'Boom', 400, { field: 'email' }), host);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        errorCode: 'CUSTOM',
        message: 'Boom',
        correlationId: 'corr-1',
        path: '/api/v1/test',
      }),
    );
  });

  it('sends publicMessage over the wire and keeps the diagnostic in the log', () => {
    const filter = new GlobalExceptionFilter(logger);
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const host = createHost(statusSpy, jsonSpy);

    const detail = 'Peyflex request failed (404): {"error":"Network not found or not active"}';
    filter.catch(
      new DomainException('UPSTREAM_PROVIDER_ERROR', detail, 502, undefined, 'Try again shortly.'),
      host,
    );

    expect(statusSpy).toHaveBeenCalledWith(502);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 502, message: 'Try again shortly.' }),
    );
    // The provider's own wording must not reach the customer.
    expect(JSON.stringify(jsonSpy.mock.calls[0])).not.toContain('Peyflex');
  });

  it('maps a UtilityProviderRejectedError to 502, not the catch-all 500', () => {
    const filter = new GlobalExceptionFilter(logger);
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const host = createHost(statusSpy, jsonSpy);

    // The exact shape that reached a customer as "An unexpected error
    // occurred" when a stale provider code was sent to the data-plans read.
    const err = new UtilityProviderRejectedError(
      'Peyflex request failed (404): {"error":"Network not found or not active"}',
    );
    filter.catch(err, host);

    expect(statusSpy).toHaveBeenCalledWith(502);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 502,
        errorCode: 'UPSTREAM_PROVIDER_ERROR',
        message: 'That service is temporarily unavailable. Please try again shortly.',
      }),
    );
    // Still a provider rejection, so the purchase path's refund logic — which
    // keys off this discriminator — is untouched.
    expect(err.neverExecuted).toBe(true);
    expect(isProviderRejection(err)).toBe(true);
  });

  it('maps HttpException messages', () => {
    const filter = new GlobalExceptionFilter(logger);
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const host = createHost(statusSpy, jsonSpy);

    filter.catch(new HttpException('Nope', HttpStatus.BAD_REQUEST), host);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Nope',
        errorCode: 'BAD_REQUEST',
      }),
    );
  });

  it('maps Prisma unique constraint errors to 409', () => {
    const filter = new GlobalExceptionFilter(logger);
    const statusSpy = jest.fn();
    const jsonSpy = jest.fn();
    const host = createHost(statusSpy, jsonSpy);

    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });

    filter.catch(prismaError, host);

    expect(statusSpy).toHaveBeenCalledWith(409);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'UNIQUE_CONSTRAINT_VIOLATION',
      }),
    );
  });
});
