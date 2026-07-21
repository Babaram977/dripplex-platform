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
import {
  RejectKycDto,
  RejectMerchantDto,
  ReviewKycDto,
  SuspendMerchantDto,
} from '../dto/admin-actions.dto';
import { ListMerchantsQueryDto } from '../dto/list-merchants-query.dto';
import { MERCHANT_PERMISSIONS } from '../merchant.constants';
import { MerchantsService } from '../merchants.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { MerchantApprovalDto, MerchantKycDto, MerchantProfileDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('admin')
export class AdminMerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('merchants')
  @RequirePermissions(MERCHANT_PERMISSIONS.REVIEW)
  public async listMerchants(@Query() query: ListMerchantsQueryDto): Promise<
    ApiSuccessResponse<{
      items: MerchantProfileDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>
  > {
    const data = await this.merchantsService.listMerchants(query);
    return { success: true, data };
  }

  @Get('merchant/:id')
  @RequirePermissions(MERCHANT_PERMISSIONS.REVIEW)
  public async getMerchant(@Param('id', ParseUUIDPipe) id: string): Promise<
    ApiSuccessResponse<{
      profile: MerchantProfileDto;
      auditSummary: { action: string; count: number; lastAt: string | null }[];
    }>
  > {
    const data = await this.merchantsService.getMerchantProfile(id);
    return { success: true, data };
  }

  @Post('merchant/:id/kyc/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MERCHANT_PERMISSIONS.APPROVE)
  public async verifyKyc(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantKycDto>> {
    const data = await this.merchantsService.verifyKyc(
      id,
      admin.id,
      dto.remarks,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('merchant/:id/kyc/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MERCHANT_PERMISSIONS.REJECT)
  public async rejectKyc(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantKycDto>> {
    const data = await this.merchantsService.rejectKyc(
      id,
      admin.id,
      dto.remarks,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('merchant/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MERCHANT_PERMISSIONS.APPROVE)
  public async approveMerchant(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantApprovalDto>> {
    const data = await this.merchantsService.approveMerchant(
      id,
      admin.id,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('merchant/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MERCHANT_PERMISSIONS.REJECT)
  public async rejectMerchant(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectMerchantDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantApprovalDto>> {
    const data = await this.merchantsService.rejectMerchant(
      id,
      admin.id,
      dto.reason,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('merchant/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MERCHANT_PERMISSIONS.SUSPEND)
  public async suspendMerchant(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendMerchantDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantApprovalDto>> {
    const data = await this.merchantsService.suspendMerchant(
      id,
      admin.id,
      dto.reason,
      this.auditContext(request, admin.id),
    );
    return { success: true, data };
  }

  @Post('merchant/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(MERCHANT_PERMISSIONS.REACTIVATE)
  public async reactivateMerchant(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantApprovalDto>> {
    const data = await this.merchantsService.reactivateMerchant(
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
