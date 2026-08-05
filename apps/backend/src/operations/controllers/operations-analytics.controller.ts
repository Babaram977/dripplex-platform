import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AnalyticsRangeQueryDto } from '../dto/analytics-range-query.dto';
import { OperationsAnalyticsService } from '../operations-analytics.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { AnalyticsRange } from '../operations-analytics.service';
import type {
  DispatchPerformanceAnalyticsDto,
  DriverUtilizationAnalyticsDto,
  GeographicDemandAnalyticsDto,
  OperationsAnalyticsOverviewDto,
  OperationsResponseAnalyticsDto,
  RideOperationsAnalyticsDto,
  ShiftAnalyticsDto,
} from '@dripplex/types';

/** `to` on the query DTO is an ISO date/timestamp string — when it's a bare
 * `YYYY-MM-DD` date (a "custom" picker with no time component), it means
 * "through the end of that day," so it gets pushed to 23:59:59.999 before
 * querying, matching Slice 2's `toQueueFilter()` convention exactly. */
function toAnalyticsRange(query: AnalyticsRangeQueryDto): AnalyticsRange {
  const to = new Date(query.to);
  const toIsBareDate = /^\d{4}-\d{2}-\d{2}$/.test(query.to);
  if (toIsBareDate) {
    to.setUTCHours(23, 59, 59, 999);
  }
  return { from: new Date(query.from), to };
}

/** DPX-OPS-001 Slice 4 — Operations Analytics (founder-approved
 * 2026-08-05, reality-audited first — see
 * docs/DPX-OPS-001-SLICE-4-REALITY-AUDIT.md). Read-only throughout, its
 * own permission (`operations:analytics:read`) since this is a distinct
 * capability from live visibility or work-queue management. */
@Controller('operations/analytics')
@RequirePermissions(OPERATIONS_PERMISSIONS.ANALYTICS_READ)
export class OperationsAnalyticsController {
  constructor(private readonly analyticsService: OperationsAnalyticsService) {}

  @Get('overview')
  public async getOverview(
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<ApiSuccessResponse<OperationsAnalyticsOverviewDto>> {
    const data = await this.analyticsService.getOverview(toAnalyticsRange(query));
    return { success: true, data };
  }

  @Get('driver-utilization')
  public async getDriverUtilization(
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<ApiSuccessResponse<DriverUtilizationAnalyticsDto>> {
    const data = await this.analyticsService.getDriverUtilization(toAnalyticsRange(query));
    return { success: true, data };
  }

  @Get('shifts')
  public async getShiftAnalytics(
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<ApiSuccessResponse<ShiftAnalyticsDto>> {
    const data = await this.analyticsService.getShiftAnalytics(toAnalyticsRange(query));
    return { success: true, data };
  }

  @Get('rides')
  public async getRideOperations(
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<ApiSuccessResponse<RideOperationsAnalyticsDto>> {
    const data = await this.analyticsService.getRideOperations(toAnalyticsRange(query));
    return { success: true, data };
  }

  @Get('dispatch')
  public async getDispatchPerformance(
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<ApiSuccessResponse<DispatchPerformanceAnalyticsDto>> {
    const data = await this.analyticsService.getDispatchPerformance(toAnalyticsRange(query));
    return { success: true, data };
  }

  @Get('response')
  public async getOperationsResponse(
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<ApiSuccessResponse<OperationsResponseAnalyticsDto>> {
    const data = await this.analyticsService.getOperationsResponse(toAnalyticsRange(query));
    return { success: true, data };
  }

  @Get('geography')
  public async getGeographicDemand(
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<ApiSuccessResponse<GeographicDemandAnalyticsDto>> {
    const cellSizeDegrees = query.cellSizeDegrees ? Number(query.cellSizeDegrees) : undefined;
    const data = await this.analyticsService.getGeographicDemand(
      toAnalyticsRange(query),
      cellSizeDegrees,
    );
    return { success: true, data };
  }
}
