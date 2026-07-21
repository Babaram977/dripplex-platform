import { Test } from '@nestjs/testing';

import { AppConfigService } from '../config/app-config.service';

import { MetricsController } from './metrics.controller';

import type { TestingModule } from '@nestjs/testing';

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            metricsEnabled: false,
          },
        },
      ],
    }).compile();

    controller = module.get(MetricsController);
  });

  it('returns metrics readiness payload', () => {
    const response = controller.getMetricsReadiness();

    expect(response.success).toBe(true);
    expect(response.data.endpointReady).toBe(true);
    expect(response.data.enabled).toBe(false);
    expect(response.data.exporter).toBe('none');
  });
});
