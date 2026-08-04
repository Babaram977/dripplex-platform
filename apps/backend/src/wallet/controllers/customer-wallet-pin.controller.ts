import { Body, Controller, Get, Post, Req } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { SetWalletPinDto, VerifyWalletPinDto } from '../dto/withdrawal.dto';
import { WalletPinService } from '../wallet-pin.service';
import { WALLET_PERMISSIONS } from '../wallet.constants';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('customer/wallet/pin')
export class CustomerWalletPinController {
  constructor(private readonly walletPinService: WalletPinService) {}

  @Get('status')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async status(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<{ hasPin: boolean }>> {
    const hasPin = await this.walletPinService.hasPin(user.id);
    return { success: true, data: { hasPin } };
  }

  @Post()
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_WITHDRAW)
  public async set(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetWalletPinDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ hasPin: boolean }>> {
    await this.walletPinService.set(user.id, dto.pin, {
      userId: user.id,
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
    });
    return { success: true, data: { hasPin: true } };
  }

  @Post('verify')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_WITHDRAW)
  public async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyWalletPinDto,
  ): Promise<ApiSuccessResponse<{ valid: boolean }>> {
    await this.walletPinService.verify(user.id, dto.pin);
    return { success: true, data: { valid: true } };
  }
}
