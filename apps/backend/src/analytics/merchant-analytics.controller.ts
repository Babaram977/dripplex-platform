import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { ANALYTICS_PERMISSIONS } from './analytics.constants';
import { AnalyticsService, type AnalyticsOverview } from './analytics.service';
import { AnalyticsOverviewQueryDto } from './dto/analytics.dto';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

@Controller('merchant/analytics')
export class MerchantAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @RequirePermissions(ANALYTICS_PERMISSIONS.MERCHANT_READ)
  public async overview(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AnalyticsOverviewQueryDto,
  ): Promise<ApiSuccessResponse<AnalyticsOverview>> {
    const data = await this.analyticsService.getMerchantOverview(user.id, query);
    return { success: true, data };
  }
}
