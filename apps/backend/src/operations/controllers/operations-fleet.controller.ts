import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OperationsEligibilityService } from '../operations-eligibility.service';
import { OperationsFleetService } from '../operations-fleet.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DispatchEligibilityDto, OperationsFleetSnapshotDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 1 — Live Fleet Map / driver list, for
 * `operations-console` only. Read-only. */
@Controller('operations/fleet')
@RequirePermissions(OPERATIONS_PERMISSIONS.LIVE_READ)
export class OperationsFleetController {
  constructor(
    private readonly fleetService: OperationsFleetService,
    private readonly eligibilityService: OperationsEligibilityService,
  ) {}

  @Get()
  public async getSnapshot(): Promise<ApiSuccessResponse<OperationsFleetSnapshotDto>> {
    const data = await this.fleetService.getFleetSnapshot();
    return { success: true, data };
  }

  /**
   * Why this driver is, or is not, being offered work — every gate dispatch
   * applies, named, with the vehicle on file.
   *
   * Read-only and diagnostic. It changes nothing; it only makes visible what
   * was already deciding.
   */
  @Get('drivers/:id/eligibility')
  public async getDriverEligibility(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<DispatchEligibilityDto>> {
    const data = await this.eligibilityService.getDriverEligibility(id);
    return { success: true, data };
  }

  /** The same question for a delivery rider, whose gates differ. */
  @Get('riders/:id/eligibility')
  public async getRiderEligibility(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<DispatchEligibilityDto>> {
    const data = await this.eligibilityService.getRiderEligibility(id);
    return { success: true, data };
  }
}
