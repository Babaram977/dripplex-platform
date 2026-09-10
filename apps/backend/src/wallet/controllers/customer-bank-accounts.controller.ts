import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BankAccountsService, type CustomerBankAccountDto } from '../bank-accounts.service';
import { AddBankAccountDto, ResolveBankAccountQueryDto } from '../dto/withdrawal.dto';
import { WALLET_PERMISSIONS } from '../wallet.constants';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('customer/wallet/bank-accounts')
export class CustomerBankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto[]>> {
    const data = await this.bankAccountsService.list(user.id);
    return { success: true, data };
  }

  /** The bank list for the picker. A bank code is what makes name enquiry
   * possible, and a customer cannot type one — so the list has to come from
   * here before an account can be added. Empty when no resolver is
   * configured; the client then falls back to a free-text bank name, exactly
   * as before Phase 0. */
  @Get('banks')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async banks(): Promise<ApiSuccessResponse<{ name: string; code: string }[]>> {
    const data = await this.bankAccountsService.listBanks();
    return { success: true, data };
  }

  /**
   * Name enquiry for the form, before anything is saved.
   *
   * Throttled hard: each call is a live request to the payment provider, and
   * an unthrottled "who owns this number" endpoint is an account-name
   * enumeration surface. A person filling in one form needs a handful of
   * attempts, not hundreds.
   */
  @Get('resolve')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async resolve(
    @Query() query: ResolveBankAccountQueryDto,
  ): Promise<ApiSuccessResponse<{ accountName: string; bankName: string; bankCode: string }>> {
    const data = await this.bankAccountsService.resolveAccount(query);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_WITHDRAW)
  public async add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddBankAccountDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto>> {
    const data = await this.bankAccountsService.add(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/default')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_WITHDRAW)
  public async setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto>> {
    const data = await this.bankAccountsService.setDefault(user.id, id);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_WITHDRAW)
  public async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ removed: boolean }>> {
    await this.bankAccountsService.remove(user.id, id, this.auditContext(request, user.id));
    return { success: true, data: { removed: true } };
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
