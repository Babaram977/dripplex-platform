import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ListOperationsQueueQueryDto } from '../dto/list-operations-queue-query.dto';
import { OperationsCasesService, type OperationsQueueFilter } from '../operations-cases.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { IncidentQueueDto, SosQueueDto, SupportQueueDto } from '@dripplex/types';

/** `dateTo` on the query DTO is an ISO date string — when it's a bare
 * calendar date (no time component), treat it as the end of that day so
 * "show me today" doesn't exclude everything created after midnight.
 * `new Date('YYYY-MM-DD')` parses as UTC midnight, so a same-day
 * `dateFrom`/`dateTo` pair needs the `dateTo` side pushed to
 * 23:59:59.999 to be inclusive. */
function toQueueFilter(query: ListOperationsQueueQueryDto): OperationsQueueFilter {
  const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
  const dateToIsBareDate = query.dateTo !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo);
  if (dateTo && dateToIsBareDate) {
    dateTo.setUTCHours(23, 59, 59, 999);
  }

  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.priority !== undefined ? { priority: query.priority } : {}),
    ...(query.assignedToId !== undefined ? { assignedToId: query.assignedToId } : {}),
    ...(query.driverId !== undefined ? { driverId: query.driverId } : {}),
    ...(query.dateFrom !== undefined ? { dateFrom: new Date(query.dateFrom) } : {}),
    ...(dateTo !== undefined ? { dateTo } : {}),
    ...(query.rideId !== undefined ? { rideId: query.rideId } : {}),
    ...(query.vehicleId !== undefined ? { vehicleId: query.vehicleId } : {}),
  };
}

/** DPX-OPS-001 Slice 2 — the three Operations Work Queues. */
@Controller('operations/queues')
@RequirePermissions(OPERATIONS_PERMISSIONS.QUEUES_READ)
export class OperationsQueuesController {
  constructor(private readonly casesService: OperationsCasesService) {}

  @Get('sos')
  public async getSosQueue(
    @Query() query: ListOperationsQueueQueryDto,
  ): Promise<ApiSuccessResponse<SosQueueDto>> {
    const data = await this.casesService.getSosQueue(toQueueFilter(query));
    return { success: true, data };
  }

  @Get('incidents')
  public async getIncidentQueue(
    @Query() query: ListOperationsQueueQueryDto,
  ): Promise<ApiSuccessResponse<IncidentQueueDto>> {
    const data = await this.casesService.getIncidentQueue(toQueueFilter(query));
    return { success: true, data };
  }

  @Get('support')
  public async getSupportQueue(
    @Query() query: ListOperationsQueueQueryDto,
  ): Promise<ApiSuccessResponse<SupportQueueDto>> {
    const data = await this.casesService.getSupportQueue(toQueueFilter(query));
    return { success: true, data };
  }
}
