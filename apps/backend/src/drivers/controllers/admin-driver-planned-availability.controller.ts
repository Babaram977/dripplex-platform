import { Controller, Get, Query } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { ListDriverPlannedAvailabilityQueryDto } from '../dto/list-driver-planned-availability-query.dto';
import { DriverPlannedAvailabilityService } from '../shifts/driver-planned-availability.service';

import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverPlannedAvailabilityDto } from '@dripplex/types';

@Controller('admin/driver-planned-availability')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_SHIFT_MANAGE)
export class AdminDriverPlannedAvailabilityController {
  constructor(private readonly plannedAvailabilityService: DriverPlannedAvailabilityService) {}

  @Get()
  public async listForDriver(
    @Query() query: ListDriverPlannedAvailabilityQueryDto,
  ): Promise<ApiSuccessResponse<DriverPlannedAvailabilityDto[]>> {
    const data = await this.plannedAvailabilityService.listForDriver(query.driverId);
    return { success: true, data };
  }
}
