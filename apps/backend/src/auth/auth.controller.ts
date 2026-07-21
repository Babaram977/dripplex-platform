import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/permissions.decorator';

import { AuthService } from './auth.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutService } from './services/logout.service';
import { RefreshService } from './services/refresh.service';

import type { AuthenticatedUser, AuthTokens, AuthUserProfile } from './auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshService: RefreshService,
    private readonly logoutService: LogoutService,
  ) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async register(
    @Body() dto: RegisterDto,
  ): Promise<ApiSuccessResponse<{ user: AuthUserProfile; tokens: AuthTokens }>> {
    const result = await this.authService.register(dto);
    return { success: true, data: result };
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  public async requestOtp(
    @Body() dto: RequestOtpDto,
  ): Promise<ApiSuccessResponse<{ expiresInSeconds: number }>> {
    const result = await this.authService.requestOtp(dto);
    return { success: true, data: result };
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<ApiSuccessResponse<{ user: AuthUserProfile; tokens: AuthTokens }>> {
    const result = await this.authService.verifyOtp(dto);
    return { success: true, data: result };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthTokens>> {
    const tokens = await this.refreshService.refresh(dto.refreshToken, this.auditContext(request));
    return { success: true, data: tokens };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  public async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ loggedOut: true }>> {
    await this.logoutService.logout(user.sid, user.id, this.auditContext(request, user.id));
    return { success: true, data: { loggedOut: true } };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  public async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ loggedOut: true }>> {
    await this.logoutService.logoutAll(user.id, this.auditContext(request, user.id));
    return { success: true, data: { loggedOut: true } };
  }

  @Get('me')
  public async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<AuthUserProfile>> {
    const profile = await this.authService.getProfile(user.id);
    return { success: true, data: profile };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { ipAddress?: string; userAgent?: string; userId?: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;
    const userAgent = request.headers['user-agent'];

    return {
      ...(ipAddress ? { ipAddress } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
      ...(userId !== undefined ? { userId } : {}),
    };
  }
}
