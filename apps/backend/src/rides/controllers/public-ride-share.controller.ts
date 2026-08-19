import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../../common/decorators/permissions.decorator';
import { RideShareService } from '../ride-share.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { SharedRideDto } from '@dripplex/types';

/**
 * The one unauthenticated door into a ride: the link a passenger sends their
 * family. No `@RequirePermissions` on the class, and the only lookup key is
 * the 32-character token in the URL — there is no ride id to guess and no
 * listing endpoint. What comes back is the trimmed `SharedRideDto`, never the
 * ride record.
 */
@Controller('public/rides')
export class PublicRideShareController {
  constructor(private readonly shareService: RideShareService) {}

  @Public()
  @Get('shared/:token')
  public async getSharedRide(
    @Param('token') token: string,
  ): Promise<ApiSuccessResponse<SharedRideDto>> {
    const data = await this.shareService.getSharedRide(token);
    return { success: true, data };
  }
}
