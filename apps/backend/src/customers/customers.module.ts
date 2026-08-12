import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AdminCustomersService } from './admin-customers.service';
import { AdminCustomersController } from './controllers/admin-customers.controller';

/**
 * DPX-OPS — Operations Console customer directory. Read-only roster over the
 * existing `User` records (customers) with per-customer trips/spend aggregates
 * from their COMPLETED rides. No new backend architecture — a thin read module
 * mirroring the driver/rider admin desks.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AdminCustomersController],
  providers: [AdminCustomersService],
  exports: [AdminCustomersService],
})
export class CustomersModule {}
