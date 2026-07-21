import { createHash, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AppConfigService } from '../../config/app-config.service';
import { registrationChannelToPortal } from '../utils/portal.util';

import type { AuthTokens, JwtPayload } from '../auth.types';
import type { RegistrationChannel } from '@prisma/client';

export interface IssueTokenPairInput {
  userId: string;
  sessionId: string;
  role: string;
  portal: RegistrationChannel;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
  ) {}

  public hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  public refreshTokenHashesMatch(storedHash: string, presentedToken: string): boolean {
    const presentedHash = this.hashRefreshToken(presentedToken);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const presentedBuffer = Buffer.from(presentedHash, 'hex');

    if (storedBuffer.length !== presentedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, presentedBuffer);
  }

  public async issueTokenPair(input: IssueTokenPairInput): Promise<AuthTokens> {
    const portal = registrationChannelToPortal(input.portal);
    const baseClaims = {
      sub: input.userId,
      sid: input.sessionId,
      role: input.role,
      portal,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...baseClaims, typ: 'access' } satisfies JwtPayload, {
        secret: this.appConfig.jwtAccessSecret,
        expiresIn: this.parseDurationToSeconds(this.appConfig.jwtAccessTtl),
      }),
      this.jwtService.signAsync({ ...baseClaims, typ: 'refresh' } satisfies JwtPayload, {
        secret: this.appConfig.jwtRefreshSecret,
        expiresIn: this.parseDurationToSeconds(this.appConfig.jwtRefreshTtl),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.appConfig.jwtAccessTtl,
    };
  }

  public async verifyAccessToken(token: string): Promise<JwtPayload> {
    return await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.appConfig.jwtAccessSecret,
    });
  }

  public async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.appConfig.jwtRefreshSecret,
    });
  }

  private parseDurationToSeconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return 7 * 24 * 60 * 60;
    }
    const amount = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's':
        return amount;
      case 'm':
        return amount * 60;
      case 'h':
        return amount * 60 * 60;
      case 'd':
        return amount * 24 * 60 * 60;
      default:
        return amount;
    }
  }
}
