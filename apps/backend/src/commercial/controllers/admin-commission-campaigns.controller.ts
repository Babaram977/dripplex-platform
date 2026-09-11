import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { COMMISSION_CAMPAIGN_PERMISSIONS } from '../commission-campaign.constants';
import {
  CommissionCampaignService,
  type CommissionCampaignDto,
} from '../commission-campaign.service';
import {
  CreateCommissionCampaignDto,
  ListCommissionCampaignsQueryDto,
  UpdateCommissionCampaignDto,
} from '../dto/commission-campaign.dto';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-COMMISSION-001 — commission campaigns, run from the Ops console.
 *
 * Guarded by its own permission rather than general admin: a campaign changes
 * what every merchant, rider or driver on the platform is charged, which is the
 * same class of decision as editing the standing commission rate and is guarded
 * the same way.
 *
 * There is no delete. A rate that was once charged against real money has to
 * stay explicable — settlement rows point back at these ids — so `archive` is
 * the end of the line.
 */
@Controller('admin/commercial/commission-campaigns')
export class AdminCommissionCampaignsController {
  constructor(private readonly campaigns: CommissionCampaignService) {}

  @Get()
  @RequirePermissions(COMMISSION_CAMPAIGN_PERMISSIONS.READ)
  public async list(
    @Query() query: ListCommissionCampaignsQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<CommissionCampaignDto>>> {
    const data = await this.campaigns.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.scope !== undefined ? { scope: query.scope } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    });
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(COMMISSION_CAMPAIGN_PERMISSIONS.READ)
  public async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CommissionCampaignDto>> {
    return { success: true, data: await this.campaigns.get(id) };
  }

  @Post()
  @RequirePermissions(COMMISSION_CAMPAIGN_PERMISSIONS.MANAGE)
  public async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateCommissionCampaignDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CommissionCampaignDto>> {
    const data = await this.campaigns.create({
      name: dto.name,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      scope: dto.scope,
      commissionRate: dto.commissionRate,
      priority: dto.priority,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      ...(dto.rules !== undefined ? { rules: dto.rules } : {}),
      announce: dto.announce,
      context: this.auditContext(request, admin.id),
    });
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions(COMMISSION_CAMPAIGN_PERMISSIONS.MANAGE)
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommissionCampaignDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CommissionCampaignDto>> {
    const data = await this.campaigns.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.commissionRate !== undefined ? { commissionRate: dto.commissionRate } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt } : {}),
      ...(dto.rules !== undefined ? { rules: dto.rules } : {}),
      ...(dto.announce !== undefined ? { announce: dto.announce } : {}),
      context: this.auditContext(request, admin.id),
    });
    return { success: true, data };
  }

  @Patch(':id/pause')
  @RequirePermissions(COMMISSION_CAMPAIGN_PERMISSIONS.MANAGE)
  public async pause(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CommissionCampaignDto>> {
    const data = await this.campaigns.pause(id, this.auditContext(request, admin.id));
    return { success: true, data };
  }

  @Patch(':id/resume')
  @RequirePermissions(COMMISSION_CAMPAIGN_PERMISSIONS.MANAGE)
  public async resume(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CommissionCampaignDto>> {
    const data = await this.campaigns.resume(id, this.auditContext(request, admin.id));
    return { success: true, data };
  }

  @Patch(':id/archive')
  @RequirePermissions(COMMISSION_CAMPAIGN_PERMISSIONS.MANAGE)
  public async archive(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CommissionCampaignDto>> {
    const data = await this.campaigns.archive(id, this.auditContext(request, admin.id));
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId: string,
  ): { userId: string; ipAddress?: string; userAgent?: string } {
    return {
      userId,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
