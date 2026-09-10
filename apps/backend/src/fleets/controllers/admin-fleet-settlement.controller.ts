import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  ApproveFleetReceivableDto,
  ApproveFleetSettlementRequestDto,
  ExecuteFleetSettlementDto,
  RejectFleetSettlementRequestDto,
} from '../dto/fleet-financial.dto';
import { FleetFinancialService } from '../fleet-financial.service';
import { FLEET_PERMISSIONS } from '../fleet.constants';
import { FleetsService } from '../fleets.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';

@Controller('admin/fleet-settlements')
@RequirePermissions(FLEET_PERMISSIONS.ADMIN_MANAGE)
export class AdminFleetSettlementController {
  constructor(
    private readonly fleets: FleetsService,
    private readonly financial: FleetFinancialService,
  ) {}

  /** Operations records the independently approved payable that a fleet may draw against. */
  @Post(':fleetId/receivables')
  public async approveReceivable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId') fleetId: string,
    @Body() body: ApproveFleetReceivableDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    await this.fleets.requireFleet(fleetId);
    const data = await this.financial.approveReceivable({
      fleetId,
      amount: body.amount,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      ...(body.description !== undefined ? { description: body.description } : {}),
      adminUserId: user.id,
    });
    return { success: true, data };
  }

  @Get(':fleetId/receivables')
  public async listReceivables(
    @Param('fleetId') fleetId: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    await this.fleets.requireFleet(fleetId);
    return { success: true, data: await this.financial.listReceivables(fleetId) };
  }

  @Get(':fleetId/requests')
  public async listRequests(
    @Param('fleetId') fleetId: string,
  ): Promise<ApiSuccessResponse<unknown[]>> {
    await this.fleets.requireFleet(fleetId);
    return { success: true, data: await this.financial.listSettlementRequests(fleetId) };
  }

  @Post('requests/:requestId/approve')
  public async approveRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() body: ApproveFleetSettlementRequestDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.financial.approveSettlementRequest({
      requestId,
      adminUserId: user.id,
      ...(body.approvedAmount !== undefined ? { approvedAmount: body.approvedAmount } : {}),
    });
    return { success: true, data };
  }

  @Post('requests/:requestId/reject')
  public async rejectRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() body: RejectFleetSettlementRequestDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    const data = await this.financial.rejectSettlementRequest({
      requestId,
      adminUserId: user.id,
      reason: body.reason,
    });
    return { success: true, data };
  }

  /** The transfer can only be initiated after Operations has approved the request. */
  @Post('requests/:requestId/execute')
  public async executeRequest(
    @Param('requestId') requestId: string,
    @Body() body: ExecuteFleetSettlementDto,
  ): Promise<ApiSuccessResponse<unknown>> {
    await this.fleets.requireFleet(body.fleetId);
    const data = await this.financial.initiateApprovedSettlement({
      requestId,
      fleetId: body.fleetId,
      ...(body.narration !== undefined ? { narration: body.narration } : {}),
    });
    return { success: true, data };
  }
}
