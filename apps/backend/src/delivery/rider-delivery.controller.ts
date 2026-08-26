import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { DELIVERY_PERMISSIONS } from './delivery.constants';
import { DeliveryService } from './delivery.service';
import {
  ConfirmCashDto,
  DeliverProofDto,
  FailDeliveryDto,
  LocationUpdateDto,
  RiderAvailabilityDto,
  RiderJobHistoryQueryDto,
} from './dto/delivery.dto';
import { TrackingService } from './tracking.service';

import type {
  DeliveryJobDto,
  RiderDeliveryJobDto,
  RiderLocationDto,
  TrackingDto,
} from './delivery.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

@Controller('rider')
export class RiderDeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly trackingService: TrackingService,
  ) {}

  @Get('jobs')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async listJobs(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<RiderDeliveryJobDto[]>> {
    const data = await this.deliveryService.listRiderJobs(user.id);
    return { success: true, data };
  }

  /**
   * Declared BEFORE `jobs/:id` on purpose — Nest matches routes in
   * declaration order, and below it every request for the history would be
   * read as a job whose id is the word "history" and rejected by ParseUUIDPipe.
   */
  @Get('jobs/history')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async listJobHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RiderJobHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<RiderDeliveryJobDto>>> {
    const data = await this.deliveryService.listRiderJobHistory(
      user.id,
      query.page,
      query.pageSize,
    );
    return { success: true, data };
  }

  @Get('jobs/:id')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async getJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RiderDeliveryJobDto>> {
    const data = await this.deliveryService.getRiderJob(user.id, id);
    return { success: true, data };
  }

  @Post('jobs/:id/accept')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async acceptJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.acceptJob(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('jobs/:id/reject')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async rejectJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.rejectJob(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('jobs/:id/pickup')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async pickUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.pickUp(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('jobs/:id/location')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LocationUpdateDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<TrackingDto>> {
    const data = await this.trackingService.recordLocation(
      id,
      user.id,
      {
        latitude: dto.latitude,
        longitude: dto.longitude,
        ...(dto.heading !== undefined ? { heading: dto.heading } : {}),
        ...(dto.speed !== undefined ? { speed: dto.speed } : {}),
        ...(dto.accuracy !== undefined ? { accuracy: dto.accuracy } : {}),
      },
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('jobs/:id/arrived')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async arrived(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.arrived(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('jobs/:id/deliver')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async deliver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeliverProofDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.deliver(
      user.id,
      id,
      {
        proofType: dto.proofType,
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.otp !== undefined ? { otp: dto.otp } : {}),
        ...(dto.signatureUrl !== undefined ? { signatureUrl: dto.signatureUrl } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  /// DPX-COMMERCIAL-001 Slice 3 — the rider's cash-collection confirmation.
  @Post('jobs/:id/confirm-cash')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async confirmCash(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmCashDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.confirmCash(
      user.id,
      id,
      dto.amountCollected,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('jobs/:id/fail')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async fail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FailDeliveryDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.fail(
      user.id,
      id,
      dto.reason,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('jobs/:id/return')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async returnJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FailDeliveryDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DeliveryJobDto>> {
    const data = await this.deliveryService.returnJob(
      user.id,
      id,
      dto.reason,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('availability')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RiderAvailabilityDto,
  ): Promise<ApiSuccessResponse<RiderLocationDto>> {
    const data = await this.deliveryService.updateRiderAvailability(user.id, {
      online: dto.online,
      acceptingOrders: dto.acceptingOrders,
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
    });
    return { success: true, data };
  }

  /**
   * The rider's stored availability. Without this the rider app assumes offline
   * on every load, so its "You are live" banner could contradict the server —
   * and a rider who believed they were online would never be dispatched.
   * Mirrors GET /driver/rides/availability. Null until the rider first goes
   * online.
   */
  @Get('availability')
  @RequirePermissions(DELIVERY_PERMISSIONS.RIDER_MANAGE)
  public async getAvailability(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<RiderLocationDto | null>> {
    const data = await this.deliveryService.getOwnRiderAvailability(user.id);
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
