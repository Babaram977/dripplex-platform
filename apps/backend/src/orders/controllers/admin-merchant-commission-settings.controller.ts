import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SetMerchantNegotiatedRateDto } from '../dto/set-merchant-negotiated-rate.dto';
import { UpdateMerchantCommissionSettingsDto } from '../dto/update-merchant-commission-settings.dto';
import { MerchantCommissionSettingsService } from '../merchant-commission-settings.service';
import { ORDER_PERMISSIONS } from '../order.constants';
import { toMerchantCommissionSettingDto } from '../order.mapper';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { MerchantCommissionSettingDto, MerchantNegotiatedRateDto } from '@dripplex/types';
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

  /**
   * Agrees a rate with one merchant, or clears it back to the platform rate.
   *
   * Founder decision 2026-09-11 — the same instrument `Fleet` already had, and
   * the same reasoning already recorded for merchant credit limits: businesses
   * differ, and a platform-wide number cannot express an individual agreement.
   *
   * Takes the **merchant profile id**, matching `Order.merchantId` and the id
   * the settlement path resolves against.
   */
  @Post(':merchantProfileId/rate')
  public async setNegotiatedRate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('merchantProfileId', ParseUUIDPipe) merchantProfileId: string,
    @Body() dto: SetMerchantNegotiatedRateDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantNegotiatedRateDto>> {
    const profile = await this.commissionSettings.setNegotiatedRate({
      merchantProfileId,
      rate: dto.rate ?? null,
      ...(dto.note === undefined ? {} : { note: dto.note }),
      adminUserId: admin.id,
      context: {
        userId: admin.id,
        ...(request.ip === undefined ? {} : { ipAddress: request.ip }),
      },
    });

    return {
      success: true,
      data: {
        merchantProfileId: profile.id,
        negotiatedRate: profile.negotiatedRate === null ? null : Number(profile.negotiatedRate),
        negotiatedBy: profile.negotiatedBy,
        negotiatedAt: profile.negotiatedAt?.toISOString() ?? null,
        negotiationNote: profile.negotiationNote,
      },
    };
  }
}
