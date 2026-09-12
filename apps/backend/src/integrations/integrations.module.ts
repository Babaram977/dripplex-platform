import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';

import { CatalogueSyncController } from './controllers/catalogue-sync.controller';
import { IntegrationsCController } from './controllers/integrations-c.controller';
import { IntegrationsController } from './controllers/integrations.controller';
import { InventorySyncController } from './controllers/inventory-sync.controller';
import { OrderSyncController } from './controllers/order-sync.controller';
import { IntegrationCredentialGuard } from './guards/integration-credential.guard';
import { CatalogueIngestionService } from './services/catalogue-ingestion.service';
import { CategoryMappingService } from './services/category-mapping.service';
import { CredentialsService } from './services/credentials.service';
import { EncryptionService } from './services/encryption.service';
import { IntegrationsService } from './services/integrations.service';
import { InventoryIngestionService } from './services/inventory-ingestion.service';
import { MerchantProfileResolver } from './services/merchant-profile-resolver.service';
import { OrderStatusIngestionService } from './services/order-status-ingestion.service';
import { SsrfProtectionService } from './services/ssrf-protection.service';

@Module({
  // ProductsModule supplies MerchantProductsService, so POS ingestion creates
  // products through the same write path a merchant uses — one path, so search
  // indexing and slug generation cannot drift apart.
  // OrdersModule supplies MerchantOrdersService, so a POS status change goes
  // through the same lifecycle path the merchant's own portal button uses —
  // one state machine, so the two cannot disagree about when a customer is
  // refunded.
  imports: [PrismaModule, AuditModule, AuthModule, ProductsModule, OrdersModule],
  controllers: [
    IntegrationsCController, // MKT-INT-001-C: Integration CRUD API (6 endpoints)
    IntegrationsController, // Legacy: Credential management endpoints (D phase, future)
    CatalogueSyncController, // P1: catalogue ingestion (POS push) + job history
    InventorySyncController, // MKT-INT-001-J: stock level push + current levels
    OrderSyncController, // MKT-INT-001-L: POS order status sync + POS order reads
  ],
  providers: [
    IntegrationsService,
    CredentialsService,
    EncryptionService,
    SsrfProtectionService,
    CatalogueIngestionService,
    CategoryMappingService,
    InventoryIngestionService,
    OrderStatusIngestionService,
    MerchantProfileResolver,
    IntegrationCredentialGuard,
  ],
  exports: [
    IntegrationsService,
    CredentialsService,
    EncryptionService,
    SsrfProtectionService,
    CatalogueIngestionService,
    CategoryMappingService,
    InventoryIngestionService,
    OrderStatusIngestionService,
  ],
})
export class IntegrationsModule {}
