import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/permissions.decorator';
import { SendVerificationDto, VerifyEmailTokenDto } from '../dto/identity-verification.dto';
import { EmailVerificationService } from '../services/email-verification.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { EmailVerificationResponse } from '../auth-registration.types';
import type { Request } from 'express';

@Controller('auth/email')
export class EmailVerificationController {
  constructor(private readonly emailVerificationService: EmailVerificationService) {}

  @Public()
  @Post('send-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  public async sendVerification(
    @Body() dto: SendVerificationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ submitted: true }>> {
    const data = await this.emailVerificationService.sendVerification(
      dto.email,
      this.auditContext(request),
    );
    return { success: true, data };
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async verify(
    @Body() dto: VerifyEmailTokenDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<EmailVerificationResponse>> {
    const data = await this.emailVerificationService.verify(
      dto.email,
      dto.token,
      this.auditContext(request),
    );
    return { success: true, data };
  }

  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  public async resend(
    @Body() dto: SendVerificationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ submitted: true }>> {
    const data = await this.emailVerificationService.resendVerification(
      dto.email,
      this.auditContext(request),
    );
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
