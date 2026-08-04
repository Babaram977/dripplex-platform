import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { ListIncidentReportsQueryDto } from '../dto/list-incident-reports-query.dto';
import { UpdateIncidentReportDto } from '../dto/update-incident-report.dto';
import { IncidentReportService } from '../incidents/incident-report.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { IncidentReportDto, IncidentReportListDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/incident-reports')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_INCIDENT_REPORT_MANAGE)
export class AdminIncidentReportsController {
  constructor(private readonly incidentReportService: IncidentReportService) {}

  @Get()
  public async list(
    @Query() query: ListIncidentReportsQueryDto,
  ): Promise<ApiSuccessResponse<IncidentReportListDto>> {
    const data = await this.incidentReportService.listReports(query);
    return { success: true, data };
  }

  @Patch(':id')
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentReportDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<IncidentReportDto>> {
    const data = await this.incidentReportService.updateReport(
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
