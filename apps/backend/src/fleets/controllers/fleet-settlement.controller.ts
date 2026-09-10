import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import { FleetFinancialService } from '../fleet-financial.service';
import { FleetsService } from '../fleets.service';
import { FLEET_PERMISSIONS } from '../fleet.constants';

@Controller('fleet/financial/settlements')
export class FleetSettlementController {
  constructor(private readonly fleets: FleetsService, private readonly financial: FleetFinancialService) {}

  @Get()
  @RequirePermissions(FLEET_PERMISSIONS.OWN_READ)
  public async list(@CurrentUser() user: AuthenticatedUser): Promise<ApiSuccessResponse<unknown[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.listSettlementRequests(fleet.id) };
  }

  @Post('request')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { amount: number },
  ): Promise<ApiSuccessResponse<unknown>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.requestSettlement({ fleetId: fleet.id, requestedBy: user.id, amount: Number(body.amount) }) };
  }

  @Post(':id/initiate')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { narration?: string },
  ): Promise<ApiSuccessResponse<unknown>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    return { success: true, data: await this.financial.initiateApprovedSettlement({ requestId: id, fleetId: fleet.id, narration: body.narration }) };
  }
}

@Controller('admin/fleets/financial/settlements')
@RequirePermissions(FLEET_PERMISSIONS.ADMIN_COMMISSION_MANAGE)
export class AdminFleetSettlementController {
  constructor(private readonly financial: FleetFinancialService) {}

  @Get('pending')
  public async pending(): Promise<ApiSuccessResponse<unknown[]>> {
    return { success: true, data: await this.financial.listPendingSettlementRequests() };
  }

  @Post(':id/approve')
  public async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { approvedAmount?: number },
  ): Promise<ApiSuccessResponse<unknown>> {
    return { success: true, data: await this.financial.approveSettlementRequest({ requestId: id, adminUserId: user.id, approvedAmount: body.approvedAmount === undefined ? undefined : Number(body.approvedAmount) }) };
  }

  @Post(':id/reject')
  public async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ): Promise<ApiSuccessResponse<unknown>> {
    return { success: true, data: await this.financial.rejectSettlementRequest({ requestId: id, adminUserId: user.id, reason: body.reason }) };
  }
}
