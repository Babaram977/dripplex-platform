import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from './dto/notification-template.dto';
import { BroadcastNotificationDto } from './dto/notification.dto';
import { NOTIFICATION_CENTER_PERMISSIONS } from './notification-center.constants';
import {
  type BroadcastNotificationResult,
  NotificationCenterService,
} from './notification-center.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Notification, NotificationTemplate } from '@prisma/client';
import type { Request } from 'express';

@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationCenter: NotificationCenterService) {}

  @Get('templates')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE)
  public async listTemplates(): Promise<ApiSuccessResponse<NotificationTemplate[]>> {
    const data = await this.notificationCenter.listTemplates();
    return { success: true, data };
  }

  @Get('templates/:code')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE)
  public async getTemplate(
    @Param('code') code: string,
  ): Promise<ApiSuccessResponse<NotificationTemplate>> {
    const data = await this.notificationCenter.getTemplate(code);
    return { success: true, data };
  }

  @Post('templates')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE)
  public async createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNotificationTemplateDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<NotificationTemplate>> {
    const data = await this.notificationCenter.createTemplate(
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Patch('templates/:code')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE)
  public async updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: UpdateNotificationTemplateDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<NotificationTemplate>> {
    const data = await this.notificationCenter.updateTemplate(
      code,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Delete('templates/:code')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE)
  public async deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ deleted: true }>> {
    await this.notificationCenter.deleteTemplate(code, this.auditContext(request, user.id));
    return { success: true, data: { deleted: true } };
  }

  @Post('broadcast')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE)
  public async broadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BroadcastNotificationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BroadcastNotificationResult>> {
    const data = await this.notificationCenter.broadcast(dto, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post(':id/resend')
  @RequirePermissions(NOTIFICATION_CENTER_PERMISSIONS.ADMIN_MANAGE)
  public async resend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<Notification>> {
    const data = await this.notificationCenter.resend(id, this.auditContext(request, user.id));
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
