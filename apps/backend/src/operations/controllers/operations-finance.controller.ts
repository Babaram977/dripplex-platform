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
  type ReferralReviewItemDto,
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

  /**
   * Referrals that qualified but are waiting on a person.
   *
   * A flagged referral is held however long the hold was — a flag is not
   * released by a timer — so without somebody working this queue the referrer
   * is never paid and nobody ever decided not to pay them. Every row carries
   * the endpoint that actions it, because this controller reads and the
   * decision moves money.
   */
  @Get('referrals/review-queue')
  public async referralReviewQueue(
    @Query() query: ListReferralPerformersQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<ReferralReviewItemDto>>> {
    const data = await this.referrals.reviewQueue(query.page, query.pageSize);
    return { success: true, data };
  }

  /** What DrippleX pays per kind of referee. Changing it is an admin grant. */
  @Get('referrals/programmes')
  public async referralProgrammes(): Promise<
    ApiSuccessResponse<Awaited<ReturnType<OperationsReferralsService['programmes']>>>
  > {
    return { success: true, data: await this.referrals.programmes() };
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
