import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

import { IntegrationsController } from './controllers/integrations.controller';
import { IntegrationsService } from './services/integrations.service';
import { CredentialsService } from './services/credentials.service';
import { EncryptionService } from './services/encryption.service';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, CredentialsService, EncryptionService],
  exports: [IntegrationsService, CredentialsService, EncryptionService],
})
export class IntegrationsModule {}
