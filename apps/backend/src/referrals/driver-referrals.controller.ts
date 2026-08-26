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
 * A driver's own referral code — the same scheme customers use, paid into the
 * driver's wallet.
 *
 * Founder decision, 2026-08-26: drivers recruited from other apps market
 * DrippleX to passengers. A customer who registers with a driver's code earns
 * that driver ₦350 of wallet cash, released on the customer's first completed
 * ride — the same anti-fraud rule the customer scheme already uses, because
 * paying on signup alone would make self-registration free money.
 *
 * This is NOT the Driver Growth Campaign (`/driver/referral-campaign`), which
 * is a separate monthly promo with tiers, thresholds and admin approval. The
 * two coexist deliberately and are not merged: one is a standing scheme, the
 * other a campaign you choose to run.
 *
 * A separate controller rather than granting drivers the customer permission,
 * so a driver is never issued a code the payout would file as a customer's —
 * `ownerType` is fixed when the code is created and decides which wallet the
 * money lands in.
 */
@Controller('driver/referrals')
export class DriverReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  @RequirePermissions(REFERRAL_PERMISSIONS.DRIVER_USE)
  public async getMyReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralDto>> {
    const data = await this.referralsService.getOrCreateMyCode(
      user.id,
      ReferralOwnerType.DRIVER,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('stats')
  @RequirePermissions(REFERRAL_PERMISSIONS.DRIVER_USE)
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
