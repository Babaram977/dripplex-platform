import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  SupportCategory,
  SupportHandlingState,
  SupportMessageAuthorType,
  SupportMessageVisibility,
  SupportPersona,
} from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-SUPPORT-002 B2 — the guarantees, tested against the database that makes
 * them rather than through a service that could be changed.
 *
 * Every assertion here is deliberately at the Prisma/SQL level. The service
 * layer is where these rules are convenient; the database is where they are
 * true, and the point of B2 is to fit the locks before the AI is standing in
 * the doorway.
 */
describe('support conversations — database guarantees', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let userId: string;
  const ticketIds: string[] = [];

  const makeTicket = async (requiresHumanHandling: boolean): Promise<string> => {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        persona: SupportPersona.CUSTOMER,
        category: requiresHumanHandling ? SupportCategory.PAYMENT : SupportCategory.TECHNICAL,
        subject: 'Subject',
        description: 'A description long enough to be realistic.',
        requiresHumanHandling,
      },
    });
    ticketIds.push(ticket.id);
    return ticket.id;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: `b2-conversation-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'B2',
        lastName: 'Conversation',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      // Messages cascade from conversations, which cascade from tickets.
      await prisma.supportTicket.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  // --- the B1 safety invariant, now enforced by the database ---------------

  it('refuses AI_HANDLING on a ticket the gate marked for human handling', async () => {
    if (!databaseAvailable) return;

    const ticketId = await makeTicket(true);

    // Not "the service refuses" — the database refuses. A future admin screen,
    // an internal service, or a migration script all hit the same wall.
    await expect(
      prisma.supportTicket.update({
        where: { id: ticketId },
        data: { handlingState: SupportHandlingState.AI_HANDLING },
      }),
    ).rejects.toThrow(/support_tickets_human_handling_not_ai/);
  });

  it('refuses it at insert time too, not only on update', async () => {
    if (!databaseAvailable) return;

    await expect(
      prisma.supportTicket.create({
        data: {
          userId,
          persona: SupportPersona.CUSTOMER,
          category: SupportCategory.SAFETY,
          subject: 'Subject',
          description: 'A description long enough to be realistic.',
          requiresHumanHandling: true,
          handlingState: SupportHandlingState.AI_HANDLING,
        },
      }),
    ).rejects.toThrow(/support_tickets_human_handling_not_ai/);
  });

  it('refuses it even when a human handled the ticket first', async () => {
    if (!databaseAvailable) return;

    // The case the architecture calls out explicitly: a human took it, and now
    // somebody wants automation to continue. Still no.
    const ticketId = await makeTicket(true);
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { handlingState: SupportHandlingState.HUMAN_HANDLING },
    });

    await expect(
      prisma.supportTicket.update({
        where: { id: ticketId },
        data: { handlingState: SupportHandlingState.AI_HANDLING },
      }),
    ).rejects.toThrow(/support_tickets_human_handling_not_ai/);
  });

  it('allows AI_HANDLING on a ticket the gate left eligible', async () => {
    if (!databaseAvailable) return;

    // The constraint must not be a blanket ban, or the gate means nothing.
    const ticketId = await makeTicket(false);
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { handlingState: SupportHandlingState.AI_HANDLING },
    });
    expect(updated.handlingState).toBe(SupportHandlingState.AI_HANDLING);
  });

  it('defaults a new ticket to OPEN', async () => {
    if (!databaseAvailable) return;
    const ticketId = await makeTicket(false);
    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    expect(ticket?.handlingState).toBe(SupportHandlingState.OPEN);
  });

  // --- one conversation per ticket -----------------------------------------

  it('allows exactly one conversation per ticket', async () => {
    if (!databaseAvailable) return;

    const ticketId = await makeTicket(false);
    await prisma.supportConversation.create({ data: { ticketId } });

    // Reopening reuses this conversation. A second one is not a supported
    // state, so "which one is live" is a question that cannot arise.
    await expect(prisma.supportConversation.create({ data: { ticketId } })).rejects.toThrow();
  });

  it('keeps the conversation across a reopen', async () => {
    if (!databaseAvailable) return;

    const ticketId = await makeTicket(false);
    const conversation = await prisma.supportConversation.create({ data: { ticketId } });

    for (const handlingState of [
      SupportHandlingState.HUMAN_HANDLING,
      SupportHandlingState.RESOLVED,
      SupportHandlingState.REOPENED,
      SupportHandlingState.HUMAN_HANDLING,
      SupportHandlingState.RESOLVED,
    ]) {
      await prisma.supportTicket.update({ where: { id: ticketId }, data: { handlingState } });
    }

    const after = await prisma.supportConversation.findUnique({ where: { ticketId } });
    expect(after?.id).toBe(conversation.id);
    expect(await prisma.supportConversation.count({ where: { ticketId } })).toBe(1);
  });

  // --- append-only ----------------------------------------------------------

  describe('immutability', () => {
    let conversationId: string;
    let messageId: string;

    beforeAll(async () => {
      if (!databaseAvailable) return;
      const ticketId = await makeTicket(false);
      const conversation = await prisma.supportConversation.create({ data: { ticketId } });
      conversationId = conversation.id;
      const message = await prisma.supportMessage.create({
        data: {
          conversationId,
          authorType: SupportMessageAuthorType.USER,
          authorId: userId,
          body: 'The original text, which must survive.',
        },
      });
      messageId = message.id;
    });

    it('has the append-only trigger installed', async () => {
      if (!databaseAvailable) return;

      // Asserted directly, because `prisma migrate diff` cannot see a trigger
      // and so will never report it missing. A clean diff is not evidence that
      // this control exists — this test is.
      const rows = await prisma.$queryRawUnsafe<{ tgname: string }[]>(
        `SELECT tgname FROM pg_trigger
         WHERE NOT tgisinternal AND tgrelid = 'support_messages'::regclass`,
      );
      expect(rows.map((row) => row.tgname)).toContain('support_messages_append_only');
    });

    it('rejects an UPDATE', async () => {
      if (!databaseAvailable) return;
      await expect(
        prisma.supportMessage.update({ where: { id: messageId }, data: { body: 'tampered' } }),
      ).rejects.toThrow(/append-only/);
    });

    it('rejects a DELETE', async () => {
      if (!databaseAvailable) return;
      await expect(prisma.supportMessage.delete({ where: { id: messageId } })).rejects.toThrow(
        /append-only/,
      );
    });

    it('leaves the original text intact after both attempts', async () => {
      if (!databaseAvailable) return;
      const message = await prisma.supportMessage.findUnique({ where: { id: messageId } });
      expect(message?.body).toBe('The original text, which must survive.');
    });

    it('still allows INSERT — append-only, not read-only', async () => {
      if (!databaseAvailable) return;
      const appended = await prisma.supportMessage.create({
        data: {
          conversationId,
          authorType: SupportMessageAuthorType.HUMAN_AGENT,
          authorId: userId,
          body: 'A correction is a new message.',
        },
      });
      expect(appended.id).not.toBe(messageId);
    });
  });

  // --- redaction is beside the record, not a mutation of it -----------------

  it('records redaction on a new row rather than by changing the original', async () => {
    if (!databaseAvailable) return;

    const ticketId = await makeTicket(false);
    const conversation = await prisma.supportConversation.create({ data: { ticketId } });
    const original = await prisma.supportMessage.create({
      data: {
        conversationId: conversation.id,
        authorType: SupportMessageAuthorType.USER,
        authorId: userId,
        body: 'Contains something that may later need redacting.',
      },
    });

    // The fields exist so a retention obligation can be met without anyone
    // reaching for the one thing that would satisfy it by breaking the
    // immutability control — which is how such controls get dropped in good
    // faith.
    await expect(
      prisma.supportMessage.update({
        where: { id: original.id },
        data: { redactedAt: new Date(), redactedBy: userId, redactionNote: 'NDPR request' },
      }),
    ).rejects.toThrow(/append-only/);
  });

  // --- ordering, idempotency, visibility ------------------------------------

  it('orders messages by a monotonic sequence, not by timestamp', async () => {
    if (!databaseAvailable) return;

    const ticketId = await makeTicket(false);
    const conversation = await prisma.supportConversation.create({ data: { ticketId } });

    // Written in one batch so several can share a millisecond — which is the
    // reason `createdAt` is not the ordering.
    await Promise.all(
      ['first', 'second', 'third', 'fourth', 'fifth'].map(
        async (body) =>
          await prisma.supportMessage.create({
            data: {
              conversationId: conversation.id,
              authorType: SupportMessageAuthorType.USER,
              authorId: userId,
              body,
            },
          }),
      ),
    );

    const messages = await prisma.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { seq: 'asc' },
    });
    expect(messages).toHaveLength(5);
    const sequences = messages.map((message) => message.seq);
    const ascending = [...sequences].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(sequences).toEqual(ascending);
    expect(new Set(sequences.map(String)).size).toBe(5);
  });

  it('refuses a duplicate client message id within a conversation', async () => {
    if (!databaseAvailable) return;

    const ticketId = await makeTicket(false);
    const conversation = await prisma.supportConversation.create({ data: { ticketId } });
    const clientMessageId = randomUUID();

    await prisma.supportMessage.create({
      data: {
        conversationId: conversation.id,
        authorType: SupportMessageAuthorType.USER,
        authorId: userId,
        body: 'Sent once.',
        clientMessageId,
      },
    });

    // A phone on a bad connection retries. The second write must not land.
    await expect(
      prisma.supportMessage.create({
        data: {
          conversationId: conversation.id,
          authorType: SupportMessageAuthorType.USER,
          authorId: userId,
          body: 'Sent once.',
          clientMessageId,
        },
      }),
    ).rejects.toThrow();
  });

  it('defaults a message to participant-visible, and can mark one internal', async () => {
    if (!databaseAvailable) return;

    const ticketId = await makeTicket(false);
    const conversation = await prisma.supportConversation.create({ data: { ticketId } });

    const shown = await prisma.supportMessage.create({
      data: {
        conversationId: conversation.id,
        authorType: SupportMessageAuthorType.SYSTEM,
        body: 'Your request has been transferred to a support specialist.',
      },
    });
    const hidden = await prisma.supportMessage.create({
      data: {
        conversationId: conversation.id,
        authorType: SupportMessageAuthorType.SYSTEM,
        body: 'Internal control record.',
        visibility: SupportMessageVisibility.INTERNAL,
      },
    });

    // Both are SYSTEM. Visibility is its own field precisely so that the second
    // one is not shown to the filer merely because nobody decided otherwise.
    expect(shown.visibility).toBe(SupportMessageVisibility.PARTICIPANTS);
    expect(hidden.visibility).toBe(SupportMessageVisibility.INTERNAL);
  });
});
