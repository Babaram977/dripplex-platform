import { Module } from '@nestjs/common';

import { AppConfigModule } from '../config/config.module';

import { ErrorTrackingService } from './error-tracking.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [AppConfigModule],
  controllers: [MetricsController],
  providers: [ErrorTrackingService],
  exports: [ErrorTrackingService],
})
export class ObservabilityModule {}
