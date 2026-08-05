import { Body, Controller, Get, Patch, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { UpdateMerchantCommissionSettingsDto } from '../dto/update-merchant-commission-settings.dto';
import { MerchantCommissionSettingsService } from '../merchant-commission-settings.service';
import { ORDER_PERMISSIONS } from '../order.constants';
import { toMerchantCommissionSettingDto } from '../order.mapper';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { MerchantCommissionSettingDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-MERCHANT-002 — the admin-configurable Marketplace merchant
 * commission rate. Separate permission from generic order management:
 * editing the commercial commission policy is a more sensitive action
 * than routine order administration, same reasoning as Driver-001's
 * security-settings permission split.
 */
@Controller('admin/merchant-settlement/commission')
@RequirePermissions(ORDER_PERMISSIONS.ADMIN_SETTLEMENT_COMMISSION_MANAGE)
export class AdminMerchantCommissionSettingsController {
  constructor(private readonly commissionSettings: MerchantCommissionSettingsService) {}

  @Get()
  public async get(): Promise<ApiSuccessResponse<MerchantCommissionSettingDto>> {
    const setting = await this.commissionSettings.getEffective();
    return { success: true, data: toMerchantCommissionSettingDto(setting) };
  }

  @Patch()
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateMerchantCommissionSettingsDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantCommissionSettingDto>> {
    const setting = await this.commissionSettings.update(dto.commissionRate, admin.id, {
      userId: admin.id,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
    });
    return { success: true, data: toMerchantCommissionSettingDto(setting) };
  }
}
