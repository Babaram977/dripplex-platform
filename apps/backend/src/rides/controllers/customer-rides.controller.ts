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
import { NearbyDriversQueryDto } from '../dto/nearby-drivers-query.dto';
import { CancelRideDto, EstimateRideFareDto, RequestRideDto } from '../dto/request-ride.dto';
import { InitiateRidePaymentDto, VerifyRidePaymentDto } from '../dto/ride-payment.dto';
import { ReportRideProblemDto } from '../dto/ride-problem-report.dto';
import { RateRideDto } from '../dto/ride-rating.dto';
import { TipDriverDto } from '../dto/ride-tip.dto';
import { RidePaymentService } from '../ride-payment.service';
import { RideProblemReportService } from '../ride-problem-report.service';
import { RideRatingService } from '../ride-rating.service';
import { RideReceiptService } from '../ride-receipt.service';
import { RideTrackingReadService } from '../ride-tracking-read.service';
import { RIDE_PERMISSIONS } from '../ride.constants';
import { RidesService } from '../rides.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  EstimateRideFareResponse,
  InitiateRidePaymentResponse,
  NearbyDriverDto,
  RideDto,
  RideProblemReportDto,
  RideRatingDto,
  RideReceiptDto,
  RideTrackingPointDto,
  RideTypeCatalogEntryDto,
} from '@dripplex/types';
import type { Request } from 'express';

@Controller('customer/rides')
@RequirePermissions(RIDE_PERMISSIONS.MANAGE)
export class CustomerRidesController {
  constructor(
    private readonly ridesService: RidesService,
    private readonly paymentService: RidePaymentService,
    private readonly ratingService: RideRatingService,
    private readonly receiptService: RideReceiptService,
    private readonly problemReportService: RideProblemReportService,
    private readonly trackingReadService: RideTrackingReadService,
  ) {}

  /** Registered before `:id` — otherwise "types" would be captured as a
   * ride id by that route. */
  @Get('types')
  public listRideTypes(): ApiSuccessResponse<RideTypeCatalogEntryDto[]> {
    return { success: true, data: this.ridesService.listRideTypes() };
  }

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  public async estimateFare(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EstimateRideFareDto,
  ): Promise<ApiSuccessResponse<EstimateRideFareResponse>> {
    const data = await this.ridesService.estimateFare(user.id, dto);
    return { success: true, data };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async requestRide(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestRideDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.ridesService.requestRide(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
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
    const data = await this.ridesService.listOwnRides(user.id, query);
    return { success: true, data };
  }

  /** Registered before `:id` — otherwise "nearby-drivers" would be captured
   * as a ride id by that route. */
  @Get('nearby-drivers')
  public async getNearbyDrivers(
    @Query() query: NearbyDriversQueryDto,
  ): Promise<ApiSuccessResponse<NearbyDriverDto[]>> {
    const data = await this.trackingReadService.getNearbyDrivers(query);
    return { success: true, data };
  }

  @Get(':id')
  public async getOwnRide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.ridesService.getOwnRide(user.id, id);
    return { success: true, data };
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  public async cancelRide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRideDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.ridesService.cancelRide(
      user.id,
      id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  public async initiatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateRidePaymentDto,
  ): Promise<ApiSuccessResponse<InitiateRidePaymentResponse>> {
    const data = await this.paymentService.initiatePayment(
      user.id,
      id,
      dto.method,
      dto.callbackUrl,
      { userId: user.id },
    );
    return { success: true, data };
  }

  @Post(':id/pay/verify')
  @HttpCode(HttpStatus.OK)
  public async verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyRidePaymentDto,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.paymentService.verifyPayment(user.id, id, dto.reference, {
      userId: user.id,
    });
    return { success: true, data };
  }

  @Get(':id/tracking')
  public async getTrackingHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RideTrackingPointDto[]>> {
    const data = await this.trackingReadService.getTrackingHistory(user.id, id);
    return { success: true, data };
  }

  @Get(':id/receipt')
  public async getReceipt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RideReceiptDto>> {
    const data = await this.receiptService.getReceipt(user.id, id);
    return { success: true, data };
  }

  @Post(':id/rate-driver')
  @HttpCode(HttpStatus.CREATED)
  public async rateDriver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateRideDto,
  ): Promise<ApiSuccessResponse<RideRatingDto>> {
    const data = await this.ratingService.rateDriver(user.id, id, dto, { userId: user.id });
    return { success: true, data };
  }

  @Post(':id/tip')
  @HttpCode(HttpStatus.OK)
  public async tipDriver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TipDriverDto,
  ): Promise<ApiSuccessResponse<RideDto>> {
    const data = await this.paymentService.tipDriver(user.id, id, dto.amount, { userId: user.id });
    return { success: true, data };
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.CREATED)
  public async reportProblem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportRideProblemDto,
  ): Promise<ApiSuccessResponse<RideProblemReportDto>> {
    const data = await this.problemReportService.reportProblem(user.id, id, dto, {
      userId: user.id,
    });
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
