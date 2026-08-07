import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { AdminCustomerKycController } from './admin-customer-kyc.controller';
import { CustomerKycController } from './customer-kyc.controller';
import { CustomerKycService } from './customer-kyc.service';

@Module({
  imports: [AuditModule],
  controllers: [CustomerKycController, AdminCustomerKycController],
  providers: [CustomerKycService],
  exports: [CustomerKycService],
})
export class KycModule {}
