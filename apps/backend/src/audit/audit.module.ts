import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AuditService } from './audit.service';
import { AUDIT_LOG_REPOSITORY } from './repositories/audit-log.repository';
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    AuditService,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: PrismaAuditLogRepository,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
