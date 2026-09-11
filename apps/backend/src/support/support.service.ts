import { Injectable } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  SupportPersona,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { NotificationCenterService } from '../notification-center/notification-center.service';
import { PrismaService } from '../prisma/prisma.service';

import { personaFor } from './support-persona.util';
import { requiresHumanHandling, SUPPORT_AUDIT_ACTIONS } from './support.constants';
import { toSupportTicketDto } from './support.mapper';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import type { ListSupportTicketsQueryDto } from './dto/list-support-tickets-query.dto';
import type { UpdateSupportTicketDto } from './dto/update-support-ticket.dto';
import type { SupportTicketDto, SupportTicketListDto } from '@dripplex/types';
import type { SupportTicket } from '@prisma/client';

/**
 * DPX-SUPPORT-001 Phase 1 — one support channel for every persona.
 *
 * Supersedes `DriverSupportService`, which was keyed on `driverId` and so could
 * only ever serve drivers. Everyone else — customers, merchants, riders, fleet
 * owners — was given an email address that lands in an inbox and never in the
 * Operations queue: no ticket, no status, no audit trail, no way for anyone to
 * say how many are outstanding.
 *
 * Tickets feed `OperationsCasesService`, the queue that already carries SOS
 * alerts and incident reports. That is the whole design constraint: Operations
 * gets one place to look, not a second support system beside the first.
 *
 * Not in this phase, and not accidentally missing: guest (unauthenticated)
 * support, and any automated first-line triage.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationCenter: NotificationCenterService,
  ) {}

  public async createTicket(
    user: AuthenticatedUser,
    dto: CreateSupportTicketDto,
    context: AuditContext,
  ): Promise<SupportTicketDto> {
    // Persona comes from the session here, and from the caller in
    // `createTicketFor` — never from `dto`, which has no field for it.
    return toSupportTicketDto(await this.createTicketFor(user.id, personaFor(user), dto, context));
  }

  /**
   * Create on behalf of a caller that already knows the persona.
   *
   * Exists for `/driver/support-tickets`, which deployed driver builds still
   * call: those routes are the driver app's by definition, so the persona is
   * the route's rather than the session's. Returns the row, not the DTO,
   * because that adapter renders its own legacy shape.
   */
  public async createTicketFor(
    userId: string,
    persona: SupportPersona,
    dto: CreateSupportTicketDto,
    context: AuditContext,
  ): Promise<SupportTicket> {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
    if (!account) {
      throw new NotFoundDomainException('User not found');
    }

    // A reference to someone else's order or ride is not a harmless mistake:
    // Operations reads it as context about the person they are talking to, so
    // an unowned reference is a way to point staff at a stranger's business.
    await this.assertOrderBelongsToUser(userId, dto.orderId);
    await this.assertRideBelongsToUser(userId, dto.rideId);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        persona,
        category: dto.category,
        subject: dto.subject.trim(),
        description: dto.description.trim(),
        // Category, never the request body.
        requiresHumanHandling: requiresHumanHandling(dto.category),
        // Fall back to the account's own details, so Operations is not asking
        // someone who is already unhappy to tell them who they are.
        contactEmail: dto.contactEmail ?? account.email,
        contactPhone: dto.contactPhone ?? account.phone,
        appVersion: dto.appVersion ?? null,
        orderId: dto.orderId ?? null,
        rideId: dto.rideId ?? null,
      },
    });

    await this.auditService.record(
      SUPPORT_AUDIT_ACTIONS.TICKET_CREATED,
      { ...context, userId },
      {
        resource: 'support_ticket',
        resourceId: ticket.id,
        metadata: {
          persona: ticket.persona,
          category: ticket.category,
          requiresHumanHandling: ticket.requiresHumanHandling,
        },
      },
    );

    return ticket;
  }

  public async listOwnTickets(userId: string): Promise<SupportTicketDto[]> {
    return (await this.listOwnTicketRows(userId)).map(toSupportTicketDto);
  }

  /** Rows rather than DTOs, for the legacy driver adapter. `persona` narrows to
   *  one channel's tickets; omitted, it is everything the user has filed. */
  public async listOwnTicketRows(
    userId: string,
    persona?: SupportPersona,
  ): Promise<SupportTicket[]> {
    return await this.prisma.supportTicket.findMany({
      where: { userId, ...(persona !== undefined ? { persona } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async getOwnTicket(userId: string, ticketId: string): Promise<SupportTicketDto> {
    return toSupportTicketDto(await this.getOwnTicketRow(userId, ticketId));
  }

  public async getOwnTicketRow(userId: string, ticketId: string): Promise<SupportTicket> {
    return await this.requireOwnedTicket(userId, ticketId);
  }

  /** Operations only. */
  public async listTickets(query: ListSupportTicketsQueryDto): Promise<SupportTicketListDto> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.persona ? { persona: query.persona } : {}),
      ...(query.category ? { category: query.category } : {}),
    };

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      items: tickets.map(toSupportTicketDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Operations only. Any change notifies the filer in-app: a ticket nobody ever
   * hears back on is worse than no ticket system, because it also spends the
   * trust that made them file it.
   */
  public async updateTicket(
    ticketId: string,
    adminUserId: string,
    dto: UpdateSupportTicketDto,
    context: AuditContext,
  ): Promise<SupportTicketDto> {
    const existing = await this.requireTicket(ticketId);

    const isResolving =
      dto.status !== undefined &&
      dto.status !== existing.status &&
      (dto.status === 'RESOLVED' || dto.status === 'CLOSED');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminResponse !== undefined ? { adminResponse: dto.adminResponse.trim() } : {}),
        ...(isResolving ? { resolvedBy: adminUserId, resolvedAt: new Date() } : {}),
      },
    });

    await this.auditService.record(
      isResolving ? SUPPORT_AUDIT_ACTIONS.TICKET_RESOLVED : SUPPORT_AUDIT_ACTIONS.TICKET_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'support_ticket',
        resourceId: updated.id,
        metadata: {
          status: updated.status,
          previousStatus: existing.status,
          hasResponse: dto.adminResponse !== undefined,
        },
      },
    );

    await this.notificationCenter.send({
      userId: updated.userId,
      category: NotificationCategory.SUPPORT,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.SUPPORT_TICKET_UPDATED,
      title: 'Support ticket updated',
      body:
        dto.adminResponse ??
        `Your ticket is now ${updated.status.toLowerCase().replace('_', ' ')}.`,
      payload: { ticketId: updated.id, status: updated.status },
    });

    return toSupportTicketDto(updated);
  }

  private async requireTicket(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundDomainException('Support ticket not found');
    }
    return ticket;
  }

  private async requireOwnedTicket(userId: string, ticketId: string): Promise<SupportTicket> {
    const ticket = await this.requireTicket(ticketId);
    if (ticket.userId !== userId) {
      throw new ForbiddenDomainException('You do not have access to this support ticket');
    }
    return ticket;
  }

  /** A party to the order: the customer who placed it, the merchant who sells
   *  through it, or the rider carrying it. */
  private async assertOrderBelongsToUser(userId: string, orderId?: string): Promise<void> {
    if (orderId === undefined) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        customerId: true,
        merchantId: true,
        deliveryJobs: { select: { riderId: true } },
      },
    });
    if (!order) {
      throw new ValidationDomainException('Order not found');
    }

    if (order.customerId === userId) return;
    if (order.deliveryJobs.some((job) => job.riderId === userId)) return;

    // `Order.merchantId` points at a MerchantProfile and carries no relation
    // field, so the owning user needs its own lookup. Done last, because the
    // two cheap checks above answer almost every real case.
    const merchant = await this.prisma.merchantProfile.findUnique({
      where: { id: order.merchantId },
      select: { userId: true },
    });
    if (merchant?.userId === userId) return;

    throw new ForbiddenDomainException('You are not a party to that order');
  }

  private async assertRideBelongsToUser(userId: string, rideId?: string): Promise<void> {
    if (rideId === undefined) return;

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      select: { customerId: true, driverId: true },
    });
    if (!ride) {
      throw new ValidationDomainException('Ride not found');
    }
    if (ride.customerId !== userId && ride.driverId !== userId) {
      throw new ForbiddenDomainException('You are not a party to that ride');
    }
  }
}
