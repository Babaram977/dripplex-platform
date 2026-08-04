import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { ForceEndDriverShiftDto } from '../dto/force-end-driver-shift.dto';
import { ListDriverShiftsQueryDto } from '../dto/list-driver-shifts-query.dto';
import { DriverShiftService } from '../shifts/driver-shift.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverShiftDto, DriverShiftListDto } from '@dripplex/types';
import type { Request } from 'express';

/** Operations visibility (Driver Slice 2 item 6): who's currently
 * active/on break, shift history, and force-ending an abandoned shift. */
@Controller('admin/driver-shifts')
@RequirePermissions(DRIVER_PERMISSIONS.ADMIN_SHIFT_MANAGE)
export class AdminDriverShiftsController {
  constructor(private readonly shiftService: DriverShiftService) {}

  @Get()
  public async list(
    @Query() query: ListDriverShiftsQueryDto,
  ): Promise<ApiSuccessResponse<DriverShiftListDto>> {
    const data = await this.shiftService.listShifts(query);
    return { success: true, data };
  }

  @Patch(':id/end')
  public async forceEnd(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ForceEndDriverShiftDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverShiftDto>> {
    const data = await this.shiftService.forceEndShift(
      id,
      admin.id,
      dto,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { userId?: string; ipAddress?: string; userAgent?: string } {
    return {
      ...(userId !== undefined ? { userId } : {}),
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
