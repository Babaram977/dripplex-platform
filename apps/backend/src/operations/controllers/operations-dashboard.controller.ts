import { Controller, Get } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OperationsDashboardService } from '../operations-dashboard.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { ActivityFeedDto, OperationsQueueCountersDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 2 — the Live Fleet Map dashboard's queue-counter
 * tiles and Live Activity Feed. Read-only, same permission as the queues
 * themselves. */
@Controller('operations/dashboard')
@RequirePermissions(OPERATIONS_PERMISSIONS.QUEUES_READ)
export class OperationsDashboardController {
  constructor(private readonly dashboardService: OperationsDashboardService) {}

  @Get('counters')
  public async getCounters(): Promise<ApiSuccessResponse<OperationsQueueCountersDto>> {
    const data = await this.dashboardService.getQueueCounters();
    return { success: true, data };
  }

  @Get('activity-feed')
  public async getActivityFeed(): Promise<ApiSuccessResponse<ActivityFeedDto>> {
    const data = await this.dashboardService.getActivityFeed();
    return { success: true, data };
  }
}
