import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateBankAccountDto } from '../dto/create-bank-account.dto';
import { CreateBusinessDto } from '../dto/create-business.dto';
import { SubmitKycDto } from '../dto/submit-kyc.dto';
import { UpdateBusinessDto } from '../dto/update-business.dto';
import { MERCHANT_PERMISSIONS } from '../merchant.constants';
import { MerchantsService } from '../merchants.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { BankAccountDto, BusinessDto, MerchantKycDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('merchant')
export class MerchantController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post('business')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MERCHANT_PERMISSIONS.BUSINESS_MANAGE)
  public async createBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BusinessDto>> {
    const data = await this.merchantsService.createBusiness(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('business')
  @RequirePermissions(MERCHANT_PERMISSIONS.BUSINESS_MANAGE)
  public async getBusiness(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<BusinessDto>> {
    const data = await this.merchantsService.getBusiness(user.id);
    return { success: true, data };
  }

  @Patch('business')
  @RequirePermissions(MERCHANT_PERMISSIONS.BUSINESS_MANAGE)
  public async updateBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBusinessDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BusinessDto>> {
    const data = await this.merchantsService.updateBusiness(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('kyc')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MERCHANT_PERMISSIONS.KYC_MANAGE)
  public async submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantKycDto>> {
    const data = await this.merchantsService.submitKyc(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('kyc')
  @RequirePermissions(MERCHANT_PERMISSIONS.KYC_MANAGE)
  public async getKyc(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<{ latest: MerchantKycDto | null; items: MerchantKycDto[] }>> {
    const data = await this.merchantsService.getKycStatus(user.id);
    return { success: true, data };
  }

  @Post('bank-account')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MERCHANT_PERMISSIONS.BANK_MANAGE)
  public async createBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBankAccountDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BankAccountDto>> {
    const data = await this.merchantsService.createBankAccount(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('bank-account')
  @RequirePermissions(MERCHANT_PERMISSIONS.BANK_MANAGE)
  public async listBankAccounts(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<BankAccountDto[]>> {
    const data = await this.merchantsService.listBankAccounts(user.id);
    return { success: true, data };
  }

  @Patch('bank-account/:id/default')
  @RequirePermissions(MERCHANT_PERMISSIONS.BANK_MANAGE)
  public async setDefaultBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BankAccountDto>> {
    const data = await this.merchantsService.setDefaultBankAccount(
      user.id,
      id,
      this.auditContext(request, user.id),
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
