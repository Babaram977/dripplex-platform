import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';

import type { AuthenticatedUser } from '../auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions === undefined || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenDomainException('Missing authenticated principal');
    }

    const hasAll = requiredPermissions.every((permission) => user.permissions.includes(permission));

    if (!hasAll) {
      throw new ForbiddenDomainException('Insufficient permissions', {
        requiredPermissions,
      });
    }

    return true;
  }
}
