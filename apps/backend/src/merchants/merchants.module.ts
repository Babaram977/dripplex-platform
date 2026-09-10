import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminMerchantsController } from './controllers/admin-merchants.controller';
import { MerchantController } from './controllers/merchant.controller';
import { CustomerMerchantsController } from './customer/customer-merchants.controller';
import { CustomerMerchantsService } from './customer/customer-merchants.service';
import { MerchantBankSettlementService } from './merchant-bank-settlement.service';
import { MerchantsService } from './merchants.service';
import { MERCHANTS_REPOSITORY } from './repositories/merchants.repository';
import { PrismaMerchantsRepository } from './repositories/prisma-merchants.repository';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, UploadsModule, WalletModule],
  controllers: [MerchantController, AdminMerchantsController, CustomerMerchantsController],
  providers: [
    MerchantsService,
    MerchantBankSettlementService,
    CustomerMerchantsService,
    { provide: MERCHANTS_REPOSITORY, useClass: PrismaMerchantsRepository },
  ],
  exports: [MerchantsService, MerchantBankSettlementService],
})
export class MerchantsModule {}
