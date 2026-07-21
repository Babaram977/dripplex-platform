import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { ANALYTICS_PERMISSIONS } from './analytics.constants';
import {
  AnalyticsService,
  type AnalyticsOverview,
  type TopMerchantDto,
  type TopProductDto,
  type TopRiderDto,
} from './analytics.service';
import { AnalyticsOverviewQueryDto, AnalyticsTopListQueryDto } from './dto/analytics.dto';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @RequirePermissions(ANALYTICS_PERMISSIONS.ADMIN_READ)
  public async overview(
    @Query() query: AnalyticsOverviewQueryDto,
  ): Promise<ApiSuccessResponse<AnalyticsOverview>> {
    const data = await this.analyticsService.getAdminOverview(query);
    return { success: true, data };
  }

  @Get('top-products')
  @RequirePermissions(ANALYTICS_PERMISSIONS.ADMIN_READ)
  public async topProducts(
    @Query() query: AnalyticsTopListQueryDto,
  ): Promise<ApiSuccessResponse<TopProductDto[]>> {
    const data = await this.analyticsService.topProducts(query);
    return { success: true, data };
  }

  @Get('top-merchants')
  @RequirePermissions(ANALYTICS_PERMISSIONS.ADMIN_READ)
  public async topMerchants(
    @Query() query: AnalyticsTopListQueryDto,
  ): Promise<ApiSuccessResponse<TopMerchantDto[]>> {
    const data = await this.analyticsService.topMerchants(query);
    return { success: true, data };
  }

  @Get('top-riders')
  @RequirePermissions(ANALYTICS_PERMISSIONS.ADMIN_READ)
  public async topRiders(
    @Query() query: AnalyticsTopListQueryDto,
  ): Promise<ApiSuccessResponse<TopRiderDto[]>> {
    const data = await this.analyticsService.topRiders(query);
    return { success: true, data };
  }
}
