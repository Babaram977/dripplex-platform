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
import { ScheduleInspectionDto } from '../dto/schedule-inspection.dto';
import { InspectionCentresService } from '../inspections/inspection-centres.service';
import { InspectionsService } from '../inspections/inspections.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { InspectionCentreDto, InspectionDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/inspections')
@RequirePermissions(DRIVER_PERMISSIONS.INSPECTION_BOOK)
export class DriverInspectionsController {
  constructor(
    private readonly inspectionsService: InspectionsService,
    private readonly inspectionCentresService: InspectionCentresService,
  ) {}

  @Get('centres')
  public async listCentres(): Promise<ApiSuccessResponse<InspectionCentreDto[]>> {
    const data = await this.inspectionCentresService.listActive();
    return { success: true, data };
  }

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<InspectionDto[]>> {
    const data = await this.inspectionsService.listOwnInspections(user.id);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<InspectionDto>> {
    const data = await this.inspectionsService.getOwnInspection(user.id, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async schedule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScheduleInspectionDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<InspectionDto>> {
    const data = await this.inspectionsService.scheduleInspection(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  public async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<InspectionDto>> {
    const data = await this.inspectionsService.cancelOwnInspection(
      user.id,
      id,
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
