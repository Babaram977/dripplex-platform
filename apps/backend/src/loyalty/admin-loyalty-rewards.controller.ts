import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { AdvanceFulfilmentDto, LoyaltyHistoryQueryDto } from './dto/loyalty.dto';
import { LoyaltyRewardsService, type LoyaltyRewardRedemptionDto } from './loyalty-rewards.service';
import { LOYALTY_PERMISSIONS } from './loyalty.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-LOYALTY-004 — the rewards Operations still has to hand over.
 *
 * A physical gift is not finished because the points came off the holder's
 * balance. Deducting and forgetting is how somebody ends up having paid 50,000
 * DX Points for something nobody ever posted, so a gift enters fulfilment and
 * stays on this list until it has actually reached them.
 */
@Controller('admin/loyalty/rewards')
@RequirePermissions(LOYALTY_PERMISSIONS.ADMIN_MANAGE)
export class AdminLoyaltyRewardsController {
  constructor(private readonly rewards: LoyaltyRewardsService) {}

  /** Everything redeemed and not yet delivered or collected. */
  @Get('fulfilment')
  public async outstanding(
    @Query() query: LoyaltyHistoryQueryDto,
  ): Promise<
    ApiSuccessResponse<PaginatedResult<LoyaltyRewardRedemptionDto & { holderName: string }>>
  > {
    const data = await this.rewards.listOutstandingFulfilment(query.page, query.pageSize);
    return { success: true, data };
  }

  @Patch('fulfilment/:redemptionId')
  public async advance(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('redemptionId', ParseUUIDPipe) redemptionId: string,
    @Body() dto: AdvanceFulfilmentDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<LoyaltyRewardRedemptionDto>> {
    const data = await this.rewards.advanceFulfilment(
      redemptionId,
      dto.status,
      dto.note,
      admin.id,
      {
        userId: admin.id,
        ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      },
    );
    return { success: true, data };
  }
}
