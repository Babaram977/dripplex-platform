import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CommissionOwnerType } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { COMMERCIAL_PERMISSIONS } from '../commercial.constants';
import { toCommissionAccountDto, toCommissionLedgerEntryDto } from '../commercial.mapper';
import { CommissionAccountService } from '../commission-account.service';
import { NegotiateCreditLimitDto } from '../dto/negotiate-credit-limit.dto';
import { RecordCommissionPaymentDto } from '../dto/record-commission-payment.dto';
import { PartnerPositionService } from '../partner-position.service';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ApiSuccessResponse } from '../../common/dto/api-response.dto';
import type {
  CommissionAccountDto,
  CommissionLedgerEntryDto,
  PaginatedResult,
  PartnerFinancialPositionDto,
} from '@dripplex/types';
import type { Request } from 'express';

/**
 * DPX-COMMERCIAL-001 Slice 1 — read a merchant/driver/rider's commission
 * account and ledger, and record a manual external payment against it
 * (§0.2's admin-manual pay-down mechanism; automatic deduction from a
 * mode-A settlement is wired in a later slice, not exposed here). No real
 * accrual call site exists yet — an account only has an outstanding
 * balance once Slice 2-4 lands.
 */
@Controller('admin/commercial/accounts/:ownerType/:ownerId')
@RequirePermissions(COMMERCIAL_PERMISSIONS.ADMIN_ACCOUNT_MANAGE)
export class AdminCommissionAccountsController {
  constructor(
    private readonly accounts: CommissionAccountService,
    private readonly positions: PartnerPositionService,
  ) {}

  @Get()
  public async get(
    @Param('ownerType', new ParseEnumPipe(CommissionOwnerType)) ownerType: CommissionOwnerType,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
  ): Promise<ApiSuccessResponse<CommissionAccountDto>> {
    const account = await this.accounts.getOrCreateAccount(ownerType, ownerId);
    return { success: true, data: toCommissionAccountDto(account) };
  }

  /** DrippleX's whole position with this partner: what we hold for them, what
   * they owe us, and the net of the two. */
  @Get('position')
  public async getPosition(
    @Param('ownerType', new ParseEnumPipe(CommissionOwnerType)) ownerType: CommissionOwnerType,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
  ): Promise<ApiSuccessResponse<PartnerFinancialPositionDto>> {
    const data = await this.positions.getPosition(ownerType, ownerId);
    return { success: true, data };
  }

  @Get('ledger')
  public async listLedger(
    @Param('ownerType', new ParseEnumPipe(CommissionOwnerType)) ownerType: CommissionOwnerType,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ): Promise<ApiSuccessResponse<PaginatedResult<CommissionLedgerEntryDto>>> {
    const page = Math.max(1, Number.parseInt(pageRaw ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeRaw ?? '20', 10) || 20));
    const { items, total } = await this.accounts.listLedgerEntries(
      ownerType,
      ownerId,
      page,
      pageSize,
    );
    return {
      success: true,
      data: {
        items: items.map(toCommissionLedgerEntryDto),
        meta: {
          page,
          limit: pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
        },
      },
    };
  }

  /**
   * Record the credit limit agreed with this partner. Its own permission —
   * `ADMIN_CREDIT_SETTINGS_MANAGE`, the same one that guards the platform
   * default — because agreeing a partner's ceiling is a commercial commitment,
   * not routine account admin.
   */
  @Patch('credit-limit')
  @RequirePermissions(COMMERCIAL_PERMISSIONS.ADMIN_CREDIT_SETTINGS_MANAGE)
  public async negotiateCreditLimit(
    @Param('ownerType', new ParseEnumPipe(CommissionOwnerType)) ownerType: CommissionOwnerType,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: NegotiateCreditLimitDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CommissionAccountDto>> {
    const account = await this.accounts.setNegotiatedCreditLimit({
      ownerType,
      ownerId,
      creditLimit: dto.creditLimit,
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      recordedBy: admin.id,
      context: {
        userId: admin.id,
        ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      },
    });
    return { success: true, data: toCommissionAccountDto(account) };
  }

  @Post('payments')
  public async recordPayment(
    @Param('ownerType', new ParseEnumPipe(CommissionOwnerType)) ownerType: CommissionOwnerType,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Body() dto: RecordCommissionPaymentDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ApiSuccessResponse<CommissionAccountDto>> {
    const account = await this.accounts.recordPayment({
      ownerType,
      ownerId,
      amount: dto.amount,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      recordedBy: admin.id,
      context: {
        userId: admin.id,
        ...(request.ip !== undefined ? { ipAddress: request.ip } : {}),
      },
    });
    return { success: true, data: toCommissionAccountDto(account) };
  }
}
