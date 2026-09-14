import { Injectable } from '@nestjs/common';

import { AuditService } from '../../audit/audit.service';
import {
  ConflictDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

import type { AuditContext } from '../../audit/audit.service';

/**
 * What a merchant may see of one reconciliation conflict.
 *
 * An allow-list, and the test pins the key set by equality. `sourceId` is
 * deliberately absent — an internal uuid the merchant cannot act on — and so is
 * `integrationId`, which the caller already supplied in the path.
 */
export interface ConflictView {
  id: string;
  conflictType: string;
  externalId: string | null;
  dripplexValue: string | null;
  externalValue: string | null;
  status: string;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export interface ConflictPage {
  items: ConflictView[];
  total: number;
  page: number;
  pageSize: number;
}

/** One page of conflicts is capped, as the POS order list is, for the same reason. */
export const MAX_CONFLICT_PAGE_SIZE = 50;

/** The fixed audit text every acknowledgement carries. */
export const ACKNOWLEDGEMENT_TEXT = 'Acknowledged by merchant';

/** `IntegrationConflict.status`, exactly as the schema's own doc comment documents it. */
export const CONFLICT_STATUS = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
  ESCALATED: 'ESCALATED',
} as const;

/**
 * A merchant's view of the conflicts their integrations raised, and the one
 * thing they may do about them.
 *
 * Until this existed, `IntegrationConflict` had three writers and no reader:
 * catalogue ingestion, inventory ingestion and order sync all recorded
 * conflicts into a table nothing in the codebase could list or resolve. A
 * merchant whose catalogue arrived miscategorised was told the sync
 * COMPLETED, and the one signal saying otherwise was written somewhere they
 * could never look.
 *
 * **Acknowledgement is not remediation, and the distinction is the point.**
 * Marking a conflict acknowledged records that a human saw it. It does not
 * touch the product, the mapping, the inventory, the price, the SKU or the
 * order — what the right remedy is differs per conflict type and each one
 * needs its own ruling. Inventing them here is precisely the speculative
 * behaviour the engineering playbook forbids.
 */
@Injectable()
export class IntegrationConflictsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async list(
    integrationId: string,
    options: { status?: string; page?: number; pageSize?: number } = {},
  ): Promise<ConflictPage> {
    const take = Math.min(
      Math.max(options.pageSize ?? MAX_CONFLICT_PAGE_SIZE, 1),
      MAX_CONFLICT_PAGE_SIZE,
    );
    const page = Math.max(options.page ?? 1, 1);
    const where = {
      integrationId,
      ...(options.status !== undefined ? { status: options.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.integrationConflict.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.integrationConflict.count({ where }),
    ]);

    return { items: rows.map((row) => this.toView(row)), total, page, pageSize: take };
  }

  /**
   * Record that the merchant has seen this conflict.
   *
   * The ownership check reads the conflict through its integration's
   * merchantId, so a conflict id belonging to another merchant is refused
   * before anything is written — the same rule the rest of this module uses,
   * and the reason a conflict id is not a capability.
   */
  public async acknowledge(
    merchantId: string,
    conflictId: string,
    context: AuditContext,
    note?: string,
  ): Promise<ConflictView> {
    const conflict = await this.prisma.integrationConflict.findUnique({
      where: { id: conflictId },
      include: { integration: { select: { merchantId: true, id: true } } },
    });

    if (!conflict) {
      throw new NotFoundDomainException('Conflict not found');
    }
    if (conflict.integration.merchantId !== merchantId) {
      // Forbidden rather than not-found, matching verifyMerchantAccess: the
      // caller supplied an id they hold, and the refusal says so.
      throw new ForbiddenDomainException('Access denied');
    }
    if (conflict.status === CONFLICT_STATUS.RESOLVED) {
      throw new ConflictDomainException('This conflict has already been acknowledged');
    }

    const trimmed = note?.trim();
    const resolution =
      trimmed !== undefined && trimmed !== ''
        ? `${ACKNOWLEDGEMENT_TEXT}: ${trimmed}`
        : ACKNOWLEDGEMENT_TEXT;

    const updated = await this.prisma.integrationConflict.update({
      where: { id: conflictId },
      data: { status: CONFLICT_STATUS.RESOLVED, resolution, resolvedAt: new Date() },
    });

    await this.auditService.record('integration.conflict_acknowledged', context, {
      userId: merchantId,
      resource: 'integration_conflict',
      resourceId: conflictId,
      metadata: {
        integrationId: conflict.integration.id,
        conflictType: conflict.conflictType,
        hasNote: trimmed !== undefined && trimmed !== '',
      },
    });

    return this.toView(updated);
  }

  private toView(row: {
    id: string;
    conflictType: string;
    externalId: string | null;
    dripplexValue: string | null;
    externalValue: string | null;
    status: string;
    resolution: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
  }): ConflictView {
    return {
      id: row.id,
      conflictType: row.conflictType,
      externalId: row.externalId,
      dripplexValue: row.dripplexValue,
      externalValue: row.externalValue,
      status: row.status,
      resolution: row.resolution,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
    };
  }
}
