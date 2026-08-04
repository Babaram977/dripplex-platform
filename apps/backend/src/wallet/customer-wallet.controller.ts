import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { WalletOwnerType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  LookupRecipientQueryDto,
  TransferWalletDto,
  WalletHistoryQueryDto,
} from './dto/wallet.dto';
import { WalletRecipientsService, type WalletRecipientDto } from './wallet-recipients.service';
import { WALLET_PERMISSIONS } from './wallet.constants';
import { WalletService, type WalletDto, type WalletLedgerEntryDto } from './wallet.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/wallet')
export class CustomerWalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletRecipientsService: WalletRecipientsService,
  ) {}

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async getWallet(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.getWallet(WalletOwnerType.CUSTOMER, user.id);
    return { success: true, data };
  }

  @Get('transactions')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WalletLedgerEntryDto>>> {
    const data = await this.walletService.listHistory(
      WalletOwnerType.CUSTOMER,
      user.id,
      query.page,
      query.pageSize,
      undefined,
      query.type,
    );
    return { success: true, data };
  }

  @Get('transfer/recipients')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_TRANSFER)
  public async lookupRecipient(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LookupRecipientQueryDto,
  ): Promise<ApiSuccessResponse<WalletRecipientDto[]>> {
    const recipient = await this.walletRecipientsService.findByPhone(user.id, query.phone);
    return { success: true, data: recipient ? [recipient] : [] };
  }

  @Get('transfer/recipients/recent')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_TRANSFER)
  public async recentRecipients(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WalletRecipientDto[]>> {
    const data = await this.walletRecipientsService.listRecent(user.id);
    return { success: true, data };
  }

  @Post('transfer')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_TRANSFER)
  public async transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferWalletDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ source: WalletDto; destination: WalletDto }>> {
    const data = await this.walletService.transfer({
      fromOwnerType: WalletOwnerType.CUSTOMER,
      fromOwnerId: user.id,
      toOwnerType: WalletOwnerType.CUSTOMER,
      toOwnerId: dto.toUserId,
      amount: dto.amount,
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      context: this.auditContext(request, user.id),
    });
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
