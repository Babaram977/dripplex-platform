import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WalletOwnerType } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UserScopedThrottlerGuard } from '../common/guards/user-scoped-throttler.guard';

import {
  LookupRecipientQueryDto,
  SetWalletLimitsDto,
  TransferWalletDto,
  WalletHistoryQueryDto,
  WalletStatementQueryDto,
} from './dto/wallet.dto';
import { WalletRecipientsService, type WalletRecipientDto } from './wallet-recipients.service';
import { WALLET_PERMISSIONS } from './wallet.constants';
import {
  WalletService,
  type WalletDto,
  type WalletLedgerEntryDto,
  type WalletStatementDto,
} from './wallet.service';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { ApiSuccessResponse } from '../common/dto/api-response.dto';
import type { PaginatedResult } from '@dripplex/types';
import type { Request, Response } from 'express';

@Controller('customer/wallet')
export class CustomerWalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletRecipientsService: WalletRecipientsService,
  ) {}

  @Get()
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async getWallet(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.getWallet(WalletOwnerType.CUSTOMER, user.id);
    return { success: true, data };
  }

  @Get('transactions')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletHistoryQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedResult<WalletLedgerEntryDto>>> {
    const data = await this.walletService.listHistory(
      WalletOwnerType.CUSTOMER,
      user.id,
      query.page,
      query.pageSize,
      undefined,
      query.type,
    );
    return { success: true, data };
  }

  /**
   * Rate-limited per authenticated caller, not per IP.
   *
   * This endpoint answers, for any phone number or address, whether a DrippleX
   * account exists and what that person is called. Adding email lookup widened
   * that: an address is far easier to guess than a phone number. Thirty a
   * minute is generous for a debounced search box — a sender typing one
   * recipient produces a handful — and turns bulk probing into something that
   * costs an attacker a fresh verified account for every bucket.
   *
   * The limit does not stop a patient attacker spread across accounts and
   * time. Nothing short of removing the lookup would, and the lookup is the
   * feature. It stops the cheap version.
   */
  @Get('transfer/recipients')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_TRANSFER)
  @UseGuards(UserScopedThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  public async lookupRecipient(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LookupRecipientQueryDto,
  ): Promise<ApiSuccessResponse<WalletRecipientDto[]>> {
    // Exactly one identifier. Neither is a malformed request; both would make
    // the server choose which one names the recipient, and money is moving on
    // the answer — so the caller is told rather than guessed at. Written as
    // two narrowing branches rather than a ternary over booleans so the types
    // carry the guarantee instead of an assertion.
    const { phone, email } = query;
    let recipient: WalletRecipientDto | null;
    if (phone !== undefined && email === undefined) {
      recipient = await this.walletRecipientsService.findByPhone(user.id, phone);
    } else if (email !== undefined && phone === undefined) {
      recipient = await this.walletRecipientsService.findByEmail(user.id, email);
    } else {
      throw new BadRequestException('Provide exactly one of phone or email');
    }
    return { success: true, data: recipient ? [recipient] : [] };
  }

  @Get('transfer/recipients/recent')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_TRANSFER)
  public async recentRecipients(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiSuccessResponse<WalletRecipientDto[]>> {
    const data = await this.walletRecipientsService.listRecent(user.id);
    return { success: true, data };
  }

  @Post('transfer')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_TRANSFER)
  public async transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferWalletDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<{ source: WalletDto; destination: WalletDto }>> {
    await this.walletService.assertWithinLimits(
      WalletOwnerType.CUSTOMER,
      user.id,
      dto.amount,
      dto.currency,
    );
    const data = await this.walletService.transfer({
      fromOwnerType: WalletOwnerType.CUSTOMER,
      fromOwnerId: user.id,
      toOwnerType: WalletOwnerType.CUSTOMER,
      toOwnerId: dto.toUserId,
      amount: dto.amount,
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      context: this.auditContext(request, user.id),
    });
    return { success: true, data };
  }

  @Put('limits')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_TRANSFER)
  public async setLimits(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetWalletLimitsDto,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<WalletDto>> {
    const data = await this.walletService.setLimits(
      WalletOwnerType.CUSTOMER,
      user.id,
      {
        dailyLimit: dto.dailyLimit ?? null,
        singleTransactionLimit: dto.singleTransactionLimit ?? null,
      },
      this.auditContext(request, user.id),
    );
    return { success: true, data };
  }

  @Get('statement')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  public async statement(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletStatementQueryDto,
  ): Promise<ApiSuccessResponse<WalletStatementDto>> {
    const data = await this.walletService.getStatement(
      WalletOwnerType.CUSTOMER,
      user.id,
      query.month,
      query.year,
    );
    return { success: true, data };
  }

  @Get('statement/export')
  @RequirePermissions(WALLET_PERMISSIONS.CUSTOMER_READ)
  @Header('Content-Type', 'text/csv')
  public async exportStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletStatementQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const statement = await this.walletService.getStatement(
      WalletOwnerType.CUSTOMER,
      user.id,
      query.month,
      query.year,
    );
    const rows = [
      ['Date', 'Type', 'Description', 'Direction', 'Amount', 'Balance After'],
      ...statement.transactions.map((tx) => [
        tx.createdAt,
        tx.type,
        (tx.description ?? '').replace(/"/g, '""'),
        tx.direction,
        tx.amount.toFixed(2),
        tx.balanceAfter.toFixed(2),
      ]),
    ];
    // CSV/formula-injection mitigation (OWASP): a cell beginning with =, +, -, @, tab,
    // or CR is interpreted as a formula by Excel/Sheets/Calc on open. description is
    // free text a customer controls (transfer notes), and a transfer writes the same
    // entry to both wallets, so this is exploitable against the recipient, not just
    // self. Prefixing with a single quote neutralizes it while staying human-readable.
    const sanitizeCsvCell = (value: string): string =>
      /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    const csv = rows
      .map((row) => row.map((cell) => `"${sanitizeCsvCell(cell)}"`).join(','))
      .join('\n');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="wallet-statement-${String(query.year)}-${String(query.month).padStart(2, '0')}.csv"`,
    );
    response.send(csv);
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
