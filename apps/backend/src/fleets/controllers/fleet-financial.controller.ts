import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ResolveBankAccountQueryDto } from '../../wallet/dto/withdrawal.dto';
import {
  AddFleetBankAccountDto,
  CreateFleetSettlementRequestDto,
} from '../dto/fleet-financial.dto';
import { FleetFinancialService } from '../fleet-financial.service';
import { FLEET_PERMISSIONS } from '../fleet.constants';
import { FleetsService } from '../fleets.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';

@Controller('fleet/financial')
@RequirePermissions(FLEET_PERMISSIONS.OWN_READ)
export class FleetFinancialController {
  constructor(
    private readonly fleets: FleetsService,
    private readonly financial: FleetFinancialService,
  ) {}

  @Get('banks')
  public async listBanks(): Promise<ApiSuccessResponse<{ name: string; code: string }[]>> {
    return { success: true, data: await this.financial.listBanks() };
  }

  @Get('bank-accounts')
  public async listAccounts(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.listBankAccounts(fleet.id) };
  }

  @Get('bank-accounts/resolve')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async resolveBankAccount(
    @Query() query: ResolveBankAccountQueryDto,
  ): Promise<ApiSuccessResponse<{ accountName: string; bankName: string; bankCode: string }>> {
    return { success: true, data: await this.financial.resolveAccount(query) };
  }

  @Post('bank-accounts')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async addAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AddFleetBankAccountDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    const data = await this.financial.addBankAccount({
      fleetId: fleet.id,
      bankName: body.bankName,
      bankCode: body.bankCode,
      accountName: body.accountName,
      accountNumber: body.accountNumber,
      currency: body.currency,
      isDefault: body.isDefault,
    });
    return { success: true, data };
  }

  @Patch('bank-accounts/:id/default')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<unknown>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.setDefaultBankAccount(fleet.id, id) };
  }

  @Get('receivables')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_READ)
  public async listReceivables(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.listReceivables(fleet.id) };
  }

  @Get('settlement-requests')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_READ)
  public async listSettlementRequests(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.listSettlementRequests(fleet.id) };
  }

  @Post('settlement-requests')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async requestSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFleetSettlementRequestDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    const data = await this.financial.requestSettlement({
      fleetId: fleet.id,
      requestedBy: user.id,
      receivableId: body.receivableId,
      amount: body.amount,
    });
    return { success: true, data };
  }
}
