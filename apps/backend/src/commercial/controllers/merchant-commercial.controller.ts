import { Controller, Get, Query } from '@nestjs/common';
import { CommissionOwnerType } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { COMMERCIAL_PERMISSIONS } from '../commercial.constants';
import { toCommissionAccountDto, toCommissionLedgerEntryDto } from '../commercial.mapper';
import { CommissionAccountService } from '../commission-account.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  CommissionAccountDto,
  CommissionLedgerEntryDto,
  PaginatedResult,
} from '@dripplex/types';

/**
 * DPX-COMMERCIAL-001 Slice 5 — a merchant reading their own commission
 * account/ledger. Self-read only, no write. Mirrors
 * MerchantWalletController's exact shape: `MerchantProfile.id` is not
 * involved here, `Order.merchantId` indirection notwithstanding —
 * CommissionAccount.ownerId for CommissionOwnerType.MERCHANT is the
 * merchant's own User.id (same as WalletOwnerType.MERCHANT), so
 * `user.id` is passed straight through, no resolve step.
 */
@Controller('merchant/commercial')
@RequirePermissions(COMMERCIAL_PERMISSIONS.MERCHANT_READ)
export class MerchantCommercialController {
  constructor(private readonly accounts: CommissionAccountService) {}

  @Get('account')
  public async getAccount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<CommissionAccountDto>> {
    const account = await this.accounts.getOrCreateAccount(CommissionOwnerType.MERCHANT, user.id);
    return { success: true, data: toCommissionAccountDto(account) };
  }

  @Get('ledger')
  public async getLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ): Promise<ApiSuccessResponse<PaginatedResult<CommissionLedgerEntryDto>>> {
    const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeRaw ?? '20', 10) || 20));
    const { items, total } = await this.accounts.listLedgerEntries(
      CommissionOwnerType.MERCHANT,
      user.id,
      page,
      pageSize,
    );
    return {
      success: true,
      data: {
        items: items.map(toCommissionLedgerEntryDto),
        meta: {
          page,
          limit: pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
        },
      },
    };
  }
}
