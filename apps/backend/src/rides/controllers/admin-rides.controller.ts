import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CancelRideByOperationsDto } from '../dto/request-ride.dto';
import { RIDE_PERMISSIONS } from '../ride.constants';
import { RidesService } from '../rides.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RideDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * Operations-initiated ride lifecycle actions.
 *
 * Guarded by RIDE_PERMISSIONS.ADMIN_SUPPORT ('admin:rides:support') — the same
 * permission that already lets operations_staff, administrator, and
 * super_administrator resolve ride problem reports and issue refunds. No new
 * permission is invented: cancelling a stranded ride is the support desk's
 * job, and the desk that can refund a trip can already undo one.
 *
 * Cancellation lives here rather than under `operations/` because the ride
 * lifecycle belongs to this module — OperationsModule is read-only over
 * `Ride` by construction, and a status write must not be the thing that
 * breaks that. This is the same reason the refund endpoint sits next door.
 */
@Controller('admin/rides')
@RequirePermissions(RIDE_PERMISSIONS.ADMIN_SUPPORT)
export class AdminRidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  public async cancelRide(
    @CurrentUser() operator: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelRideByOperationsDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.ridesService.cancelRideAsOperations(
      operator.id,
      id,
      body,
      this.auditContext(request, operator.id),
    );
    return { success: true, data };
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
