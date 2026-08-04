import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { CreateSosAlertDto } from '../dto/create-sos-alert.dto';
import { SosAlertService } from '../sos/sos-alert.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { SosAlertDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/sos-alerts')
@RequirePermissions(DRIVER_PERMISSIONS.SOS_ALERT_MANAGE)
export class DriverSosAlertsController {
  constructor(private readonly sosAlertService: SosAlertService) {}

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<SosAlertDto[]>> {
    const data = await this.sosAlertService.listOwnAlerts(user.id);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<SosAlertDto>> {
    const data = await this.sosAlertService.getOwnAlert(user.id, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSosAlertDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<SosAlertDto>> {
    const data = await this.sosAlertService.trigger(
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
