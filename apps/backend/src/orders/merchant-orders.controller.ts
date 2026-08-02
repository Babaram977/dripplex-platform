import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  AcceptOrderDto,
  DelayOrderDto,
  MerchantCancelOrderDto,
  MerchantOrderListQueryDto,
  RejectOrderDto,
} from './dto/merchant-order.dto';
import { MerchantOrdersService } from './merchant-orders.service';
import { ORDER_PERMISSIONS } from './order.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { OrderDto, PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('merchant/orders')
@RequirePermissions(ORDER_PERMISSIONS.MERCHANT_MANAGE)
export class MerchantOrdersController {
  constructor(private readonly merchantOrdersService: MerchantOrdersService) {}

  @Get()
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MerchantOrderListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<OrderDto>>> {
    const data = await this.merchantOrdersService.listOrders(user.id, query);
    return { success: true, data };
  }

  @Get(':id')
  public async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.merchantOrdersService.getOrder(user.id, id);
    return { success: true, data };
  }

  @Patch(':id/accept')
  public async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptOrderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.merchantOrdersService.acceptOrder(
      user.id,
      id,
      this.auditContext(request, user.id),
      dto.estimatedReadyAt,
    );
    return { success: true, data };
  }

  @Patch(':id/reject')
  public async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOrderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.merchantOrdersService.rejectOrder(
      user.id,
      id,
      dto.reason,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/ready')
  public async ready(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.merchantOrdersService.markReady(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/delay')
  public async delay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DelayOrderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.merchantOrdersService.delayOrder(
      user.id,
      id,
      dto.estimatedReadyAt,
      dto.reason,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch(':id/cancel')
  public async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MerchantCancelOrderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<OrderDto>> {
    const data = await this.merchantOrdersService.cancelOrder(
      user.id,
      id,
      dto.reason,
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
