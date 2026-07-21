import { type ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
