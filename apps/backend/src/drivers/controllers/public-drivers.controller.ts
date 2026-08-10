import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { Public } from '../../common/decorators/permissions.decorator';
import { DriversService } from '../drivers.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RatingSummaryDto } from '@dripplex/types';

/**
 * DPX-REVIEWS-001 — customer-facing driver reputation. Public (no auth): a
 * rider deciding whether to accept a driver can see the driver's aggregate
 * star rating. Only the aggregate is exposed — never individual raters.
 */
@Controller('drivers')
export class PublicDriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get(':driverId/rating')
  @Public()
  public async getDriverRating(
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<ApiSuccessResponse<RatingSummaryDto>> {
    const data = await this.driversService.getPublicDriverRating(driverId);
    return { success: true, data };
  }
}
