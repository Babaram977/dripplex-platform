import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginController } from './controllers/login.controller';
import { RegistrationController } from './controllers/registration.controller';
import { VerificationController } from './controllers/verification.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AUTH_SESSION_REPOSITORY } from './repositories/auth-session.repository';
import { PrismaAuthSessionRepository } from './repositories/prisma-auth-session.repository';
import { PrismaRegistrationRepository } from './repositories/prisma-registration.repository';
import { REGISTRATION_REPOSITORY } from './repositories/registration.repository';
import { LoginAttemptService } from './services/login-attempt.service';
import { LoginService } from './services/login.service';
import { OtpService } from './services/otp.service';
import { RegistrationService } from './services/registration.service';
import { SessionService } from './services/session.service';
import { VerificationService } from './services/verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController, RegistrationController, VerificationController, LoginController],
  providers: [
    AuthService,
    OtpService,
    RegistrationService,
    VerificationService,
    LoginService,
    SessionService,
    LoginAttemptService,
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
  ],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard, PassportModule, JwtModule],
})
export class AuthModule {}
