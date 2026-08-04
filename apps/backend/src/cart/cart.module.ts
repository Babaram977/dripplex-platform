import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';

import { AdminCartsController } from './admin-carts.controller';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CatalogInventoryValidator } from './inventory/catalog-inventory.validator';
import { INVENTORY_VALIDATOR } from './inventory/inventory-validator';
import { CART_REPOSITORY } from './repositories/cart.repository';
import { PrismaCartRepository } from './repositories/prisma-cart.repository';

@Module({
  imports: [PrismaModule, AuditModule, ProductsModule, PricingModule],
  controllers: [CartController, AdminCartsController],
  providers: [
    CartService,
    { provide: CART_REPOSITORY, useClass: PrismaCartRepository },
    { provide: INVENTORY_VALIDATOR, useClass: CatalogInventoryValidator },
  ],
  exports: [CartService, CART_REPOSITORY],
})
export class CartModule {}
