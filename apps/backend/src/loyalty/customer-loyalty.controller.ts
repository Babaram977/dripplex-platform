import { Body, Controller, Delete, Get, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { IssueRedemptionCodeDto, LoyaltyHistoryQueryDto, RedeemPointsDto } from './dto/loyalty.dto';
import {
  LoyaltyStoreRedemptionService,
  type IssuedRedemptionCode,
} from './loyalty-store-redemption.service';
import { LOYALTY_PERMISSIONS } from './loyalty.constants';
import {
  LoyaltyService,
  type LoyaltyAccountOverview,
  type LoyaltyLedgerEntryDto,
  type LoyaltyRedemptionResult,
} from './loyalty.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/loyalty')
export class CustomerLoyaltyController {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly storeRedemptions: LoyaltyStoreRedemptionService,
  ) {}

  @Get()
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_READ)
  public async getLoyalty(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<LoyaltyAccountOverview>> {
    const data = await this.loyaltyService.getCustomerOverview(user.id);
    return { success: true, data };
  }

  @Get('history')
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_READ)
  public async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LoyaltyHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<LoyaltyLedgerEntryDto>>> {
    const data = await this.loyaltyService.listHistory(user.id, query.page, query.pageSize);
    return { success: true, data };
  }

  /**
   * Redeems points into the customer's own wallet at 200 points to the naira.
   * The response carries the credited amount and the wallet's new balance, so
   * the app can show what the redemption was actually worth rather than
   * inferring it.
   */
  @Post('redeem')
  @RequirePermissions(LOYALTY_PERMISSIONS.CUSTOMER_REDEEM)
  public async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemPointsDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<LoyaltyRedemptionResult>> {
    const data = await this.loyaltyService.redeemPoints(
      user.id,
      dto.points,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  /**
   * DPX-LOYALTY-002 — a one-time code authorising a merchant to take this many
   * points at their counter.
   *
   * The code comes back once, here, and is never stored in plaintext. Any
   * outstanding code is cancelled, so a holder can only ever have one live
   * authorisation against their balance.
   *
   * On its own permission rather than the redeem-to-wallet one: drivers and
   * riders hold DX points too and the founder's decision was explicitly that
   * all three personas can spend theirs in a shop.
   */
  @Post('redemption-code')
  @RequirePermissions(LOYALTY_PERMISSIONS.REDEMPTION_CODE_CREATE)
  public async issueRedemptionCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: IssueRedemptionCodeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<IssuedRedemptionCode>> {
    const data = await this.storeRedemptions.issueCode(
      user.id,
      dto.points,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  /** Revokes the holder's outstanding counter code. */
  @Delete('redemption-code')
  @RequirePermissions(LOYALTY_PERMISSIONS.REDEMPTION_CODE_CREATE)
  public async cancelRedemptionCode(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ cancelled: number }>> {
    const data = await this.storeRedemptions.cancelOutstanding(
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { userId?: string; ipAddress?: string; userAgent?: string } {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
