import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { MerchantModuleEnabledGuard } from '../../merchants/guards/merchant-module-enabled.guard';
import { WALLET_PERMISSIONS } from '../../wallet/wallet.constants';
import { ListSettlementsQueryDto } from '../dto/list-settlements-query.dto';
import { MerchantSettlementService } from '../merchant-settlement.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  MerchantCommissionTermsDto,
  OrderSettlementDto,
  PaginatedResult,
} from '@dripplex/types';

/**
 * DPX-MERCHANT-007 — merchant-facing settlement transparency for the
 * Wallet & Bank screen. Read-only; gated by the same `merchant:wallet:read`
 * permission the merchant role is already granted for `GET /merchant/wallet`
 * — settlement history is wallet-domain data from the merchant's
 * perspective, not order-management data.
 */
@Controller('merchant/settlements')
@RequirePermissions(WALLET_PERMISSIONS.MERCHANT_READ)
@UseGuards(MerchantModuleEnabledGuard)
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

  /**
   * The rate this merchant is charged, so their app can show it instead of a
   * number compiled into the client.
   *
   * The super-app printed "Commission 10%" as static text. Ops can change the
   * standing rate without a redeploy and a campaign can target named merchants,
   * so that text was a claim the platform had stopped guaranteeing.
   */
  @Get('commission')
  public async commission(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<MerchantCommissionTermsDto>> {
    return { success: true, data: await this.settlementService.getCommissionTerms(user.id) };
  }
}
