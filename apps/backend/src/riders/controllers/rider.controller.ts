import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SubmitRiderKycDto } from '../dto/submit-rider-kyc.dto';
import { UpdateRiderProfileDto } from '../dto/update-rider-profile.dto';
import { RIDER_SELF_PERMISSIONS } from '../rider.constants';
import { RidersService } from '../riders.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RiderKycDto, RiderProfileDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-RIDER-002 — rider self-service surface. Mirrors DriverController's KYC
 * upload and profile endpoints; riders submit an ID + a guarantor ID and set
 * the company/organisation name they deliver for.
 */
@Controller('rider')
export class RiderController {
  constructor(private readonly ridersService: RidersService) {}

  @Get('profile')
  @RequirePermissions(RIDER_SELF_PERMISSIONS.KYC_MANAGE)
  public async getOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<RiderProfileDto>> {
    const data = await this.ridersService.getOwnProfile(user.id);
    return { success: true, data };
  }

  @Patch('profile')
  @RequirePermissions(RIDER_SELF_PERMISSIONS.KYC_MANAGE)
  public async updateOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRiderProfileDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RiderProfileDto>> {
    const data = await this.ridersService.updateOwnProfile(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('kyc')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(RIDER_SELF_PERMISSIONS.KYC_MANAGE)
  public async submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitRiderKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RiderKycDto>> {
    const data = await this.ridersService.submitRiderKyc(
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
