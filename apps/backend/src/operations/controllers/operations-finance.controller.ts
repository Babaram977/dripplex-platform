import { Controller, Get, Param, Query } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  ListPayoutQueueQueryDto,
  ListReferralPerformersQueryDto,
  ReferralPersonaParamDto,
} from '../dto/operations-finance.dto';
import {
  OperationsPayoutsService,
  type PayoutQueueSummary,
  type PayoutRequestDto,
} from '../operations-payouts.service';
import {
  OperationsReferralsService,
  type ReferralOverviewDto,
  type ReferralPerformerDto,
} from '../operations-referrals.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';

/**
 * DPX-OPS — money out, and where it came from.
 *
 * Read-only throughout. Approving a payout stays on the existing withdrawal and
 * fleet-settlement endpoints, which carry their own grants, so an operator can
 * be given the queue without being given the ability to pay anybody — and every
 * row says which endpoint actions it.
 */
@Controller('operations/finance')
@RequirePermissions(OPERATIONS_PERMISSIONS.FINANCE_READ)
export class OperationsFinanceController {
  constructor(
    private readonly payouts: OperationsPayoutsService,
    private readonly referrals: OperationsReferralsService,
  ) {}

  /** Every partner asking DrippleX for money, whichever queue they asked in. */
  @Get('payout-requests')
  public async listPayoutRequests(
    @Query() query: ListPayoutQueueQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<PayoutRequestDto>>> {
    const data = await this.payouts.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.requesterType !== undefined ? { requesterType: query.requesterType } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    });
    return { success: true, data };
  }

  /** What is outstanding, and who is waiting for it. */
  @Get('payout-requests/summary')
  public async payoutSummary(): Promise<ApiSuccessResponse<PayoutQueueSummary>> {
    return { success: true, data: await this.payouts.summary() };
  }

  /** Referral performance, one persona at a time. */
  @Get('referrals')
  public async referralOverview(): Promise<ApiSuccessResponse<ReferralOverviewDto>> {
    return { success: true, data: await this.referrals.overview() };
  }

  /** Who is actually referring, within one persona. */
  @Get('referrals/:persona/performers')
  public async referralPerformers(
    @Param() params: ReferralPersonaParamDto,
    @Query() query: ListReferralPerformersQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<ReferralPerformerDto>>> {
    const data = await this.referrals.performers(params.persona, query.page, query.pageSize);
    return { success: true, data };
  }
}
