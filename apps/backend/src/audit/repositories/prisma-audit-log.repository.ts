import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  AuditLogRecord,
  AuditLogRepository,
  CreateAuditLogInput,
} from './audit-log.repository';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

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
}
