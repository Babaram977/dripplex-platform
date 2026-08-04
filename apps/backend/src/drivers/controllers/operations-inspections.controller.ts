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
import { DecideInspectionDto } from '../dto/decide-inspection.dto';
import { ListInspectionsQueryDto } from '../dto/list-inspections-query.dto';
import { RecordInspectionChecklistDto } from '../dto/record-inspection-checklist.dto';
import { InspectionsService } from '../inspections/inspections.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { InspectionDto } from '@dripplex/types';
import type { Request } from 'express';

/** DPX-DRIVER-002 Phase 3 — inspection management within the existing
 * Operations/Admin Portal, per the founder's decision not to build a
 * separate Inspector app. Officer (`INSPECTION_CHECKLIST_MANAGE`) records;
 * Supervisor (`INSPECTION_APPROVE`) decides — see driver.constants.ts. */
@Controller('admin/inspections')
export class OperationsInspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get()
  @RequirePermissions(DRIVER_PERMISSIONS.INSPECTION_CHECKLIST_MANAGE)
  public async list(@Query() query: ListInspectionsQueryDto): Promise<
    ApiSuccessResponse<{
      items: InspectionDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>
  > {
    const data = await this.inspectionsService.listInspections(query);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(DRIVER_PERMISSIONS.INSPECTION_CHECKLIST_MANAGE)
  public async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<InspectionDto>> {
    const data = await this.inspectionsService.getInspection(id);
    return { success: true, data };
  }

  @Post(':id/checklist')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.INSPECTION_CHECKLIST_MANAGE)
  public async recordChecklist(
    @CurrentUser() officer: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordInspectionChecklistDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<InspectionDto>> {
    const data = await this.inspectionsService.recordChecklist(
      id,
      officer.id,
      dto,
      this.auditContext(request, officer.id),
    );
    return { success: true, data };
  }

  @Post(':id/decide')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.INSPECTION_APPROVE)
  public async decide(
    @CurrentUser() supervisor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideInspectionDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<InspectionDto>> {
    const data = await this.inspectionsService.decide(
      id,
      supervisor.id,
      dto,
      this.auditContext(request, supervisor.id),
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
