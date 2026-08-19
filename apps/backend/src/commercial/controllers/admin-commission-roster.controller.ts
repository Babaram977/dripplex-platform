import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { COMMERCIAL_PERMISSIONS } from '../commercial.constants';
import { toCommissionAccountDto } from '../commercial.mapper';
import { CommissionAccountService } from '../commission-account.service';
import { ListCommissionAccountsQueryDto } from '../dto/list-commission-accounts-query.dto';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { AdminCommissionAccountDto, PaginatedResult } from '@dripplex/types';

/**
 * "Who owes DrippleX money, and who is blocked because of it."
 *
 * Registered separately from AdminCommissionAccountsController because that
 * one's path is `admin/commercial/accounts/:ownerType/:ownerId` — a collection
 * route cannot live under it without `accounts` being read as an ownerType.
 */
@Controller('admin/commercial/accounts')
@RequirePermissions(COMMERCIAL_PERMISSIONS.ADMIN_ACCOUNT_MANAGE)
export class AdminCommissionRosterController {
  constructor(private readonly accounts: CommissionAccountService) {}

  @Get()
  public async list(
    @Query() query: ListCommissionAccountsQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<AdminCommissionAccountDto>>> {
    const { items, total } = await this.accounts.listAccounts({
      ...(query.ownerType !== undefined ? { ownerType: query.ownerType } : {}),
      ...(query.blocked !== undefined ? { blockedOnly: query.blocked } : {}),
      page: query.page,
      pageSize: query.limit,
    });

    return {
      success: true,
      data: {
        items: items.map(({ account, owner }) => ({
          ...toCommissionAccountDto(account),
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          ownerPhone: owner?.phone ?? null,
        })),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.limit) || 1),
        },
      },
    };
  }
}
