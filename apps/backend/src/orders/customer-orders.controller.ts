import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CheckoutService } from './checkout.service';
import { CancelOrderDto, CheckoutDto, CustomerOrderListQueryDto } from './dto/order.dto';
import { ORDER_PERMISSIONS } from './order.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { CheckoutResponseDto, OrderDto, PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer')
export class CustomerOrdersController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(ORDER_PERMISSIONS.CHECKOUT)
  public async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CheckoutResponseDto>> {
    const data = await this.checkoutService.checkout(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('orders')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CustomerOrderListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<OrderDto>>> {
    const data = await this.checkoutService.listCustomerOrders(user.id, query.page, query.pageSize);
    return { success: true, data };
  }

  @Get('orders/:id')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.checkoutService.getCustomerOrder(user.id, id);
    return { success: true, data };
  }

  @Post('orders/:id/cancel')
  @RequirePermissions(ORDER_PERMISSIONS.ORDERS)
  public async cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOrderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.checkoutService.cancelCustomerOrder(
      user.id,
      id,
      this.auditContext(request, user.id),
      dto.reason,
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
