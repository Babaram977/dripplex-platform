import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { AssignmentMethod } from '@prisma/client';

import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { DELIVERY_PERMISSIONS } from './delivery.constants';
import { DeliveryService } from './delivery.service';
import { AdminJobListQueryDto, AssignRiderDto, CancelDeliveryDto } from './dto/delivery.dto';

import type { DeliveryJobDto } from './delivery.mapper';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/delivery')
export class AdminDeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get()
  @RequirePermissions(DELIVERY_PERMISSIONS.ADMIN_MANAGE)
  public async listJobs(
    @Query() query: AdminJobListQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<DeliveryJobDto>>> {
    const data = await this.deliveryService.listAdminJobs({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.riderId !== undefined ? { riderId: query.riderId } : {}),
      ...(query.merchantId !== undefined ? { merchantId: query.merchantId } : {}),
      ...(query.customerId !== undefined ? { customerId: query.customerId } : {}),
    });
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions(DELIVERY_PERMISSIONS.ADMIN_MANAGE)
  public async getJob(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.getAdminJob(id);
    return { success: true, data };
  }

  @Post(':id/assign')
  @RequirePermissions(DELIVERY_PERMISSIONS.ADMIN_MANAGE)
  public async assignRider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRiderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.assignRider(
      id,
      dto.riderId,
      dto.method ?? AssignmentMethod.MANUAL,
      this.auditContext(request),
    );
    return { success: true, data };
  }

  @Post(':id/reassign')
  @RequirePermissions(DELIVERY_PERMISSIONS.ADMIN_MANAGE)
  public async reassignRider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRiderDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.reassignRider(
      id,
      dto.riderId,
      this.auditContext(request),
    );
    return { success: true, data };
  }

  @Post(':id/cancel')
  @RequirePermissions(DELIVERY_PERMISSIONS.ADMIN_MANAGE)
  public async cancelJob(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDeliveryDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.cancelJob(id, dto.reason, this.auditContext(request));
    return { success: true, data };
  }

  private auditContext(request: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
