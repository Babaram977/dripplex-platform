import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { MessageContextType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { SendMessageDto } from './dto/message.dto';
import { MESSAGING_PERMISSIONS } from './messaging.constants';
import { MessagingService, type MessageDto } from './messaging.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

/**
 * DPX-CHAT-001 — a thread per delivery or ride.
 *
 * The permission only says "this kind of account may use messaging at all".
 * Access to a SPECIFIC thread is decided by MessagingService from the job's own
 * parties, so holding the permission never lets anyone read a conversation they
 * are not part of.
 */
@Controller('messages')
@RequirePermissions(MESSAGING_PERMISSIONS.USE)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('unread-count')
  public async unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<{ unread: number }>> {
    const unread = await this.messagingService.countUnread(user.id);
    return { success: true, data: { unread } };
  }

  @Get('delivery/:id')
  public async listDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<MessageDto[]>> {
    const data = await this.messagingService.listMessages(user.id, MessageContextType.DELIVERY, id);
    return { success: true, data };
  }

  @Post('delivery/:id')
  public async sendDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MessageDto>> {
    const data = await this.messagingService.sendMessage(
      user.id,
      MessageContextType.DELIVERY,
      id,
      dto.body,
      this.auditContext(request),
    );
    return { success: true, data };
  }

  @Get('ride/:id')
  public async listRide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<MessageDto[]>> {
    const data = await this.messagingService.listMessages(user.id, MessageContextType.RIDE, id);
    return { success: true, data };
  }

  @Post('ride/:id')
  public async sendRide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MessageDto>> {
    const data = await this.messagingService.sendMessage(
      user.id,
      MessageContextType.RIDE,
      id,
      dto.body,
      this.auditContext(request),
    );
    return { success: true, data };
  }

  private auditContext(request: Request): { ipAddress?: string; userAgent?: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;
    const userAgent = request.headers['user-agent'];
    return {
      ...(ipAddress ? { ipAddress } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
    };
  }
}
