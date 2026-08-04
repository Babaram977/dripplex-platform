import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { SubmitIdentityVerificationDto } from '../dto/submit-identity-verification.dto';
import {
  toDriverIdentityVerificationDto,
  toIdentityVerificationStatusDto,
} from '../identity-verification/driver-identity-verification.mapper';
import { DriverIdentityVerificationService } from '../identity-verification/driver-identity-verification.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverIdentityVerificationDto, IdentityVerificationStatusDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/identity-verification')
export class DriverIdentityVerificationController {
  constructor(private readonly identityVerificationService: DriverIdentityVerificationService) {}

  @Get('status')
  @RequirePermissions(DRIVER_PERMISSIONS.IDENTITY_VERIFICATION_MANAGE)
  public async status(
    @CurrentUser() user: AuthenticatedUser,
    @Query('deviceId') deviceId?: string,
  ): Promise<ApiSuccessResponse<IdentityVerificationStatusDto>> {
    const check = await this.identityVerificationService.status(user.id, deviceId);
    return { success: true, data: toIdentityVerificationStatusDto(check) };
  }

  @Post('submit')
  @RequirePermissions(DRIVER_PERMISSIONS.IDENTITY_VERIFICATION_MANAGE)
  // Biometric submissions are inherently rate-limited by user effort (a
  // real selfie capture per attempt), but scoped tighter than the app-wide
  // default anyway — same reasoning as the Wallet PIN throttle.
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  public async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitIdentityVerificationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverIdentityVerificationDto>> {
    const record = await this.identityVerificationService.submit(
      {
        driverId: user.id,
        selfieImageBase64: dto.selfieImageBase64,
        ...(dto.idDocumentImageBase64 !== undefined
          ? { idDocumentImageBase64: dto.idDocumentImageBase64 }
          : {}),
        ...(dto.idNumber !== undefined ? { idNumber: dto.idNumber } : {}),
        ...(dto.deviceId !== undefined ? { deviceId: dto.deviceId } : {}),
        ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      },
      { userId: user.id, ...(request.ip !== undefined ? { ipAddress: request.ip } : {}) },
    );
    return { success: true, data: toDriverIdentityVerificationDto(record) };
  }
}
