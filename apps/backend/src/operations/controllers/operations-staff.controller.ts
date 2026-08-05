import { Controller, Get } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { OperationsCasesService } from '../operations-cases.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { OperationsStaffMemberDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 2 — the assignable-operator/supervisor pool for the
 * "Assign operator" control. Same read permission as the queues — anyone
 * who can see a queue can see who it could be assigned to. */
@Controller('operations/staff')
@RequirePermissions(OPERATIONS_PERMISSIONS.QUEUES_READ)
export class OperationsStaffController {
  constructor(private readonly casesService: OperationsCasesService) {}

  @Get()
  public async list(): Promise<ApiSuccessResponse<OperationsStaffMemberDto[]>> {
    const data = await this.casesService.getAssignableStaff();
    return { success: true, data };
  }
}
