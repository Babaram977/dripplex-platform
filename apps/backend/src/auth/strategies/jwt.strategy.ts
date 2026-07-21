import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UnauthorizedDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';

import type { AuthenticatedUser, JwtPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(appConfig: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.jwtAccessSecret,
    });
  }

  public validate(payload: JwtPayload): AuthenticatedUser {
    if (payload.typ !== 'access' || !payload.sub || !payload.email) {
      throw new UnauthorizedDomainException('Invalid access token payload');
    }

    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    };
  }
}
