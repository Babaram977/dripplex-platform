import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegistrationController } from './controllers/registration.controller';
import { VerificationController } from './controllers/verification.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PrismaRegistrationRepository } from './repositories/prisma-registration.repository';
import { REGISTRATION_REPOSITORY } from './repositories/registration.repository';
import { OtpService } from './services/otp.service';
import { RegistrationService } from './services/registration.service';
import { VerificationService } from './services/verification.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController, RegistrationController, VerificationController],
  providers: [
    AuthService,
    OtpService,
    RegistrationService,
    VerificationService,
    JwtStrategy,
    JwtAuthGuard,
    PermissionsGuard,
    {
      provide: REGISTRATION_REPOSITORY,
      useClass: PrismaRegistrationRepository,
    },
  ],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard, PassportModule, JwtModule],
})
export class AuthModule {}
