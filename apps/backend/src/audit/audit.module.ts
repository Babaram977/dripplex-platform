import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AuditService } from './audit.service';
import { AUDIT_LOG_REPOSITORY } from './repositories/audit-log.repository';
import { AUDIT_SEGMENT_REPOSITORY } from './repositories/audit-segment.repository';
import { PrismaAuditLogRepository } from './repositories/prisma-audit-log.repository';
import { PrismaAuditSegmentRepository } from './repositories/prisma-audit-segment.repository';
import { SegmentAuthorityService } from './segment-authority.service';

@Module({
  imports: [PrismaModule],
  providers: [
    AuditService,
    {
      provide: AUDIT_LOG_REPOSITORY,
      useClass: PrismaAuditLogRepository,
    },
    // P1-B2. Registered concretely as well as behind its token:
    // SegmentAuthorityService depends on the implementation, and the token
    // exists for a later substitution rather than for indirection's own sake.
    PrismaAuditSegmentRepository,
    {
      provide: AUDIT_SEGMENT_REPOSITORY,
      useExisting: PrismaAuditSegmentRepository,
    },
    SegmentAuthorityService,
  ],
  exports: [AuditService, SegmentAuthorityService],
})
export class AuditModule {}
