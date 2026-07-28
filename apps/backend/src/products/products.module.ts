import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
