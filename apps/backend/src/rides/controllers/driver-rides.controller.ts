import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RideDispatchService } from '../ride-dispatch.service';
import { RIDE_PERMISSIONS } from '../ride.constants';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { RideDto, RideOfferDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/rides')
@RequirePermissions(RIDE_PERMISSIONS.DRIVER_MANAGE)
export class DriverRidesController {
  constructor(private readonly dispatchService: RideDispatchService) {}

  @Get('offers')
  public async listOwnOffers(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<RideOfferDto[]>> {
    const data = await this.dispatchService.listOwnOffers(user.id);
    return { success: true, data };
  }

  @Post('offers/:id/accept')
  @HttpCode(HttpStatus.OK)
  public async acceptOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.dispatchService.acceptOffer(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('offers/:id/decline')
  @HttpCode(HttpStatus.OK)
  public async declineOffer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<null>> {
    await this.dispatchService.declineOffer(user.id, id, this.auditContext(request, user.id));
    return { success: true, data: null };
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
