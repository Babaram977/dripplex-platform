import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegisterFleetDto, RequestFleetJoinDto } from '../dto/fleet.dto';
import { FleetsService } from '../fleets.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { FleetJoinRequestDto, FleetRegistrationDto } from '@dripplex/types';

/**
 * DPX-FLEET — the two things a person does for themselves.
 *
 * Founder decision, 2026-08-30: "The two clients needing fleet registration
 * will go online and register themselves then the system should issue a dx
 * fleet number for them which their riders and drivers will use at onboarding
 * process."
 *
 * Deliberately not on `FleetOwnerController`: everything there is gated on
 * `fleet:own:read`, which a person registering a fleet does not have yet and
 * a rider joining one never will. These routes are authenticated but carry no
 * permission of their own — what a caller may do is decided from the account
 * they are signed in as, inside the service, rather than from a body field
 * they could have written themselves.
 */
@Controller('fleet')
export class FleetSelfServiceController {
  constructor(private readonly fleets: FleetsService) {}

  /**
   * Registers a fleet and issues its DX number immediately.
   *
   * The number comes back straight away because that is the entire point of
   * it — the owner needs something to give their riders. The fleet is
   * `PENDING_APPROVAL` until Operations checks it: nobody is attached, no job
   * counts and no commission accrues in the meantime.
   *
   * Throttled like the other registration routes: creating fleets in a loop
   * would burn DX numbers, and those are meant to be permanent.
   */
  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  public async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterFleetDto,
  ): Promise<ApiSuccessResponse<FleetRegistrationDto>> {
    const fleet = await this.fleets.registerFleet({
      ownerUserId: user.id,
      name: dto.name,
      ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone } : {}),
      context: { userId: user.id },
    });

    return {
      success: true,
      data: {
        fleetNumber: fleet.fleetNumber,
        name: fleet.name,
        status: fleet.status,
      },
    };
  }

  /**
   * A rider or driver quoting a fleet's DX number during their own onboarding.
   *
   * Creates a request, never a membership — the fleet owner confirms it. See
   * `FleetsService.requestToJoin` for why that step is not optional.
   */
  @Post('join')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  public async requestToJoin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestFleetJoinDto,
  ): Promise<ApiSuccessResponse<FleetJoinRequestDto>> {
    const { member, fleet } = await this.fleets.requestToJoin({
      fleetNumber: dto.fleetNumber,
      userId: user.id,
      context: { userId: user.id },
    });

    return {
      success: true,
      data: {
        memberId: member.id,
        fleetNumber: fleet.fleetNumber,
        fleetName: fleet.name,
        role: member.role,
        status: member.status,
        requestedAt: member.joinedAt.toISOString(),
        rejectedReason: member.rejectedReason,
      },
    };
  }

  /**
   * Whether the signed-in rider is waiting on a fleet, so their app can say so
   * rather than leaving them wondering whether the number was accepted.
   */
  @Get('join/status')
  public async joinStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<FleetJoinRequestDto | null>> {
    const pending = await this.fleets.pendingRequestFor(user.id);
    if (pending === null) return { success: true, data: null };

    return {
      success: true,
      data: {
        memberId: pending.member.id,
        fleetNumber: pending.fleet.fleetNumber,
        fleetName: pending.fleet.name,
        role: pending.member.role,
        status: pending.member.status,
        requestedAt: pending.member.joinedAt.toISOString(),
        rejectedReason: pending.member.rejectedReason,
      },
    };
  }
}
