import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/permissions.decorator';
import { SendOtpDto, VerifyPhoneOtpDto } from '../dto/identity-verification.dto';
import { PhoneVerificationService } from '../services/phone-verification.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { PhoneVerificationResponse } from '../auth-registration.types';
import type { Request } from 'express';

@Controller('auth/phone')
export class PhoneVerificationController {
  constructor(private readonly phoneVerificationService: PhoneVerificationService) {}

  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  public async sendOtp(
    @Body() dto: SendOtpDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ submitted: true }>> {
    const data = await this.phoneVerificationService.sendOtp(dto.phone, this.auditContext(request));
    return { success: true, data };
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async verify(
    @Body() dto: VerifyPhoneOtpDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PhoneVerificationResponse>> {
    const data = await this.phoneVerificationService.verify(
      dto.phone,
      dto.otp,
      this.auditContext(request),
    );
    return { success: true, data };
  }

  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  public async resend(
    @Body() dto: SendOtpDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ submitted: true }>> {
    const data = await this.phoneVerificationService.resendOtp(
      dto.phone,
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
