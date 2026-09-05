import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepository,
  type AuditRecordDetails,
  type CreateAuditLogInput,
  type AuditEventForAppend,
} from './repositories/audit-log.repository';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  /**
   * Append an authoritative audit event within a Class-A transaction boundary.
   *
   * CRITICAL: append() accepts a Prisma.TransactionClient and MUST participate
   * in the caller's transaction. Business mutation and audit append commit together.
   *
   * Usage:
   *   await prisma.$transaction(async (tx) => {
   *     // business mutations...
   *     await auditService.append(tx, { action, context, details });
   *   }); // single COMMIT
   *
   * @param tx - Caller-owned transaction client. append() MUST NOT open $transaction().
   *   Delegates to repository without validation; Prisma will reject invalid clients.
   * @param event - Audit event with action, context, and optional details.
   */
  public async append(tx: Prisma.TransactionClient, event: AuditEventForAppend): Promise<void> {
    await this.auditLogRepository.append(tx, event).then(() => undefined);
  }

  /**
   * Record an infrastructure-failure audit event outside any transaction.
   *
   * INTERFACE BOUNDARY (P1-B1): Establishes the signature for recording audit events
   * that occur outside the business transaction boundary. The current implementation
   * is a temporary path through the existing audit_logs table.
   *
   * The actual durable infrastructure-failure model with retry logic and recovery
   * guarantees is owned by P1-B6 (Failure Recovery Subsystem).
   *
   * @param action - Failure action identifier.
   * @param context - Request context (userId, ipAddress, userAgent).
   * @param details - Failure details (resource, metadata, etc.).
   */
  public async recordFailure(
    action: string,
    context: AuditContext,
    details?: AuditRecordDetails,
  ): Promise<void> {
    const input: CreateAuditLogInput = { action, metadata: details?.metadata ?? {} };

    const userId = details?.userId ?? context.userId;
    if (userId !== undefined) {
      input.userId = userId;
    }

    if (details?.resource !== undefined) {
      input.resource = details.resource;
    }

    if (details?.resourceId !== undefined) {
      input.resourceId = details.resourceId;
    }

    const ipAddress = context.ipAddress ?? details?.ipAddress;
    if (ipAddress !== undefined) {
      input.ipAddress = ipAddress;
    }

    const userAgent = context.userAgent ?? details?.userAgent;
    if (userAgent !== undefined) {
      input.userAgent = userAgent;
    }

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await this.auditLogRepository.create(input);
  }

  /**
   * Record a non-authoritative audit event outside any transaction.
   *
   * DEPRECATED: For backward compatibility only. Existing post-transaction audit calls
   * use record(). During P1-B7, wallet mutations will migrate to append(tx, event).
   *
   * @deprecated Use append(tx, event) for Class-A mutations instead.
   * @param action - Audit action.
   * @param context - Request context.
   * @param details - Audit details.
   */
  public async record(
    action: string,
    context: AuditContext,
    details?: AuditRecordDetails,
  ): Promise<void> {
    // Delegate to recordFailure for now (same implementation)
    // This preserves compatibility with all existing call sites
    await this.recordFailure(action, context, details);
  }
}
