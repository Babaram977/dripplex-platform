import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';

import { CatalogueSyncController } from './controllers/catalogue-sync.controller';
import { IntegrationsCController } from './controllers/integrations-c.controller';
import { IntegrationsController } from './controllers/integrations.controller';
import { IntegrationCredentialGuard } from './guards/integration-credential.guard';
import { CatalogueIngestionService } from './services/catalogue-ingestion.service';
import { CategoryMappingService } from './services/category-mapping.service';
import { CredentialsService } from './services/credentials.service';
import { EncryptionService } from './services/encryption.service';
import { IntegrationsService } from './services/integrations.service';
import { SsrfProtectionService } from './services/ssrf-protection.service';

@Module({
  // ProductsModule supplies MerchantProductsService, so POS ingestion creates
  // products through the same write path a merchant uses — one path, so search
  // indexing and slug generation cannot drift apart.
  imports: [PrismaModule, AuditModule, AuthModule, ProductsModule],
  controllers: [
    IntegrationsCController, // MKT-INT-001-C: Integration CRUD API (6 endpoints)
    IntegrationsController, // Legacy: Credential management endpoints (D phase, future)
    CatalogueSyncController, // P1: catalogue ingestion (POS push) + job history
  ],
  providers: [
    IntegrationsService,
    CredentialsService,
    EncryptionService,
    SsrfProtectionService,
    CatalogueIngestionService,
    CategoryMappingService,
    IntegrationCredentialGuard,
  ],
  exports: [
    IntegrationsService,
    CredentialsService,
    EncryptionService,
    SsrfProtectionService,
    CatalogueIngestionService,
    CategoryMappingService,
  ],
})
export class IntegrationsModule {}
