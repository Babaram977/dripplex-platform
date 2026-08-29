import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ListOperationsHistoryQueryDto } from '../dto/list-operations-history-query.dto';
import { OperationsHistoryService } from '../operations-history.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  DeliveryHistoryDto,
  OrderHistoryDto,
  RideHistoryDto,
  UtilityPurchaseHistoryDto,
} from '@dripplex/types';

/**
 * DPX-OPS — completed-work history across all four things DrippleX does.
 *
 * Founder requirement, 2026-08-29: "Those information are needed for audit
 * purpose and dispute incase and security quaring." Operations could see the
 * live queues and nothing else, so its Completed and Cancelled tabs matched
 * nothing and it appeared that no records were kept at all.
 *
 * Four endpoints rather than one merged feed. The domains share filters but
 * not fields — a trip has a route and a fare, a utility purchase has a meter
 * number and a provider reference — and flattening them into one row type
 * would drop exactly the details a dispute turns on.
 *
 * Read-only, gated on its own `operations:history:read`.
 */
@Controller('operations/history')
@RequirePermissions(OPERATIONS_PERMISSIONS.HISTORY_READ)
export class OperationsHistoryController {
  constructor(private readonly historyService: OperationsHistoryService) {}

  @Get('rides')
  public async getRideHistory(
    @Query() query: ListOperationsHistoryQueryDto,
  ): Promise<ApiSuccessResponse<RideHistoryDto>> {
    const data = await this.historyService.getRideHistory(query);
    return { success: true, data };
  }

  @Get('deliveries')
  public async getDeliveryHistory(
    @Query() query: ListOperationsHistoryQueryDto,
  ): Promise<ApiSuccessResponse<DeliveryHistoryDto>> {
    const data = await this.historyService.getDeliveryHistory(query);
    return { success: true, data };
  }

  @Get('orders')
  public async getOrderHistory(
    @Query() query: ListOperationsHistoryQueryDto,
  ): Promise<ApiSuccessResponse<OrderHistoryDto>> {
    const data = await this.historyService.getOrderHistory(query);
    return { success: true, data };
  }

  @Get('utilities')
  public async getUtilityPurchaseHistory(
    @Query() query: ListOperationsHistoryQueryDto,
  ): Promise<ApiSuccessResponse<UtilityPurchaseHistoryDto>> {
    const data = await this.historyService.getUtilityPurchaseHistory(query);
    return { success: true, data };
  }
}
