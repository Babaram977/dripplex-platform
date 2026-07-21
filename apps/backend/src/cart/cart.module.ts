import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminCartsController } from './admin-carts.controller';
import { DEFAULT_FLAT_DELIVERY_FEE, DEFAULT_VAT_RATE } from './cart.constants';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { AlwaysAvailableInventoryValidator } from './inventory/always-available-inventory.validator';
import { INVENTORY_VALIDATOR } from './inventory/inventory-validator';
import { COUPON_ENGINE } from './pricing/coupon-engine';
import { DELIVERY_FEE_CALCULATOR, FLAT_DELIVERY_FEE } from './pricing/delivery-fee-calculator';
import { FlatDeliveryFeeCalculator } from './pricing/flat-delivery-fee.calculator';
import { NigeriaTaxCalculator } from './pricing/nigeria-tax.calculator';
import { NoCouponEngine } from './pricing/no-coupon.engine';
import { TAX_CALCULATOR, VAT_RATE } from './pricing/tax-calculator';
import { CART_REPOSITORY } from './repositories/cart.repository';
import { PrismaCartRepository } from './repositories/prisma-cart.repository';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CartController, AdminCartsController],
  providers: [
    CartService,
    { provide: CART_REPOSITORY, useClass: PrismaCartRepository },
    { provide: COUPON_ENGINE, useClass: NoCouponEngine },
    { provide: TAX_CALCULATOR, useClass: NigeriaTaxCalculator },
    { provide: DELIVERY_FEE_CALCULATOR, useClass: FlatDeliveryFeeCalculator },
    { provide: INVENTORY_VALIDATOR, useClass: AlwaysAvailableInventoryValidator },
    { provide: VAT_RATE, useValue: DEFAULT_VAT_RATE },
    { provide: FLAT_DELIVERY_FEE, useValue: DEFAULT_FLAT_DELIVERY_FEE },
  ],
  exports: [CartService],
})
export class CartModule {}
