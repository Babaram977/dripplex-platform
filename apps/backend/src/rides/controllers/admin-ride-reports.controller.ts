import {
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
import { ListRideProblemReportsQueryDto } from '../dto/ride-problem-report.dto';
import { RideProblemReportService } from '../ride-problem-report.service';
import { RIDE_PERMISSIONS } from '../ride.constants';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RideProblemReportDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/ride-reports')
@RequirePermissions(RIDE_PERMISSIONS.ADMIN_SUPPORT)
export class AdminRideReportsController {
  constructor(private readonly problemReportService: RideProblemReportService) {}

  @Get()
  public async listReports(
    @Query() query: ListRideProblemReportsQueryDto,
  ): Promise<ApiSuccessResponse<RideProblemReportDto[]>> {
    const data = await this.problemReportService.listReports(query.status);
    return { success: true, data };
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  public async resolveReport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideProblemReportDto>> {
    const data = await this.problemReportService.resolveReport(
      id,
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
