import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { MerchantScoped } from '../decorators/merchant-scoped.decorator';
import { AcknowledgeConflictDto } from '../dtos/acknowledge-conflict.dto';
import { IntegrationConflictsService } from '../services/integration-conflicts.service';
import { IntegrationsService } from '../services/integrations.service';

import type { ConflictPage, ConflictView } from '../services/integration-conflicts.service';
import type { Request } from 'express';

/**
 * A merchant's reconciliation conflicts.
 *
 * Merchant-facing throughout — a POS credential reaches nothing here. The POS
 * writes conflicts by pushing a catalogue or a stock batch; reading and
 * acknowledging them is the merchant's work, and it authenticates as a user.
 *
 * Both routes lead with two literal segments. `IntegrationsCController`
 * registers `GET /integrations/:integrationId` and the legacy controller
 * registers `GET /integrations/:id`, so any one-segment path here would be
 * swallowed by them — which is exactly how the POS order list shipped
 * answering 401 from a CRUD route while looking alive.
 */
@ApiTags('Integrations')
@Controller('integrations/conflicts')
export class IntegrationConflictsController {
  constructor(
    private readonly conflicts: IntegrationConflictsService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  @Get(':integrationId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('integrations:read')
  @ApiOperation({ summary: "List one integration's reconciliation conflicts" })
  @ApiResponse({ status: 200, description: 'Conflicts, newest first' })
  @ApiResponse({ status: 403, description: 'Integration belongs to another merchant' })
  public async list(
    @MerchantScoped() merchantId: string,
    @Param('integrationId', ParseUUIDPipe) integrationId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{ success: true; data: ConflictPage }> {
    // Ownership before any read, so one merchant cannot enumerate another's
    // conflicts by guessing an integration id.
    await this.integrationsService.verifyMerchantAccess(merchantId, integrationId);
    const data = await this.conflicts.list(integrationId, {
      ...(status !== undefined ? { status } : {}),
      ...(page !== undefined ? { page: Number(page) } : {}),
      ...(pageSize !== undefined ? { pageSize: Number(pageSize) } : {}),
    });
    return { success: true, data };
  }

  /**
   * Record that the merchant has seen this conflict.
   *
   * Named for what it does. It writes `status = RESOLVED` because that is the
   * schema's vocabulary, but it remediates nothing — calling the route
   * `resolve` would invite a later reader to assume otherwise.
   */
  @Patch(':conflictId/acknowledge')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('integrations:write')
  @ApiOperation({ summary: 'Acknowledge a conflict — records review, changes no data' })
  @ApiResponse({ status: 200, description: 'Acknowledged' })
  @ApiResponse({ status: 403, description: 'Conflict belongs to another merchant' })
  @ApiResponse({ status: 404, description: 'No such conflict' })
  @ApiResponse({ status: 409, description: 'Already acknowledged' })
  public async acknowledge(
    @MerchantScoped() merchantId: string,
    @Param('conflictId', ParseUUIDPipe) conflictId: string,
    @Body() dto: AcknowledgeConflictDto,
    @Req() request: Request,
  ): Promise<{ success: true; data: ConflictView }> {
    const data = await this.conflicts.acknowledge(
      merchantId,
      conflictId,
      this.auditContext(request),
      dto.note,
    );
    return { success: true, data };
  }

  /** Same shape every other controller in this module records. */
  private auditContext(request: Request): { ipAddress?: string; userAgent?: string } {
    const ip = request.ip;
    const agent = request.headers['user-agent'];
    return {
      ...(typeof ip === 'string' ? { ipAddress: ip } : {}),
      ...(typeof agent === 'string' ? { userAgent: agent } : {}),
    };
  }
}
