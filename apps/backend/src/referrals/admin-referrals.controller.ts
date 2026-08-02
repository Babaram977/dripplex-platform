import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { AdminReferralRedemptionsQueryDto } from './dto/referral.dto';
import { REFERRAL_PERMISSIONS } from './referral.constants';
import { ReferralsService } from './referrals.service';

import type { ReferralRedemptionDto } from './referral.mapper';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';

@Controller('admin/referrals')
export class AdminReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('redemptions')
  @RequirePermissions(REFERRAL_PERMISSIONS.ADMIN_MANAGE)
  public async listRedemptions(
    @Query() query: AdminReferralRedemptionsQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<ReferralRedemptionDto>>> {
    const data = await this.referralsService.listRedemptions(
      query.status,
      query.page,
      query.pageSize,
    );
    return { success: true, data };
  }
}
