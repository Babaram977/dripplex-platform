import {
  Body,
  Controller,
  Delete,
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
import { SetDriverPlannedAvailabilityDto } from '../dto/set-driver-planned-availability.dto';
import { DriverPlannedAvailabilityService } from '../shifts/driver-planned-availability.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverPlannedAvailabilityDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/planned-availability')
@RequirePermissions(DRIVER_PERMISSIONS.SHIFT_MANAGE)
export class DriverPlannedAvailabilityController {
  constructor(private readonly plannedAvailabilityService: DriverPlannedAvailabilityService) {}

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverPlannedAvailabilityDto[]>> {
    const data = await this.plannedAvailabilityService.listOwn(user.id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetDriverPlannedAvailabilityDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverPlannedAvailabilityDto>> {
    const data = await this.plannedAvailabilityService.setEntry(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.plannedAvailabilityService.deleteOwn(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
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
