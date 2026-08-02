import { Body, Controller, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { toOrderDto } from '../orders/order.mapper';

import { RefundOrderDto } from './dto/refund-order.dto';
import { PAYMENT_PERMISSIONS } from './payment.constants';
import { PaymentService } from './payment.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { OrderDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/orders')
export class AdminPaymentsController {
  constructor(private readonly paymentService: PaymentService) {}

  @Patch(':id/refund')
  @RequirePermissions(PAYMENT_PERMISSIONS.ADMIN_REFUND)
  public async refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundOrderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const order = await this.paymentService.refundOrder(
      user.id,
      id,
      dto.reason,
      this.auditContext(request, user.id),
    );
    return { success: true, data: toOrderDto(order) };
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
