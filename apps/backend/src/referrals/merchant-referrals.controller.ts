import { Controller, Get, Req } from '@nestjs/common';
import { ReferralOwnerType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { REFERRAL_PERMISSIONS } from './referral.constants';
import { ReferralsService } from './referrals.service';

import type { ReferralDto, ReferralStatsDto } from './referral.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

/**
 * DPX-REFERRAL-002 — a merchant's own referral code, paid into the merchant
 * wallet their portal already shows.
 *
 * Merchants were one of two earning personas with no way to be credited for
 * bringing DrippleX a customer, while a driver or rider doing the identical
 * thing earned ₦350. A shop telling the people at its counter to sign up is
 * the most natural referral on the platform — and now that DX points are
 * spendable in store, a merchant has a direct reason to want those customers
 * on DrippleX.
 *
 * Nothing else about the scheme changes. The code is redeemed at a new
 * customer's registration and released on that customer's first completed
 * ride, not on signup, which is the locked anti-fraud rule: paying on
 * registration alone makes self-signup free money.
 *
 * A separate controller and permission rather than reusing another persona's,
 * for the reason that split exists at all: `ownerType` is fixed when the code
 * is created and decides which wallet the reward lands in.
 */
@Controller('merchant/referrals')
export class MerchantReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  @RequirePermissions(REFERRAL_PERMISSIONS.MERCHANT_USE)
  public async getMyReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralDto>> {
    const data = await this.referralsService.getOrCreateMyCode(
      user.id,
      ReferralOwnerType.MERCHANT,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('stats')
  @RequirePermissions(REFERRAL_PERMISSIONS.MERCHANT_USE)
  public async getStats(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<ReferralStatsDto>> {
    const data = await this.referralsService.getStats(user.id);
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
