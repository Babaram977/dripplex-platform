import { Body, Controller, Get, Patch, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { UpdateDriverSecuritySettingsDto } from '../dto/update-driver-security-settings.dto';
import { toDriverSecuritySettingsDto } from '../identity-verification/driver-identity-verification.mapper';
import { DriverSecuritySettingsService } from '../identity-verification/driver-security-settings.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverSecuritySettingsDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * Driver-001 Security Standard — admin-configurable risk-engine policy.
 * See docs/DPX-DRIVER-001-SECURITY-STANDARD.md. Separate permission from
 * `admin:drivers:identity-verification:manage`: editing the security
 * *policy* is a more sensitive action than routine per-driver
 * unlock/manual-flag operations.
 */
@Controller('admin/drivers/security-settings')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_SECURITY_SETTINGS_MANAGE)
export class AdminDriverSecuritySettingsController {
  constructor(private readonly securitySettingsService: DriverSecuritySettingsService) {}

  @Get()
  public async get(): Promise<ApiSuccessResponse<DriverSecuritySettingsDto>> {
    const settings = await this.securitySettingsService.getEffective();
    return { success: true, data: toDriverSecuritySettingsDto(settings) };
  }

  @Patch()
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateDriverSecuritySettingsDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverSecuritySettingsDto>> {
    const settings = await this.securitySettingsService.update(dto, admin.id, {
      userId: admin.id,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
    });
    return { success: true, data: toDriverSecuritySettingsDto(settings) };
  }
}
