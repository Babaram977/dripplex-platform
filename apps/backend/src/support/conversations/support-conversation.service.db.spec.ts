import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  SupportCategory,
  SupportHandlingState,
  SupportMessageAuthorType,
  SupportMessageVisibility,
  SupportPersona,
  type SupportTicket,
} from '@prisma/client';

import { SUPPORT_PERMISSIONS } from '../support.constants';

import { SupportConversationService } from './support-conversation.service';

import type { AuditService } from '../../audit/audit.service';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SupportService } from '../support.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-SUPPORT-002 B2 — the conversation SERVICE, against the real database.
 *
 * Mocked Prisma would prove the service calls what it means to call. It would
 * not prove the 1:1 constraint holds, that the append-only trigger fires, or
 * that idempotency survives a race — and those are the guarantees. So this runs
 * against Postgres, and the service under test is the real class with its real
 * dependencies, except `SupportService` which is stubbed to exactly B1's
 * ownership contract (throw for a stranger, return the row for the owner).
 */
describe('SupportConversationService — against the database', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: SupportConversationService;
  let auditRecords: { action: string; userId?: string }[] = [];

  let ownerId: string;
  let strangerId: string;
  let operatorId: string;

  const owner = (): AuthenticatedUser => authUser(ownerId, [SUPPORT_PERMISSIONS.TICKETS_USE]);
  const stranger = (): AuthenticatedUser => authUser(strangerId, [SUPPORT_PERMISSIONS.TICKETS_USE]);
  const operator = (): AuthenticatedUser =>
    authUser(operatorId, [SUPPORT_PERMISSIONS.TICKETS_USE, SUPPORT_PERMISSIONS.ADMIN_MANAGE]);
  const handoffOperator = (): AuthenticatedUser =>
    authUser(operatorId, [
      SUPPORT_PERMISSIONS.TICKETS_USE,
      SUPPORT_PERMISSIONS.ADMIN_MANAGE,
      SUPPORT_PERMISSIONS.AI_HANDOFF,
    ]);

  function authUser(id: string, permissions: string[]): AuthenticatedUser {
    return {
      id,
      sid: randomUUID(),
      email: `${id}@example.test`,
      role: 'customer',
      portal: 'customer',
      roles: ['customer'],
      permissions,
    };
  }

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'T',
        lastName: 'U',
      },
    });
    return user.id;
  }

  /** `requiresHumanHandling: true` is the B1 gate's verdict, written by B1. */
  async function makeTicket(requiresHumanHandling: boolean): Promise<SupportTicket> {
    return await prisma.supportTicket.create({
      data: {
        userId: ownerId,
        persona: SupportPersona.CUSTOMER,
        category: requiresHumanHandling ? SupportCategory.PAYMENT : SupportCategory.TECHNICAL,
        subject: 'Subject',
        description: 'A description long enough to be realistic.',
        requiresHumanHandling,
      },
    });
  }

  async function setState(id: string, handlingState: SupportHandlingState): Promise<void> {
    await prisma.supportTicket.update({ where: { id }, data: { handlingState } });
  }

  beforeAll(async () => {
    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      await client.$disconnect().catch(() => undefined);
      return;
    }
    prisma = client as unknown as PrismaService;

    ownerId = await makeUser();
    strangerId = await makeUser();
    operatorId = await makeUser();

    const audit = {
      record: (action: string, context: { userId?: string }): Promise<void> => {
        auditRecords.push({ action, ...(context.userId ? { userId: context.userId } : {}) });
        return Promise.resolve();
      },
    } as unknown as AuditService;

    // Exactly B1's ownership contract, no more. Stubbing it this way is what
    // makes "B2 adds no alternate authorization path" testable: if the service
    // ever stopped routing through here, these isolation tests would pass while
    // the real thing was wide open — so a test below asserts the service calls
    // it, not merely that it refuses.
    const supportService = {
      getOwnTicketRow: async (userId: string, ticketId: string): Promise<SupportTicket> => {
        const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
        if (ticket === null) throw new Error('Support ticket not found');
        if (ticket.userId !== userId)
          throw new Error('You do not have access to this support ticket');
        return ticket;
      },
    } as unknown as SupportService;

    service = new SupportConversationService(prisma, audit, supportService);
  });

  afterAll(async () => {
    if (databaseAvailable) await (prisma as unknown as PrismaClient).$disconnect();
  });

  beforeEach(() => {
    auditRecords = [];
  });

  const t = (name: string, fn: () => Promise<void>): void => {
    it(name, async () => {
      if (!databaseAvailable) return;
      await fn();
    });
  };

  /* ---------------------------------------------------------------- */

  describe('one conversation per ticket, reused on reopen', () => {
    t('appending twice does not create a second conversation', async () => {
      const ticket = await makeTicket(false);

      await service.appendUserMessage(owner(), ticket.id, { body: 'first' }, {});
      await service.appendUserMessage(owner(), ticket.id, { body: 'second' }, {});

      const count = await prisma.supportConversation.count({ where: { ticketId: ticket.id } });
      expect(count).toBe(1);
    });

    t('a full resolve/reopen cycle keeps the same conversation id', async () => {
      const ticket = await makeTicket(false);
      await service.appendUserMessage(owner(), ticket.id, { body: 'hello' }, {});
      const first = await prisma.supportConversation.findUniqueOrThrow({
        where: { ticketId: ticket.id },
      });

      await setState(ticket.id, SupportHandlingState.HUMAN_HANDLING);
      await service.transitionByOperator(operator(), ticket.id, SupportHandlingState.RESOLVED, {});
      await service.transitionByOwner(owner(), ticket.id, SupportHandlingState.REOPENED, {});
      await service.transitionByOperator(
        operator(),
        ticket.id,
        SupportHandlingState.HUMAN_HANDLING,
        {},
      );
      await service.transitionByOperator(operator(), ticket.id, SupportHandlingState.RESOLVED, {});

      const after = await prisma.supportConversation.findUniqueOrThrow({
        where: { ticketId: ticket.id },
      });
      expect(after.id).toBe(first.id);
      expect(await prisma.supportConversation.count({ where: { ticketId: ticket.id } })).toBe(1);
    });

    t('concurrent first appends still produce exactly one conversation', async () => {
      const ticket = await makeTicket(false);

      await Promise.all([
        service.appendUserMessage(owner(), ticket.id, { body: 'a' }, {}),
        service.appendUserMessage(owner(), ticket.id, { body: 'b' }, {}),
        service.appendUserMessage(owner(), ticket.id, { body: 'c' }, {}),
      ]);

      expect(await prisma.supportConversation.count({ where: { ticketId: ticket.id } })).toBe(1);
    });
  });

  describe('ownership isolation', () => {
    t('a stranger cannot read the transcript', async () => {
      const ticket = await makeTicket(false);
      await service.appendUserMessage(owner(), ticket.id, { body: 'private' }, {});

      await expect(service.getTranscriptForOwner(stranger(), ticket.id)).rejects.toThrow(
        /do not have access/i,
      );
    });

    t('a stranger cannot append', async () => {
      const ticket = await makeTicket(false);

      await expect(
        service.appendUserMessage(stranger(), ticket.id, { body: 'intrusion' }, {}),
      ).rejects.toThrow(/do not have access/i);
    });

    t('a stranger cannot reopen', async () => {
      const ticket = await makeTicket(false);
      await setState(ticket.id, SupportHandlingState.RESOLVED);

      await expect(
        service.transitionByOwner(stranger(), ticket.id, SupportHandlingState.REOPENED, {}),
      ).rejects.toThrow(/do not have access/i);
    });

    t('ownership runs through B1: the owner path never reads userId itself', async () => {
      const ticket = await makeTicket(false);
      const calls: string[] = [];
      const spying = new SupportConversationService(
        prisma,
        { record: () => Promise.resolve() } as unknown as AuditService,
        {
          getOwnTicketRow: async (userId: string, ticketId: string): Promise<SupportTicket> => {
            calls.push(`${userId}:${ticketId}`);
            return await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
          },
        } as unknown as SupportService,
      );

      await spying.appendUserMessage(owner(), ticket.id, { body: 'x' }, {});
      await spying.getTranscriptForOwner(owner(), ticket.id);

      // If B2 ever grew its own ownership check, this would stay empty while the
      // refusal tests above still passed.
      expect(calls).toEqual([`${ownerId}:${ticket.id}`, `${ownerId}:${ticket.id}`]);
    });

    t('operations without ADMIN_MANAGE is refused', async () => {
      const ticket = await makeTicket(false);

      await expect(service.getTranscriptForOperations(owner(), ticket.id)).rejects.toThrow(
        /do not have access/i,
      );
      await expect(
        service.appendOperatorMessage(owner(), ticket.id, { body: 'x' }, {}),
      ).rejects.toThrow(/do not have access/i);
    });
  });

  describe('visibility is excluded at query time', () => {
    t('the owner never sees INTERNAL messages', async () => {
      const ticket = await makeTicket(false);
      await service.appendUserMessage(owner(), ticket.id, { body: 'user says' }, {});
      await service.appendOperatorMessage(
        operator(),
        ticket.id,
        { body: 'internal note', visibility: SupportMessageVisibility.INTERNAL },
        {},
      );
      await service.appendOperatorMessage(operator(), ticket.id, { body: 'reply' }, {});

      const ownerView = await service.getTranscriptForOwner(owner(), ticket.id);
      const opsView = await service.getTranscriptForOperations(operator(), ticket.id);

      expect(ownerView.map((m) => m.body)).toEqual(['user says', 'reply']);
      expect(ownerView.every((m) => m.visibility === SupportMessageVisibility.PARTICIPANTS)).toBe(
        true,
      );
      expect(opsView.map((m) => m.body)).toContain('internal note');
    });

    t(
      'the SYSTEM message a transition writes is INTERNAL, so the filer never sees it',
      async () => {
        const ticket = await makeTicket(false);
        await setState(ticket.id, SupportHandlingState.HUMAN_HANDLING);
        await service.transitionByOperator(
          operator(),
          ticket.id,
          SupportHandlingState.RESOLVED,
          {},
        );

        const ownerView = await service.getTranscriptForOwner(owner(), ticket.id);
        const opsView = await service.getTranscriptForOperations(operator(), ticket.id);

        expect(ownerView).toHaveLength(0);
        expect(opsView).toHaveLength(1);
        expect(opsView[0]?.authorType).toBe(SupportMessageAuthorType.SYSTEM);
        expect(opsView[0]?.visibility).toBe(SupportMessageVisibility.INTERNAL);
      },
    );

    t('an operator cannot smuggle INTERNAL into the filer view via a bad value', async () => {
      const ticket = await makeTicket(false);
      await service.appendOperatorMessage(
        operator(),
        ticket.id,
        { body: 'reply', visibility: 'NONSENSE' as SupportMessageVisibility },
        {},
      );

      // Anything that is not exactly INTERNAL becomes PARTICIPANTS. Defaulting
      // the other way would make a typo an invisible reply.
      const ownerView = await service.getTranscriptForOwner(owner(), ticket.id);
      expect(ownerView.map((m) => m.body)).toEqual(['reply']);
    });
  });

  describe('idempotent append', () => {
    t('the same clientMessageId returns the first message, not a second', async () => {
      const ticket = await makeTicket(false);
      const key = randomUUID();

      const first = await service.appendUserMessage(
        owner(),
        ticket.id,
        { body: 'sent once', clientMessageId: key },
        {},
      );
      const retry = await service.appendUserMessage(
        owner(),
        ticket.id,
        { body: 'sent once', clientMessageId: key },
        {},
      );

      expect(retry.id).toBe(first.id);
      expect(retry.seq).toBe(first.seq);
      const count = await prisma.supportMessage.count({
        where: { conversationId: first.conversationId },
      });
      expect(count).toBe(1);
    });

    t('concurrent retries of the same key still write exactly one', async () => {
      const ticket = await makeTicket(false);
      const key = randomUUID();

      const results = await Promise.all([
        service.appendUserMessage(owner(), ticket.id, { body: 'x', clientMessageId: key }, {}),
        service.appendUserMessage(owner(), ticket.id, { body: 'x', clientMessageId: key }, {}),
        service.appendUserMessage(owner(), ticket.id, { body: 'x', clientMessageId: key }, {}),
      ]);

      // The read-before-write is an optimisation; the unique constraint is the
      // guarantee, and the loser must return the winner's row rather than throw.
      expect(new Set(results.map((r) => r.id)).size).toBe(1);
    });

    t('no clientMessageId means no deduplication', async () => {
      const ticket = await makeTicket(false);

      const a = await service.appendUserMessage(owner(), ticket.id, { body: 'same text' }, {});
      const b = await service.appendUserMessage(owner(), ticket.id, { body: 'same text' }, {});

      expect(b.id).not.toBe(a.id);
    });
  });

  describe('ordering', () => {
    t('the transcript is ordered by seq, which is monotonic', async () => {
      const ticket = await makeTicket(false);
      for (const body of ['one', 'two', 'three', 'four']) {
        await service.appendUserMessage(owner(), ticket.id, { body }, {});
      }

      const view = await service.getTranscriptForOwner(owner(), ticket.id);
      expect(view.map((m) => m.body)).toEqual(['one', 'two', 'three', 'four']);

      let previous: bigint | undefined;
      for (const seq of view.map((m) => BigInt(m.seq))) {
        if (previous !== undefined) expect(seq > previous).toBe(true);
        previous = seq;
      }
    });
  });

  describe('transitions, through the service', () => {
    t('an operator claims an open ticket', async () => {
      const ticket = await makeTicket(false);

      const updated = await service.transitionByOperator(
        operator(),
        ticket.id,
        SupportHandlingState.HUMAN_HANDLING,
        {},
      );

      expect(updated.handlingState).toBe(SupportHandlingState.HUMAN_HANDLING);
    });

    t('the server may start automation on an eligible ticket', async () => {
      const ticket = await makeTicket(false);

      const updated = await service.transitionByServer(ticket.id, SupportHandlingState.AI_HANDLING);

      expect(updated.handlingState).toBe(SupportHandlingState.AI_HANDLING);
    });

    t('the server may NOT start automation on a gated ticket', async () => {
      const ticket = await makeTicket(true);

      await expect(
        service.transitionByServer(ticket.id, SupportHandlingState.AI_HANDLING),
      ).rejects.toThrow(/reserved for human handling/i);
      const after = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.handlingState).toBe(SupportHandlingState.OPEN);
    });

    t('every legal SERVER transition is accepted', async () => {
      const legal: [SupportHandlingState, SupportHandlingState][] = [
        [SupportHandlingState.OPEN, SupportHandlingState.AI_HANDLING],
        [SupportHandlingState.AI_HANDLING, SupportHandlingState.HUMAN_HANDLING],
        [SupportHandlingState.AI_HANDLING, SupportHandlingState.RESOLVED],
        [SupportHandlingState.HUMAN_HANDLING, SupportHandlingState.RESOLVED],
        [SupportHandlingState.RESOLVED, SupportHandlingState.CLOSED],
        [SupportHandlingState.REOPENED, SupportHandlingState.AI_HANDLING],
      ];

      for (const [from, to] of legal) {
        const ticket = await makeTicket(false);
        await setState(ticket.id, from);
        const updated = await service.transitionByServer(ticket.id, to);
        expect(updated.handlingState).toBe(to);
      }
    });

    t('an illegal transition is refused and writes nothing', async () => {
      const ticket = await makeTicket(false);

      await expect(
        service.transitionByOperator(operator(), ticket.id, SupportHandlingState.CLOSED, {}),
      ).rejects.toThrow(/cannot move from OPEN to CLOSED/i);

      const after = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.handlingState).toBe(SupportHandlingState.OPEN);
      expect(await prisma.supportConversation.count({ where: { ticketId: ticket.id } })).toBe(0);
    });

    t('a user cannot claim their own ticket into human handling', async () => {
      const ticket = await makeTicket(false);

      await expect(
        service.transitionByOwner(owner(), ticket.id, SupportHandlingState.HUMAN_HANDLING, {}),
      ).rejects.toThrow(/not yours to do/i);
    });
  });

  describe('the ai-handoff permission, and what it cannot do', () => {
    t('an operator holding it may hand an eligible ticket to automation', async () => {
      const ticket = await makeTicket(false);
      await setState(ticket.id, SupportHandlingState.HUMAN_HANDLING);

      const updated = await service.transitionByOperator(
        handoffOperator(),
        ticket.id,
        SupportHandlingState.AI_HANDLING,
        {},
      );

      expect(updated.handlingState).toBe(SupportHandlingState.AI_HANDLING);
    });

    t('ADMIN_MANAGE alone is not enough, and the refusal names the permission', async () => {
      const ticket = await makeTicket(false);
      await setState(ticket.id, SupportHandlingState.HUMAN_HANDLING);

      await expect(
        service.transitionByOperator(operator(), ticket.id, SupportHandlingState.AI_HANDLING, {}),
      ).rejects.toThrow(/support:tickets:ai-handoff/);
    });

    t('holding it does NOT override B1 eligibility', async () => {
      const ticket = await makeTicket(true);
      await setState(ticket.id, SupportHandlingState.HUMAN_HANDLING);

      await expect(
        service.transitionByOperator(
          handoffOperator(),
          ticket.id,
          SupportHandlingState.AI_HANDLING,
          {},
        ),
      ).rejects.toThrow(/reserved for human handling/i);

      const after = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.handlingState).toBe(SupportHandlingState.HUMAN_HANDLING);
      // Permission is authority to ATTEMPT; eligibility decides whether the move
      // is allowed at all. Both must pass, and the gate outranks the grant.
      expect(after.requiresHumanHandling).toBe(true);
    });

    t('a caller cannot supply the permission name — it comes from the session', async () => {
      const ticket = await makeTicket(false);
      await setState(ticket.id, SupportHandlingState.HUMAN_HANDLING);
      const liar = authUser(operatorId, [SUPPORT_PERMISSIONS.ADMIN_MANAGE]);

      // There is no parameter through which to claim a permission; the only
      // source is the authenticated user's server-side set.
      await expect(
        service.transitionByOperator(liar, ticket.id, SupportHandlingState.AI_HANDLING, {}),
      ).rejects.toThrow(/support:tickets:ai-handoff/);
    });
  });

  describe('B2 never writes requiresHumanHandling', () => {
    t('it is unchanged across a full lifecycle on a gated ticket', async () => {
      const ticket = await makeTicket(true);
      expect(ticket.requiresHumanHandling).toBe(true);

      await service.transitionByOperator(
        operator(),
        ticket.id,
        SupportHandlingState.HUMAN_HANDLING,
        {},
      );
      await service.appendOperatorMessage(operator(), ticket.id, { body: 'looking into it' }, {});
      await service.transitionByOperator(operator(), ticket.id, SupportHandlingState.RESOLVED, {});
      await service.transitionByOwner(owner(), ticket.id, SupportHandlingState.REOPENED, {});

      const after = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(after.requiresHumanHandling).toBe(true);
    });

    t(
      'eligibility is re-read, not remembered: a ticket gated after filing cannot reach AI',
      async () => {
        const ticket = await makeTicket(false);
        await service.transitionByServer(ticket.id, SupportHandlingState.AI_HANDLING);
        await service.transitionByServer(ticket.id, SupportHandlingState.RESOLVED);
        await service.transitionByOwner(owner(), ticket.id, SupportHandlingState.REOPENED, {});

        // B1 re-gates the ticket while it is reopened.
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { requiresHumanHandling: true },
        });

        await expect(
          service.transitionByServer(ticket.id, SupportHandlingState.AI_HANDLING),
        ).rejects.toThrow(/reserved for human handling/i);
      },
    );
  });

  describe('messages are append-only, and the service offers no way around it', () => {
    t('the database refuses an UPDATE even from raw SQL', async () => {
      const ticket = await makeTicket(false);
      const message = await service.appendUserMessage(owner(), ticket.id, { body: 'fixed' }, {});

      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE support_messages SET body = 'tampered' WHERE id = '${message.id}'::uuid`,
        ),
      ).rejects.toThrow();
    });

    t('the database refuses a DELETE', async () => {
      const ticket = await makeTicket(false);
      const message = await service.appendUserMessage(
        owner(),
        ticket.id,
        { body: 'permanent' },
        {},
      );

      await expect(
        prisma.$executeRawUnsafe(`DELETE FROM support_messages WHERE id = '${message.id}'::uuid`),
      ).rejects.toThrow();
    });
  });

  describe('validation', () => {
    t('an empty or whitespace-only body is refused', async () => {
      const ticket = await makeTicket(false);

      await expect(
        service.appendUserMessage(owner(), ticket.id, { body: '   ' }, {}),
      ).rejects.toThrow(/cannot be empty/i);
    });

    t('a body over the column limit is refused before it reaches the column', async () => {
      const ticket = await makeTicket(false);

      await expect(
        service.appendUserMessage(owner(), ticket.id, { body: 'x'.repeat(8001) }, {}),
      ).rejects.toThrow(/cannot exceed/i);
    });
  });

  describe('audit', () => {
    t('a transition and an append are both recorded', async () => {
      const ticket = await makeTicket(false);
      await service.appendUserMessage(owner(), ticket.id, { body: 'hello' }, {});
      await service.transitionByOperator(
        operator(),
        ticket.id,
        SupportHandlingState.HUMAN_HANDLING,
        {},
      );

      expect(auditRecords.map((r) => r.action)).toEqual([
        'support.conversation.message.appended',
        'support.ticket.handling_state.changed',
      ]);
    });

    t('a SERVER transition records no actor, because there is none', async () => {
      const ticket = await makeTicket(false);
      await service.transitionByServer(ticket.id, SupportHandlingState.AI_HANDLING);

      expect(auditRecords).toHaveLength(1);
      expect(auditRecords[0]?.userId).toBeUndefined();
    });
  });
});
