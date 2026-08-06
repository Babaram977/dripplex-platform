import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/permissions.decorator';
import { AppConfigService } from '../../config/app-config.service';
import { GoogleExchangeDto } from '../dto/google-exchange.dto';
import { GoogleConfiguredGuard } from '../guards/google-configured.guard';
import { GoogleAuthService } from '../services/google-auth.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { GoogleProfileData } from '../auth-google.types';
import type { PortalLoginResponse } from '../auth-login.types';
import type { Request, Response } from 'express';

@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly appConfig: AppConfigService,
  ) {}

  /** Starts the flow: redirects the browser to Google's consent screen. */
  @Public()
  @Get()
  @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
  public startGoogleAuth(): void {
    // Handled entirely by passport-google-oauth20's redirect — no body.
  }

  /**
   * Google redirects the browser back here after consent. passport has
   * already run GoogleStrategy.validate() and attached the resulting
   * GoogleProfileData to req.user by the time this handler runs.
   */
  @Public()
  @Get('callback')
  @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
  public async googleCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const redirectBase = `${this.appConfig.customerAppUrl.replace(/\/$/, '')}/auth/google/callback`;

    try {
      const profile = request.user as GoogleProfileData;
      const code = await this.googleAuthService.completeSignIn(profile, this.auditContext(request));
      response.redirect(`${redirectBase}?code=${encodeURIComponent(code)}`);
    } catch {
      response.redirect(`${redirectBase}?error=google_sign_in_failed`);
    }
  }

  /**
   * Frontend exchanges the short-lived handoff code from the redirect for
   * the actual access/refresh token pair. Kept as a separate POST so real
   * JWTs are never placed in the browser-redirect URL (query strings end up
   * in browser history and referrer headers).
   */
  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async exchange(
    @Body() dto: GoogleExchangeDto,
  ): Promise<ApiSuccessResponse<PortalLoginResponse>> {
    const data = await this.googleAuthService.exchangeHandoffCode(dto.code);
    return { success: true, data };
  }

  private auditContext(request: Request): { ipAddress?: string; userAgent?: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;

    const userAgent = request.headers['user-agent'];
    return {
      ...(ipAddress ? { ipAddress } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
    };
  }
}
