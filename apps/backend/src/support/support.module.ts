import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminSupportController } from './controllers/admin-support.controller';
import { SupportController } from './controllers/support.controller';
import { SupportConversationService } from './conversations/support-conversation.service';
import { SupportService } from './support.service';

/**
 * DPX-SUPPORT-001 Phase 1. Exports `SupportService` because
 * `OperationsCasesService` drives ticket status from the case lifecycle
 * through it, the same way it already does for incidents.
 *
 * DPX-SUPPORT-002 B2 adds `SupportConversationService` as a PROVIDER ONLY.
 * `controllers` is deliberately unchanged: this increment exposes no route, so
 * nothing outside the server can reach a transition or an append, and in
 * particular nothing can reach SERVER authority. Routes are a separate,
 * separately reviewed increment.
 */
@Module({
  imports: [PrismaModule, AuditModule, NotificationCenterModule],
  controllers: [SupportController, AdminSupportController],
  providers: [SupportService, SupportConversationService],
  exports: [SupportService, SupportConversationService],
})
export class SupportModule {}
