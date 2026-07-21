import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AdminAnalyticsController } from './admin-analytics.controller';
import { AnalyticsEventsSubscriber } from './analytics-events.subscriber';
import { AnalyticsService } from './analytics.service';
import { MerchantAnalyticsController } from './merchant-analytics.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MerchantAnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService, AnalyticsEventsSubscriber],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
