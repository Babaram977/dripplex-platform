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
import { Throttle } from '@nestjs/throttler';
import { WalletOwnerType } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BankAccountsService, type CustomerBankAccountDto } from '../bank-accounts.service';
import {
  AddBankAccountDto,
  ResolveBankAccountQueryDto,
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

  public async listBanks(): Promise<ApiSuccessResponse<{ name: string; code: string }[]>> {
    const data = await this.bankAccountsService.listBanks();
    return { success: true, data };
  }

  public async resolveBankAccount(
    query: ResolveBankAccountQueryDto,
  ): Promise<ApiSuccessResponse<{ accountName: string; bankName: string; bankCode: string }>> {
    const data = await this.bankAccountsService.resolveAccount(query);
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
  // Nest resolves constructor dependencies from `design:paramtypes`, and
  // TypeScript only emits that metadata for a class that declares its own
  // constructor. A subclass that just inherits the base constructor carries no
  // metadata at all, so Nest builds it with zero arguments: the app boots,
  // every route maps, and then each handler throws on the first `this.<service>`
  // because all three are undefined. It surfaces as a 500 on every endpoint of
  // this controller while the rest of the app is fine. Hence the explicit
  // pass-through — it exists for the metadata, not for the code.
  //
  // It reads as a useless constructor and the linter says so. Deleting it
  // removes the metadata and breaks every route here at runtime, so the rule is
  // silenced deliberately. See partner-payout-di.spec.ts.
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    bankAccountsService: BankAccountsService,
    withdrawalService: WithdrawalService,
    walletPinService: WalletPinService,
  ) {
    super(bankAccountsService, withdrawalService, walletPinService);
  }

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

  @Get('bank-accounts/banks')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_READ)
  public override async listBanks(): Promise<ApiSuccessResponse<{ name: string; code: string }[]>> {
    return await super.listBanks();
  }

  /**
   * Name enquiry for the form, before anything is saved.
   *
   * Throttled hard: each call is a live request to the payment provider, and
   * an unthrottled "who owns this number" endpoint is an account-name
   * enumeration surface. A person filling in one form needs a handful of
   * attempts, not hundreds.
   */
  @Get('bank-accounts/resolve')
  @RequirePermissions(WALLET_PERMISSIONS.RIDER_READ)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public override async resolveBankAccount(
    @Query() query: ResolveBankAccountQueryDto,
  ): Promise<ApiSuccessResponse<{ accountName: string; bankName: string; bankCode: string }>> {
    return await super.resolveBankAccount(query);
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
  // Nest resolves constructor dependencies from `design:paramtypes`, and
  // TypeScript only emits that metadata for a class that declares its own
  // constructor. A subclass that just inherits the base constructor carries no
  // metadata at all, so Nest builds it with zero arguments: the app boots,
  // every route maps, and then each handler throws on the first `this.<service>`
  // because all three are undefined. It surfaces as a 500 on every endpoint of
  // this controller while the rest of the app is fine. Hence the explicit
  // pass-through — it exists for the metadata, not for the code.
  //
  // It reads as a useless constructor and the linter says so. Deleting it
  // removes the metadata and breaks every route here at runtime, so the rule is
  // silenced deliberately. See partner-payout-di.spec.ts.
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    bankAccountsService: BankAccountsService,
    withdrawalService: WithdrawalService,
    walletPinService: WalletPinService,
  ) {
    super(bankAccountsService, withdrawalService, walletPinService);
  }

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

  @Get('bank-accounts/banks')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_READ)
  public override async listBanks(): Promise<ApiSuccessResponse<{ name: string; code: string }[]>> {
    return await super.listBanks();
  }

  /**
   * Name enquiry for the form, before anything is saved.
   *
   * Throttled hard: each call is a live request to the payment provider, and
   * an unthrottled "who owns this number" endpoint is an account-name
   * enumeration surface. A person filling in one form needs a handful of
   * attempts, not hundreds.
   */
  @Get('bank-accounts/resolve')
  @RequirePermissions(WALLET_PERMISSIONS.DRIVER_READ)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  public override async resolveBankAccount(
    @Query() query: ResolveBankAccountQueryDto,
  ): Promise<ApiSuccessResponse<{ accountName: string; bankName: string; bankCode: string }>> {
    return await super.resolveBankAccount(query);
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
