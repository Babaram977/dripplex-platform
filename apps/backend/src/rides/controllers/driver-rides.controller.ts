import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ListRidesQueryDto } from '../dto/list-rides-query.dto';
import { CancelRideDto } from '../dto/request-ride.dto';
import { RateRideDto } from '../dto/ride-rating.dto';
import { StartTripDto } from '../dto/start-trip.dto';
import { UpdateDriverAvailabilityDto } from '../dto/update-driver-availability.dto';
import { RideDispatchService } from '../ride-dispatch.service';
import { RidePaymentService } from '../ride-payment.service';
import { RideRatingService } from '../ride-rating.service';
import { RideTripService } from '../ride-trip.service';
import { RIDE_PERMISSIONS } from '../ride.constants';
import { RidesService } from '../rides.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  DriverAvailabilityDto,
  DriverRideDto,
  RideDto,
  RideOfferDto,
  RideOfferPreviewDto,
  RideRatingDto,
} from '@dripplex/types';
import type { Request } from 'express';

@Controller('driver/rides')
@RequirePermissions(RIDE_PERMISSIONS.DRIVER_MANAGE)
export class DriverRidesController {
  constructor(
    private readonly dispatchService: RideDispatchService,
    private readonly ridesService: RidesService,
    private readonly tripService: RideTripService,
    private readonly paymentService: RidePaymentService,
    private readonly ratingService: RideRatingService,
  ) {}

  @Post('availability')
  @HttpCode(HttpStatus.OK)
  public async updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDriverAvailabilityDto,
  ): Promise<ApiSuccessResponse<DriverAvailabilityDto>> {
    const data = await this.ridesService.updateDriverAvailability(user.id, dto);
    return { success: true, data };
  }

  @Get('availability')
  public async getAvailability(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverAvailabilityDto | null>> {
    const data = await this.ridesService.getOwnAvailability(user.id);
    return { success: true, data };
  }

  @Get('active')
  public async getActiveRide(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<DriverRideDto | null>> {
    const data = await this.ridesService.getActiveRide(user.id);
    return { success: true, data };
  }

  @Get()
  public async listOwnRides(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRidesQueryDto,
  ): Promise<
    ApiSuccessResponse<{
      items: RideDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>
  > {
    const data = await this.ridesService.listOwnRidesForDriver(user.id, query);
    return { success: true, data };
  }

  @Get('offers')
  public async listOwnOffers(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<RideOfferDto[]>> {
    const data = await this.dispatchService.listOwnOffers(user.id);
    return { success: true, data };
  }

  @Get('offers/:id')
  public async getOfferPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RideOfferPreviewDto>> {
    const data = await this.dispatchService.getOfferPreview(user.id, id);
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

  @Post(':id/arrive')
  @HttpCode(HttpStatus.OK)
  public async markArrived(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.tripService.markArrived(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  public async startTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartTripDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.tripService.startTrip(
      user.id,
      id,
      dto.verificationCode,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  public async completeTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.tripService.completeTrip(
      user.id,
      id,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  public async cancelTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRideDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.tripService.cancelByDriver(
      user.id,
      id,
      dto.reason,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/cash-confirm')
  @HttpCode(HttpStatus.OK)
  public async confirmCash(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.paymentService.confirmCash(user.id, id, { userId: user.id });
    return { success: true, data };
  }

  @Post(':id/rate-customer')
  @HttpCode(HttpStatus.CREATED)
  public async rateCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateRideDto,
  ): Promise<ApiSuccessResponse<RideRatingDto>> {
    const data = await this.ratingService.rateCustomer(user.id, id, dto, { userId: user.id });
    return { success: true, data };
  }

  @Get(':id/ratings')
  public async listRideRatings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RideRatingDto[]>> {
    const data = await this.ratingService.listRideRatings(user.id, id);
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
