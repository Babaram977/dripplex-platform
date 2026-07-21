import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminReviewsController } from './admin-reviews.controller';
import { CustomerReviewsController } from './customer-reviews.controller';
import { MerchantReviewsController } from './merchant-reviews.controller';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    ReviewsController,
    CustomerReviewsController,
    MerchantReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
