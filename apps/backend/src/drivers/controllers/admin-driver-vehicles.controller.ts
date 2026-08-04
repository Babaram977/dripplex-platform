import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { ListVehiclesQueryDto } from '../dto/list-vehicles-query.dto';
import { RejectVehicleDto } from '../dto/reject-vehicle.dto';
import { VehiclesService } from '../vehicles/vehicles.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { VehicleDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/vehicles')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_VEHICLE_MANAGE)
export class AdminDriverVehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  public async list(@Query() query: ListVehiclesQueryDto): Promise<
    ApiSuccessResponse<{
      items: VehicleDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>
  > {
    const data = await this.vehiclesService.listVehicles(query);
    return { success: true, data };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  public async approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<VehicleDto>> {
    const data = await this.vehiclesService.approveVehicle(
      id,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  public async reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVehicleDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<VehicleDto>> {
    const data = await this.vehiclesService.rejectVehicle(
      id,
      admin.id,
      dto.rejectedReason,
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
