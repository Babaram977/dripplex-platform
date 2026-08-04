import { Injectable } from '@nestjs/common';
import { NotificationCategory, NotificationChannel, NotificationType } from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { NotificationCenterService } from '../../notification-center/notification-center.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS } from '../driver.constants';

import { toDriverSupportTicketDto } from './driver-support.mapper';

import type { CreateDriverSupportTicketDto } from '../dto/create-driver-support-ticket.dto';
import type { ListDriverSupportTicketsQueryDto } from '../dto/list-driver-support-tickets-query.dto';
import type { UpdateDriverSupportTicketDto } from '../dto/update-driver-support-ticket.dto';
import type { DriverSupportTicketDto, DriverSupportTicketListDto } from '@dripplex/types';
import type { DriverSupportTicket } from '@prisma/client';

/** Driver Slice 2 item 3 — Driver Support (founder-approved 2026-08-04): "a
 * basic 'submit an issue, admin sees a queue' loop is a defensible v1, not
 * a full helpdesk platform" (from `docs/DRIVER-SLICE-2-AUDIT.md`). General
 * account/payout/app/KYC support — distinct from the ride-scoped
 * `RideProblemReport` and from the safety-relevant Incident Reporting item. */
@Injectable()
export class DriverSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationCenter: NotificationCenterService,
  ) {}

  public async createTicket(
    driverUserId: string,
    dto: CreateDriverSupportTicketDto,
    context: AuditContext,
  ): Promise<DriverSupportTicketDto> {
    const ticket = await this.prisma.driverSupportTicket.create({
      data: {
        driverId: driverUserId,
        category: dto.category,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SUPPORT_TICKET_SUBMITTED,
      { ...context, userId: driverUserId },
      {
        resource: 'driver_support_ticket',
        resourceId: ticket.id,
        metadata: { category: ticket.category },
      },
    );

    return toDriverSupportTicketDto(ticket);
  }

  public async listOwnTickets(driverUserId: string): Promise<DriverSupportTicketDto[]> {
    const tickets = await this.prisma.driverSupportTicket.findMany({
      where: { driverId: driverUserId },
      orderBy: { createdAt: 'desc' },
    });
    return tickets.map(toDriverSupportTicketDto);
  }

  public async getOwnTicket(
    driverUserId: string,
    ticketId: string,
  ): Promise<DriverSupportTicketDto> {
    const ticket = await this.requireOwnedTicket(driverUserId, ticketId);
    return toDriverSupportTicketDto(ticket);
  }

  public async listTickets(
    query: ListDriverSupportTicketsQueryDto,
  ): Promise<DriverSupportTicketListDto> {
    const where = query.status ? { status: query.status } : {};
    const [tickets, total] = await Promise.all([
      this.prisma.driverSupportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.driverSupportTicket.count({ where }),
    ]);

    return {
      items: tickets.map(toDriverSupportTicketDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /** Admin-only. Any change (status and/or a response) notifies the driver
   * in-app — a ticket a driver never hears back on is worse than no ticket
   * system at all. */
  public async updateTicket(
    ticketId: string,
    adminUserId: string,
    dto: UpdateDriverSupportTicketDto,
    context: AuditContext,
  ): Promise<DriverSupportTicketDto> {
    const existing = await this.requireTicket(ticketId);

    const isResolving =
      dto.status !== undefined &&
      dto.status !== existing.status &&
      (dto.status === 'RESOLVED' || dto.status === 'CLOSED');

    const updated = await this.prisma.driverSupportTicket.update({
      where: { id: ticketId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminResponse !== undefined ? { adminResponse: dto.adminResponse.trim() } : {}),
        ...(isResolving ? { resolvedBy: adminUserId, resolvedAt: new Date() } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SUPPORT_TICKET_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'driver_support_ticket',
        resourceId: updated.id,
        metadata: { status: updated.status, hasResponse: dto.adminResponse !== undefined },
      },
    );

    await this.notificationCenter.send({
      userId: updated.driverId,
      category: NotificationCategory.SUPPORT,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.DRIVER_SUPPORT_TICKET_UPDATED,
      title: 'Support ticket updated',
      body:
        dto.adminResponse ??
        `Your ticket is now ${updated.status.toLowerCase().replace('_', ' ')}.`,
      payload: { ticketId: updated.id, status: updated.status },
    });

    return toDriverSupportTicketDto(updated);
  }

  private async requireTicket(ticketId: string): Promise<DriverSupportTicket> {
    const ticket = await this.prisma.driverSupportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundDomainException('Support ticket not found');
    }
    return ticket;
  }

  private async requireOwnedTicket(
    driverUserId: string,
    ticketId: string,
  ): Promise<DriverSupportTicket> {
    const ticket = await this.requireTicket(ticketId);
    if (ticket.driverId !== driverUserId) {
      throw new ForbiddenDomainException('You do not have access to this support ticket');
    }
    return ticket;
  }
}
