import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DeactivateFleetMemberDto, RejectFleetJoinRequestDto } from '../dto/fleet.dto';
import { FleetOverviewService } from '../fleet-overview.service';
import { FLEET_PERMISSIONS } from '../fleet.constants';
import { FleetsService } from '../fleets.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { FleetJobDto, FleetMemberDto, FleetOverviewDto } from '@dripplex/types';

/**
 * DPX-FLEET — the fleet owner's own console.
 *
 * Every route resolves the fleet from the signed-in user rather than taking a
 * fleet id from the caller. There is no path here that names another company's
 * fleet, so no request can be pointed at one — the scoping is structural, not
 * a check that could be forgotten on a new endpoint.
 *
 * The owner manages his own people: deactivate a rider whose bike is off the
 * road, reactivate them, remove one who has left. He cannot delete their
 * DrippleX account — that closes an identity, releases a phone number and has
 * to check for trips in progress and money owed, which is Operations' job and
 * has its own refusals. A rider who leaves a fleet keeps their account, their
 * earnings history and the record of the trips they did.
 */
@Controller('fleet')
@RequirePermissions(FLEET_PERMISSIONS.OWN_READ)
export class FleetOwnerController {
  constructor(
    private readonly fleets: FleetsService,
    private readonly overview: FleetOverviewService,
  ) {}

  @Get('overview')
  public async getOverview(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<FleetOverviewDto>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    const data = await this.overview.getOverview(fleet.id);
    return { success: true, data };
  }

  @Get('members')
  public async listMembers(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<FleetMemberDto[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    const data = await this.overview.listMembers(fleet.id);
    return { success: true, data };
  }

  @Get('live')
  public async listLiveJobs(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<FleetJobDto[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    const data = await this.overview.listLiveJobs(fleet.id);
    return { success: true, data };
  }

  /**
   * Riders who quoted this fleet's DX number and are waiting on the owner.
   *
   * The confirmation step exists because the rider typed the number
   * themselves. Without it, anyone could type any company's number and that
   * company would be invoiced for their jobs.
   */
  @Get('requests')
  public async listRequests(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<FleetMemberDto[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    const data = await this.overview.listPendingRequests(fleet.id);
    return { success: true, data };
  }

  @Post('requests/:memberId/approve')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async approveRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
  ): Promise<ApiSuccessResponse<FleetMemberDto[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    await this.fleets.approveJoinRequest({
      fleetId: fleet.id,
      memberId,
      ownerUserId: user.id,
      context: { userId: user.id },
    });
    const data = await this.overview.listMembers(fleet.id);
    return { success: true, data };
  }

  @Post('requests/:memberId/reject')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async rejectRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
    @Body() dto: RejectFleetJoinRequestDto,
  ): Promise<ApiSuccessResponse<FleetMemberDto[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    await this.fleets.rejectJoinRequest({
      fleetId: fleet.id,
      memberId,
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      ownerUserId: user.id,
      context: { userId: user.id },
    });
    const data = await this.overview.listPendingRequests(fleet.id);
    return { success: true, data };
  }

  @Post('members/:memberId/deactivate')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async deactivateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
    @Body() dto: DeactivateFleetMemberDto,
  ): Promise<ApiSuccessResponse<FleetMemberDto[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    await this.fleets.deactivateMember({
      fleetId: fleet.id,
      memberId,
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
      context: { userId: user.id },
    });
    const data = await this.overview.listMembers(fleet.id);
    return { success: true, data };
  }

  @Post('members/:memberId/reactivate')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async reactivateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
  ): Promise<ApiSuccessResponse<FleetMemberDto[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    await this.fleets.reactivateMember({
      fleetId: fleet.id,
      memberId,
      context: { userId: user.id },
    });
    const data = await this.overview.listMembers(fleet.id);
    return { success: true, data };
  }

  @Post('members/:memberId/remove')
  @RequirePermissions(FLEET_PERMISSIONS.OWN_MANAGE)
  public async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('memberId') memberId: string,
  ): Promise<ApiSuccessResponse<FleetMemberDto[]>> {
    const fleet = await this.fleets.requireFleetOwnedBy(user.id);
    await this.fleets.removeMember({
      fleetId: fleet.id,
      memberId,
      context: { userId: user.id },
    });
    const data = await this.overview.listMembers(fleet.id);
    return { success: true, data };
  }
}
