import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RIDE_PERMISSIONS } from '../../rides/ride.constants';
import { DriverRideContactService } from '../ride-contact/driver-ride-contact.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RidePassengerContactDto } from '@dripplex/types';

/** Driver Slice 2 item 2 — one-tap phone calling. Reuses
 * `RIDE_PERMISSIONS.DRIVER_MANAGE` (the same permission drivers already
 * hold for ride actions) rather than inventing a new one, since this is
 * still "a driver acting on their own active ride" — just a read, not a
 * new capability class. Read-only reference to the rides module's own
 * permission constant; no file under `rides/` is modified. */
@Controller('driver/ride-contact')
@RequirePermissions(RIDE_PERMISSIONS.DRIVER_MANAGE)
export class DriverRideContactController {
  constructor(private readonly rideContactService: DriverRideContactService) {}

  @Get('active')
  public async getActiveContact(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<RidePassengerContactDto>> {
    const data = await this.rideContactService.getActiveContact(user.id);
    return { success: true, data };
  }
}
