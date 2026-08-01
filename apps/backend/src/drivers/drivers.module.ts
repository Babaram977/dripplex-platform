import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminDriversController } from './controllers/admin-drivers.controller';
import { DriverController } from './controllers/driver.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [DriverController, AdminDriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
