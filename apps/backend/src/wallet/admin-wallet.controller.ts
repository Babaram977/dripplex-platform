import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { WalletOwnerType } from '@prisma/client';

import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ValidationDomainException } from '../common/exceptions/domain.exception';

import { AdminWalletMutationDto, WalletReconciliationQueryDto } from './dto/wallet.dto';
import { WALLET_PERMISSIONS } from './wallet.constants';
import { WalletService, type WalletDto, type WalletReconciliationDto } from './wallet.service';

import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { Request } from 'express';

@Controller('admin/wallets')
export class AdminWalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('reconciliation')
  @RequirePermissions(WALLET_PERMISSIONS.ADMIN_MANAGE)
  public async reconcile(
    @Query() query: WalletReconciliationQueryDto,
  ): Promise<ApiSuccessResponse<WalletReconciliationDto>> {
    if (!query.ownerType || !query.ownerId) {
      throw new ValidationDomainException('ownerType and ownerId are required');
    }
    const data = await this.walletService.reconcileWallet(
      query.ownerType,
      query.ownerId,
      query.currency,
    );
    return { success: true, data };
  }

  @Post(':ownerType/:ownerId/credit')
  @RequirePermissions(WALLET_PERMISSIONS.ADMIN_MANAGE)
  public async credit(
    @Param('ownerType', new ParseEnumPipe(WalletOwnerType)) ownerType: WalletOwnerType,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: AdminWalletMutationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.credit({
      ownerType,
      ownerId,
      amount: dto.amount,
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.referenceType !== undefined ? { referenceType: dto.referenceType } : {}),
      ...(dto.referenceId !== undefined ? { referenceId: dto.referenceId } : {}),
      context: this.auditContext(request),
    });
    return { success: true, data };
  }

  @Post(':ownerType/:ownerId/debit')
  @RequirePermissions(WALLET_PERMISSIONS.ADMIN_MANAGE)
  public async debit(
    @Param('ownerType', new ParseEnumPipe(WalletOwnerType)) ownerType: WalletOwnerType,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: AdminWalletMutationDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.debit({
      ownerType,
      ownerId,
      amount: dto.amount,
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.referenceType !== undefined ? { referenceType: dto.referenceType } : {}),
      ...(dto.referenceId !== undefined ? { referenceId: dto.referenceId } : {}),
      context: this.auditContext(request),
    });
    return { success: true, data };
  }

  private auditContext(request: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      ...(typeof request.headers['user-agent'] === 'string'
        ? { userAgent: request.headers['user-agent'] }
        : {}),
    };
  }
}
