import { Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { DriverShiftService } from '../shifts/driver-shift.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { DriverShiftDto, DriverShiftSummaryDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/shifts')
@RequirePermissions(DRIVER_PERMISSIONS.SHIFT_MANAGE)
export class DriverShiftsController {
  constructor(private readonly shiftService: DriverShiftService) {}

  @Get()
  public async listOwn(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverShiftDto[]>> {
    const data = await this.shiftService.listOwnShifts(user.id);
    return { success: true, data };
  }

  @Get('summary')
  public async getSummary(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverShiftSummaryDto>> {
    const data = await this.shiftService.getSummary(user.id);
    return { success: true, data };
  }

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  public async start(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverShiftDto>> {
    const data = await this.shiftService.startShift(user.id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post('break/start')
  public async startBreak(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverShiftDto>> {
    const data = await this.shiftService.startBreak(user.id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post('break/end')
  public async endBreak(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverShiftDto>> {
    const data = await this.shiftService.endBreak(user.id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post('end')
  public async end(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverShiftDto>> {
    const data = await this.shiftService.endShift(user.id, this.auditContext(request, user.id));
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
