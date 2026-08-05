import { Controller, Get, Param } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OperationsDispatchSupportService } from '../operations-dispatch-support.service';
import { OperationsRideDetailService } from '../operations-ride-detail.service';
import { OperationsRideQueueService } from '../operations-ride-queue.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  DispatchSupportDto,
  OperationsRideAllocationDto,
  OperationsRideDetailDto,
  OperationsRideQueueDto,
  OperationsRideTrackingDto,
} from '@dripplex/types';

/** DPX-OPS-001 Slice 1 (queue) + Slice 3 (detail/allocation/tracking/
 * dispatch-candidates) — live ride queue and Dispatch Management, for
 * `operations-console` only. Read-only throughout; reads `Ride`/
 * `RideOffer`/`RideTracking`/`DriverAvailability` directly,
 * `apps/backend/src/rides/` files are never touched. Same
 * `operations:live:read` permission as Slice 1 gates all of it — per the
 * Slice 3 reality audit, no new permission is warranted for a read-only
 * extension of an already-read-gated resource. */
@Controller('operations/rides')
@RequirePermissions(OPERATIONS_PERMISSIONS.LIVE_READ)
export class OperationsRidesController {
  constructor(
    private readonly rideQueueService: OperationsRideQueueService,
    private readonly rideDetailService: OperationsRideDetailService,
    private readonly dispatchSupportService: OperationsDispatchSupportService,
  ) {}

  @Get()
  public async getQueue(): Promise<ApiSuccessResponse<OperationsRideQueueDto>> {
    const data = await this.rideQueueService.getRideQueue();
    return { success: true, data };
  }

  @Get(':id')
  public async getRideDetail(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<OperationsRideDetailDto>> {
    const data = await this.rideDetailService.getRideDetail(id);
    return { success: true, data };
  }

  @Get(':id/allocation')
  public async getRideAllocation(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<OperationsRideAllocationDto>> {
    const data = await this.rideDetailService.getRideAllocation(id);
    return { success: true, data };
  }

  @Get(':id/tracking')
  public async getTripTracking(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<OperationsRideTrackingDto>> {
    const data = await this.dispatchSupportService.getTripTracking(id);
    return { success: true, data };
  }

  @Get(':id/dispatch-candidates')
  public async getDispatchCandidates(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<DispatchSupportDto>> {
    const data = await this.dispatchSupportService.getDispatchCandidates(id);
    return { success: true, data };
  }
}
