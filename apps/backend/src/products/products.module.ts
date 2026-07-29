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
  exports: [ProductsService],
})
export class ProductsModule {}
