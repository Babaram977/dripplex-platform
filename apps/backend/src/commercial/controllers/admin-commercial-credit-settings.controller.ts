import { Body, Controller, Get, Param, ParseEnumPipe, Patch, Req } from '@nestjs/common';
import { CommissionOwnerType } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CommercialCreditSettingsService } from '../commercial-credit-settings.service';
import { COMMERCIAL_PERMISSIONS } from '../commercial.constants';
import { toCommercialCreditSettingDto } from '../commercial.mapper';
import { UpdateCommercialCreditSettingDto } from '../dto/update-commercial-credit-setting.dto';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { CommercialCreditSettingDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-COMMERCIAL-001 Slice 1 — the admin-configurable commission credit
 * limit, one row per owner type. Separate permission from generic order/
 * wallet administration, same reasoning as DPX-MERCHANT-002's commission-
 * rate permission and Driver-001's security-settings permission.
 */
@Controller('admin/commercial/credit-settings')
@RequirePermissions(COMMERCIAL_PERMISSIONS.ADMIN_CREDIT_SETTINGS_MANAGE)
export class AdminCommercialCreditSettingsController {
  constructor(private readonly creditSettings: CommercialCreditSettingsService) {}

  @Get(':ownerType')
  public async get(
    @Param('ownerType', new ParseEnumPipe(CommissionOwnerType)) ownerType: CommissionOwnerType,
  ): Promise<ApiSuccessResponse<CommercialCreditSettingDto>> {
    const setting = await this.creditSettings.getEffective(ownerType);
    return { success: true, data: toCommercialCreditSettingDto(setting) };
  }

  @Patch()
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateCommercialCreditSettingDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CommercialCreditSettingDto>> {
    const setting = await this.creditSettings.update(dto.ownerType, dto.creditLimit, admin.id, {
      userId: admin.id,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
    });
    return { success: true, data: toCommercialCreditSettingDto(setting) };
  }
}
