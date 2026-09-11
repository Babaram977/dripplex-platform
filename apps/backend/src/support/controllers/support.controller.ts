import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateSupportTicketDto } from '../dto/create-support-ticket.dto';
import { SUPPORT_PERMISSIONS } from '../support.constants';
import { SupportService } from '../support.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { SupportTicketDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-SUPPORT-001 Phase 1 — the one route every persona files through.
 *
 * Not under `/customer`, `/driver` or `/merchant`: the whole point is that the
 * path does not encode who you are. The server reads that from the session.
 */
@Controller('support/tickets')
@RequirePermissions(SUPPORT_PERMISSIONS.TICKETS_USE)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<SupportTicketDto[]>> {
    const data = await this.supportService.listOwnTickets(user.id);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<SupportTicketDto>> {
    const data = await this.supportService.getOwnTicket(user.id, id);
    return { success: true, data };
  }

  /**
   * Ten an hour. Generous for anybody with a real problem — nobody has ten
   * distinct problems an hour — and low enough that a script cannot bury the
   * Operations queue under a persona's whole ticket history.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportTicketDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<SupportTicketDto>> {
    const data = await this.supportService.createTicket(user, dto, auditContext(request, user.id));
    return { success: true, data };
  }
}

export function auditContext(
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
