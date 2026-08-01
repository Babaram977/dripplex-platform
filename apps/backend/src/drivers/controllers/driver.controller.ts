import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { DriversService } from '../drivers.service';
import { SubmitDriverKycDto } from '../dto/submit-driver-kyc.dto';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverKycDto, DriverProfileDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver')
export class DriverController {
  constructor(private readonly driversService: DriversService) {}

  @Get('profile')
  @RequirePermissions(DRIVER_PERMISSIONS.KYC_MANAGE)
  public async getOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverProfileDto>> {
    const data = await this.driversService.getOwnProfile(user.id);
    return { success: true, data };
  }

  @Post('kyc')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(DRIVER_PERMISSIONS.KYC_MANAGE)
  public async submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitDriverKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverKycDto>> {
    const data = await this.driversService.submitKyc(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { userId?: string; ipAddress?: string; userAgent?: string } {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
