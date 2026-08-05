import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AddOperationsCaseNoteDto } from '../dto/add-operations-case-note.dto';
import { UpdateOperationsCaseDto } from '../dto/update-operations-case.dto';
import { OperationsCasesService } from '../operations-cases.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { AuditContext } from '../../audit/audit.service';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { OperationsCaseDetailDto } from '@dripplex/types';
import type { Request } from 'express';

/** DPX-OPS-001 Slice 2 — a single work-queue case: detail (with its full
 * timeline), assign/prioritize/change status, and add operator notes.
 * `GET` only needs `QUEUES_READ`; every mutation needs `QUEUES_MANAGE`. */
@Controller('operations/cases')
export class OperationsCasesController {
  constructor(private readonly casesService: OperationsCasesService) {}

  @Get(':id')
  @RequirePermissions(OPERATIONS_PERMISSIONS.QUEUES_READ)
  public async getCase(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<OperationsCaseDetailDto>> {
    const data = await this.casesService.getCaseDetail(id);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions(OPERATIONS_PERMISSIONS.QUEUES_MANAGE)
  public async updateCase(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperationsCaseDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OperationsCaseDetailDto>> {
    const data = await this.casesService.updateCase(
      id,
      dto,
      operator.id,
      this.auditContext(request, operator.id),
    );
    return { success: true, data };
  }

  @Post(':id/notes')
  @RequirePermissions(OPERATIONS_PERMISSIONS.QUEUES_MANAGE)
  public async addNote(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddOperationsCaseNoteDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OperationsCaseDetailDto>> {
    const data = await this.casesService.addNote(
      id,
      dto.note,
      operator.id,
      this.auditContext(request, operator.id),
    );
    return { success: true, data };
  }

  private auditContext(request: Request, userId?: string): AuditContext {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
