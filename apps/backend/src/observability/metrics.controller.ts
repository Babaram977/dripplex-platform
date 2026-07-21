import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { Public } from '../common/decorators/permissions.decorator';
import { AppConfigService } from '../config/app-config.service';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';

export interface MetricsReadiness {
  enabled: boolean;
  exporter: 'none' | 'prometheus' | 'otlp';
  endpointReady: boolean;
  message: string;
}

@Controller('metrics')
export class MetricsController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  public getMetricsReadiness(): ApiSuccessResponse<MetricsReadiness> {
    const enabled = this.appConfig.metricsEnabled;

    return {
      success: true,
      data: {
        enabled,
        exporter: enabled ? 'prometheus' : 'none',
        endpointReady: true,
        message: enabled
          ? 'Metrics collection is flagged on; exporter wiring lands in a later sprint.'
          : 'Metrics collection is disabled. Enable METRICS_ENABLED when Prometheus/OTel is provisioned.',
      },
    };
  }
}
