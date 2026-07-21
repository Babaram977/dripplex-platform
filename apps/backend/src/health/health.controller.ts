import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';

import { Public } from '../common/decorators/permissions.decorator';

import { HealthService } from './health.service';

import type { HealthCheckResult } from './health.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Response } from 'express';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  public async getHealth(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessResponse<HealthCheckResult>> {
    const result = await this.healthService.check();

    if (result.status === 'error') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      success: true,
      data: result,
    };
  }
}
