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

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { CreateDriverSupportTicketDto } from '../dto/create-driver-support-ticket.dto';
import { DriverSupportService } from '../support/driver-support.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverSupportTicketDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/support-tickets')
@RequirePermissions(DRIVER_PERMISSIONS.SUPPORT_TICKET_MANAGE)
export class DriverSupportController {
  constructor(private readonly supportService: DriverSupportService) {}

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverSupportTicketDto[]>> {
    const data = await this.supportService.listOwnTickets(user.id);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<DriverSupportTicketDto>> {
    const data = await this.supportService.getOwnTicket(user.id, id);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDriverSupportTicketDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverSupportTicketDto>> {
    const data = await this.supportService.createTicket(
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
