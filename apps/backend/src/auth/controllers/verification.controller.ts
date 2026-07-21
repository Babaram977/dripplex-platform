import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/permissions.decorator';
import { VerifyEmailDto, VerifyPhoneDto } from '../dto/verification.dto';
import { VerificationService } from '../services/verification.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  EmailVerificationResponse,
  PhoneVerificationResponse,
} from '../auth-registration.types';
import type { Request } from 'express';

@Controller('auth/verify')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Public()
  @Post('email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<EmailVerificationResponse>> {
    const data = await this.verificationService.verifyEmail(
      dto.email,
      dto.otp,
      this.auditContext(request),
    );
    return { success: true, data };
  }

  @Public()
  @Post('phone')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async verifyPhone(
    @Body() dto: VerifyPhoneDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PhoneVerificationResponse>> {
    const data = await this.verificationService.verifyPhone(
      dto.phone,
      dto.otp,
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
