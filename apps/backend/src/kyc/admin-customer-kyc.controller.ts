import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CustomerKycService } from './customer-kyc.service';
import {
  RejectCustomerKycDto,
  RequestResubmissionCustomerKycDto,
  VerifyCustomerKycDto,
} from './dto/admin-customer-kyc-review.dto';
import { KYC_PERMISSIONS } from './kyc.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { AdminCustomerKycListItemDto, CustomerKycStatusDto } from '@dripplex/types';
import type { Request } from 'express';

/** Admin review of customer Level 2 KYC submissions, modeled on `AdminDriversController`'s KYC review shape. */
@Controller('admin/customer-kyc')
export class AdminCustomerKycController {
  constructor(private readonly kycService: CustomerKycService) {}

  @Get('pending')
  @RequirePermissions(KYC_PERMISSIONS.ADMIN_REVIEW)
  public async listPending(): Promise<ApiSuccessResponse<AdminCustomerKycListItemDto[]>> {
    const data = await this.kycService.listPendingReview();
    return { success: true, data };
  }

  @Get('user/:userId')
  @RequirePermissions(KYC_PERMISSIONS.ADMIN_REVIEW)
  public async getForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiSuccessResponse<CustomerKycStatusDto>> {
    const data = await this.kycService.getForUser(userId);
    return { success: true, data };
  }

  @Post(':kycId/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(KYC_PERMISSIONS.ADMIN_REVIEW)
  public async verify(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('kycId', ParseUUIDPipe) kycId: string,
    @Body() dto: VerifyCustomerKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerKycStatusDto>> {
    const data = await this.kycService.verify(
      kycId,
      admin.id,
      dto.remarks,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post(':kycId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(KYC_PERMISSIONS.ADMIN_REVIEW)
  public async reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('kycId', ParseUUIDPipe) kycId: string,
    @Body() dto: RejectCustomerKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerKycStatusDto>> {
    const data = await this.kycService.reject(
      kycId,
      admin.id,
      dto.remarks,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post(':kycId/request-resubmission')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(KYC_PERMISSIONS.ADMIN_REVIEW)
  public async requestResubmission(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('kycId', ParseUUIDPipe) kycId: string,
    @Body() dto: RequestResubmissionCustomerKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerKycStatusDto>> {
    const data = await this.kycService.requestResubmission(
      kycId,
      admin.id,
      dto.remarks,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  private auditContext(
    request: Request,
    userId?: string,
  ): { ipAddress?: string; userAgent?: string; userId?: string } {
    const forwarded = request.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;
    const userAgent = request.headers['user-agent'];

    return {
      ...(ipAddress ? { ipAddress } : {}),
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
      ...(userId !== undefined ? { userId } : {}),
    };
  }
}
