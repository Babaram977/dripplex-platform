import type { Prisma } from '@prisma/client';

export interface CreateAuditLogInput {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface AuditRecordDetails {
  userId?: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Audit event for Class-A (transaction-aware) appending.
 *
 * Represents an authoritative audit event that commits within the same
 * PostgreSQL transaction as its corresponding business mutation.
 *
 * Timestamp is database-generated (Prisma default: now()).
 * Caller supplies action, context, and optional details.
 */
export interface AuditEventForAppend {
  action: string;
  context: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  details?: AuditRecordDetails;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

export interface AuditLogRepository {
  /**
   * Create an audit log entry outside any transaction.
   *
   * @deprecated Use append() for Class-A authoritative audit instead.
   */
  create(input: CreateAuditLogInput): Promise<AuditLogRecord>;

  /**
   * Append an authoritative audit event within a caller-owned transaction.
   *
   * MUST use the supplied tx parameter and MUST NOT open a nested $transaction().
   * The event commits with the same PostgreSQL transaction as the business mutation.
   *
   * @param tx - Caller-owned Prisma.TransactionClient
   * @param event - Audit event with action, context, and optional details
   */
  append(tx: Prisma.TransactionClient, event: AuditEventForAppend): Promise<AuditLogRecord>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
