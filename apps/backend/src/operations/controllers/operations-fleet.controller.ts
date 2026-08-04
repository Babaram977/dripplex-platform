import { Controller, Get } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OperationsFleetService } from '../operations-fleet.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { OperationsFleetSnapshotDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 1 — Live Fleet Map / driver list, for
 * `operations-console` only. Read-only. */
@Controller('operations/fleet')
@RequirePermissions(OPERATIONS_PERMISSIONS.LIVE_READ)
export class OperationsFleetController {
  constructor(private readonly fleetService: OperationsFleetService) {}

  @Get()
  public async getSnapshot(): Promise<ApiSuccessResponse<OperationsFleetSnapshotDto>> {
    const data = await this.fleetService.getFleetSnapshot();
    return { success: true, data };
  }
}
