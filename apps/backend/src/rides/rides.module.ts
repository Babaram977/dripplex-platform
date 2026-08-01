import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomerRidesController } from './controllers/customer-rides.controller';
import { RideFareService } from './ride-fare.service';
import { RidesService } from './rides.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CustomerRidesController],
  providers: [RidesService, RideFareService],
  exports: [RidesService, RideFareService],
})
export class RidesModule {}
