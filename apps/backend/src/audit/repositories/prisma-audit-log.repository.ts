import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  AuditLogRecord,
  AuditLogRepository,
  AuditEventForAppend,
  CreateAuditLogInput,
} from './audit-log.repository';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an audit log entry outside any transaction (legacy path).
   *
   * Uses the root Prisma client. Not authoritative for Class-A operations.
   *
   * @deprecated Use append(tx, event) for authoritative Class-A audit.
   */
  public async create(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    return await this.prisma.auditLog.create({
      data: {
        action: input.action,
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.resource !== undefined ? { resource: input.resource } : {}),
        ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  }

  /**
   * Append an authoritative audit event within a transaction.
   *
   * CRITICAL CONTRACT:
   * - MUST use the supplied tx parameter
   * - MUST NOT call this.prisma.* (root client)
   * - MUST NOT open a nested $transaction()
   * - Participates in the caller's transaction boundary
   *
   * If tx is not a valid TransactionClient, Prisma will throw a validation error.
   *
   * @param tx - Caller-owned Prisma.TransactionClient
   * @param event - Audit event (action, context, details)
   */
  public async append(
    tx: Prisma.TransactionClient,
    event: AuditEventForAppend,
  ): Promise<AuditLogRecord> {
    // Extract fields from event, following the same pattern as create()
    const input: CreateAuditLogInput = {
      action: event.action,
      metadata: event.details?.metadata ?? {},
    };

    const userId = event.details?.userId ?? event.context.userId;
    if (userId !== undefined) {
      input.userId = userId;
    }

    if (event.details?.resource !== undefined) {
      input.resource = event.details.resource;
    }

    if (event.details?.resourceId !== undefined) {
      input.resourceId = event.details.resourceId;
    }

    const ipAddress = event.context.ipAddress ?? event.details?.ipAddress;
    if (ipAddress !== undefined) {
      input.ipAddress = ipAddress;
    }

    const userAgent = event.context.userAgent ?? event.details?.userAgent;
    if (userAgent !== undefined) {
      input.userAgent = userAgent;
    }

    // CRITICAL: Use tx, not this.prisma
    // This ensures the append participates in the caller's transaction
    return await tx.auditLog.create({
      data: {
        action: input.action,
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.resource !== undefined ? { resource: input.resource } : {}),
        ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  }
}
