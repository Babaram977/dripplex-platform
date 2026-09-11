import { Injectable } from '@nestjs/common';
import { SupportPersona } from '@prisma/client';

import { SupportService } from '../../support/support.service';

import { toDriverSupportTicketDto, toSupportCategory } from './driver-support.mapper';

import type { AuditContext } from '../../audit/audit.service';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { CreateDriverSupportTicketDto } from '../dto/create-driver-support-ticket.dto';
import type { DriverSupportTicketDto } from '@dripplex/types';

/**
 * `/driver/support-tickets` — kept alive, no longer a separate system.
 *
 * Driver Slice 2 item 3 (founder-approved 2026-08-04) built this as "a basic
 * 'submit an issue, admin sees a queue' loop". DPX-SUPPORT-001 replaced the
 * queue underneath it with one that serves every persona, so this class became
 * an adapter: same routes, same request and response shapes, writing into
 * `SupportTicket` like everything else.
 *
 * It is an adapter and not a deletion because DrippleX is on the Play Store and
 * driver builds already in people's hands call these routes. Removing them
 * would break support for the drivers most likely to need it — the ones who
 * have not updated.
 *
 * What it must never become again is a second writer. `driver_support_tickets`
 * is now history only: the Operations queue reads `support_tickets`, so a
 * ticket written to the old table would be one nobody ever sees. That is the
 * regression this class exists to prevent, and `driver-support.adapter.db.spec`
 * is what proves it has not returned.
 */
@Injectable()
export class DriverSupportService {
  constructor(private readonly support: SupportService) {}

  public async createTicket(
    user: AuthenticatedUser,
    dto: CreateDriverSupportTicketDto,
    context: AuditContext,
  ): Promise<DriverSupportTicketDto> {
    const ticket = await this.support.createTicketFor(
      user.id,
      // Forced, not derived. These routes are the driver app's, whatever the
      // session's portal claim happens to say.
      SupportPersona.DRIVER,
      {
        category: toSupportCategory(dto.category),
        subject: dto.subject,
        description: dto.description,
      },
      context,
    );
    return toDriverSupportTicketDto(ticket);
  }

  /** Only the driver's own DRIVER-persona tickets. The same human's customer
   *  tickets are their customer support history and belong in the customer
   *  app, not in a list the driver app labels "driver support". */
  public async listOwnTickets(driverUserId: string): Promise<DriverSupportTicketDto[]> {
    const tickets = await this.support.listOwnTicketRows(driverUserId, SupportPersona.DRIVER);
    return tickets.map(toDriverSupportTicketDto);
  }

  public async getOwnTicket(
    driverUserId: string,
    ticketId: string,
  ): Promise<DriverSupportTicketDto> {
    return toDriverSupportTicketDto(await this.support.getOwnTicketRow(driverUserId, ticketId));
  }
}
