import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/permissions.decorator';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from '../dto/password.dto';
import { PasswordService } from '../services/password.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { AuthenticatedUser } from '../auth.types';
import type { Request } from 'express';

@Controller('auth/password')
export class PasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  @Public()
  @Post('forgot')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  public async forgot(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ submitted: true }>> {
    const data = await this.passwordService.forgotPassword(dto.email, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async reset(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ reset: true }>> {
    const data = await this.passwordService.resetPassword(dto, this.auditContext(request));
    return { success: true, data };
  }

  @Post('change')
  @HttpCode(HttpStatus.OK)
  public async change(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ changed: true }>> {
    const data = await this.passwordService.changePassword(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
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
