import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminDriverIdentityVerificationController } from './controllers/admin-driver-identity-verification.controller';
import { AdminDriversController } from './controllers/admin-drivers.controller';
import { DriverIdentityVerificationController } from './controllers/driver-identity-verification.controller';
import { DriverController } from './controllers/driver.controller';
import { DriversService } from './drivers.service';
import { AccountRecoverySubscriber } from './identity-verification/account-recovery.subscriber';
import { CredentialChangeSubscriber } from './identity-verification/credential-change.subscriber';
import { DriverIdentityVerificationService } from './identity-verification/driver-identity-verification.service';
import { FailedLoginLockoutSubscriber } from './identity-verification/failed-login-lockout.subscriber';
import { IDENTITY_VERIFICATION_PROVIDER } from './identity-verification/identity-verification-provider.adapter';
import { SmileIdProvider } from './identity-verification/smile-id.provider';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [
    DriverController,
    AdminDriversController,
    DriverIdentityVerificationController,
    AdminDriverIdentityVerificationController,
  ],
  providers: [
    DriversService,
    DriverIdentityVerificationService,
    AccountRecoverySubscriber,
    CredentialChangeSubscriber,
    FailedLoginLockoutSubscriber,
    { provide: IDENTITY_VERIFICATION_PROVIDER, useClass: SmileIdProvider },
  ],
  exports: [DriversService, DriverIdentityVerificationService],
})
export class DriversModule {}
