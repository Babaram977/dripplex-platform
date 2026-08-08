import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { CustomerKycService } from './customer-kyc.service';
import { SubmitCustomerKycDto } from './dto/submit-customer-kyc.dto';
import { KYC_PERMISSIONS } from './kyc.constants';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { CustomerKycStatusDto } from '@dripplex/types';
import type { Request } from 'express';

/**
 * Self-service Level 2 identity verification (DPX-PROFILE-KYC-002). Levels 0
 * and 1 don't go through this controller at all -- they're derived from
 * existing phone/email verification state (see `CustomerKycStatusDto.
 * levelAccess`), not a document flow.
 */
@Controller('kyc/me')
export class CustomerKycController {
  constructor(private readonly kycService: CustomerKycService) {}

  @Get()
  @RequirePermissions(KYC_PERMISSIONS.CUSTOMER_MANAGE)
  public async getMyStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<CustomerKycStatusDto>> {
    const data = await this.kycService.getMyStatus(user.id);
    return { success: true, data };
  }

  @Post('start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(KYC_PERMISSIONS.CUSTOMER_MANAGE)
  public async start(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerKycStatusDto>> {
    const data = await this.kycService.start(user.id, this.auditContext(request, user.id));
    return { success: true, data };
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(KYC_PERMISSIONS.CUSTOMER_MANAGE)
  public async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitCustomerKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerKycStatusDto>> {
    const data = await this.kycService.submit(user.id, dto, this.auditContext(request, user.id));
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
