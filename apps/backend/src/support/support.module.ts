import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminSupportController } from './controllers/admin-support.controller';
import { SupportController } from './controllers/support.controller';
import { SupportService } from './support.service';

/** DPX-SUPPORT-001 Phase 1. Exports `SupportService` because
 *  `OperationsCasesService` drives ticket status from the case lifecycle
 *  through it, the same way it already does for incidents. */
@Module({
  imports: [PrismaModule, AuditModule, NotificationCenterModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
