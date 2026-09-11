import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { DriverTier } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DriverTierService, type DriverTierSettingDto } from '../driver-tier.service';
import { UpdateDriverTierSettingDto } from '../dto/driver-tier.dto';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { Request } from 'express';

/**
 * DPX-TIER-001 — the driver tier table, edited from the Ops console.
 *
 * Every threshold, rating bar and percentage a driver is measured against lives
 * in the database and is edited here. Nora's specification is explicit that
 * changing what DrippleX charges, or what it takes to earn a discount, must
 * never require a deployment.
 *
 * Guarded by the same permission as the standing platform commission rate:
 * editing a tier changes what a whole class of drivers is charged, which is the
 * same class of decision.
 */
@Controller('admin/drivers/tiers')
@RequirePermissions('admin:commercial:commission-settings:manage')
export class AdminDriverTiersController {
  constructor(private readonly tiers: DriverTierService) {}

  @Get()
  public async list(): Promise<ApiSuccessResponse<DriverTierSettingDto[]>> {
    return { success: true, data: await this.tiers.listSettings() };
  }

  @Patch(':tier')
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('tier') tier: DriverTier,
    @Body() dto: UpdateDriverTierSettingDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverTierSettingDto>> {
    const data = await this.tiers.updateSetting(
      tier,
      {
        ...(dto.commissionRate !== undefined ? { commissionRate: dto.commissionRate } : {}),
        ...(dto.minCompletedTrips !== undefined
          ? { minCompletedTrips: dto.minCompletedTrips }
          : {}),
        ...(dto.minRatedTrips !== undefined ? { minRatedTrips: dto.minRatedTrips } : {}),
        ...(dto.minAverageRating !== undefined ? { minAverageRating: dto.minAverageRating } : {}),
        ...(dto.maxCancellationRate !== undefined
          ? { maxCancellationRate: dto.maxCancellationRate }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      admin.id,
      {
        userId: admin.id,
        ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      },
    );
    return { success: true, data };
  }
}
