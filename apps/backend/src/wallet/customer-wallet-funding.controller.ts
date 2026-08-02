import { Body, Controller, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

import { FundWalletDto, VerifyWalletFundingDto } from './dto/wallet-funding.dto';
import { type FundWalletResult, WalletFundingService } from './wallet-funding.service';
import { WALLET_PERMISSIONS } from './wallet.constants';
import { type WalletDto } from './wallet.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('customer/wallet')
export class CustomerWalletFundingController {
  constructor(private readonly walletFundingService: WalletFundingService) {}

  @Post('fund')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_FUND)
  public async fund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FundWalletDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<FundWalletResult>> {
    const data = await this.walletFundingService.initiateFunding(
      user.id,
      dto,
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Post('fund/verify')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_FUND)
  public async verifyFund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyWalletFundingDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletFundingService.verifyFunding(
      user.id,
      dto,
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
