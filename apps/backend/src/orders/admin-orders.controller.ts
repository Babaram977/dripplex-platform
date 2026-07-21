import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CheckoutService } from './checkout.service';
import { AdminOrderListQueryDto } from './dto/order.dto';
import { ORDER_PERMISSIONS } from './order.constants';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { OrderDto, PaginatedResult } from '@dripplex/types';

@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly checkoutService: CheckoutService) {}

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
}
