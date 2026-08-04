import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AdminWithdrawalCompleteDto,
  AdminWithdrawalFailDto,
  WithdrawalHistoryQueryDto,
} from '../dto/withdrawal.dto';
import { WALLET_PERMISSIONS } from '../wallet.constants';
import { WithdrawalService, type WithdrawalRequestDto } from '../withdrawal.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

/**
 * Real Phase 1 fulfillment path: no automated payout provider is wired in
 * yet (see docs/WALLET-004-WITHDRAW-DESIGN.md), so completed/failed
 * withdrawals are actioned here by ops until Phase 2's PayoutProvider
 * replaces this with real transfer-API automation.
 */
@Controller('admin/wallet/withdrawals')
export class AdminWithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.ADMIN_WITHDRAWALS_MANAGE)
  public async list(
    @Query() query: WithdrawalHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WithdrawalRequestDto>>> {
    const data = await this.withdrawalService.listForAdmin(
      query.page,
      query.pageSize,
      query.status,
    );
    return { success: true, data };
  }

  @Post(':id/complete')
  @RequirePermissions(WALLET_PERMISSIONS.ADMIN_WITHDRAWALS_MANAGE)
  public async complete(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminWithdrawalCompleteDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WithdrawalRequestDto>> {
    const data = await this.withdrawalService.adminComplete(
      admin.id,
      id,
      dto.adminNote,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post(':id/fail')
  @RequirePermissions(WALLET_PERMISSIONS.ADMIN_WITHDRAWALS_MANAGE)
  public async fail(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminWithdrawalFailDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WithdrawalRequestDto>> {
    const data = await this.withdrawalService.adminFail(
      admin.id,
      id,
      dto.reason,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId: string,
  ): { userId: string; ipAddress?: string; userAgent?: string } {
    return {
      userId,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
