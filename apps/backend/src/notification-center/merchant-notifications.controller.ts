import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { UpdateNotificationPreferencesDto } from './dto/notification-preference.dto';
import { ListNotificationsQueryDto } from './dto/notification.dto';
import { NOTIFICATION_CENTER_PERMISSIONS } from './notification-center.constants';
import { NotificationCenterService } from './notification-center.service';

import type { NotificationListResult } from './notification-center.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Notification, NotificationPreference } from '@prisma/client';
import type { Request } from 'express';

/**
 * DPX-MERCHANT-009 — same `NotificationCenterService` as
 * `CustomerNotificationsController`/`DriverNotificationsController` — a
 * notification's `userId` isn't portal-scoped, and merchants already
 * receive real rows here (ORDER_PLACED, LOW_INVENTORY, MERCHANT_APPROVAL,
 * WITHDRAWAL_*, etc. — see `NotificationType`), they just had no route to
 * read them and the SDK's `notifications` client pointed at
 * `/customer/notifications`, not `/merchant/notifications`. Mirrors the
 * customer controller (including preferences) rather than adding new
 * service logic.
 */
@Controller('merchant/notifications')
export class MerchantNotificationsController {
  constructor(private readonly notificationCenter: NotificationCenterService) {}

  @Get()
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_READ)
  public async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<ApiSuccessResponse<NotificationListResult>> {
    const data = await this.notificationCenter.list(user.id, query);
    return { success: true, data };
  }

  @Patch(':id/read')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE)
  public async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<Notification>> {
    const data = await this.notificationCenter.markRead(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('mark-all-read')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE)
  public async markAllRead(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ updated: number }>> {
    const data = await this.notificationCenter.markAllRead(
      user.id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE)
  public async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.notificationCenter.delete(user.id, id, this.auditContext(request, user.id));
  }

  @Get('preferences')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_READ)
  public async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<NotificationPreference[]>> {
    const data = await this.notificationCenter.listPreferences(user.id);
    return { success: true, data };
  }

  @Put('preferences')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.CUSTOMER_MANAGE)
  public async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferencesDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<NotificationPreference[]>> {
    const data = await this.notificationCenter.updatePreferences(
      user.id,
      dto,
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
