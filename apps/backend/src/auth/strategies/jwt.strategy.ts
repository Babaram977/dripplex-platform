import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UnauthorizedDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../../users/users.service';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';
import { portalToRegistrationChannel } from '../utils/portal.util';

import type { AuthenticatedUser, JwtPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    appConfig: AppConfigService,
    private readonly usersService: UsersService,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.jwtAccessSecret,
    });
  }

  public async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (
      payload.typ !== 'access' ||
      !payload.sub ||
      !payload.sid ||
      !payload.role ||
      !payload.portal
    ) {
      throw new UnauthorizedDomainException('Invalid access token payload');
    }

    const session = await this.authSessionRepository.findById(payload.sid);
    if (session?.userId !== payload.sub) {
      throw new UnauthorizedDomainException('Session not found');
    }

    if (session.revokedAt) {
      throw new UnauthorizedDomainException('Session has been revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedDomainException('Session has expired');
    }

    const expectedPortal = portalToRegistrationChannel(payload.portal);
    if (!expectedPortal || session.portal !== expectedPortal) {
      throw new UnauthorizedDomainException('Portal mismatch');
    }

    const user = await this.usersService.findByIdWithRbac(payload.sub);
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedDomainException('User is not active');
    }

    const roles = user.roles.map((assignment) => assignment.role.name);
    if (!roles.includes(payload.role)) {
      throw new UnauthorizedDomainException('Role mismatch');
    }

    const permissions = [
      ...new Set(
        user.roles.flatMap((assignment) =>
          assignment.role.permissions.map((grant) => grant.permission.code),
        ),
      ),
    ];

    await this.authSessionRepository.updateLastActiveAt(payload.sid);

    return {
      id: payload.sub,
      sid: payload.sid,
      email: user.email,
      role: payload.role,
      portal: payload.portal,
      roles,
      permissions,
    };
  }
}
