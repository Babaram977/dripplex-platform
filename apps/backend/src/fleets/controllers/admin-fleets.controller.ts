import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AddFleetMemberDto,
  CreateFleetDto,
  ReplaceFleetCommissionTiersDto,
  SetFleetNegotiatedRateDto,
  SettleFleetPeriodDto,
  SuspendFleetDto,
} from '../dto/fleet.dto';
import { FleetCommissionService } from '../fleet-commission.service';
import { FleetOverviewService } from '../fleet-overview.service';
import { FLEET_PERMISSIONS } from '../fleet.constants';
import { FleetsService } from '../fleets.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  FleetCommissionTierDto,
  FleetDto,
  FleetOverviewDto,
  FleetPeriodDto,
} from '@dripplex/types';
import type { Fleet } from '@prisma/client';

function toFleetDto(fleet: Fleet): FleetDto {
  return {
    id: fleet.id,
    fleetNumber: fleet.fleetNumber,
    name: fleet.name,
    contactPhone: fleet.contactPhone,
    status: fleet.status,
    suspendedReason: fleet.suspendedReason,
    createdAt: fleet.createdAt.toISOString(),
  };
}

/**
 * DPX-FLEET — Operations' side of fleets.
 *
 * Founder decision, 2026-08-30: "KYC and onboarding is handled by dx
 * operations". A fleet owner says who he employs; DrippleX still says who may
 * work. So creating a fleet, issuing its Fleet DX number and attaching people
 * to it all live here, behind an Operations permission — and none of it
 * touches KYC or identity verification, which stay exactly where they were.
 *
 * The commission tier table is separately gated. Editing the bands changes
 * what every fleet is charged, which is a different level of authority from
 * attaching a rider to one.
 */
@Controller('admin/fleets')
@RequirePermissions(FLEET_PERMISSIONS.ADMIN_MANAGE)
export class AdminFleetsController {
  constructor(
    private readonly fleets: FleetsService,
    private readonly overview: FleetOverviewService,
    private readonly commission: FleetCommissionService,
  ) {}

  @Get()
  public async listFleets(
    @Query('includeSuspended') includeSuspended?: string,
  ): Promise<ApiSuccessResponse<FleetDto[]>> {
    const fleets = await this.fleets.listFleets({
      includeSuspended: includeSuspended === 'true',
    });
    return { success: true, data: fleets.map(toFleetDto) };
  }

  @Post()
  public async createFleet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFleetDto,
  ): Promise<ApiSuccessResponse<FleetDto>> {
    const fleet = await this.fleets.createFleet({
      ownerUserId: dto.ownerUserId,
      name: dto.name,
      ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
      context: { userId: user.id },
    });
    return { success: true, data: toFleetDto(fleet) };
  }

  @Get(':fleetId')
  public async getFleet(
    @Param('fleetId') fleetId: string,
  ): Promise<ApiSuccessResponse<FleetOverviewDto>> {
    const data = await this.overview.getOverview(fleetId);
    return { success: true, data };
  }

  /** Attaches a rider or driver to a fleet by its Fleet DX number. */
  @Post('members')
  public async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddFleetMemberDto,
  ): Promise<ApiSuccessResponse<{ memberId: string }>> {
    const member = await this.fleets.addMember({
      fleetNumber: dto.fleetNumber,
      userId: dto.userId,
      role: dto.role,
      context: { userId: user.id },
    });
    return { success: true, data: { memberId: member.id } };
  }

  @Post(':fleetId/suspend')
  public async suspendFleet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId') fleetId: string,
    @Body() dto: SuspendFleetDto,
  ): Promise<ApiSuccessResponse<FleetDto>> {
    const fleet = await this.fleets.suspendFleet({
      fleetId,
      reason: dto.reason,
      context: { userId: user.id },
    });
    return { success: true, data: toFleetDto(fleet) };
  }

  @Post(':fleetId/reinstate')
  public async reinstateFleet(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId') fleetId: string,
  ): Promise<ApiSuccessResponse<FleetDto>> {
    const fleet = await this.fleets.reinstateFleet({
      fleetId,
      context: { userId: user.id },
    });
    return { success: true, data: toFleetDto(fleet) };
  }

  @Get('commission/tiers')
  @RequirePermissions(FLEET_PERMISSIONS.ADMIN_COMMISSION_MANAGE)
  public async listTiers(): Promise<ApiSuccessResponse<FleetCommissionTierDto[]>> {
    const tiers = await this.commission.listTiers();
    return {
      success: true,
      data: tiers.map((tier) => ({
        id: tier.id,
        minOrders: tier.minOrders,
        maxOrders: tier.maxOrders,
        rate: Number(tier.rate),
      })),
    };
  }

  /**
   * Replaces the whole band table.
   *
   * Whole-table because the bands only mean anything together — one that
   * overlaps its neighbour, or a gap between two, charges the wrong rate or
   * none at all, and only the complete set can be checked for that.
   */
  @Post('commission/tiers')
  @RequirePermissions(FLEET_PERMISSIONS.ADMIN_COMMISSION_MANAGE)
  public async replaceTiers(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplaceFleetCommissionTiersDto,
  ): Promise<ApiSuccessResponse<FleetCommissionTierDto[]>> {
    const tiers = await this.commission.replaceTiers({
      tiers: dto.tiers.map((tier) => ({
        minOrders: tier.minOrders,
        maxOrders: tier.maxOrders ?? null,
        rate: tier.rate,
      })),
      adminUserId: user.id,
      context: { userId: user.id },
    });
    return {
      success: true,
      data: tiers.map((tier) => ({
        id: tier.id,
        minOrders: tier.minOrders,
        maxOrders: tier.maxOrders,
        rate: Number(tier.rate),
      })),
    };
  }

  /**
   * Agrees a rate with one fleet, or clears it back to the band table.
   *
   * Founder decision, 2026-08-30: "make it editable negotiable". The same
   * principle as merchant credit limits — businesses differ, and a
   * platform-wide table cannot express an individual agreement.
   */
  @Post(':fleetId/commission/rate')
  @RequirePermissions(FLEET_PERMISSIONS.ADMIN_COMMISSION_MANAGE)
  public async setNegotiatedRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId') fleetId: string,
    @Body() dto: SetFleetNegotiatedRateDto,
  ): Promise<ApiSuccessResponse<FleetDto>> {
    await this.fleets.requireFleet(fleetId);
    await this.commission.setNegotiatedRate({
      fleetId,
      rate: dto.rate ?? null,
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      adminUserId: user.id,
      context: { userId: user.id },
    });
    return { success: true, data: toFleetDto(await this.fleets.requireFleet(fleetId)) };
  }

  /** Closes a finished month and charges the fleet for it. */
  @Post(':fleetId/commission/settle')
  @RequirePermissions(FLEET_PERMISSIONS.ADMIN_COMMISSION_MANAGE)
  public async settlePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fleetId') fleetId: string,
    @Body() dto: SettleFleetPeriodDto,
  ): Promise<ApiSuccessResponse<FleetPeriodDto>> {
    const period = await this.commission.settlePeriod({
      fleetId,
      periodStart: new Date(dto.periodStart),
      adminUserId: user.id,
      context: { userId: user.id },
    });
    return {
      success: true,
      data: {
        periodStart: period.periodStart.toISOString(),
        periodEnd: period.periodEnd.toISOString(),
        orderCount: period.orderCount,
        chargeableTotal: Number(period.chargeableTotal),
        projectedRate: null,
        projectedCommission: null,
        settled: period.settledAt !== null,
        appliedRate: period.appliedRate === null ? null : Number(period.appliedRate),
        commissionAmount: period.commissionAmount === null ? null : Number(period.commissionAmount),
      },
    };
  }
}
