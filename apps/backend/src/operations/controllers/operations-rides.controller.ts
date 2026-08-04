import { Controller, Get } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OperationsRideQueueService } from '../operations-ride-queue.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { OperationsRideQueueDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 1 — live ride queue (unassigned requests through
 * in-progress trips), for `operations-console` only. Read-only; reads
 * `Ride` directly, `apps/backend/src/rides/` files are never touched. */
@Controller('operations/rides')
@RequirePermissions(OPERATIONS_PERMISSIONS.LIVE_READ)
export class OperationsRidesController {
  constructor(private readonly rideQueueService: OperationsRideQueueService) {}

  @Get()
  public async getQueue(): Promise<ApiSuccessResponse<OperationsRideQueueDto>> {
    const data = await this.rideQueueService.getRideQueue();
    return { success: true, data };
  }
}
