import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { WalletOwnerType } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ValidationDomainException } from '../../common/exceptions/domain.exception';
import { CreateWithdrawalRequestDto, WithdrawalHistoryQueryDto } from '../dto/withdrawal.dto';
import { WALLET_PERMISSIONS } from '../wallet.constants';
import { WithdrawalService, type WithdrawalRequestDto } from '../withdrawal.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/wallet/withdrawals')
export class CustomerWithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post()
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_WITHDRAW)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalRequestDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WithdrawalRequestDto>> {
    const result = await this.withdrawalService.create(
      user.id,
      WalletOwnerType.CUSTOMER,
      dto,
      this.auditContext(request, user.id),
    );
    // A customer carries no commission account, so nothing can be netted off
    // and a payout is always produced. If that ever stops being true this
    // should fail loudly rather than return an empty success.
    if (result.payout === null) {
      throw new ValidationDomainException('Withdrawal could not be created');
    }
    return { success: true, data: result.payout };
  }

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WithdrawalHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WithdrawalRequestDto>>> {
    const data = await this.withdrawalService.listForUser(
      user.id,
      query.page,
      query.pageSize,
      query.status,
    );
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<WithdrawalRequestDto>> {
    const data = await this.withdrawalService.getForUser(user.id, id);
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
