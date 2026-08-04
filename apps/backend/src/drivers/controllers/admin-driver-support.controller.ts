import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { ListDriverSupportTicketsQueryDto } from '../dto/list-driver-support-tickets-query.dto';
import { UpdateDriverSupportTicketDto } from '../dto/update-driver-support-ticket.dto';
import { DriverSupportService } from '../support/driver-support.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverSupportTicketDto, DriverSupportTicketListDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin/driver-support-tickets')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_SUPPORT_TICKET_MANAGE)
export class AdminDriverSupportController {
  constructor(private readonly supportService: DriverSupportService) {}

  @Get()
  public async list(
    @Query() query: ListDriverSupportTicketsQueryDto,
  ): Promise<ApiSuccessResponse<DriverSupportTicketListDto>> {
    const data = await this.supportService.listTickets(query);
    return { success: true, data };
  }

  @Patch(':id')
  public async update(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverSupportTicketDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverSupportTicketDto>> {
    const data = await this.supportService.updateTicket(
      id,
      admin.id,
      dto,
      this.auditContext(request, admin.id),
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
