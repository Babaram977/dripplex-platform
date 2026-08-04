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
import { DriverActivationService } from '../activation/driver-activation.service';
import { DRIVER_PERMISSIONS } from '../driver.constants';
import { DriversService } from '../drivers.service';
import {
  RejectDriverDto,
  RejectDriverKycDto,
  ReviewDriverKycDto,
  SuspendDriverDto,
} from '../dto/admin-driver-actions.dto';
import { ListDriversQueryDto } from '../dto/list-drivers-query.dto';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  DriverActivationEligibilityDto,
  DriverApprovalDto,
  DriverKycDto,
  DriverProfileDto,
} from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin')
export class AdminDriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly activationService: DriverActivationService,
  ) {}

  @Get('drivers')
  @RequirePermissions(DRIVER_PERMISSIONS.REVIEW)
  public async listDrivers(@Query() query: ListDriversQueryDto): Promise<
    ApiSuccessResponse<{
      items: DriverProfileDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>
  > {
    const data = await this.driversService.listDrivers(query);
    return { success: true, data };
  }

  @Get('driver/:id')
  @RequirePermissions(DRIVER_PERMISSIONS.REVIEW)
  public async getDriver(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<DriverProfileDto>> {
    const data = await this.driversService.getDriverProfile(id);
    return { success: true, data };
  }

  @Post('driver/kyc/:kycId/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.APPROVE)
  public async verifyKyc(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('kycId', ParseUUIDPipe) kycId: string,
    @Body() dto: ReviewDriverKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverKycDto>> {
    const data = await this.driversService.verifyKyc(
      kycId,
      admin.id,
      dto.remarks,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('driver/kyc/:kycId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.REJECT)
  public async rejectKyc(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('kycId', ParseUUIDPipe) kycId: string,
    @Body() dto: RejectDriverKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverKycDto>> {
    const data = await this.driversService.rejectKyc(
      kycId,
      admin.id,
      dto.remarks,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Get('driver/:id/activation-eligibility')
  @RequirePermissions(DRIVER_PERMISSIONS.REVIEW)
  public async getActivationEligibility(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<DriverActivationEligibilityDto>> {
    const data = await this.activationService.checkEligibility(id);
    return { success: true, data };
  }

  @Post('driver/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.APPROVE)
  public async approveDriver(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverApprovalDto>> {
    const data = await this.driversService.approveDriver(
      id,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('driver/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.REJECT)
  public async rejectDriver(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDriverDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverApprovalDto>> {
    const data = await this.driversService.rejectDriver(
      id,
      admin.id,
      dto.reason,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('driver/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.SUSPEND)
  public async suspendDriver(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendDriverDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverApprovalDto>> {
    const data = await this.driversService.suspendDriver(
      id,
      admin.id,
      dto.reason,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('driver/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(DRIVER_PERMISSIONS.REACTIVATE)
  public async reactivateDriver(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<DriverApprovalDto>> {
    const data = await this.driversService.reactivateDriver(
      id,
      admin.id,
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
