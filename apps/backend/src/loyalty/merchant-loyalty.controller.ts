import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { RedeemStoreCodeDto } from './dto/loyalty.dto';
import {
  LoyaltyStoreRedemptionService,
  type RedemptionCodePreview,
  type StoreRedemptionResult,
} from './loyalty-store-redemption.service';
import { LOYALTY_PERMISSIONS } from './loyalty.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

/**
 * DPX-LOYALTY-002 — taking DX points at a merchant's counter.
 *
 * Both routes are throttled. A code is a bearer authorisation over somebody's
 * points, and an unthrottled preview endpoint is a machine for trying codes
 * until one works. The limits are deliberately generous enough for a busy till
 * and far too tight to search an eight-character space.
 */
@Controller('merchant/loyalty')
export class MerchantLoyaltyController {
  constructor(private readonly redemptions: LoyaltyStoreRedemptionService) {}

  /**
   * What a code is worth, without taking it. The merchant sees the amount and
   * the holder's name before handing over goods.
   */
  @Post('redemptions/preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions(LOYALTY_PERMISSIONS.MERCHANT_REDEEM)
  public async preview(
    @Body() dto: RedeemStoreCodeDto,
  ): Promise<ApiSuccessResponse<RedemptionCodePreview>> {
    return { success: true, data: await this.redemptions.preview(dto.code) };
  }

  /** Takes the points and credits the merchant's DX wallet. */
  @Post('redemptions')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequirePermissions(LOYALTY_PERMISSIONS.MERCHANT_REDEEM)
  public async redeem(
    @CurrentUser() merchant: AuthenticatedUser,
    @Body() dto: RedeemStoreCodeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<StoreRedemptionResult>> {
    const data = await this.redemptions.redeem(merchant.id, dto.code, {
      userId: merchant.id,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    });
    return { success: true, data };
  }
}
