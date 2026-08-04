import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { CreateInspectionCentreDto } from '../dto/create-inspection-centre.dto';
import { UpdateInspectionCentreDto } from '../dto/update-inspection-centre.dto';
import { InspectionCentresService } from '../inspections/inspection-centres.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { InspectionCentreDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/inspection-centres')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_INSPECTION_CENTRES_MANAGE)
export class AdminInspectionCentresController {
  constructor(private readonly inspectionCentresService: InspectionCentresService) {}

  @Get()
  public async list(): Promise<ApiSuccessResponse<InspectionCentreDto[]>> {
    const data = await this.inspectionCentresService.listAll();
    return { success: true, data };
  }

  @Get(':id')
  public async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<InspectionCentreDto>> {
    const data = await this.inspectionCentresService.get(id);
    return { success: true, data };
  }

  @Post()
  public async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateInspectionCentreDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<InspectionCentreDto>> {
    const data = await this.inspectionCentresService.create(
      dto,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Patch(':id')
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInspectionCentreDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<InspectionCentreDto>> {
    const data = await this.inspectionCentresService.update(
      id,
      dto,
      admin.id,
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
