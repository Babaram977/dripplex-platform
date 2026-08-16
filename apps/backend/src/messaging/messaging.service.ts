import { Injectable, Logger } from '@nestjs/common';
import { MessageContextType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RideGateway } from '../rides/ride.gateway';

import { MESSAGE_PAGE_SIZE, MESSAGING_AUDIT_ACTIONS } from './messaging.constants';

export interface MessageDto {
  id: string;
  contextType: MessageContextType;
  contextId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  body: string;
  mine: boolean;
  readAt: string | null;
  createdAt: string;
}

/** The two people a thread belongs to, resolved from the job itself. */
interface Participants {
  customerId: string;
  courierId: string | null;
}

/**
 * DPX-CHAT-001 — in-app messaging between the two parties of a live job.
 *
 * Until now the "Message" button next to a rider on the tracking screen was a
 * dead control: DrippleX had no messages table, no endpoints and no way for a
 * customer to reach the person carrying their order. A phone call was the only
 * channel, and only in one direction.
 *
 * This is deliberately NOT a general inbox. A thread is anchored to a delivery
 * job or a ride, and the participants are read from that job every time, so:
 *
 *   • a rider can only message the customer they are actually assigned to —
 *     there is no way to address a stranger;
 *   • authorisation cannot drift, because there is no membership list to keep
 *     in step with reassignment; hand a job to another rider and the previous
 *     one loses access on the next request;
 *   • a thread cannot outlive its reason to exist.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly gateway: RideGateway,
  ) {}

  public async listMessages(
    userId: string,
    contextType: MessageContextType,
    contextId: string,
  ): Promise<MessageDto[]> {
    await this.requireParticipant(userId, contextType, contextId);

    const messages = await this.prisma.message.findMany({
      where: { contextType, contextId },
      orderBy: { createdAt: 'asc' },
      take: MESSAGE_PAGE_SIZE,
      include: { sender: { select: { firstName: true, lastName: true } } },
    });

    // Opening the thread marks what was addressed to you as read — that is
    // what clears the unread badge, so it belongs here rather than in a
    // separate call the client might forget to make.
    await this.prisma.message.updateMany({
      where: { contextType, contextId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    return messages.map((message) => ({
      id: message.id,
      contextType: message.contextType,
      contextId: message.contextId,
      senderId: message.senderId,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim(),
      recipientId: message.recipientId,
      body: message.body,
      mine: message.senderId === userId,
      readAt: message.readAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    }));
  }

  public async sendMessage(
    userId: string,
    contextType: MessageContextType,
    contextId: string,
    body: string,
    context: AuditContext = {},
  ): Promise<MessageDto> {
    const participants = await this.requireParticipant(userId, contextType, contextId);
    const recipientId =
      userId === participants.customerId ? participants.courierId : participants.customerId;

    if (recipientId === null) {
      // No courier assigned yet — there is nobody on the other end, and a
      // message addressed to nobody would silently never be delivered.
      throw new NotFoundDomainException('Nobody is assigned to this job yet');
    }

    const created = await this.prisma.message.create({
      data: { contextType, contextId, senderId: userId, recipientId, body: body.trim() },
      include: { sender: { select: { firstName: true, lastName: true } } },
    });

    await this.auditService.record(
      MESSAGING_AUDIT_ACTIONS.SENT,
      { ...context, userId },
      { resource: 'message', resourceId: created.id, metadata: { contextType, contextId } },
    );

    const dto: MessageDto = {
      id: created.id,
      contextType: created.contextType,
      contextId: created.contextId,
      senderId: created.senderId,
      senderName: `${created.sender.firstName} ${created.sender.lastName}`.trim(),
      recipientId: created.recipientId,
      body: created.body,
      mine: true,
      readAt: null,
      createdAt: created.createdAt.toISOString(),
    };

    // Push to the recipient's socket so the other side sees it without waiting
    // for their next poll. Failure here must not fail the send — the message is
    // already stored and the client polls as a fallback.
    try {
      this.gateway.publishToUser(recipientId, 'message:new', { ...dto, mine: false });
    } catch (error) {
      this.logger.warn(
        `Stored message ${created.id} but could not push it: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return dto;
  }

  public async countUnread(userId: string): Promise<number> {
    return await this.prisma.message.count({ where: { recipientId: userId, readAt: null } });
  }

  /**
   * The whole authorisation model: you may read or write a thread if and only
   * if you are one of the two parties on the job it is anchored to. Read fresh
   * every time, so a reassignment takes effect immediately.
   */
  private async requireParticipant(
    userId: string,
    contextType: MessageContextType,
    contextId: string,
  ): Promise<Participants> {
    const participants = await this.resolveParticipants(contextType, contextId);
    if (userId !== participants.customerId && userId !== participants.courierId) {
      throw new ForbiddenDomainException('You are not part of this conversation');
    }
    return participants;
  }

  private async resolveParticipants(
    contextType: MessageContextType,
    contextId: string,
  ): Promise<Participants> {
    if (contextType === MessageContextType.DELIVERY) {
      const job = await this.prisma.deliveryJob.findUnique({ where: { id: contextId } });
      if (!job) {
        throw new NotFoundDomainException('Delivery not found');
      }
      return { customerId: job.customerId, courierId: job.riderId };
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: contextId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return { customerId: ride.customerId, courierId: ride.driverId };
  }
}
