import { Controller, Get, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { REFERRAL_PERMISSIONS } from './referral.constants';
import { ReferralsService } from './referrals.service';

import type { ReferralDto, ReferralStatsDto } from './referral.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('customer/referrals')
export class CustomerReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  @RequirePermissions(REFERRAL_PERMISSIONS.CUSTOMER_USE)
  public async getMyReferral(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralDto>> {
    const data = await this.referralsService.getOrCreateMyCode(
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('stats')
  @RequirePermissions(REFERRAL_PERMISSIONS.CUSTOMER_USE)
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
