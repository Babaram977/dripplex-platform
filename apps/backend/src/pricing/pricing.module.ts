import { Module } from '@nestjs/common';

import { PromotionsModule } from '../promotions/promotions.module';

import { PricingService } from './pricing.service';

@Module({
  imports: [PromotionsModule],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
