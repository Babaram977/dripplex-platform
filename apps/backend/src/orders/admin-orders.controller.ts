import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CheckoutService } from './checkout.service';
import { AdminOrderListQueryDto, ResolveOrderDisputeDto } from './dto/order.dto';
import { OrderPaymentProofService } from './order-payment-proof.service';
import { ORDER_PERMISSIONS } from './order.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { OrderDto, OrderPaymentProofDto, PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly paymentProofs: OrderPaymentProofService,
  ) {}

  @Get()
  @RequirePermissions(ORDER_PERMISSIONS.ADMIN_READ)
  public async listOrders(
    @Query() query: AdminOrderListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<OrderDto>>> {
    const data = await this.checkoutService.listAdminOrders({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.paymentStatus !== undefined ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.merchantId !== undefined ? { merchantId: query.merchantId } : {}),
      ...(query.customerId !== undefined ? { customerId: query.customerId } : {}),
      ...(query.createdFrom !== undefined ? { createdFrom: query.createdFrom } : {}),
      ...(query.createdTo !== undefined ? { createdTo: query.createdTo } : {}),
    });
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(ORDER_PERMISSIONS.ADMIN_READ)
  public async getOrder(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.checkoutService.getAdminOrder(id);
    return { success: true, data };
  }

  /** DPX-ORDER-PROOF-001 — the customer's bank receipts for this order. The
   * reason the founder asked for receipts at all: when a MERCHANT_DIRECT order
   * is disputed, this is the customer's side of "I paid" and the merchant's
   * confirmation is theirs. Read-only, and never editable by anyone. */
  @Get(':id/payment-proofs')
  @RequirePermissions(ORDER_PERMISSIONS.ADMIN_READ)
  public async listPaymentProofs(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<OrderPaymentProofDto[]>> {
    const data = await this.paymentProofs.listForAdmin(id);
    return { success: true, data };
  }

  @Patch('disputes/:disputeId/resolve')
  @RequirePermissions(ORDER_PERMISSIONS.ADMIN_MANAGE)
  public async resolveDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('disputeId', ParseUUIDPipe) disputeId: string,
    @Body() dto: ResolveOrderDisputeDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.checkoutService.resolveDispute(
      user.id,
      disputeId,
      dto.resolution,
      this.auditContext(request, user.id),
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
