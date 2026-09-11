import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CommissionOwnerType, WalletOwnerType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { MerchantModuleEnabledGuard } from '../merchants/guards/merchant-module-enabled.guard';

import { WalletHistoryQueryDto } from './dto/wallet.dto';
import {
  CreateWithdrawalRequestDto,
  SetWalletPinDto,
  SettleCommissionDto,
  WithdrawalHistoryQueryDto,
} from './dto/withdrawal.dto';
import { WalletPinService } from './wallet-pin.service';
import { WALLET_DEFAULT_CURRENCY, WALLET_PERMISSIONS } from './wallet.constants';
import { WalletService, type WalletDto, type WalletLedgerEntryDto } from './wallet.service';
import {
  WithdrawalService,
  type WithdrawalRequestDto,
  PayoutResultDto,
} from './withdrawal.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('merchant/wallet')
@UseGuards(MerchantModuleEnabledGuard)
export class MerchantWalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly withdrawalService: WithdrawalService,
    private readonly walletPinService: WalletPinService,
  ) {}

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.MERCHANT_READ)
  public async getWallet(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.getWallet(WalletOwnerType.MERCHANT, user.id);
    return { success: true, data };
  }

  @Get('transactions')
  @RequirePermissions(WALLET_PERMISSIONS.MERCHANT_READ)
  public async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WalletLedgerEntryDto>>> {
    const data = await this.walletService.listHistory(
      WalletOwnerType.MERCHANT,
      user.id,
      query.page,
      query.pageSize,
    );
    return { success: true, data };
  }

  /**
   * A merchant asking to be paid out of their own wallet balance.
   *
   * Automatic settlement is unchanged and remains the main way a merchant is
   * paid: when an online order completes, the net amount is transferred to
   * their verified account without anybody asking for it. This is the manual
   * route alongside it, for the balance that automatic settlement does not
   * move — and it is the same request every other persona makes, into the same
   * Operations queue, with the same approval.
   *
   * The destination is the merchant's existing verified settlement account, not
   * a second one linked for payouts: two records of the same bank is how the
   * one money goes to ends up being the one nobody checked.
   */
  @Post('payouts')
  @RequirePermissions(WALLET_PERMISSIONS.MERCHANT_WITHDRAW)
  public async requestPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalRequestDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PayoutResultDto>> {
    const data = await this.withdrawalService.create(
      user.id,
      WalletOwnerType.MERCHANT,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  /**
   * DPX-LOYALTY-002 — pay down what this merchant owes DrippleX, out of their
   * wallet balance.
   *
   * Merchant commission is normally deducted at settlement, so nothing is ever
   * taken from a merchant's balance automatically. This is the merchant
   * choosing to, which is what makes the value they earn by redeeming DX points
   * useful for something other than a payout. Never takes more than is owed.
   */
  @Post('commission-settlements')
  @RequirePermissions(WALLET_PERMISSIONS.MERCHANT_WITHDRAW)
  public async settleCommission(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SettleCommissionDto,
    @Req() request: Request,
  ): Promise<
    ApiSuccessResponse<{ settled: number; outstandingBalance: number; wallet: WalletDto }>
  > {
    const data = await this.withdrawalService.settleCommissionFromWallet(
      user.id,
      WalletOwnerType.MERCHANT,
      CommissionOwnerType.MERCHANT,
      dto.amount,
      WALLET_DEFAULT_CURRENCY,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('payouts')
  @RequirePermissions(WALLET_PERMISSIONS.MERCHANT_READ)
  public async listPayouts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WithdrawalHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WithdrawalRequestDto>>> {
    const data = await this.withdrawalService.listForUser(user.id, query.page, query.pageSize);
    return { success: true, data };
  }

  /** Required before money can leave the wallet, exactly as for a driver. */
  @Post('pin')
  @RequirePermissions(WALLET_PERMISSIONS.MERCHANT_WITHDRAW)
  public async setPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetWalletPinDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ set: true }>> {
    await this.walletPinService.set(user.id, dto.pin, this.auditContext(request, user.id));
    return { success: true, data: { set: true } };
  }

  @Get('pin')
  @RequirePermissions(WALLET_PERMISSIONS.MERCHANT_READ)
  public async hasPin(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<{ set: boolean }>> {
    const set = await this.walletPinService.hasPin(user.id);
    return { success: true, data: { set } };
  }

  private auditContext(
    request: Request,
    userId: string,
  ): { userId: string; ipAddress?: string; userAgent?: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;
    const userAgent = request.headers['user-agent'];
    return {
      userId,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
    };
  }
}
