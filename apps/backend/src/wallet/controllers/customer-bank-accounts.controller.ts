import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BankAccountsService, type CustomerBankAccountDto } from '../bank-accounts.service';
import { AddBankAccountDto } from '../dto/withdrawal.dto';
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
