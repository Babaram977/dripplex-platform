import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Prisma,
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

  /* ------------------------------------------------------------------ */
  /* Nora's review checklist, verified explicitly                        */
  /* ------------------------------------------------------------------ */

  describe('a rolled-back transaction leaves a valid, reusable conversation', () => {
    t('the empty conversation survives and the next request reuses it', async () => {
      const ticket = await makeTicket(false);

      // The conversation is created BEFORE the transaction, so a failure inside
      // the transaction must not destroy it. Audit is the last step inside that
      // transaction, so making it throw rolls the transaction back after the
      // conversation already exists — exactly the window this design creates.
      const failing = new SupportConversationService(
        prisma,
        {
          record: (): Promise<void> => Promise.reject(new Error('audit sink is down')),
        } as unknown as AuditService,
        {
          getOwnTicketRow: (): Promise<SupportTicket> =>
            prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }),
        } as unknown as SupportService,
      );

      await expect(
        failing.transitionByOperator(
          operator(),
          ticket.id,
          SupportHandlingState.HUMAN_HANDLING,
          {},
        ),
      ).rejects.toThrow(/audit sink is down/);

      // The transaction rolled back: no state change, no SYSTEM message.
      const afterFailure = await prisma.supportTicket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      expect(afterFailure.handlingState).toBe(SupportHandlingState.OPEN);

      const orphan = await prisma.supportConversation.findUnique({
        where: { ticketId: ticket.id },
      });
      expect(orphan).not.toBeNull();
      expect(
        await prisma.supportMessage.count({ where: { conversationId: orphan?.id ?? '' } }),
      ).toBe(0);

      // An empty conversation is valid and harmless. The next request must REUSE
      // it rather than trip over it or create a second.
      const updated = await service.transitionByOperator(
        operator(),
        ticket.id,
        SupportHandlingState.HUMAN_HANDLING,
        {},
      );
      expect(updated.handlingState).toBe(SupportHandlingState.HUMAN_HANDLING);

      const conversations = await prisma.supportConversation.findMany({
        where: { ticketId: ticket.id },
      });
      expect(conversations).toHaveLength(1);
      expect(conversations[0]?.id).toBe(orphan?.id);
    });
  });

  describe('idempotency is scoped to the conversation', () => {
    t('returns the PERSISTED message, not a freshly constructed response', async () => {
      const ticket = await makeTicket(false);
      const key = randomUUID();

      const first = await service.appendUserMessage(
        owner(),
        ticket.id,
        { body: 'original wording', clientMessageId: key },
        {},
      );
      // A retry whose body DIFFERS. If the service were constructing a response
      // rather than returning the stored row, this would echo the new text.
      const retry = await service.appendUserMessage(
        owner(),
        ticket.id,
        { body: 'different wording on the retry', clientMessageId: key },
        {},
      );

      expect(retry.id).toBe(first.id);
      expect(retry.body).toBe('original wording');

      const persisted = await prisma.supportMessage.findUniqueOrThrow({ where: { id: first.id } });
      expect(retry.body).toBe(persisted.body);
      expect(retry.seq).toBe(persisted.seq.toString());
    });

    t('the same key in a different conversation is a different message', async () => {
      const ticketA = await makeTicket(false);
      const ticketB = await makeTicket(false);
      const key = randomUUID();

      const a = await service.appendUserMessage(
        owner(),
        ticketA.id,
        { body: 'in A', clientMessageId: key },
        {},
      );
      const b = await service.appendUserMessage(
        owner(),
        ticketB.id,
        { body: 'in B', clientMessageId: key },
        {},
      );

      // The unique is (conversationId, clientMessageId), not the key alone —
      // a global key would let one ticket's retry suppress another's message.
      expect(b.id).not.toBe(a.id);
      expect(a.body).toBe('in A');
      expect(b.body).toBe('in B');
    });
  });

  describe('ownership isolation across all five personas', () => {
    const PERSONAS = [
      SupportPersona.CUSTOMER,
      SupportPersona.RIDER,
      SupportPersona.DRIVER,
      SupportPersona.MERCHANT,
      SupportPersona.FLEET_OWNER,
    ];

    t('every persona reaches its own ticket and no other persona reaches it', async () => {
      const holders: { persona: SupportPersona; userId: string; ticketId: string }[] = [];

      for (const persona of PERSONAS) {
        const userId = await makeUser();
        const ticket = await prisma.supportTicket.create({
          data: {
            userId,
            persona,
            category: SupportCategory.TECHNICAL,
            subject: `${persona} subject`,
            description: 'A description long enough to be realistic.',
            requiresHumanHandling: false,
          },
        });
        holders.push({ persona, userId, ticketId: ticket.id });
      }

      for (const holder of holders) {
        const asHolder = authUser(holder.userId, [SUPPORT_PERMISSIONS.TICKETS_USE]);

        // Reaches their own.
        await expect(
          service.appendUserMessage(asHolder, holder.ticketId, { body: 'mine' }, {}),
        ).resolves.toBeDefined();
        await expect(
          service.getTranscriptForOwner(asHolder, holder.ticketId),
        ).resolves.toHaveLength(1);

        // Reaches nobody else's — all four other personas, both read and write.
        for (const other of holders) {
          if (other.userId === holder.userId) continue;

          await expect(service.getTranscriptForOwner(asHolder, other.ticketId)).rejects.toThrow(
            /do not have access/i,
          );
          await expect(
            service.appendUserMessage(asHolder, other.ticketId, { body: 'intrusion' }, {}),
          ).rejects.toThrow(/do not have access/i);
        }
      }
    });

    t('operations with ADMIN_MANAGE reaches every persona; without it, none', async () => {
      const ticketIds: string[] = [];
      for (const persona of PERSONAS) {
        const userId = await makeUser();
        const ticket = await prisma.supportTicket.create({
          data: {
            userId,
            persona,
            category: SupportCategory.TECHNICAL,
            subject: `${persona} subject`,
            description: 'A description long enough to be realistic.',
            requiresHumanHandling: false,
          },
        });
        ticketIds.push(ticket.id);
      }

      const withoutGrant = authUser(operatorId, [SUPPORT_PERMISSIONS.TICKETS_USE]);

      for (const ticketId of ticketIds) {
        await expect(
          service.getTranscriptForOperations(operator(), ticketId),
        ).resolves.toBeDefined();
        await expect(service.getTranscriptForOperations(withoutGrant, ticketId)).rejects.toThrow(
          /do not have access/i,
        );
      }
    });

    // `it`, not the DB-guarded `t`: this reads the source file and needs no
    // database, so it must run even where Postgres is unavailable.
    it('no B2 source authorises by reading SupportTicket.userId', () => {
      const source = readFileSync(join(__dirname, 'support-conversation.service.ts'), 'utf8');

      // The ONLY ownership decision is B1's. Two shapes would be a second
      // authorization path: comparing the row's userId, or filtering a query by
      // it. Neither may appear.
      //
      // Deliberately NOT asserting the absence of `userId: user.id` outright —
      // that appears in the AUDIT context, where it is attribution rather than
      // authorization. An earlier version of this test failed on exactly that
      // and the test was wrong, not the service.
      expect(source).not.toMatch(/ticket\.userId\s*[!=]==/);
      expect(source).not.toMatch(/where:\s*\{[^}]*userId/);
      expect(source).toContain('this.supportService.getOwnTicketRow(');
    });
  });

  describe('SERVER authority is unreachable from an authenticated path', () => {
    t('transitionByServer accepts no user and ignores whatever a caller holds', async () => {
      const ticket = await makeTicket(true);

      // Even a caller holding every permission cannot obtain SERVER authority,
      // because no signature accepts an actor and transitionByServer takes no
      // user at all. The gated ticket is refused on eligibility, not on identity.
      await expect(
        service.transitionByServer(ticket.id, SupportHandlingState.AI_HANDLING),
      ).rejects.toThrow(/reserved for human handling/i);

      expect(service.transitionByServer.length).toBeLessThanOrEqual(2);
    });

    t('the operator path cannot reach a SERVER-only transition', async () => {
      const ticket = await makeTicket(false);

      // OPEN -> AI_HANDLING is SERVER-only in the approved table.
      await expect(
        service.transitionByOperator(
          handoffOperator(),
          ticket.id,
          SupportHandlingState.AI_HANDLING,
          {},
        ),
      ).rejects.toThrow(/not yours to do/i);
    });
  });

  /**
   * The P2002 recovery in `append`, forced.
   *
   * The concurrency test above asserts the OUTCOME (exactly one message), and
   * that outcome is satisfied by the pre-check alone whenever the calls do not
   * genuinely interleave — so deleting the recovery sometimes left it green.
   * Mutation testing caught that: a guard whose detector is a race is not
   * guarded. This drives the branch deterministically with a stubbed client
   * instead of hoping the scheduler cooperates.
   */
  describe('the idempotency recovery branch, forced deterministically', () => {
    const P2002 = (): Error =>
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      });

    function serviceWithRacingCreate(winner: Record<string, unknown>): SupportConversationService {
      let findFirstCalls = 0;
      const stub = {
        supportConversation: {
          findUnique: (): Promise<unknown> => Promise.resolve({ id: 'conversation-1' }),
        },
        supportMessage: {
          // First call is the pre-check and finds nothing — i.e. the racing
          // writer has not committed yet. Second call is the recovery read.
          findFirst: (): Promise<unknown> => {
            findFirstCalls += 1;
            return Promise.resolve(findFirstCalls === 1 ? null : winner);
          },
          // The racing writer committed in between.
          create: (): Promise<never> => Promise.reject(P2002()),
        },
      } as unknown as PrismaService;

      return new SupportConversationService(
        stub,
        { record: (): Promise<void> => Promise.resolve() } as unknown as AuditService,
        {
          getOwnTicketRow: (): Promise<SupportTicket> =>
            Promise.resolve({ id: 'ticket-1' } as SupportTicket),
        } as unknown as SupportService,
      );
    }

    it('returns the winner rather than throwing, when the create loses the race', async () => {
      const winner = {
        id: 'message-winner',
        conversationId: 'conversation-1',
        seq: 42n,
        authorType: SupportMessageAuthorType.USER,
        authorId: 'user-1',
        body: 'the winning message',
        visibility: SupportMessageVisibility.PARTICIPANTS,
        redactedAt: null,
        createdAt: new Date('2026-09-12T00:00:00.000Z'),
      };

      const result = await serviceWithRacingCreate(winner).appendUserMessage(
        { id: 'user-1', permissions: [] } as unknown as AuthenticatedUser,
        'ticket-1',
        { body: 'my retry', clientMessageId: 'key-1' },
        {},
      );

      // The loser must return the winner's persisted row, not its own text and
      // not an error.
      expect(result.id).toBe('message-winner');
      expect(result.body).toBe('the winning message');
      expect(result.seq).toBe('42');
    });

    it('rethrows P2002 when there is no idempotency key to recover by', async () => {
      // A stub whose findFirst ALWAYS returns a row. The first version of this
      // test reused the racing stub, whose first findFirst returns null — which
      // meant the recovery read came back empty and the code rethrew for the
      // WRONG reason. The mutation that drops the `clientMessageId !== undefined`
      // condition stayed green against it. The stub was masking the guard.
      const alwaysFinds = {
        supportConversation: {
          findUnique: (): Promise<unknown> => Promise.resolve({ id: 'conversation-1' }),
        },
        supportMessage: {
          findFirst: (): Promise<unknown> =>
            Promise.resolve({
              id: 'someone-elses-message',
              conversationId: 'conversation-1',
              seq: 7n,
              authorType: SupportMessageAuthorType.USER,
              authorId: 'user-2',
              body: 'not the callers message',
              visibility: SupportMessageVisibility.PARTICIPANTS,
              redactedAt: null,
              createdAt: new Date('2026-09-12T00:00:00.000Z'),
            }),
          create: (): Promise<never> => Promise.reject(P2002()),
        },
      } as unknown as PrismaService;

      const service = new SupportConversationService(
        alwaysFinds,
        { record: (): Promise<void> => Promise.resolve() } as unknown as AuditService,
        {
          getOwnTicketRow: (): Promise<SupportTicket> =>
            Promise.resolve({ id: 'ticket-1' } as SupportTicket),
        } as unknown as SupportService,
      );

      // Without a clientMessageId a unique violation is not an idempotent retry
      // — there is no key identifying "the same message", so returning whatever
      // row happens to be there would hand the caller someone else's message.
      // It is a real error and must surface.
      await expect(
        service.appendUserMessage(
          { id: 'user-1', permissions: [] } as unknown as AuthenticatedUser,
          'ticket-1',
          { body: 'no key' },
          {},
        ),
      ).rejects.toThrow(/Unique constraint failed/);
    });
  });

  describe('audit records observation, and is not a second state authority', () => {
    t('the exact event for each operation', async () => {
      const ticket = await makeTicket(false);

      await service.appendUserMessage(owner(), ticket.id, { body: 'from the filer' }, {});
      await service.appendOperatorMessage(operator(), ticket.id, { body: 'from ops' }, {});
      await service.transitionByOperator(
        operator(),
        ticket.id,
        SupportHandlingState.HUMAN_HANDLING,
        {},
      );
      await service.transitionByOperator(operator(), ticket.id, SupportHandlingState.RESOLVED, {});
      await service.transitionByOwner(owner(), ticket.id, SupportHandlingState.REOPENED, {});
      await service
        .transitionByServer(ticket.id, SupportHandlingState.CLOSED)
        .catch(() => undefined);

      expect(auditRecords).toEqual([
        { action: 'support.conversation.message.appended', userId: ownerId },
        { action: 'support.conversation.message.appended', userId: operatorId },
        { action: 'support.ticket.handling_state.changed', userId: operatorId },
        { action: 'support.ticket.handling_state.changed', userId: operatorId },
        { action: 'support.ticket.handling_state.changed', userId: ownerId },
      ]);
    });

    t('a refused transition records nothing', async () => {
      const ticket = await makeTicket(true);

      await expect(
        service.transitionByServer(ticket.id, SupportHandlingState.AI_HANDLING),
      ).rejects.toThrow();

      // Refusals happen before the transaction. An audit trail that recorded
      // attempts as if they were changes would misreport the ticket's history.
      expect(auditRecords).toEqual([]);
    });

    t(
      'a failed audit BLOCKS the state change rather than letting it proceed unaudited',
      async () => {
        const ticket = await makeTicket(false);
        const failing = new SupportConversationService(
          prisma,
          {
            record: (): Promise<void> => Promise.reject(new Error('audit sink is down')),
          } as unknown as AuditService,
          {
            getOwnTicketRow: (): Promise<SupportTicket> =>
              prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }),
          } as unknown as SupportService,
        );

        await expect(
          failing.transitionByOperator(
            operator(),
            ticket.id,
            SupportHandlingState.HUMAN_HANDLING,
            {},
          ),
        ).rejects.toThrow();

        // Audit sits inside the transaction deliberately. The direction matters:
        // a broken sink costs availability, never an unrecorded state change.
        const after = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
        expect(after.handlingState).toBe(SupportHandlingState.OPEN);
      },
    );

    t('the audit result cannot influence the outcome', async () => {
      const ticket = await makeTicket(false);
      const lying = new SupportConversationService(
        prisma,
        {
          // Returns something that looks like a decision. It is discarded: the
          // return value is never read, so audit cannot authorise, veto or
          // rewrite a transition.
          record: (): Promise<unknown> =>
            Promise.resolve({ allowed: false, handlingState: SupportHandlingState.CLOSED }),
        } as unknown as AuditService,
        {
          getOwnTicketRow: (): Promise<SupportTicket> =>
            prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }),
        } as unknown as SupportService,
      );

      const updated = await lying.transitionByOperator(
        operator(),
        ticket.id,
        SupportHandlingState.HUMAN_HANDLING,
        {},
      );

      expect(updated.handlingState).toBe(SupportHandlingState.HUMAN_HANDLING);
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
