import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CmsModule } from '../cms/cms.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { DriverActivationService } from './activation/driver-activation.service';
import { AdminDriverIdentityVerificationController } from './controllers/admin-driver-identity-verification.controller';
import { AdminDriverPlannedAvailabilityController } from './controllers/admin-driver-planned-availability.controller';
import { AdminDriverSecuritySettingsController } from './controllers/admin-driver-security-settings.controller';
import { AdminDriverShiftsController } from './controllers/admin-driver-shifts.controller';
import { AdminDriverVehiclesController } from './controllers/admin-driver-vehicles.controller';
import { AdminDriversController } from './controllers/admin-drivers.controller';
import { AdminInspectionCentresController } from './controllers/admin-inspection-centres.controller';
import { DriverHelpController } from './controllers/driver-help.controller';
import { DriverIdentityVerificationController } from './controllers/driver-identity-verification.controller';
import { DriverIncidentReportsController } from './controllers/driver-incident-reports.controller';
import { DriverInspectionsController } from './controllers/driver-inspections.controller';
import { DriverPlannedAvailabilityController } from './controllers/driver-planned-availability.controller';
import { DriverRideContactController } from './controllers/driver-ride-contact.controller';
import { DriverShiftsController } from './controllers/driver-shifts.controller';
import { DriverSosAlertsController } from './controllers/driver-sos-alerts.controller';
import { DriverSupportController } from './controllers/driver-support.controller';
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
import { IncidentReportService } from './incidents/incident-report.service';
import { InspectionCentresService } from './inspections/inspection-centres.service';
import { InspectionsService } from './inspections/inspections.service';
import { OnboardingService } from './onboarding/onboarding.service';
import { DriverRideContactService } from './ride-contact/driver-ride-contact.service';
import { DriverPlannedAvailabilityService } from './shifts/driver-planned-availability.service';
import { DriverShiftReminderSweepService } from './shifts/driver-shift-reminder-sweep.service';
import { DriverShiftService } from './shifts/driver-shift.service';
import { SosAlertService } from './sos/sos-alert.service';
import { DriverSupportService } from './support/driver-support.service';
import { VehiclesService } from './vehicles/vehicles.service';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, NotificationCenterModule, CmsModule],
  controllers: [
    DriverController,
    DriverHelpController,
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
    DriverSupportController,
    DriverIncidentReportsController,
    DriverSosAlertsController,
    DriverShiftsController,
    DriverPlannedAvailabilityController,
    AdminDriverShiftsController,
    AdminDriverPlannedAvailabilityController,
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
    DriverSupportService,
    IncidentReportService,
    SosAlertService,
    DriverShiftService,
    DriverPlannedAvailabilityService,
    DriverShiftReminderSweepService,
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
    DriverSupportService,
    IncidentReportService,
    SosAlertService,
    DriverShiftService,
    DriverPlannedAvailabilityService,
  ],
})
export class DriversModule {}
