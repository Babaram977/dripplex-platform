import { Controller, Get, Query } from '@nestjs/common';
import { WalletOwnerType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { WalletHistoryQueryDto } from './dto/wallet.dto';
import { WALLET_PERMISSIONS } from './wallet.constants';
import { WalletService, type WalletDto, type WalletLedgerEntryDto } from './wallet.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';

@Controller('driver/wallet')
export class DriverWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_READ)
  public async getWallet(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.getWallet(WalletOwnerType.DRIVER, user.id);
    return { success: true, data };
  }

  @Get('transactions')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_READ)
  public async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WalletLedgerEntryDto>>> {
    const data = await this.walletService.listHistory(
      WalletOwnerType.DRIVER,
      user.id,
      query.page,
      query.pageSize,
    );
    return { success: true, data };
  }
}
