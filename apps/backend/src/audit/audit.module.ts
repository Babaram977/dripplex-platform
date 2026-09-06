import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AuditChainService } from './audit-chain.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AUDIT_LOG_REPOSITORY } from './repositories/audit-log.repository';
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository';
import { PrismaAuditSegmentRepository } from './repositories/prisma-audit-segment.repository';
import { SegmentAuthorityService } from './segment-authority.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    SegmentAuthorityService,
    AuditChainService,
    PrismaAuditSegmentRepository,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: PrismaAuditLogRepository,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
