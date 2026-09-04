import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { IntegrationsCController } from './controllers/integrations-c.controller';
import { IntegrationsController } from './controllers/integrations.controller';
import { CredentialsService } from './services/credentials.service';
import { EncryptionService } from './services/encryption.service';
import { IntegrationsService } from './services/integrations.service';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [
    IntegrationsCController, // MKT-INT-001-C: Integration CRUD API (6 endpoints)
    IntegrationsController, // Legacy: Credential management endpoints (D phase, future)
  ],
  providers: [IntegrationsService, CredentialsService, EncryptionService],
  exports: [IntegrationsService, CredentialsService, EncryptionService],
})
export class IntegrationsModule {}
