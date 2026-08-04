import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { ListSosAlertsQueryDto } from '../dto/list-sos-alerts-query.dto';
import { UpdateSosAlertDto } from '../dto/update-sos-alert.dto';
import { SosAlertService } from '../sos/sos-alert.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { SosAlertDto, SosAlertListDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/sos-alerts')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_SOS_ALERT_MANAGE)
export class AdminSosAlertsController {
  constructor(private readonly sosAlertService: SosAlertService) {}

  @Get()
  public async list(
    @Query() query: ListSosAlertsQueryDto,
  ): Promise<ApiSuccessResponse<SosAlertListDto>> {
    const data = await this.sosAlertService.listAlerts(query);
    return { success: true, data };
  }

  @Patch(':id')
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSosAlertDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<SosAlertDto>> {
    const data = await this.sosAlertService.updateAlert(
      id,
      admin.id,
      dto,
      this.auditContext(request, admin.id),
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
