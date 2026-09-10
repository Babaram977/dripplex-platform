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
 * A rider's own referral code — the same standing scheme customers and drivers
 * already have, paid into the rider's own wallet.
 *
 * Riders were the one earning persona without it. They meet customers on every
 * delivery and were marketing DrippleX with no way to be credited for it, while
 * a driver doing the identical thing earned ₦350.
 *
 * Released on the referred customer's first completed ride, not on signup —
 * the same anti-fraud rule the customer and driver schemes use, because paying
 * on registration alone makes self-signup free money.
 *
 * A separate controller and permission rather than reusing the driver's, for
 * the reason that split exists at all: `ownerType` is fixed when the code is
 * created and decides which wallet the reward lands in, so a rider issued a
 * code under the driver permission would have their ₦350 filed as a driver's.
 */
@Controller('rider/referrals')
export class RiderReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  @RequirePermissions(REFERRAL_PERMISSIONS.RIDER_USE)
  public async getMyReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralDto>> {
    const data = await this.referralsService.getOrCreateMyCode(
      user.id,
      ReferralOwnerType.RIDER,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('stats')
  @RequirePermissions(REFERRAL_PERMISSIONS.RIDER_USE)
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
