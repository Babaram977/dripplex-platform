import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { LoyaltyHistoryQueryDto, RedeemRewardDto } from './dto/loyalty.dto';
import {
  LoyaltyRewardsService,
  type LoyaltyRewardDto,
  type LoyaltyRewardRedemptionDto,
} from './loyalty-rewards.service';
import { LOYALTY_PERMISSIONS } from './loyalty.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-LOYALTY-004 — what DX Points can be turned into.
 *
 * Points buy *entitlements*, never cash: a coupon, a free delivery, a gift. The
 * catalogue's thresholds — 10,000, 25,000, 50,000 to open with — are rows
 * Operations maintains, so a threshold is never a number baked into the app,
 * and 10,000 DX Points is never ₦10,000.
 */
@Controller('customer/loyalty/rewards')
export class CustomerLoyaltyRewardsController {
  constructor(private readonly rewards: LoyaltyRewardsService) {}

  /** Every live reward, with what this holder can afford and what they lack. */
  @Get()
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_READ)
  public async catalogue(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<LoyaltyRewardDto[]>> {
    return { success: true, data: await this.rewards.catalogueFor(user.id) };
  }

  @Get('redemptions')
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_READ)
  public async redemptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LoyaltyHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<LoyaltyRewardRedemptionDto>>> {
    const data = await this.rewards.listForUser(user.id, query.page, query.pageSize);
    return { success: true, data };
  }

  /**
   * Spend points on a reward.
   *
   * The caller supplies an idempotency key. Two taps on a slow connection are
   * one redemption — a replay returns the redemption that already happened
   * rather than charging the points again.
   */
  @Post(':rewardId/redeem')
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_REDEEM)
  public async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rewardId', ParseUUIDPipe) rewardId: string,
    @Body() dto: RedeemRewardDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<LoyaltyRewardRedemptionDto>> {
    const data = await this.rewards.redeem(user.id, rewardId, dto.idempotencyKey, {
      userId: user.id,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
    });
    return { success: true, data };
  }
}
