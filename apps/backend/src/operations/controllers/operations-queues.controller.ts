import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ListOperationsQueueQueryDto } from '../dto/list-operations-queue-query.dto';
import { OperationsCasesService } from '../operations-cases.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { IncidentQueueDto, SosQueueDto, SupportQueueDto } from '@dripplex/types';

/** DPX-OPS-001 Slice 2 — the three Operations Work Queues. */
@Controller('operations/queues')
@RequirePermissions(OPERATIONS_PERMISSIONS.QUEUES_READ)
export class OperationsQueuesController {
  constructor(private readonly casesService: OperationsCasesService) {}

  @Get('sos')
  public async getSosQueue(
    @Query() query: ListOperationsQueueQueryDto,
  ): Promise<ApiSuccessResponse<SosQueueDto>> {
    const data = await this.casesService.getSosQueue(query);
    return { success: true, data };
  }

  @Get('incidents')
  public async getIncidentQueue(
    @Query() query: ListOperationsQueueQueryDto,
  ): Promise<ApiSuccessResponse<IncidentQueueDto>> {
    const data = await this.casesService.getIncidentQueue(query);
    return { success: true, data };
  }

  @Get('support')
  public async getSupportQueue(
    @Query() query: ListOperationsQueueQueryDto,
  ): Promise<ApiSuccessResponse<SupportQueueDto>> {
    const data = await this.casesService.getSupportQueue(query);
    return { success: true, data };
  }
}
