import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminPromotionsController } from './admin-promotions.controller';
import { CustomerPromotionsController } from './customer-promotions.controller';
import { PromotionSweepService } from './promotion-sweep.service';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [PrismaModule, AuditModule, WalletModule],
  controllers: [CustomerPromotionsController, AdminPromotionsController],
  providers: [PromotionsService, PromotionSweepService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
