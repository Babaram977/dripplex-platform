import { Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { DRIVER_CAMPAIGN_PERMISSIONS } from './driver-campaign.constants';
import { toDriverReferralDto } from './driver-campaign.mapper';
import { DriverCampaignService } from './driver-campaign.service';

import type {
  DriverCampaignDashboardDto,
  DriverLeaderboardEntryDto,
  DriverReferralDto,
  ReferralCampaignDto,
} from './driver-campaign.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('driver/referral-campaign')
export class DriverCampaignController {
  constructor(private readonly driverCampaignService: DriverCampaignService) {}

  @Get('code')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.DRIVER_USE)
  public async getMyCode(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ campaign: ReferralCampaignDto; referral: DriverReferralDto }>> {
    const { campaign, referral } = await this.driverCampaignService.getOrCreateMyCode(
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data: { campaign, referral: toDriverReferralDto(referral) } };
  }

  @Post('invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.DRIVER_USE)
  public async recordInvite(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.driverCampaignService.recordInviteTap(user.id);
  }

  @Get('dashboard')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.DRIVER_USE)
  public async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverCampaignDashboardDto>> {
    const data = await this.driverCampaignService.getDashboard(user.id);
    return { success: true, data };
  }

  @Get('leaderboard')
  @RequirePermissions(DRIVER_CAMPAIGN_PERMISSIONS.DRIVER_USE)
  public async getLeaderboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverLeaderboardEntryDto[]>> {
    const data = await this.driverCampaignService.getLeaderboardForActiveCampaign(user.id);
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
