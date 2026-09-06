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
import { RIDE_PERMISSIONS } from '../../rides/ride.constants';
import { CreateSosAlertDto } from '../dto/create-sos-alert.dto';
import { SosAlertService } from '../sos/sos-alert.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { SosAlertDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-SAFETY-001 — the passenger's Emergency SOS.
 *
 * Lives beside `DriverSosAlertsController` under `drivers/` for the same
 * reason `SosAlertService` does: the Ride module is frozen, so anything
 * that needs to read `prisma.ride` directly is built here. The route is
 * `customer/…`, which is what callers see.
 *
 * Gated on `customer:ride:manage` rather than a new permission. Raising
 * SOS is only possible during one of your own active rides, so anyone who
 * can manage that ride can already raise it — a new permission would add a
 * catalog entry and a seed migration without excluding a single caller,
 * and would risk a real emergency failing on an unseeded grant.
 *
 * Deliberately not throttled, matching the driver controller. Rate-limiting
 * a life-safety endpoint trades a real emergency for protection against a
 * nuisance; if abuse ever appears, the answer is an Operations-side
 * duplicate-suppression rule, not a 429 in front of an SOS button.
 */
@Controller('customer/sos-alerts')
@RequirePermissions(RIDE_PERMISSIONS.MANAGE)
export class CustomerSosAlertsController {
  constructor(private readonly sosAlertService: SosAlertService) {}

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<SosAlertDto[]>> {
    const data = await this.sosAlertService.listOwnCustomerAlerts(user.id);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<SosAlertDto>> {
    const data = await this.sosAlertService.getOwnCustomerAlert(user.id, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSosAlertDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<SosAlertDto>> {
    const data = await this.sosAlertService.triggerForCustomer(
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
