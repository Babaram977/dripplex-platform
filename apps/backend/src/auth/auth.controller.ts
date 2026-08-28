import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/permissions.decorator';
import { AccountDeletionService } from '../users/account-deletion.service';

import { AuthService } from './auth.service';
import { ConfirmEmailChangeDto, RequestEmailChangeDto } from './dto/change-email.dto';
import { ConfirmPhoneChangeDto, RequestPhoneChangeDto } from './dto/change-phone.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LogoutService } from './services/logout.service';
import { ProfileService } from './services/profile.service';
import { RefreshService } from './services/refresh.service';

import type { AuthenticatedUser, AuthTokens, AuthUserProfile } from './auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { AccountCommitments } from '../users/account-deletion.service';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshService: RefreshService,
    private readonly logoutService: LogoutService,
    private readonly profileService: ProfileService,
    private readonly accountDeletion: AccountDeletionService,
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

  @Patch('me')
  public async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthUserProfile>> {
    const profile = await this.profileService.updateProfile(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data: profile };
  }

  /**
   * What is still open on my own account.
   *
   * Same numbers the Operations Console reads, shown to the person themselves
   * so the delete screen can say what is holding it up instead of failing on
   * confirmation.
   */
  @Get('me/commitments')
  public async myCommitments(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<AccountCommitments>> {
    return { success: true, data: await this.accountDeletion.commitmentsFor(user.id) };
  }

  /**
   * Close my own account.
   *
   * The app has had a Delete Account flow since it was designed. It was a
   * mock: three steps, a typed DELETE, and `setDeleteStep('done')` — no
   * request, nothing deleted. It then told the customer their request had been
   * received and they had 30 days to cancel it, which described a system that
   * does not exist. Somebody who wanted to leave was told they had.
   *
   * Same service as the operator path, so the same protections apply: it
   * refuses while a trip is in progress or money is owed, releases the email
   * and phone so the person can sign up again, and leaves an audit record.
   * `kind: 'self'` supplies the reason and skips the guard that stops an
   * operator deleting themselves from the roster — which is the intended
   * action here rather than the accident it is there.
   */
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  public async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ deleted: true }>> {
    await this.accountDeletion.deleteAccount(
      user.id,
      { kind: 'self' },
      this.auditContext(request, user.id),
    );
    return { success: true, data: { deleted: true } };
  }

  @Post('me/phone/change')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  public async requestPhoneChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestPhoneChangeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ expiresInSeconds: number }>> {
    const result = await this.profileService.requestPhoneChange(
      user.id,
      dto.newPhone,
      this.auditContext(request, user.id),
    );
    return { success: true, data: result };
  }

  @Post('me/phone/change/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async confirmPhoneChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmPhoneChangeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthUserProfile>> {
    const profile = await this.profileService.confirmPhoneChange(
      user.id,
      dto.otp,
      this.auditContext(request, user.id),
    );
    return { success: true, data: profile };
  }

  @Post('me/email/change')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  public async requestEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestEmailChangeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ expiresInSeconds: number }>> {
    const result = await this.profileService.requestEmailChange(
      user.id,
      dto.newEmail,
      this.auditContext(request, user.id),
    );
    return { success: true, data: result };
  }

  @Post('me/email/change/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async confirmEmailChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmEmailChangeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<AuthUserProfile>> {
    const profile = await this.profileService.confirmEmailChange(
      user.id,
      dto.otp,
      this.auditContext(request, user.id),
    );
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
