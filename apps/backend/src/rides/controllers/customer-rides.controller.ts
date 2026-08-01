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
import { ListRidesQueryDto } from '../dto/list-rides-query.dto';
import { CancelRideDto, RequestRideDto } from '../dto/request-ride.dto';
import { RIDE_PERMISSIONS } from '../ride.constants';
import { RidesService } from '../rides.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RideDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/rides')
@RequirePermissions(RIDE_PERMISSIONS.MANAGE)
export class CustomerRidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async requestRide(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestRideDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.ridesService.requestRide(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get()
  public async listOwnRides(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRidesQueryDto,
  ): Promise<
    ApiSuccessResponse<{
      items: RideDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>
  > {
    const data = await this.ridesService.listOwnRides(user.id, query);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwnRide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.ridesService.getOwnRide(user.id, id);
    return { success: true, data };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  public async cancelRide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRideDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.ridesService.cancelRide(
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
