import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/permissions.decorator';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

import type { AuthenticatedUser, AuthTokens, AuthUserProfile } from './auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async register(
    @Body() dto: RegisterDto,
  ): Promise<ApiSuccessResponse<{ user: AuthUserProfile; tokens: AuthTokens }>> {
    const result = await this.authService.register(dto);
    return { success: true, data: result };
  }

  /**
   * @deprecated Temporary Sprint 0.1 scaffold. Use portal-specific
   * `POST /auth/login/{customer|merchant|rider|driver}` instead.
   * Removed in S1-C4 when JWT issuance moves to the new session flow.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async login(
    @Body() dto: LoginDto,
  ): Promise<ApiSuccessResponse<{ user: AuthUserProfile; tokens: AuthTokens }>> {
    const result = await this.authService.login(dto);
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
  public async refresh(@Body() dto: RefreshTokenDto): Promise<ApiSuccessResponse<AuthTokens>> {
    const tokens = await this.authService.refresh(dto);
    return { success: true, data: tokens };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  public async logout(
    @Body() dto: RefreshTokenDto,
  ): Promise<ApiSuccessResponse<{ loggedOut: true }>> {
    await this.authService.logout(dto.refreshToken);
    return { success: true, data: { loggedOut: true } };
  }

  @Get('me')
  public async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<AuthUserProfile>> {
    const profile = await this.authService.getProfile(user.id);
    return { success: true, data: profile };
  }
}
