import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { AdminOrderRecoveryListQueryDto, OperatorRecoveryCancelDto } from './dto/order.dto';
import { OrderRecoveryService } from './order-recovery.service';
import { ORDER_PERMISSIONS } from './order.constants';
import { toOrderRecoveryDto } from './order.mapper';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { OrderRecoveryDto, PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-ORDER-8D-RECOVERY Increment 2 — the operator's recovery surface.
 *
 * Mounted at `admin/order-recoveries`, deliberately NOT under `admin/orders`.
 * That controller already declares `@Get(':id')` with a ParseUUIDPipe, and a
 * literal segment added beneath it is swallowed — mapped, reported at startup,
 * and answering 400 to every request. Keeping recovery on its own prefix means
 * this increment cannot reintroduce that trap, and cannot shadow an existing
 * order route either.
 *
 * READ is the existing `admin:orders:read`. ACTING requires the separate
 * `admin:orders:recovery:manage`, seeded in Increment 1 and consumed here for
 * the first time. It is not `admin:orders:manage` because that permission
 * already authorises dispute resolution and wallet refunds — a recovery
 * operator must not inherit the power to refund any order on the platform.
 */
@Controller('admin/order-recoveries')
export class AdminOrderRecoveryController {
  constructor(private readonly recovery: OrderRecoveryService) {}

  @Get()
  @RequirePermissions(ORDER_PERMISSIONS.ADMIN_READ)
  public async list(
    @Query() query: AdminOrderRecoveryListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<OrderRecoveryDto>>> {
    const data = await this.recovery.list({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.trigger !== undefined ? { trigger: query.trigger } : {}),
    });
    return { success: true, data };
  }

  @Get(':orderId')
  @RequirePermissions(ORDER_PERMISSIONS.ADMIN_READ)
  public async getByOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<ApiSuccessResponse<OrderRecoveryDto | null>> {
    const recovery = await this.recovery.getByOrderId(orderId);
    return { success: true, data: recovery === null ? null : toOrderRecoveryDto(recovery) };
  }

  /**
   * Cancel a stalled order on this operator's authority.
   *
   * The only mutating route in this increment. It cannot reverse a wallet,
   * open an investigation, notify anybody or run unattended — each of those
   * waits for its own increment and its own ruling.
   */
  @Post(':orderId/cancel')
  @RequirePermissions(ORDER_PERMISSIONS.ADMIN_RECOVERY_MANAGE)
  public async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: OperatorRecoveryCancelDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderRecoveryDto>> {
    const recovery = await this.recovery.cancelForRecovery({
      orderId,
      operatorId: user.id,
      reason: dto.reason,
      context: {
        userId: user.id,
        ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
        ...(typeof request.headers['user-agent'] === 'string'
          ? { userAgent: request.headers['user-agent'] }
          : {}),
      },
    });
    return { success: true, data: toOrderRecoveryDto(recovery) };
  }
}
