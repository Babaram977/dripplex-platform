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
import { RefundRideDto } from '../dto/ride-payment.dto';
import { RidePaymentService } from '../ride-payment.service';
import { RIDE_PERMISSIONS } from '../ride.constants';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RideDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-D4 — admin/operations-initiated ride refunds. Guarded by
 * RIDE_PERMISSIONS.ADMIN_SUPPORT ('admin:rides:support'), which the
 * operations_staff, administrator, and super_administrator roles already hold
 * (the same admin/ops set that resolves ride problem reports) — no new
 * permission invented. Full refunds only; there is no customer self-service
 * refund endpoint.
 */
@Controller('admin/rides')
@RequirePermissions(RIDE_PERMISSIONS.ADMIN_SUPPORT)
export class AdminRidePaymentsController {
  constructor(private readonly paymentService: RidePaymentService) {}

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  public async refundRide(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RefundRideDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.paymentService.refundRide(
      admin.id,
      id,
      body.reason,
      this.auditContext(request, admin.id),
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
