import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { DriverActivationService } from './activation/driver-activation.service';
import { AdminDriverIdentityVerificationController } from './controllers/admin-driver-identity-verification.controller';
import { AdminDriverSecuritySettingsController } from './controllers/admin-driver-security-settings.controller';
import { AdminDriverVehiclesController } from './controllers/admin-driver-vehicles.controller';
import { AdminDriversController } from './controllers/admin-drivers.controller';
import { AdminInspectionCentresController } from './controllers/admin-inspection-centres.controller';
import { DriverIdentityVerificationController } from './controllers/driver-identity-verification.controller';
import { DriverInspectionsController } from './controllers/driver-inspections.controller';
import { DriverRideContactController } from './controllers/driver-ride-contact.controller';
import { DriverVehiclesController } from './controllers/driver-vehicles.controller';
import { DriverController } from './controllers/driver.controller';
import { OperationsInspectionsController } from './controllers/operations-inspections.controller';
import { DriversService } from './drivers.service';
import { AccountRecoverySubscriber } from './identity-verification/account-recovery.subscriber';
import { CredentialChangeSubscriber } from './identity-verification/credential-change.subscriber';
import { DriverIdentityVerificationService } from './identity-verification/driver-identity-verification.service';
import { DriverSecuritySettingsService } from './identity-verification/driver-security-settings.service';
import { FailedLoginLockoutSubscriber } from './identity-verification/failed-login-lockout.subscriber';
import { IDENTITY_VERIFICATION_PROVIDER } from './identity-verification/identity-verification-provider.adapter';
import { SmileIdProvider } from './identity-verification/smile-id.provider';
import { InspectionCentresService } from './inspections/inspection-centres.service';
import { InspectionsService } from './inspections/inspections.service';
import { OnboardingService } from './onboarding/onboarding.service';
import { DriverRideContactService } from './ride-contact/driver-ride-contact.service';
import { VehiclesService } from './vehicles/vehicles.service';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [
    DriverController,
    AdminDriversController,
    DriverIdentityVerificationController,
    AdminDriverIdentityVerificationController,
    AdminDriverSecuritySettingsController,
    DriverVehiclesController,
    AdminDriverVehiclesController,
    DriverInspectionsController,
    AdminInspectionCentresController,
    OperationsInspectionsController,
    DriverRideContactController,
  ],
  providers: [
    DriversService,
    DriverActivationService,
    DriverIdentityVerificationService,
    DriverSecuritySettingsService,
    VehiclesService,
    OnboardingService,
    InspectionCentresService,
    InspectionsService,
    DriverRideContactService,
    AccountRecoverySubscriber,
    CredentialChangeSubscriber,
    FailedLoginLockoutSubscriber,
    { provide: IDENTITY_VERIFICATION_PROVIDER, useClass: SmileIdProvider },
  ],
  exports: [
    DriversService,
    DriverActivationService,
    DriverIdentityVerificationService,
    DriverSecuritySettingsService,
    VehiclesService,
    OnboardingService,
    InspectionCentresService,
    InspectionsService,
    DriverRideContactService,
  ],
})
export class DriversModule {}
