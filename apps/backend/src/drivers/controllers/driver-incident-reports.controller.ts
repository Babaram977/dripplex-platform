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
import { CreateIncidentReportDto } from '../dto/create-incident-report.dto';
import { IncidentReportService } from '../incidents/incident-report.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { IncidentReportDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/incident-reports')
@RequirePermissions(DRIVER_PERMISSIONS.INCIDENT_REPORT_MANAGE)
export class DriverIncidentReportsController {
  constructor(private readonly incidentReportService: IncidentReportService) {}

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<IncidentReportDto[]>> {
    const data = await this.incidentReportService.listOwnReports(user.id);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<IncidentReportDto>> {
    const data = await this.incidentReportService.getOwnReport(user.id, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIncidentReportDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<IncidentReportDto>> {
    const data = await this.incidentReportService.createReport(
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
