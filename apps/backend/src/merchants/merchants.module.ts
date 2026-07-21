import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminMerchantsController } from './controllers/admin-merchants.controller';
import { MerchantController } from './controllers/merchant.controller';
import { MerchantsService } from './merchants.service';
import { MERCHANTS_REPOSITORY } from './repositories/merchants.repository';
import { PrismaMerchantsRepository } from './repositories/prisma-merchants.repository';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [MerchantController, AdminMerchantsController],
  providers: [
    MerchantsService,
    {
      provide: MERCHANTS_REPOSITORY,
      useClass: PrismaMerchantsRepository,
    },
  ],
  exports: [MerchantsService],
})
export class MerchantsModule {}
