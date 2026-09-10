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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ResolveBankAccountQueryDto } from '../../wallet/dto/withdrawal.dto';
import { CreateBankAccountDto } from '../dto/create-bank-account.dto';
import { CreateBusinessDto } from '../dto/create-business.dto';
import { PauseStoreDto } from '../dto/pause-store.dto';
import { SubmitKycDto } from '../dto/submit-kyc.dto';
import { UpdateBusinessDto } from '../dto/update-business.dto';
import { MerchantModuleEnabledGuard } from '../guards/merchant-module-enabled.guard';
import { MerchantBankSettlementService } from '../merchant-bank-settlement.service';
import { MERCHANT_PERMISSIONS } from '../merchant.constants';
import { MerchantsService } from '../merchants.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { BankAccountDto, BusinessDto, MerchantKycDto } from '@dripplex/types';
import type { Request } from 'express';

@Controller('merchant')
@UseGuards(MerchantModuleEnabledGuard)
export class MerchantController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly merchantBankSettlement: MerchantBankSettlementService,
  ) {}

  @Post('business')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MERCHANT_PERMISSIONS.BUSINESS_MANAGE)
  public async createBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BusinessDto>> {
    return {
      success: true,
      data: await this.merchantsService.createBusiness(
        user.id,
        dto,
        this.auditContext(request, user.id),
      ),
    };
  }

  @Get('business')
  @RequirePermissions(MERCHANT_PERMISSIONS.BUSINESS_MANAGE)
  public async getBusiness(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<BusinessDto>> {
    return { success: true, data: await this.merchantsService.getBusiness(user.id) };
  }

  @Patch('business')
  @RequirePermissions(MERCHANT_PERMISSIONS.BUSINESS_MANAGE)
  public async updateBusiness(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBusinessDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BusinessDto>> {
    return {
      success: true,
      data: await this.merchantsService.updateBusiness(
        user.id,
        dto,
        this.auditContext(request, user.id),
      ),
    };
  }

  @Post('business/pause')
  @RequirePermissions(MERCHANT_PERMISSIONS.BUSINESS_MANAGE)
  public async pauseStore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PauseStoreDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BusinessDto>> {
    return {
      success: true,
      data: await this.merchantsService.pauseStore(
        user.id,
        dto.reason,
        this.auditContext(request, user.id),
      ),
    };
  }

  @Post('business/resume')
  @RequirePermissions(MERCHANT_PERMISSIONS.BUSINESS_MANAGE)
  public async resumeStore(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BusinessDto>> {
    return {
      success: true,
      data: await this.merchantsService.resumeStore(user.id, this.auditContext(request, user.id)),
    };
  }

  @Post('kyc')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MERCHANT_PERMISSIONS.KYC_MANAGE)
  public async submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitKycDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<MerchantKycDto>> {
    return {
      success: true,
      data: await this.merchantsService.submitKyc(
        user.id,
        dto,
        this.auditContext(request, user.id),
      ),
    };
  }

  @Get('kyc')
  @RequirePermissions(MERCHANT_PERMISSIONS.KYC_MANAGE)
  public async getKyc(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<{ latest: MerchantKycDto | null; items: MerchantKycDto[] }>> {
    return { success: true, data: await this.merchantsService.getKycStatus(user.id) };
  }

  @Get('bank-account/banks')
  @RequirePermissions(MERCHANT_PERMISSIONS.BANK_MANAGE)
  public async listBankOptions(): Promise<ApiSuccessResponse<{ name: string; code: string }[]>> {
    return { success: true, data: await this.merchantBankSettlement.listBanks() };
  }

  @Get('bank-account/resolve')
  @RequirePermissions(MERCHANT_PERMISSIONS.BANK_MANAGE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public async resolveBankAccount(
    @Query() query: ResolveBankAccountQueryDto,
  ): Promise<ApiSuccessResponse<{ accountName: string; bankName: string; bankCode: string }>> {
    return { success: true, data: await this.merchantBankSettlement.resolveAccount(query) };
  }

  @Post('bank-account')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(MERCHANT_PERMISSIONS.BANK_MANAGE)
  public async createBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBankAccountDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BankAccountDto>> {
    const account = await this.merchantBankSettlement.create(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data: account as unknown as BankAccountDto };
  }

  @Get('bank-account')
  @RequirePermissions(MERCHANT_PERMISSIONS.BANK_MANAGE)
  public async listBankAccounts(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<BankAccountDto[]>> {
    return { success: true, data: await this.merchantsService.listBankAccounts(user.id) };
  }

  @Patch('bank-account/:id/default')
  @RequirePermissions(MERCHANT_PERMISSIONS.BANK_MANAGE)
  public async setDefaultBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<BankAccountDto>> {
    return {
      success: true,
      data: await this.merchantsService.setDefaultBankAccount(
        user.id,
        id,
        this.auditContext(request, user.id),
      ),
    };
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
