import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import { VehiclesService } from '../vehicles/vehicles.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { VehicleDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/vehicles')
@RequirePermissions(DRIVER_PERMISSIONS.VEHICLE_MANAGE)
export class DriverVehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<VehicleDto[]>> {
    const data = await this.vehiclesService.listOwnVehicles(user.id);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<VehicleDto>> {
    const data = await this.vehiclesService.getOwnVehicle(user.id, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<VehicleDto>> {
    const data = await this.vehiclesService.createVehicle(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id')
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<VehicleDto>> {
    const data = await this.vehiclesService.updateOwnVehicle(
      user.id,
      id,
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
