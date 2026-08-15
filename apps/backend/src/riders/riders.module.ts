import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';

import { AdminRidersController } from './controllers/admin-riders.controller';
import { RiderController } from './controllers/rider.controller';
import { RidersService } from './riders.service';

/**
 * DPX-RIDER-001 — delivery-rider approval module. Exposes the admin/ops
 * rider approval desk (AdminRidersController) and, per DPX-RIDER-002, the
 * rider self-service surface (RiderController: KYC upload + company name),
 * backed by RidersService.
 */
@Module({
  // NotificationsModule provides NOTIFICATION_SERVICE, which RidersService
  // injects to send rider lifecycle emails (DPX-RIDER-005). Without it Nest
  // cannot resolve the provider and the whole API fails to boot.
  imports: [PrismaModule, AuditModule, UploadsModule, NotificationsModule],
  controllers: [AdminRidersController, RiderController],
  providers: [RidersService],
  exports: [RidersService],
})
export class RidersModule {}
