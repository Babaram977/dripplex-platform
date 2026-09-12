import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AddCampaignPromoterDto } from '../dto/operations-promotions.dto';
import { OperationsPromotionsService } from '../operations-promotions.service';
import { OPERATIONS_PERMISSIONS } from '../operations.constants';

import type { AuditContext } from '../../audit/audit.service';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { Request } from 'express';

/**
 * DPX-PROMO-REF-001 — the Operations Promotions tab.
 *
 * Authorization is server-side and per-route, never a client-side hide. Reading
 * performance and managing promoters are separate permissions because they are
 * different acts: one looks at numbers, the other issues a private token that
 * earns real money.
 *
 * There is no promoter-facing route on this controller and no campaign-scoped
 * route that a promoter could reach. A promoter's own view of their campaign
 * is a separate surface and must never return another promoter's token.
 */
@ApiTags('Operations')
@Controller('operations/promotions')
export class OperationsPromotionsController {
  constructor(private readonly promotions: OperationsPromotionsService) {}

  @Get('campaigns')
  @RequirePermissions(OPERATIONS_PERMISSIONS.PROMOTIONS_READ)
  @ApiOperation({ summary: 'Referral campaigns and their performance' })
  public async listCampaigns(): Promise<
    ApiSuccessResponse<Awaited<ReturnType<OperationsPromotionsService['listCampaigns']>>>
  > {
    return { success: true, data: await this.promotions.listCampaigns() };
  }

  @Get('campaigns/:promotionId')
  @RequirePermissions(OPERATIONS_PERMISSIONS.PROMOTIONS_READ)
  @ApiOperation({ summary: 'One campaign, its promoters and their private tokens' })
  @ApiResponse({ status: 404, description: 'No such campaign' })
  public async getCampaign(
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
  ): Promise<ApiSuccessResponse<Awaited<ReturnType<OperationsPromotionsService['getCampaign']>>>> {
    return { success: true, data: await this.promotions.getCampaign(promotionId) };
  }

  /**
   * Enrol a promoter and issue their private campaign token.
   *
   * MANAGE, not READ. This writes money-earning state: it ensures the user's
   * `Referral` row exists, issues a token that attributes acquisitions to them,
   * and fixes the rate they will be paid.
   */
  @Post('campaigns/:promotionId/promoters')
  @RequirePermissions(OPERATIONS_PERMISSIONS.PROMOTIONS_MANAGE)
  @ApiOperation({ summary: 'Add a promoter to a campaign' })
  @ApiResponse({ status: 400, description: 'Reward must be exactly one of cash or DX Points' })
  @ApiResponse({ status: 409, description: 'Already an active promoter on this campaign' })
  public async addPromoter(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('promotionId', ParseUUIDPipe) promotionId: string,
    @Body() dto: AddCampaignPromoterDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<Awaited<ReturnType<OperationsPromotionsService['addPromoter']>>>> {
    const data = await this.promotions.addPromoter(
      promotionId,
      {
        userId: dto.userId,
        participantType: dto.participantType,
        rewardAmountNgn: dto.rewardAmountNgn,
        rewardPoints: dto.rewardPoints,
      },
      operator.id,
      this.auditContext(request, operator.id),
    );
    return { success: true, data };
  }

  /**
   * End a promoter's participation.
   *
   * A deactivation, never a delete: the row, the token and every historical
   * attribution and reward survive, because a removed promoter's past
   * acquisitions still have to be explainable and payable.
   */
  @Delete('promoters/:promoterId')
  @RequirePermissions(OPERATIONS_PERMISSIONS.PROMOTIONS_MANAGE)
  @ApiOperation({ summary: 'Remove a promoter, keeping their history' })
  @ApiResponse({ status: 404, description: 'No such promoter' })
  public async removePromoter(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('promoterId', ParseUUIDPipe) promoterId: string,
    @Req() request: Request,
  ): Promise<
    ApiSuccessResponse<Awaited<ReturnType<OperationsPromotionsService['removePromoter']>>>
  > {
    const data = await this.promotions.removePromoter(
      promoterId,
      operator.id,
      this.auditContext(request, operator.id),
    );
    return { success: true, data };
  }

  /**
   * What the universal acquisition incentive has cost.
   *
   * Read-only, and there is no route to create one. It is a single
   * platform-wide promotion by founder ruling, and an endpoint that could mint
   * a per-campaign 20% would let two of them stack into 40% off.
   */
  @Get('acquisition-incentive')
  @RequirePermissions(OPERATIONS_PERMISSIONS.PROMOTIONS_READ)
  @ApiOperation({ summary: 'Usage of the universal 20% acquisition incentive' })
  public async acquisitionIncentive(): Promise<
    ApiSuccessResponse<
      Awaited<ReturnType<OperationsPromotionsService['acquisitionIncentiveUsage']>>
    >
  > {
    return { success: true, data: await this.promotions.acquisitionIncentiveUsage() };
  }

  /** Who did it, from where — the same shape every Ops mutation records. */
  private auditContext(request: Request, userId?: string): AuditContext {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
