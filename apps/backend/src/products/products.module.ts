import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomerProductsController } from './customer/customer-products.controller';
import { CustomerProductsService } from './customer/customer-products.service';
import { MerchantProductsController } from './merchant-products.controller';
import { MerchantProductsService } from './merchant-products.service';
import { ProductSearchSyncService } from './product-search-sync.service';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MerchantProductsController, CustomerProductsController],
  providers: [
    ProductsService,
    MerchantProductsService,
    ProductSearchSyncService,
    CustomerProductsService,
  ],
  // MerchantProductsService is exported so POS catalogue ingestion can create
  // products through the same write path a merchant uses, rather than growing a
  // second one that would have to be kept in step with it.
  exports: [ProductsService, MerchantProductsService],
})
export class ProductsModule {}
