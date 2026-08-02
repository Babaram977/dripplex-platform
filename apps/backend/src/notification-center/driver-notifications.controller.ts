import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { ListNotificationsQueryDto } from './dto/notification.dto';
import { NOTIFICATION_CENTER_PERMISSIONS } from './notification-center.constants';
import { NotificationCenterService } from './notification-center.service';

import type { NotificationListResult } from './notification-center.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Notification } from '@prisma/client';
import type { Request } from 'express';

/**
 * Same NotificationCenterService as CustomerNotificationsController — a
 * notification's userId isn't portal-scoped, drivers already receive real
 * rows here (DRIVER_REFERRAL_* events), they just had no route to read
 * them. Mirrors the customer controller rather than adding new service
 * logic.
 */
@Controller('driver/notifications')
export class DriverNotificationsController {
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
