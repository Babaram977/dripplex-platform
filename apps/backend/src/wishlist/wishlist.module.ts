import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CartModule } from '../cart/cart.module';
import { PrismaModule } from '../prisma/prisma.module';

import { SharedWishlistController } from './shared-wishlist.controller';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [PrismaModule, AuditModule, CartModule],
  controllers: [WishlistController, SharedWishlistController],
  providers: [WishlistService],
  exports: [WishlistService],
})
export class WishlistModule {}
