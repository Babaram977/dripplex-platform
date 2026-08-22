import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { RideType } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateRideSurchargeZoneDto,
  UpdateRideFareRateDto,
  UpdateRideSurchargeZoneDto,
} from '../dto/ride-pricing.dto';
import { RidePricingService } from '../ride-pricing.service';
import { RIDE_PERMISSIONS, RIDE_TYPE_CATALOG } from '../ride.constants';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RideFareRateDto, RideSurchargeZoneDto } from '@dripplex/types';
import type { RideSurchargeZone } from '@prisma/client';
import type { Request } from 'express';

/**
 * The pricing console's backend.
 *
 * Ride fares were a hardcoded constant — `RIDE_FARE_RATES` — that still
 * carried its own warning that it was "not a founder-approved fare table".
 * Changing a price meant a code change and a deploy, and charging more for an
 * airport run was not expressible at all.
 *
 * Guarded by its own permission rather than reusing `admin:rides:support`: an
 * operator who can refund a trip should not thereby be able to reprice the
 * platform. Granted to `administrator` and `super_administrator`, not to
 * `operations_staff`.
 *
 * Every write is audit-logged with before and after — a fare change is a
 * commercial act, and "who set this rate, and when" has to be answerable.
 */
@Controller('admin/rides/pricing')
@RequirePermissions(RIDE_PERMISSIONS.ADMIN_PRICING)
export class AdminRidePricingController {
  constructor(private readonly pricingService: RidePricingService) {}

  @Get('rates')
  public async listRates(): Promise<ApiSuccessResponse<RideFareRateDto[]>> {
    const rates = await this.pricingService.listRates();
    return {
      success: true,
      data: rates.map((rate) => ({
        ...rate,
        // The console shows "Dx Comfort", not "COMFORT" — the same catalog the
        // passenger app reads, so the two never disagree about a service name.
        displayName: RIDE_TYPE_CATALOG[rate.rideType].displayName,
      })),
    };
  }

  @Put('rates/:rideType')
  public async updateRate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('rideType', new ParseEnumPipe(RideType)) rideType: RideType,
    @Body() body: UpdateRideFareRateDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideFareRateDto>> {
    const rate = await this.pricingService.updateRate(
      rideType,
      body,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return {
      success: true,
      data: { ...rate, displayName: RIDE_TYPE_CATALOG[rate.rideType].displayName },
    };
  }

  @Get('zones')
  public async listZones(): Promise<ApiSuccessResponse<RideSurchargeZoneDto[]>> {
    // Inactive zones included: the console is where you go to turn one back
    // on, so hiding them would hide the control.
    const zones = await this.pricingService.listZones(true);
    return { success: true, data: zones.map(toZoneDto) };
  }

  @Post('zones')
  public async createZone(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: CreateRideSurchargeZoneDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideSurchargeZoneDto>> {
    const zone = await this.pricingService.createZone(
      body,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return { success: true, data: toZoneDto(zone) };
  }

  @Patch('zones/:id')
  public async updateZone(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRideSurchargeZoneDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideSurchargeZoneDto>> {
    const zone = await this.pricingService.updateZone(
      id,
      body,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return { success: true, data: toZoneDto(zone) };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { userId?: string; ipAddress?: string; userAgent?: string } {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}

function toZoneDto(zone: RideSurchargeZone): RideSurchargeZoneDto {
  return {
    id: zone.id,
    name: zone.name,
    latitude: Number(zone.latitude),
    longitude: Number(zone.longitude),
    radiusMeters: zone.radiusMeters,
    surchargeType: zone.surchargeType,
    amount: Number(zone.amount),
    appliesTo: zone.appliesTo,
    excludedRideTypes: zone.excludedRideTypes,
    active: zone.active,
    updatedAt: zone.updatedAt.toISOString(),
  };
}
