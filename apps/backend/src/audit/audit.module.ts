import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AuditChainService } from './audit-chain.service';
import { AuditService } from './audit.service';
import { AUDIT_LOG_REPOSITORY } from './repositories/audit-log.repository';
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository';
import { SegmentAuthorityService } from './segment-authority.service';

@Module({
  imports: [PrismaModule],
  providers: [
    AuditService,
    SegmentAuthorityService,
    AuditChainService,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: PrismaAuditLogRepository,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
