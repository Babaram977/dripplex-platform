import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { MerchantProductsController } from './merchant-products.controller';
import { MerchantProductsService } from './merchant-products.service';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MerchantProductsController],
  providers: [ProductsService, MerchantProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
