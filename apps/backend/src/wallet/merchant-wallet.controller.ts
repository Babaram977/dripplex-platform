import { Controller, Get } from '@nestjs/common';
import { WalletOwnerType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { WALLET_PERMISSIONS } from './wallet.constants';
import { WalletService, type WalletDto } from './wallet.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

@Controller('merchant/wallet')
export class MerchantWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.MERCHANT_READ)
  public async getWallet(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.getWallet(WalletOwnerType.MERCHANT, user.id);
    return { success: true, data };
  }
}
