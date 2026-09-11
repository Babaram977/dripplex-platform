import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ListSupportTicketsQueryDto } from '../dto/list-support-tickets-query.dto';
import { UpdateSupportTicketDto } from '../dto/update-support-ticket.dto';
import { SUPPORT_PERMISSIONS } from '../support.constants';
import { SupportService } from '../support.service';

import { auditContext } from './support.controller';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { SupportTicketDto, SupportTicketListDto } from '@dripplex/types';
import type { Request } from 'express';

/** DPX-SUPPORT-001 — the Operations side. The queue itself lives in
 *  `OperationsCasesService`; these routes are the direct list/answer surface
 *  behind the same permission. */
@Controller('admin/support/tickets')
@RequirePermissions(SUPPORT_PERMISSIONS.ADMIN_MANAGE)
export class AdminSupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  public async list(
    @Query() query: ListSupportTicketsQueryDto,
  ): Promise<ApiSuccessResponse<SupportTicketListDto>> {
    const data = await this.supportService.listTickets(query);
    return { success: true, data };
  }

  @Patch(':id')
  public async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportTicketDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<SupportTicketDto>> {
    const data = await this.supportService.updateTicket(
      id,
      user.id,
      dto,
      auditContext(request, user.id),
    );
    return { success: true, data };
  }
}
