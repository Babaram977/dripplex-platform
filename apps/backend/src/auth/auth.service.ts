import { createHash, randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Logger } from 'nestjs-pino';

import {
  ConflictDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';

import type { AuthTokens, AuthUserProfile } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import type { RegisterDto } from './dto/register.dto';

/** Sprint 0.1 scaffold payload — incompatible with S1-C4 session-bound JWT guard */
interface ScaffoldJwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  typ: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
    private readonly logger: Logger,
  ) {}

  public async register(dto: RegisterDto): Promise<{ user: AuthUserProfile; tokens: AuthTokens }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictDomainException('Email is already registered');
    }

    if (dto.phone) {
      const phoneOwner = await this.usersService.findByPhone(dto.phone);
      if (phoneOwner) {
        throw new ConflictDomainException('Phone number is already registered');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, this.appConfig.bcryptSaltRounds);
    const user = await this.usersService.createUser({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      status: UserStatus.PENDING_VERIFICATION,
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
    });

    const profile = await this.toProfile(user.id);
    const tokens = await this.issueTokens(profile);

    return { user: profile, tokens };
  }

  public async login(dto: LoginDto): Promise<{ user: AuthUserProfile; tokens: AuthTokens }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.deletedAt) {
      throw new UnauthorizedDomainException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedDomainException('Invalid email or password');
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      throw new ForbiddenDomainException('Account is not permitted to sign in', {
        status: user.status,
      });
    }

    await this.usersService.markLogin(user.id);
    const profile = await this.toProfile(user.id);
    const tokens = await this.issueTokens(profile);
    return { user: profile, tokens };
  }

  public async requestOtp(dto: RequestOtpDto): Promise<{ expiresInSeconds: number }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.deletedAt) {
      // Anti-enumeration: identical response shape
      return { expiresInSeconds: this.appConfig.otpTtlSeconds };
    }

    const otp = this.generateOtp(this.appConfig.otpLength);
    const otpHash = this.hashOtp(otp);
    const key = this.otpKey(dto.email);

    await this.redis.set(key, otpHash, this.appConfig.otpTtlSeconds);

    // Production integrations (SMS/email) will consume this event; log only in non-production.
    if (!this.appConfig.isProduction) {
      this.logger.debug({ email: dto.email, otp }, 'OTP generated for development');
    } else {
      this.logger.log({ email: dto.email }, 'OTP generated');
    }

    return { expiresInSeconds: this.appConfig.otpTtlSeconds };
  }

  public async verifyOtp(
    dto: VerifyOtpDto,
  ): Promise<{ user: AuthUserProfile; tokens: AuthTokens }> {
    const key = this.otpKey(dto.email);
    const storedHash = await this.redis.get(key);
    if (!storedHash) {
      throw new ValidationDomainException('OTP expired or not requested');
    }

    const providedHash = this.hashOtp(dto.otp);
    if (providedHash !== storedHash) {
      throw new UnauthorizedDomainException('Invalid OTP');
    }

    await this.redis.del(key);

    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.deletedAt) {
      throw new NotFoundDomainException('User not found');
    }

    await this.usersService.markEmailVerified(user.id);
    await this.usersService.activateIfVerificationsComplete(user.id, false);
    await this.usersService.markLogin(user.id);

    const profile = await this.toProfile(user.id);
    const tokens = await this.issueScaffoldTokens(profile);
    return { user: profile, tokens };
  }

  public async getProfile(userId: string): Promise<AuthUserProfile> {
    return await this.toProfile(userId);
  }

  /** Sprint 0.1 tokens without session binding */
  private async issueScaffoldTokens(profile: AuthUserProfile): Promise<AuthTokens> {
    const baseClaims = {
      sub: profile.id,
      email: profile.email,
      roles: profile.roles,
      permissions: profile.permissions,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...baseClaims, typ: 'access' } satisfies ScaffoldJwtPayload, {
        secret: this.appConfig.jwtAccessSecret,
        expiresIn: this.parseDurationToSeconds(this.appConfig.jwtAccessTtl),
      }),
      this.jwtService.signAsync({ ...baseClaims, typ: 'refresh' } satisfies ScaffoldJwtPayload, {
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

  private issueTokens(profile: AuthUserProfile): Promise<AuthTokens> {
    return this.issueScaffoldTokens(profile);
  }

  private async toProfile(userId: string): Promise<AuthUserProfile> {
    const user = await this.usersService.findByIdWithRbac(userId);
    if (!user || user.deletedAt) {
      throw new NotFoundDomainException('User not found');
    }

    const roles = user.roles.map((assignment) => assignment.role.name);
    const permissions = [
      ...new Set(
        user.roles.flatMap((assignment) =>
          assignment.role.permissions.map((grant) => grant.permission.code),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles,
      permissions,
    };
  }

  private generateOtp(length: number): string {
    const max = 10 ** length;
    const value = randomInt(0, max);
    return value.toString().padStart(length, '0');
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private otpKey(email: string): string {
    return `auth:otp:${email.toLowerCase()}`;
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
