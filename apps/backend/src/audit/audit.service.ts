import { Inject, Injectable } from '@nestjs/common';

import {
  AUDIT_LOG_REPOSITORY,
  type AuditLogRepository,
  type AuditRecordDetails,
  type CreateAuditLogInput,
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

  public record(
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

    return this.auditLogRepository.create(input).then(() => undefined);
  }
}
