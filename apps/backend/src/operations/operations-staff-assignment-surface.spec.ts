import { randomUUID } from 'node:crypto';

import {
  OperationsAssigneeRole,
  OperationsCaseType,
  OperationsLifecycleStatus,
  OperationsPriority,
} from '@prisma/client';

import { ConflictDomainException } from '../common/exceptions/domain.exception';

import { OperationsCasesController } from './controllers/operations-cases.controller';
import { OperationsStaffController } from './controllers/operations-staff.controller';
import { OperationsCasesService } from './operations-cases.service';
import { OPERATIONS_AUDIT_ACTIONS, OPERATIONS_PERMISSIONS } from './operations.constants';

import type { AuditService } from '../audit/audit.service';
import type { IncidentReportService } from '../drivers/incidents/incident-report.service';
import type { SosAlertService } from '../drivers/sos/sos-alert.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SupportService } from '../support/support.service';

/**
 * ops.dripplex.com migration, step 8 — pinning the OPERATOR-ASSIGNMENT surface
 * before porting it out of `apps/operations-console`.
 *
 * The standalone console's `case-controls.tsx` can assign a case to a member of
 * the operations staff; ops.dripplex.com's Incidents and Support screens show
 * `Assigned: <name> | Unassigned` and offer no way to change it. That control is
 * the capability being migrated, and it is a MUTATION on a live queue, so the
 * founder's sequence applies: establish the server contract, prove the write's
 * shape, then port the UI.
 *
 * This spec is deliberately NOT a duplicate of `operations-cases.service.spec.ts`
 * (real Postgres, already covers NEW -> ASSIGNED, the assignable pool and the
 * optimistic-concurrency race). It pins the five things the PORT depends on and
 * that nothing currently asserts:
 *
 *   1. Seeing the pool and being able to assign are DIFFERENT permissions.
 *   2. `assignedToRole` silently defaults to OPERATOR when omitted.
 *   3. Unassigning does not revert the status that assigning advanced.
 *   4. The server does not check the assignee is in the assignable pool.
 *   5. Both assign and unassign are audited.
 *
 * It uses a recording Prisma stub rather than a database: the subject here is
 * the exact `data` the service writes, which a stub can show precisely and a
 * database can only show after the fact. Every read the assignment path takes is
 * declared; anything undeclared throws, so the spec cannot pass by accident if
 * the service starts consulting something new.
 */

interface WriteRecord {
  target: string;
  args: Record<string, unknown>;
}

interface CaseRow {
  id: string;
  caseType: OperationsCaseType;
  sourceId: string;
  status: OperationsLifecycleStatus;
  priority: OperationsPriority;
  version: number;
  assignedToId: string | null;
  assignedToRole: OperationsAssigneeRole | null;
  assignedById: string | null;
  assignedAt: Date | null;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function caseRow(overrides: Partial<CaseRow> = {}): CaseRow {
  return {
    id: randomUUID(),
    caseType: OperationsCaseType.SUPPORT,
    sourceId: randomUUID(),
    status: OperationsLifecycleStatus.NEW,
    priority: OperationsPriority.MEDIUM,
    version: 0,
    assignedToId: null,
    assignedToRole: null,
    assignedById: null,
    assignedAt: null,
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: new Date('2026-09-17T08:00:00.000Z'),
    updatedAt: new Date('2026-09-17T08:00:00.000Z'),
    ...overrides,
  };
}

/**
 * A PrismaService stub that RECORDS writes instead of performing them, and
 * throws on any read the assignment path is not already known to take.
 *
 * `updateMany` records and reports one affected row (the happy path); pass
 * `updateCount: 0` to simulate losing the atomic version race.
 */
function recordingPrisma(
  kase: CaseRow,
  options: { updateCount?: number } = {},
): { prisma: PrismaService; writes: WriteRecord[]; reads: string[] } {
  const writes: WriteRecord[] = [];
  const reads: string[] = [];

  const record = (target: string, args: Record<string, unknown>): void => {
    writes.push({ target, args });
  };

  const models: Record<string, Record<string, unknown>> = {
    operationsCase: {
      findUnique: (args: Record<string, unknown>) => {
        reads.push('operationsCase.findUnique');
        void args;
        return Promise.resolve(kase);
      },
      // Returns the row WITH the update applied, the way Postgres would.
      // `updateCase` re-reads here inside the transaction and hands the result
      // to `syncSourceStatus`, so a stub that returned the pre-update row would
      // quietly hide the source-table consequence of assigning.
      findUniqueOrThrow: () => {
        reads.push('operationsCase.findUniqueOrThrow');
        const update = writes.find((w) => w.target === 'operationsCase.updateMany');
        const data = (update?.args['data'] ?? {}) as Record<string, unknown>;
        const { version: _version, ...applied } = data;
        return Promise.resolve({ ...kase, ...applied });
      },
      updateMany: (args: Record<string, unknown>) => {
        record('operationsCase.updateMany', args);
        return Promise.resolve({ count: options.updateCount ?? 1 });
      },
    },
    operationsCaseEvent: {
      createMany: (args: Record<string, unknown>) => {
        record('operationsCaseEvent.createMany', args);
        return Promise.resolve({ count: 1 });
      },
      findMany: () => {
        reads.push('operationsCaseEvent.findMany');
        return Promise.resolve([]);
      },
    },
    // `syncSourceStatus` and `getCaseDetail` both look the source row up.
    // Only the fields the mapper dereferences are filled in: the assertions
    // below are on the recorded WRITE and on the source-sync call, never on the
    // DTO that comes back, so a fuller ticket would be decoration.
    supportTicket: {
      findUnique: () => {
        reads.push('supportTicket.findUnique');
        return Promise.resolve({
          id: kase.sourceId,
          status: 'OPEN',
          user: { id: randomUUID(), firstName: 'Tick', lastName: 'Filer' },
        });
      },
    },
    user: {
      findMany: () => {
        reads.push('user.findMany');
        return Promise.resolve([]);
      },
    },
  };

  const prisma = new Proxy(
    {},
    {
      get(_target, property: string | symbol) {
        if (property === '$transaction') {
          return (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
        }
        if (typeof property !== 'string') return undefined;
        if (property.startsWith('$')) {
          throw new Error(`recordingPrisma: ${property} is not a fixture`);
        }
        const model = models[property];
        if (!model) {
          throw new Error(`recordingPrisma: model '${property}' is not a fixture`);
        }
        return new Proxy(model, {
          get(modelTarget, verb: string | symbol) {
            if (typeof verb !== 'string') return undefined;
            const fn = modelTarget[verb];
            if (typeof fn !== 'function') {
              throw new Error(`recordingPrisma: ${property}.${verb} is not a fixture`);
            }
            return fn;
          },
        });
      },
    },
  ) as unknown as PrismaService;

  return { prisma, writes, reads };
}

function serviceFor(prisma: PrismaService): {
  service: OperationsCasesService;
  audit: { record: jest.Mock };
  support: { updateTicket: jest.Mock };
} {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  // Real, because assigning is not silent: `syncSourceStatus` pushes the
  // case's lifecycle back down onto the driver-facing source row. The SOS and
  // incident services stay empty objects — every case in this spec is a
  // SUPPORT case, and a stub that answered for a branch this spec never takes
  // would be a fixture pretending to be coverage.
  const support = { updateTicket: jest.fn().mockResolvedValue(undefined) };
  const service = new OperationsCasesService(
    prisma,
    audit as unknown as AuditService,
    {} as unknown as SosAlertService,
    {} as unknown as IncidentReportService,
    support as unknown as SupportService,
  );
  return { service, audit, support };
}

/** The `data` the service handed to the guarded `updateMany`. */
function writtenData(writes: WriteRecord[]): Record<string, unknown> {
  const update = writes.find((w) => w.target === 'operationsCase.updateMany');
  if (!update) throw new Error('expected the case row to have been written');
  return update.args['data'] as Record<string, unknown>;
}

function loggedEventTypes(writes: WriteRecord[]): string[] {
  const events = writes.find((w) => w.target === 'operationsCaseEvent.createMany');
  if (!events) return [];
  return (events.args['data'] as { eventType: string }[]).map((e) => e.eventType);
}

// ── A. Route and permission wiring ───────────────────────────────────────────

describe('the assignment surface: who may see the pool, and who may assign', () => {
  it('serves the assignable pool at operations/staff behind QUEUES_READ', () => {
    const path: unknown = Reflect.getMetadata('path', OperationsStaffController);
    const permissions: unknown = Reflect.getMetadata('permissions', OperationsStaffController);

    expect(path).toBe('operations/staff');
    expect(permissions).toEqual([OPERATIONS_PERMISSIONS.QUEUES_READ]);
  });

  it('gates the assignment itself on QUEUES_MANAGE, not on the permission that reveals the pool', () => {
    const read: unknown = Reflect.getMetadata(
      'permissions',
      OperationsCasesController.prototype.getCase,
    );
    const write: unknown = Reflect.getMetadata(
      'permissions',
      OperationsCasesController.prototype.updateCase,
    );

    expect(read).toEqual([OPERATIONS_PERMISSIONS.QUEUES_READ]);
    expect(write).toEqual([OPERATIONS_PERMISSIONS.QUEUES_MANAGE]);
    // The consequence the ported UI has to honour: an account with QUEUES_READ
    // alone can load the staff list perfectly well and would be handed a 403 by
    // the only thing that list is for. The control is gated on MANAGE.
    expect(read).not.toEqual(write);
  });
});

// ── B. The pool ──────────────────────────────────────────────────────────────

describe('the assignable pool', () => {
  function poolPrisma(users: unknown[]): { prisma: PrismaService; calls: unknown[] } {
    const calls: unknown[] = [];
    const prisma = {
      user: {
        findMany: (args: unknown) => {
          calls.push(args);
          return Promise.resolve(users);
        },
      },
    } as unknown as PrismaService;
    return { prisma, calls };
  }

  it('selects on QUEUES_MANAGE — the permission to act, not the permission to look', async () => {
    const { prisma, calls } = poolPrisma([]);
    const { service } = serviceFor(prisma);

    await service.getAssignableStaff();

    expect(JSON.stringify(calls[0])).toContain(OPERATIONS_PERMISSIONS.QUEUES_MANAGE);
    expect(JSON.stringify(calls[0])).not.toContain(OPERATIONS_PERMISSIONS.QUEUES_READ);
  });

  it('classifies administrator and super_administrator as supervisors and everyone else as operators', async () => {
    const { prisma } = poolPrisma([
      {
        id: 'u-admin',
        firstName: 'Ada',
        lastName: 'Admin',
        roles: [{ role: { name: 'administrator' } }],
      },
      {
        id: 'u-super',
        firstName: 'Sam',
        lastName: 'Super',
        roles: [{ role: { name: 'super_administrator' } }],
      },
      {
        id: 'u-staff',
        firstName: 'Ola',
        lastName: 'Operator',
        roles: [{ role: { name: 'operations_staff' } }],
      },
    ]);
    const { service } = serviceFor(prisma);

    const pool = await service.getAssignableStaff();

    expect(pool.map((m) => [m.id, m.role])).toEqual([
      ['u-admin', OperationsAssigneeRole.SUPERVISOR],
      ['u-super', OperationsAssigneeRole.SUPERVISOR],
      ['u-staff', OperationsAssigneeRole.OPERATOR],
    ]);
  });

  it('holding both roles reads as supervisor — the wider role wins', async () => {
    const { prisma } = poolPrisma([
      {
        id: 'u-both',
        firstName: 'Bo',
        lastName: 'Both',
        roles: [{ role: { name: 'operations_staff' } }, { role: { name: 'administrator' } }],
      },
    ]);
    const { service } = serviceFor(prisma);

    expect((await service.getAssignableStaff())[0]?.role).toBe(OperationsAssigneeRole.SUPERVISOR);
  });

  it('asks the database to order the pool, so the ported UI must not re-sort it', async () => {
    const { prisma, calls } = poolPrisma([]);
    const { service } = serviceFor(prisma);

    await service.getAssignableStaff();

    expect((calls[0] as { orderBy: unknown }).orderBy).toEqual([
      { firstName: 'asc' },
      { lastName: 'asc' },
    ]);
  });
});

// ── C. What assigning writes ─────────────────────────────────────────────────

describe('assigning a case', () => {
  it('records the assignee, their role, who assigned them and when', async () => {
    const kase = caseRow({ status: OperationsLifecycleStatus.IN_PROGRESS });
    const { prisma, writes } = recordingPrisma(kase);
    const { service } = serviceFor(prisma);
    const assignee = randomUUID();
    const actor = randomUUID();

    await service.updateCase(
      kase.id,
      { assignedToId: assignee, assignedToRole: OperationsAssigneeRole.SUPERVISOR, version: 0 },
      actor,
      {},
    );

    const data = writtenData(writes);
    expect(data['assignedToId']).toBe(assignee);
    expect(data['assignedToRole']).toBe(OperationsAssigneeRole.SUPERVISOR);
    expect(data['assignedById']).toBe(actor);
    expect(data['assignedAt']).toBeInstanceOf(Date);
    expect(loggedEventTypes(writes)).toContain('ASSIGNED');
  });

  it('SILENTLY DEFAULTS THE ROLE TO OPERATOR when the caller omits it', async () => {
    // This is why the ported control must send the role from the pool entry
    // rather than just the id: omitting it does not mean "unchanged" and does
    // not mean "look it up" — it means the case records a supervisor as an
    // operator, in the row and in the timeline event, with no error.
    const kase = caseRow({ status: OperationsLifecycleStatus.IN_PROGRESS });
    const { prisma, writes } = recordingPrisma(kase);
    const { service } = serviceFor(prisma);

    await service.updateCase(kase.id, { assignedToId: randomUUID(), version: 0 }, randomUUID(), {});

    expect(writtenData(writes)['assignedToRole']).toBe(OperationsAssigneeRole.OPERATOR);
  });

  it('advances a NEW case to ASSIGNED as a side effect of being assigned', async () => {
    const kase = caseRow({ status: OperationsLifecycleStatus.NEW });
    const { prisma, writes } = recordingPrisma(kase);
    const { service } = serviceFor(prisma);

    await service.updateCase(kase.id, { assignedToId: randomUUID(), version: 0 }, randomUUID(), {});

    expect(writtenData(writes)['status']).toBe(OperationsLifecycleStatus.ASSIGNED);
  });

  it('is not silent: assigning also moves the driver-facing support ticket to IN_PROGRESS', async () => {
    // The operator picking a name from a dropdown changes what the DRIVER sees
    // on their ticket. Worth pinning before the control exists in the console:
    // it is the reason assignment belongs behind QUEUES_MANAGE rather than
    // being treated as bookkeeping.
    const kase = caseRow({ status: OperationsLifecycleStatus.NEW });
    const { prisma } = recordingPrisma(kase);
    const { service, support } = serviceFor(prisma);
    const actor = randomUUID();

    await service.updateCase(kase.id, { assignedToId: randomUUID(), version: 0 }, actor, {});

    expect(support.updateTicket).toHaveBeenCalledWith(
      kase.sourceId,
      actor,
      { status: 'IN_PROGRESS' },
      {},
    );
  });

  it('does not drag a case that is already being worked back to ASSIGNED', async () => {
    const kase = caseRow({ status: OperationsLifecycleStatus.IN_PROGRESS });
    const { prisma, writes } = recordingPrisma(kase);
    const { service } = serviceFor(prisma);

    await service.updateCase(kase.id, { assignedToId: randomUUID(), version: 0 }, randomUUID(), {});

    expect(writtenData(writes)['status']).toBeUndefined();
  });
});

// ── D. What unassigning writes ───────────────────────────────────────────────

describe('unassigning a case', () => {
  it('clears the assignee, the role, who assigned them and when — all four', async () => {
    const kase = caseRow({
      status: OperationsLifecycleStatus.ASSIGNED,
      assignedToId: randomUUID(),
      assignedToRole: OperationsAssigneeRole.OPERATOR,
      assignedById: randomUUID(),
      assignedAt: new Date(),
    });
    const { prisma, writes } = recordingPrisma(kase);
    const { service } = serviceFor(prisma);

    await service.updateCase(kase.id, { assignedToId: null, version: 0 }, randomUUID(), {});

    const data = writtenData(writes);
    expect(data['assignedToId']).toBeNull();
    expect(data['assignedToRole']).toBeNull();
    expect(data['assignedById']).toBeNull();
    expect(data['assignedAt']).toBeNull();
    expect(loggedEventTypes(writes)).toContain('UNASSIGNED');
  });

  it('DOES NOT REVERT THE STATUS that assigning advanced', async () => {
    // A case that was NEW, got assigned (and so became ASSIGNED), then gets
    // unassigned, stays ASSIGNED with nobody assigned to it. Nothing in the
    // service walks that back. The ported UI says so rather than letting an
    // operator discover it from a queue that looks handled and isn't.
    const kase = caseRow({
      status: OperationsLifecycleStatus.ASSIGNED,
      assignedToId: randomUUID(),
      assignedToRole: OperationsAssigneeRole.OPERATOR,
    });
    const { prisma, writes } = recordingPrisma(kase);
    const { service } = serviceFor(prisma);

    await service.updateCase(kase.id, { assignedToId: null, version: 0 }, randomUUID(), {});

    expect(writtenData(writes)['status']).toBeUndefined();
  });
});

// ── E. The gap this port does not close ──────────────────────────────────────

describe('the assignee is not validated against the assignable pool', () => {
  it('accepts any UUID as an assignee, without ever consulting the pool', async () => {
    // RECORDED, NOT FIXED. `UpdateOperationsCaseDto.assignedToId` carries
    // `@IsUUID()` and nothing else: the service writes whatever well-formed id
    // it is handed — a customer's, a deactivated operator's, one belonging to
    // no user at all. The only thing standing between the operator and that is
    // the UI offering a select of the pool instead of a free-text field, which
    // is exactly what the standalone console did and what the port keeps.
    //
    // Adding server-side membership validation would be a backend behaviour
    // change beyond this migration's remit (CLAUDE.md section 3), so it is
    // written down here and raised, not slipped in. If this test ever fails
    // because a validation was added, that is good news — update it.
    const kase = caseRow({ status: OperationsLifecycleStatus.IN_PROGRESS });
    const { prisma, writes, reads } = recordingPrisma(kase);
    const { service } = serviceFor(prisma);
    const strangerId = randomUUID();

    await service.updateCase(kase.id, { assignedToId: strangerId, version: 0 }, randomUUID(), {});

    expect(writtenData(writes)['assignedToId']).toBe(strangerId);
    // `user.findMany` is reached only by `getCaseDetail`'s name lookup after
    // the write, never before it as a check.
    const updateIndex = reads.indexOf('operationsCase.findUniqueOrThrow');
    const poolCheck = reads.indexOf('user.findMany');
    expect(poolCheck === -1 || poolCheck > updateIndex).toBe(true);
  });
});

// ── F. Audit and concurrency ─────────────────────────────────────────────────

describe('assignment is audited and version-guarded', () => {
  it('records an audit entry naming the assignee', async () => {
    const kase = caseRow({ status: OperationsLifecycleStatus.IN_PROGRESS });
    const { prisma } = recordingPrisma(kase);
    const { service, audit } = serviceFor(prisma);
    const assignee = randomUUID();

    await service.updateCase(kase.id, { assignedToId: assignee, version: 0 }, randomUUID(), {});

    expect(audit.record).toHaveBeenCalledWith(
      OPERATIONS_AUDIT_ACTIONS.CASE_ASSIGNED,
      expect.anything(),
      expect.objectContaining({ metadata: { assignedToId: assignee } }),
    );
  });

  it('audits an unassignment too, as a null assignee rather than as silence', async () => {
    const kase = caseRow({
      status: OperationsLifecycleStatus.ASSIGNED,
      assignedToId: randomUUID(),
    });
    const { prisma } = recordingPrisma(kase);
    const { service, audit } = serviceFor(prisma);

    await service.updateCase(kase.id, { assignedToId: null, version: 0 }, randomUUID(), {});

    expect(audit.record).toHaveBeenCalledWith(
      OPERATIONS_AUDIT_ACTIONS.CASE_ASSIGNED,
      expect.anything(),
      expect.objectContaining({ metadata: { assignedToId: null } }),
    );
  });

  it('refuses a stale version without writing anything', async () => {
    const kase = caseRow({ version: 4, status: OperationsLifecycleStatus.IN_PROGRESS });
    const { prisma, writes } = recordingPrisma(kase);
    const { service } = serviceFor(prisma);

    await expect(
      service.updateCase(kase.id, { assignedToId: randomUUID(), version: 3 }, randomUUID(), {}),
    ).rejects.toBeInstanceOf(ConflictDomainException);
    expect(writes).toEqual([]);
  });

  it('refuses when the guarded write loses the race, even though the version read matched', async () => {
    const kase = caseRow({ version: 4, status: OperationsLifecycleStatus.IN_PROGRESS });
    const { prisma } = recordingPrisma(kase, { updateCount: 0 });
    const { service, audit } = serviceFor(prisma);

    await expect(
      service.updateCase(kase.id, { assignedToId: randomUUID(), version: 4 }, randomUUID(), {}),
    ).rejects.toBeInstanceOf(ConflictDomainException);
    // A lost race must not leave an audit entry claiming an assignment happened.
    expect(audit.record).not.toHaveBeenCalled();
  });
});
