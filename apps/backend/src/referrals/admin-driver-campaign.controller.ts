import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { DRIVER_CAMPAIGN_PERMISSIONS } from './driver-campaign.constants';
import { DriverCampaignService } from './driver-campaign.service';
import {
  CreateReferralCampaignDto,
  ListCampaignsQueryDto,
  ListFraudChecksQueryDto,
  RejectRewardDto,
  ReviewFraudCheckDto,
  UpdateCampaignRewardsDto,
} from './dto/driver-campaign.dto';

import type {
  LeaderboardEntryDto,
  ReferralCampaignDto,
  ReferralFraudCheckDto,
  ReferralRewardDto,
} from './driver-campaign.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { DriverReferralRewardStatus } from '@prisma/client';
import type { Request, Response } from 'express';

@Controller('admin/referral-campaigns')
export class AdminDriverCampaignController {
  constructor(private readonly driverCampaignService: DriverCampaignService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReferralCampaignDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralCampaignDto>> {
    const data = await this.driverCampaignService.createCampaign(
      {
        name: dto.name,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        ...(dto.requiredTripsPerPassenger !== undefined
          ? { requiredTripsPerPassenger: dto.requiredTripsPerPassenger }
          : {}),
        ...(dto.silverThreshold !== undefined ? { silverThreshold: dto.silverThreshold } : {}),
        ...(dto.silverRewardAmount !== undefined
          ? { silverRewardAmount: dto.silverRewardAmount }
          : {}),
        ...(dto.goldThreshold !== undefined ? { goldThreshold: dto.goldThreshold } : {}),
        ...(dto.goldRewardAmount !== undefined ? { goldRewardAmount: dto.goldRewardAmount } : {}),
        ...(dto.goldQualificationRate !== undefined
          ? { goldQualificationRate: dto.goldQualificationRate }
          : {}),
      },
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get()
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async list(
    @Query() query: ListCampaignsQueryDto,
  ): Promise<ApiSuccessResponse<ReferralCampaignDto[]>> {
    const data = await this.driverCampaignService.listCampaigns(query.status);
    return { success: true, data };
  }

  @Patch(':id/rewards')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async updateRewards(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignRewardsDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralCampaignDto>> {
    const data = await this.driverCampaignService.updateCampaignRewards(
      id,
      dto,
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/pause')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralCampaignDto>> {
    const data = await this.driverCampaignService.pauseCampaign(
      id,
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/resume')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralCampaignDto>> {
    const data = await this.driverCampaignService.resumeCampaign(
      id,
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get(':id/leaderboard')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async leaderboard(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<LeaderboardEntryDto[]>> {
    const data = await this.driverCampaignService.getLeaderboard(id);
    return { success: true, data };
  }

  @Get(':id/export')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async export(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const csv = await this.driverCampaignService.exportCampaignReportCsv(id);
    response.setHeader('Content-Type', 'text/csv');
    response.setHeader('Content-Disposition', `attachment; filename="campaign-${id}.csv"`);
    response.send(csv);
  }

  @Get('rewards')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async listRewards(
    @Query('campaignId') campaignId: string | undefined,
    @Query('status') status: DriverReferralRewardStatus | undefined,
  ): Promise<ApiSuccessResponse<ReferralRewardDto[]>> {
    const data = await this.driverCampaignService.listRewards(campaignId, status);
    return { success: true, data };
  }

  @Post('rewards/:id/approve')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async approveReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralRewardDto>> {
    const data = await this.driverCampaignService.approveReward(
      id,
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('rewards/:id/reject')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async rejectReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRewardDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralRewardDto>> {
    const data = await this.driverCampaignService.rejectReward(
      id,
      dto.reason,
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('rewards/:id/pay')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async payReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralRewardDto>> {
    const data = await this.driverCampaignService.payReward(
      id,
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('fraud-checks')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async listFraudChecks(
    @Query() query: ListFraudChecksQueryDto,
  ): Promise<ApiSuccessResponse<ReferralFraudCheckDto[]>> {
    const data = await this.driverCampaignService.listFraudChecks(query.status);
    return { success: true, data };
  }

  @Post('fraud-checks/:id/review')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.ADMIN_MANAGE)
  public async reviewFraudCheck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewFraudCheckDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralFraudCheckDto>> {
    const data = await this.driverCampaignService.reviewFraudCheck(
      id,
      dto.status,
      user.id,
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
