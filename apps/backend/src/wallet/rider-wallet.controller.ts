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

@Controller('rider/wallet')
export class RiderWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_READ)
  public async getWallet(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.getWallet(WalletOwnerType.RIDER, user.id);
    return { success: true, data };
  }

  /**
   * The rider's own wallet history.
   *
   * Customer, merchant and driver wallets have had this since they shipped;
   * the rider controller was the one that stopped at a balance. So a rider
   * could see a number and never what made it — no record of a delivery
   * earning arriving, a payout leaving, or a commission reversal — which is
   * exactly the position a courier is least able to argue from.
   *
   * Same shape, same pagination and the same RIDER_READ permission as the
   * balance above; nothing here is new capability, only the missing half of
   * an endpoint pair.
   */
  @Get('transactions')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_READ)
  public async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WalletLedgerEntryDto>>> {
    const data = await this.walletService.listHistory(
      WalletOwnerType.RIDER,
      user.id,
      query.page,
      query.pageSize,
    );
    return { success: true, data };
  }
}
