import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import { FleetFinancialService } from '../fleet-financial.service';
import { FleetsService } from '../fleets.service';
import { FLEET_PERMISSIONS } from '../fleet.constants';

@Controller('fleet/financial')
@RequirePermissions(FLEET_PERMISSIONS.OWN_READ)
export class FleetFinancialController {
  constructor(private readonly fleets: FleetsService, private readonly financial: FleetFinancialService) {}

  @Get('banks')
  public async listBanks(): Promise<ApiSuccessResponse<{ name: string; code: string }[]>> {
    return { success: true, data: await this.financial.listBanks() };
  }

  @Get('bank-accounts')
  public async listAccounts(@CurrentUser() user: AuthenticatedUser): Promise<ApiSuccessResponse<unknown[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.listBankAccounts(fleet.id) };
  }

  @Post('bank-accounts')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async addAccount(@CurrentUser() user: AuthenticatedUser, @Body() body: { bankName: string; bankCode: string; accountName: string; accountNumber: string; currency?: string; isDefault?: boolean }): Promise<ApiSuccessResponse<unknown>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    const data = await this.financial.addBankAccount({ fleetId: fleet.id, ...body });
    return { success: true, data };
  }

  @Patch('bank-accounts/:id/default')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async setDefault(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ApiSuccessResponse<unknown>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.setDefaultBankAccount(fleet.id, id) };
  }

  @Get('receivables')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_READ)
  public async listReceivables(@CurrentUser() user: AuthenticatedUser): Promise<ApiSuccessResponse<unknown[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.listReceivables(fleet.id) };
  }

  @Get('settlement-requests')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_READ)
  public async listSettlementRequests(@CurrentUser() user: AuthenticatedUser): Promise<ApiSuccessResponse<unknown[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.listSettlementRequests(fleet.id) };
  }

  @Post('settlement-requests')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async requestSettlement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { receivableId: string; amount: number },
  ): Promise<ApiSuccessResponse<unknown>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    const data = await this.financial.requestSettlement({
      fleetId: fleet.id,
      requestedBy: user.id,
      receivableId: body.receivableId,
      amount: Number(body.amount),
    });
    return { success: true, data };
  }
}
