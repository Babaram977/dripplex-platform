import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { WALLET_PERMISSIONS } from '../../wallet/wallet.constants';
import { ListSettlementsQueryDto } from '../dto/list-settlements-query.dto';
import { MerchantSettlementService } from '../merchant-settlement.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { OrderSettlementDto, PaginatedResult } from '@dripplex/types';

/**
 * DPX-MERCHANT-007 — merchant-facing settlement transparency for the
 * Wallet & Bank screen. Read-only; gated by the same `merchant:wallet:read`
 * permission the merchant role is already granted for `GET /merchant/wallet`
 * — settlement history is wallet-domain data from the merchant's
 * perspective, not order-management data.
 */
@Controller('merchant/settlements')
@RequirePermissions(WALLET_PERMISSIONS.MERCHANT_READ)
export class MerchantSettlementsController {
  constructor(private readonly settlementService: MerchantSettlementService) {}

  @Get()
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSettlementsQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<OrderSettlementDto>>> {
    const data = await this.settlementService.listSettlements(user.id, query.page, query.pageSize);
    return { success: true, data };
  }
}
