import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminRidersController } from './controllers/admin-riders.controller';
import { RidersService } from './riders.service';

/**
 * DPX-RIDER-001 — delivery-rider approval module. Exposes the admin/ops
 * rider approval desk (AdminRidersController) backed by RidersService.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminRidersController],
  providers: [RidersService],
  exports: [RidersService],
})
export class RidersModule {}
