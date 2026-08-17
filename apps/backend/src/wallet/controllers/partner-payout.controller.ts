import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { WalletOwnerType } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BankAccountsService, type CustomerBankAccountDto } from '../bank-accounts.service';
import {
  AddBankAccountDto,
  CreateWithdrawalRequestDto,
  SetWalletPinDto,
  WithdrawalHistoryQueryDto,
} from '../dto/withdrawal.dto';
import { WalletPinService } from '../wallet-pin.service';
import { WALLET_PERMISSIONS } from '../wallet.constants';
import {
  WithdrawalService,
  type PayoutResultDto,
  type WithdrawalRequestDto,
} from '../withdrawal.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-PAYOUT-001 — how a rider or driver gets paid.
 *
 * Their earnings have always landed in a RIDER/DRIVER wallet (RiderSettlement
 * and the ride settlement services credit it on every completed job), but
 * there was no way to get money out of it: bank-account linking, the wallet
 * PIN and the withdrawal queue were all bolted to `customer/wallet/*` and
 * gated on customer permissions. The driver app said "Withdraw · Coming soon"
 * because it was true.
 *
 * Nothing new is invented here. This is the **existing** withdrawal machinery
 * — request debits the wallet immediately and sits PENDING; Operations pays by
 * bank transfer and marks it complete; a failure reverses the debit back to
 * the same wallet — made reachable by the two roles that earn money on the
 * platform.
 *
 * Founder decision (2026-08-16): Operations transfers manually, on a weekly
 * cycle every Monday, working from the settlement report. Requests may be
 * raised any day; the Monday run is when the money moves.
 */
abstract class PartnerPayoutController {
  constructor(
    protected readonly bankAccountsService: BankAccountsService,
    protected readonly withdrawalService: WithdrawalService,
    protected readonly walletPinService: WalletPinService,
  ) {}

  /** Which wallet this partner's earnings live in. */
  protected abstract ownerType(): WalletOwnerType;

  public async listBankAccounts(
    user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto[]>> {
    const data = await this.bankAccountsService.list(user.id);
    return { success: true, data };
  }

  public async addBankAccount(
    user: AuthenticatedUser,
    dto: AddBankAccountDto,
    request: Request,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto>> {
    const data = await this.bankAccountsService.add(user.id, dto, auditContext(request, user.id));
    return { success: true, data };
  }

  public async setDefaultBankAccount(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto>> {
    const data = await this.bankAccountsService.setDefault(user.id, id);
    return { success: true, data };
  }

  public async removeBankAccount(
    user: AuthenticatedUser,
    id: string,
    request: Request,
  ): Promise<ApiSuccessResponse<{ removed: boolean }>> {
    await this.bankAccountsService.remove(user.id, id, auditContext(request, user.id));
    return { success: true, data: { removed: true } };
  }

  public async setPin(
    user: AuthenticatedUser,
    dto: SetWalletPinDto,
    request: Request,
  ): Promise<ApiSuccessResponse<{ set: true }>> {
    await this.walletPinService.set(user.id, dto.pin, auditContext(request, user.id));
    return { success: true, data: { set: true } };
  }

  public async hasPin(user: AuthenticatedUser): Promise<ApiSuccessResponse<{ set: boolean }>> {
    const set = await this.walletPinService.hasPin(user.id);
    return { success: true, data: { set } };
  }

  public async requestPayout(
    user: AuthenticatedUser,
    dto: CreateWithdrawalRequestDto,
    request: Request,
  ): Promise<ApiSuccessResponse<PayoutResultDto>> {
    const data = await this.withdrawalService.create(
      user.id,
      this.ownerType(),
      dto,
      auditContext(request, user.id),
    );
    return { success: true, data };
  }

  public async listPayouts(
    user: AuthenticatedUser,
    query: WithdrawalHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WithdrawalRequestDto>>> {
    const data = await this.withdrawalService.listForUser(user.id, query.page, query.pageSize);
    return { success: true, data };
  }
}

function auditContext(
  request: Request,
  userId: string,
): { userId: string; ipAddress?: string; userAgent?: string } {
  const forwarded = request.headers['x-forwarded-for'];
  const ipAddress = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : request.ip;
  const userAgent = request.headers['user-agent'];
  return {
    userId,
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    ...(typeof userAgent === 'string' ? { userAgent } : {}),
  };
}

@Controller('rider/wallet')
export class RiderPayoutController extends PartnerPayoutController {
  protected override ownerType(): WalletOwnerType {
    return WalletOwnerType.RIDER;
  }

  @Get('bank-accounts')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_READ)
  public override async listBankAccounts(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto[]>> {
    return await super.listBankAccounts(user);
  }

  @Post('bank-accounts')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_WITHDRAW)
  public override async addBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddBankAccountDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto>> {
    return await super.addBankAccount(user, dto, request);
  }

  @Patch('bank-accounts/:id/default')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_WITHDRAW)
  public override async setDefaultBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto>> {
    return await super.setDefaultBankAccount(user, id);
  }

  @Delete('bank-accounts/:id')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_WITHDRAW)
  public override async removeBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ removed: boolean }>> {
    return await super.removeBankAccount(user, id, request);
  }

  @Post('pin')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_WITHDRAW)
  public override async setPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetWalletPinDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ set: true }>> {
    return await super.setPin(user, dto, request);
  }

  @Get('pin')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_READ)
  public override async hasPin(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<{ set: boolean }>> {
    return await super.hasPin(user);
  }

  @Post('payouts')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_WITHDRAW)
  public override async requestPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalRequestDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PayoutResultDto>> {
    return await super.requestPayout(user, dto, request);
  }

  @Get('payouts')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_READ)
  public override async listPayouts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WithdrawalHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WithdrawalRequestDto>>> {
    return await super.listPayouts(user, query);
  }
}

@Controller('driver/wallet')
export class DriverPayoutController extends PartnerPayoutController {
  protected override ownerType(): WalletOwnerType {
    return WalletOwnerType.DRIVER;
  }

  @Get('bank-accounts')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_READ)
  public override async listBankAccounts(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto[]>> {
    return await super.listBankAccounts(user);
  }

  @Post('bank-accounts')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_WITHDRAW)
  public override async addBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddBankAccountDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto>> {
    return await super.addBankAccount(user, dto, request);
  }

  @Patch('bank-accounts/:id/default')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_WITHDRAW)
  public override async setDefaultBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<CustomerBankAccountDto>> {
    return await super.setDefaultBankAccount(user, id);
  }

  @Delete('bank-accounts/:id')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_WITHDRAW)
  public override async removeBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ removed: boolean }>> {
    return await super.removeBankAccount(user, id, request);
  }

  @Post('pin')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_WITHDRAW)
  public override async setPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetWalletPinDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ set: true }>> {
    return await super.setPin(user, dto, request);
  }

  @Get('pin')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_READ)
  public override async hasPin(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<{ set: boolean }>> {
    return await super.hasPin(user);
  }

  @Post('payouts')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_WITHDRAW)
  public override async requestPayout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalRequestDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<PayoutResultDto>> {
    return await super.requestPayout(user, dto, request);
  }

  @Get('payouts')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_READ)
  public override async listPayouts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WithdrawalHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WithdrawalRequestDto>>> {
    return await super.listPayouts(user, query);
  }
}
