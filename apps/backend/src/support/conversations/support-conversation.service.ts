import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SupportHandlingState,
  SupportMessageAuthorType,
  SupportMessageVisibility,
  type SupportConversation,
  type SupportMessage,
  type SupportTicket,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { SUPPORT_AUDIT_ACTIONS, SUPPORT_PERMISSIONS } from '../support.constants';
import { SupportService } from '../support.service';

import { toSupportMessageDto } from './support-conversation.mapper';
import {
  decideTransition,
  TransitionActor,
  type TransitionRefusal,
} from './support-conversation.transitions';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type {
  AppendOperatorSupportMessageRequest,
  AppendSupportMessageRequest,
  SupportMessageDto,
} from '@dripplex/types';

const MAX_BODY_LENGTH = 8000;

/**
 * DPX-SUPPORT-002 B2 — the conversation service.
 *
 * Provider-free and AI-free by construction. There is no provider SDK, no
 * model, no credential and no route here, and the §9 import-boundary test
 * asserts this module reaches no wallet, payment, settlement, payout, ledger,
 * commission or bank-account service.
 *
 * THREE THINGS THAT ARE STRUCTURAL RATHER THAN CHECKED
 *
 * 1. `authorType` and `authorId` are not parameters anywhere. They are fixed by
 *    which method was called. `{"authorType":"ASSISTANT"}` is not rejected —
 *    it is unrepresentable, because no method accepts it.
 *
 * 2. The transition ACTOR is the method, never an argument. A caller cannot
 *    claim to be SERVER, because no signature lets them say so.
 *
 * 3. `requiresHumanHandling` is read and never written. The structural test in
 *    `support-conversation.permissions.spec.ts` greps all of `src/` and pins
 *    the assignment list to B1's single create path; a write added here fails
 *    it without anyone having to think of looking.
 */
@Injectable()
export class SupportConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    /** Ownership only. `getOwnTicketRow` is B1's existing public front door to
     *  `requireOwnedTicket`, so this reuses the mutation-proven isolation path
     *  rather than adding a second way to decide who owns a ticket. */
    private readonly supportService: SupportService,
  ) {}

  /* ---------------------------------------------------------------------- */
  /* Reading                                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * The filer's transcript. INTERNAL messages are excluded **in the query**,
   * not filtered out of a fetched list: a post-filter is one refactor away from
   * being forgotten, and the failure mode is a leak.
   */
  public async getTranscriptForOwner(
    user: AuthenticatedUser,
    ticketId: string,
  ): Promise<SupportMessageDto[]> {
    await this.supportService.getOwnTicketRow(user.id, ticketId);
    const conversation = await this.findConversation(ticketId);
    if (conversation === null) return [];

    const messages = await this.prisma.supportMessage.findMany({
      where: {
        conversationId: conversation.id,
        visibility: SupportMessageVisibility.PARTICIPANTS,
      },
      orderBy: { seq: 'asc' },
    });
    return messages.map(toSupportMessageDto);
  }

  /** Operations. Sees everything, including INTERNAL. */
  public async getTranscriptForOperations(
    user: AuthenticatedUser,
    ticketId: string,
  ): Promise<SupportMessageDto[]> {
    this.requirePermission(user, SUPPORT_PERMISSIONS.ADMIN_MANAGE);
    await this.requireTicket(ticketId);
    const conversation = await this.findConversation(ticketId);
    if (conversation === null) return [];

    const messages = await this.prisma.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { seq: 'asc' },
    });
    return messages.map(toSupportMessageDto);
  }

  /* ---------------------------------------------------------------------- */
  /* Appending                                                               */
  /* ---------------------------------------------------------------------- */

  /** The filer writes. Always `USER`, always their own id, always PARTICIPANTS. */
  public async appendUserMessage(
    user: AuthenticatedUser,
    ticketId: string,
    request: AppendSupportMessageRequest,
    context: AuditContext,
  ): Promise<SupportMessageDto> {
    const ticket = await this.supportService.getOwnTicketRow(user.id, ticketId);
    return await this.append(ticket, context, {
      authorType: SupportMessageAuthorType.USER,
      authorId: user.id,
      body: request.body,
      visibility: SupportMessageVisibility.PARTICIPANTS,
      clientMessageId: request.clientMessageId,
    });
  }

  /** Operations writes. Always `HUMAN_AGENT`, always the operator's id. */
  public async appendOperatorMessage(
    user: AuthenticatedUser,
    ticketId: string,
    request: AppendOperatorSupportMessageRequest,
    context: AuditContext,
  ): Promise<SupportMessageDto> {
    this.requirePermission(user, SUPPORT_PERMISSIONS.ADMIN_MANAGE);
    const ticket = await this.requireTicket(ticketId);
    return await this.append(ticket, context, {
      authorType: SupportMessageAuthorType.HUMAN_AGENT,
      authorId: user.id,
      body: request.body,
      visibility:
        request.visibility === SupportMessageVisibility.INTERNAL
          ? SupportMessageVisibility.INTERNAL
          : SupportMessageVisibility.PARTICIPANTS,
      clientMessageId: request.clientMessageId,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Transitions — the actor is the method                                   */
  /* ---------------------------------------------------------------------- */

  /** The filer. In the approved table this reaches only RESOLVED -> REOPENED. */
  public async transitionByOwner(
    user: AuthenticatedUser,
    ticketId: string,
    to: SupportHandlingState,
    context: AuditContext,
  ): Promise<SupportTicket> {
    const ticket = await this.supportService.getOwnTicketRow(user.id, ticketId);
    return await this.transition(ticket, to, TransitionActor.USER, user, context);
  }

  /** Operations. Carries their server-side permission set, never a claim. */
  public async transitionByOperator(
    user: AuthenticatedUser,
    ticketId: string,
    to: SupportHandlingState,
    context: AuditContext,
  ): Promise<SupportTicket> {
    this.requirePermission(user, SUPPORT_PERMISSIONS.ADMIN_MANAGE);
    const ticket = await this.requireTicket(ticketId);
    return await this.transition(ticket, to, TransitionActor.OPERATOR, user, context);
  }

  /**
   * The server acting on its own reading — NOT a privileged user.
   *
   * Deliberately takes no `AuthenticatedUser`: there is no caller identity to
   * supply and therefore none to forge. No route reaches this in this
   * increment, and none should until B3 is separately reviewed.
   */
  public async transitionByServer(
    ticketId: string,
    to: SupportHandlingState,
    context: AuditContext = {},
  ): Promise<SupportTicket> {
    const ticket = await this.requireTicket(ticketId);
    return await this.transition(ticket, to, TransitionActor.SERVER, null, context);
  }

  /* ---------------------------------------------------------------------- */
  /* Internals                                                               */
  /* ---------------------------------------------------------------------- */

  private async transition(
    ticket: SupportTicket,
    to: SupportHandlingState,
    actor: TransitionActor,
    user: AuthenticatedUser | null,
    context: AuditContext,
  ): Promise<SupportTicket> {
    const decision = decideTransition({
      from: ticket.handlingState,
      to,
      actor,
      // Re-read from the row on EVERY decision, never cached and never carried
      // on the conversation. A ticket eligible when filed may have had a money
      // or safety term added since — §3's "re-read, never remembered".
      aiEligible: !ticket.requiresHumanHandling,
      // The authenticated actor's server-side permission set. Never a name
      // supplied by the caller.
      heldPermissions: user?.permissions ?? [],
    });

    if (!decision.allowed) {
      throw this.refusalToException(decision.refusal, ticket.handlingState, to);
    }

    // Outside the transaction on purpose — see ensureConversation. A
    // conversation that exists with no messages is valid and idempotent, so a
    // rolled-back transition leaves nothing incorrect behind.
    const conversation = await this.ensureConversation(ticket.id);

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id: ticket.id },
        // handlingState ONLY. requiresHumanHandling is B1's and is never
        // written here — see the structural test.
        data: { handlingState: to },
      });

      await tx.supportMessage.create({
        data: {
          conversationId: conversation.id,
          authorType: SupportMessageAuthorType.SYSTEM,
          authorId: null,
          body: `Handling state changed from ${ticket.handlingState} to ${to} by ${actor}.`,
          // Operational detail. INTERNAL by decision, not by omission.
          visibility: SupportMessageVisibility.INTERNAL,
        },
      });

      await this.auditService.record(
        SUPPORT_AUDIT_ACTIONS.HANDLING_STATE_CHANGED,
        { ...context, ...(user === null ? {} : { userId: user.id }) },
        {
          resource: 'support_ticket',
          resourceId: ticket.id,
          metadata: { from: ticket.handlingState, to, actor },
        },
      );

      return updated;
    });
  }

  private async append(
    ticket: SupportTicket,
    context: AuditContext,
    data: {
      authorType: SupportMessageAuthorType;
      authorId: string | null;
      body: string;
      visibility: SupportMessageVisibility;
      clientMessageId?: string | undefined;
    },
  ): Promise<SupportMessageDto> {
    const body = data.body.trim();
    if (body.length === 0) {
      throw new ValidationDomainException('A support message cannot be empty');
    }
    if (body.length > MAX_BODY_LENGTH) {
      throw new ValidationDomainException(
        `A support message cannot exceed ${String(MAX_BODY_LENGTH)} characters`,
      );
    }

    const conversation = await this.ensureConversation(ticket.id);

    // Idempotency. A retry returns the message it already wrote rather than
    // writing a second one; the unique (conversationId, clientMessageId) is
    // what decides, so two concurrent retries cannot both win.
    if (data.clientMessageId !== undefined) {
      const existing = await this.prisma.supportMessage.findFirst({
        where: { conversationId: conversation.id, clientMessageId: data.clientMessageId },
      });
      if (existing !== null) return toSupportMessageDto(existing);
    }

    let message: SupportMessage;
    try {
      message = await this.prisma.supportMessage.create({
        data: {
          conversationId: conversation.id,
          authorType: data.authorType,
          authorId: data.authorId,
          body,
          visibility: data.visibility,
          clientMessageId: data.clientMessageId ?? null,
        },
      });
    } catch (error) {
      // The check above is an optimisation; THIS is the guarantee. Two retries
      // racing both pass the read and one loses the unique — it must return the
      // winner's message, not an error.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        data.clientMessageId !== undefined
      ) {
        const winner = await this.prisma.supportMessage.findFirst({
          where: { conversationId: conversation.id, clientMessageId: data.clientMessageId },
        });
        if (winner !== null) return toSupportMessageDto(winner);
      }
      throw error;
    }

    await this.auditService.record(
      SUPPORT_AUDIT_ACTIONS.MESSAGE_APPENDED,
      { ...context, ...(data.authorId === null ? {} : { userId: data.authorId }) },
      {
        resource: 'support_message',
        resourceId: message.id,
        metadata: {
          ticketId: ticket.id,
          authorType: data.authorType,
          visibility: data.visibility,
        },
      },
    );

    return toSupportMessageDto(message);
  }

  /**
   * Exactly one conversation per ticket, for the life of the ticket. Reopening
   * REUSES it.
   *
   * NOT an upsert. Prisma's upsert reads and then inserts, so two concurrent
   * first-appends both miss and the loser gets a unique violation — proven by
   * the concurrency test, which failed against the upsert version of this
   * method. The `@unique ticketId` is what guarantees one conversation; this is
   * how the loser copes with having lost.
   *
   * Deliberately NOT called inside a transaction. In Postgres a unique
   * violation aborts the enclosing transaction, so the recovery read below
   * could not run there — the row would be gone along with everything else in
   * the transaction. Callers create the conversation first, then open their
   * transaction.
   */
  private async ensureConversation(ticketId: string): Promise<SupportConversation> {
    const existing = await this.prisma.supportConversation.findUnique({ where: { ticketId } });
    if (existing !== null) return existing;

    try {
      return await this.prisma.supportConversation.create({ data: { ticketId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.supportConversation.findUnique({ where: { ticketId } });
        if (winner !== null) return winner;
      }
      throw error;
    }
  }

  private async findConversation(ticketId: string): Promise<SupportConversation | null> {
    return await this.prisma.supportConversation.findUnique({ where: { ticketId } });
  }

  private async requireTicket(ticketId: string): Promise<SupportTicket> {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (ticket === null) {
      throw new NotFoundDomainException('Support ticket not found');
    }
    return ticket;
  }

  /** Against the authenticated actor's server-side set. Never a caller claim. */
  private requirePermission(user: AuthenticatedUser, permission: string): void {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenDomainException('You do not have access to this support ticket');
    }
  }

  private refusalToException(
    refusal: TransitionRefusal,
    from: SupportHandlingState,
    to: SupportHandlingState,
  ): Error {
    switch (refusal.kind) {
      case 'ILLEGAL':
        return new ValidationDomainException(`A support ticket cannot move from ${from} to ${to}`);
      case 'WRONG_ACTOR':
        return new ForbiddenDomainException(
          `Moving a support ticket from ${from} to ${to} is not yours to do`,
        );
      case 'NOT_AI_ELIGIBLE':
        // The permission is authority to ATTEMPT; eligibility is whether the
        // move is allowed at all. Holding ai-handoff never overrides this.
        return new ForbiddenDomainException(
          'This ticket is reserved for human handling and cannot be moved to automation',
        );
      case 'MISSING_PERMISSION':
        return new ForbiddenDomainException(
          `Moving a support ticket from ${from} to ${to} requires ${refusal.permission}`,
        );
    }
  }
}
