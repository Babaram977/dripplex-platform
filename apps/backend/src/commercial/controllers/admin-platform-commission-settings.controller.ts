import { Body, Controller, Get, Patch, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { COMMERCIAL_PERMISSIONS } from '../commercial.constants';
import { toPlatformCommissionSettingDto } from '../commercial.mapper';
import { UpdatePlatformCommissionSettingDto } from '../dto/update-platform-commission-setting.dto';
import { PlatformCommissionSettingsService } from '../platform-commission-settings.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { PlatformCommissionSettingDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-LAUNCH — the Ops-configurable platform (ride) commission rate. Exposed on
 * the admin/ops console surface, guarded by its own commission-settings
 * permission (administrator / super_administrator only) — editing the
 * commercial commission policy is a more sensitive action than routine admin
 * work, same reasoning as the credit-settings and merchant commission-rate
 * permission splits. Every change is audit-logged in the service.
 */
@Controller('admin/commercial/commission-settings')
@RequirePermissions(COMMERCIAL_PERMISSIONS.ADMIN_COMMISSION_SETTINGS_MANAGE)
export class AdminPlatformCommissionSettingsController {
  constructor(private readonly commissionSettings: PlatformCommissionSettingsService) {}

  @Get()
  public async get(): Promise<ApiSuccessResponse<PlatformCommissionSettingDto>> {
    const setting = await this.commissionSettings.getEffective();
    return { success: true, data: toPlatformCommissionSettingDto(setting) };
  }

  @Patch()
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdatePlatformCommissionSettingDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PlatformCommissionSettingDto>> {
    const setting = await this.commissionSettings.update(dto.commissionRate, admin.id, {
      userId: admin.id,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
    });
    return { success: true, data: toPlatformCommissionSettingDto(setting) };
  }
}
