import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminPromotionsController } from './admin-promotions.controller';
import { CustomerPromotionsController } from './customer-promotions.controller';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CustomerPromotionsController, AdminPromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
