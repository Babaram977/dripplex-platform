import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationController } from './controllers/email-verification.controller';
import { LoginController } from './controllers/login.controller';
import { PasswordController } from './controllers/password.controller';
import { PhoneVerificationController } from './controllers/phone-verification.controller';
import { RegistrationController } from './controllers/registration.controller';
import { SessionsController } from './controllers/sessions.controller';
import { VerificationController } from './controllers/verification.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AUTH_SESSION_REPOSITORY } from './repositories/auth-session.repository';
import { IDENTITY_VERIFICATION_REPOSITORY } from './repositories/identity-verification.repository';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './repositories/password-reset.repository';
import { PrismaAuthSessionRepository } from './repositories/prisma-auth-session.repository';
import { PrismaIdentityVerificationRepository } from './repositories/prisma-identity-verification.repository';
import { PrismaPasswordResetTokenRepository } from './repositories/prisma-password-reset.repository';
import { PrismaRegistrationRepository } from './repositories/prisma-registration.repository';
import { REGISTRATION_REPOSITORY } from './repositories/registration.repository';
import { DeviceInfoService } from './services/device-info.service';
import { EmailVerificationService } from './services/email-verification.service';
import { LoginAttemptService } from './services/login-attempt.service';
import { LoginService } from './services/login.service';
import { LogoutService } from './services/logout.service';
import { OtpService } from './services/otp.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { PasswordService } from './services/password.service';
import { PhoneVerificationService } from './services/phone-verification.service';
import { RefreshService } from './services/refresh.service';
import { RegistrationService } from './services/registration.service';
import { SessionActivityService } from './services/session-activity.service';
import { SessionManagementService } from './services/session-management.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { VerificationService } from './services/verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [
    AuthController,
    RegistrationController,
    VerificationController,
    LoginController,
    PasswordController,
    EmailVerificationController,
    PhoneVerificationController,
    SessionsController,
  ],
  providers: [
    AuthService,
    OtpService,
    RegistrationService,
    VerificationService,
    EmailVerificationService,
    PhoneVerificationService,
    LoginService,
    SessionService,
    SessionManagementService,
    SessionActivityService,
    DeviceInfoService,
    LoginAttemptService,
    TokenService,
    RefreshService,
    LogoutService,
    PasswordPolicyService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    PermissionsGuard,
    {
      provide: REGISTRATION_REPOSITORY,
      useClass: PrismaRegistrationRepository,
    },
    {
      provide: AUTH_SESSION_REPOSITORY,
      useClass: PrismaAuthSessionRepository,
    },
    {
      provide: PASSWORD_RESET_TOKEN_REPOSITORY,
      useClass: PrismaPasswordResetTokenRepository,
    },
    {
      provide: IDENTITY_VERIFICATION_REPOSITORY,
      useClass: PrismaIdentityVerificationRepository,
    },
  ],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard, PassportModule, JwtModule],
})
export class AuthModule {}
