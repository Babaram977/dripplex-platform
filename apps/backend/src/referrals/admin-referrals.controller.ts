import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ReferralRefereeType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  AdminReferralRedemptionsQueryDto,
  ApproveReferralRedemptionDto,
  RejectReferralRedemptionDto,
  ReverseReferralRedemptionDto,
  UpdateReferralProgrammeDto,
} from './dto/referral.dto';
import { ReferralLifecycleService } from './referral-lifecycle.service';
import { REFERRAL_PERMISSIONS } from './referral.constants';
import { ReferralsService } from './referrals.service';

import type { ReferralProgrammeDto } from './referral-lifecycle.service';
import type { ReferralRedemptionDto } from './referral.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/referrals')
export class AdminReferralsController {
  constructor(
    private readonly referralsService: ReferralsService,
    private readonly lifecycle: ReferralLifecycleService,
  ) {}

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

  /** What DrippleX pays per kind of referee, and what has to be true first. */
  @Get('programmes')
  @RequirePermissions(REFERRAL_PERMISSIONS.ADMIN_MANAGE)
  public async listProgrammes(): Promise<ApiSuccessResponse<ReferralProgrammeDto[]>> {
    const data = await this.lifecycle.listProgrammes();
    return { success: true, data };
  }

  @Patch('programmes/:refereeType')
  @RequirePermissions(REFERRAL_PERMISSIONS.ADMIN_MANAGE)
  public async updateProgramme(
    @Param('refereeType') refereeType: ReferralRefereeType,
    @Body() body: UpdateReferralProgrammeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<ReferralProgrammeDto>> {
    const data = await this.lifecycle.updateProgramme(
      refereeType,
      body,
      user.id,
      auditContext(request, user.id),
    );
    return { success: true, data };
  }

  /**
   * Release a referral that qualified but is being held — usually one the
   * shared-device check flagged, where an operator can see it is a household
   * rather than one person twice.
   */
  @Post('redemptions/:id/approve')
  @RequirePermissions(REFERRAL_PERMISSIONS.ADMIN_MANAGE)
  public async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveReferralRedemptionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ status: string }>> {
    const status = await this.lifecycle.approve(
      id,
      body.note ?? null,
      user.id,
      auditContext(request, user.id),
    );
    return { success: true, data: { status } };
  }

  @Post('redemptions/:id/reject')
  @RequirePermissions(REFERRAL_PERMISSIONS.ADMIN_MANAGE)
  public async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectReferralRedemptionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ status: string }>> {
    const status = await this.lifecycle.reject(
      id,
      body.reason,
      body.note ?? null,
      user.id,
      auditContext(request, user.id),
    );
    return { success: true, data: { status } };
  }

  /** Take a paid reward back. Fails rather than overdrawing a wallet that has
   *  already spent it — see `ReferralLifecycleService.reverse`. */
  @Post('redemptions/:id/reverse')
  @RequirePermissions(REFERRAL_PERMISSIONS.ADMIN_MANAGE)
  public async reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReverseReferralRedemptionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ status: string }>> {
    const status = await this.lifecycle.reverse(
      id,
      body.reason,
      user.id,
      auditContext(request, user.id),
    );
    return { success: true, data: { status } };
  }
}

function auditContext(
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
