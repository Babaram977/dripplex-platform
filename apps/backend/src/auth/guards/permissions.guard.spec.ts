import { type ExecutionContext } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';

import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';

import { PermissionsGuard } from './permissions.guard';

import type { AuthenticatedUser } from '../auth.types';

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new PermissionsGuard(reflector);

  const createContext = (user?: AuthenticatedUser): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('allows when no permissions are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows when the user has all required permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['users:read']);
    expect(
      guard.canActivate(
        createContext({
          id: '1',
          sid: 'session-1',
          email: 'a@b.c',
          role: 'admin',
          portal: 'customer',
          roles: ['admin'],
          permissions: ['users:read', 'users:delete'],
        }),
      ),
    ).toBe(true);
  });

  it('denies when a required permission is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['users:delete']);
    expect(() =>
      guard.canActivate(
        createContext({
          id: '1',
          sid: 'session-1',
          email: 'a@b.c',
          role: 'customer',
          portal: 'customer',
          roles: ['customer'],
          permissions: ['users:read'],
        }),
      ),
    ).toThrow(ForbiddenDomainException);
  });
});
