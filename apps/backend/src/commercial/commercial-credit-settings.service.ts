import { Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import {
  COMMERCIAL_AUDIT_ACTIONS,
  DEFAULT_DRIVER_CREDIT_LIMIT,
  DEFAULT_MERCHANT_CREDIT_LIMIT,
} from './commercial.constants';

import type { CommercialCreditSetting, CommissionOwnerType } from '@prisma/client';

function defaultCreditLimitFor(ownerType: CommissionOwnerType): number {
  // DRIVER and RIDER share one default — ₦5,000 since 2026-08-25 — because
  // §1.3 treats "Driver/Rider" as a single credit-policy concept. Worth
  // knowing before changing it: a driver-only decision moves couriers too,
  // and splitting them means splitting the policy, not just the constant.
  // MERCHANT has its own, per the doc's explicit two-constant instruction.
  return ownerType === 'MERCHANT' ? DEFAULT_MERCHANT_CREDIT_LIMIT : DEFAULT_DRIVER_CREDIT_LIMIT;
}

/**
 * DPX-COMMERCIAL-001 Slice 1 — the admin-configurable commission credit
 * limit, one row per owner type (MERCHANT/DRIVER/RIDER). Same
 * get-or-create-singleton-per-key + audit-logged-update pattern as
 * MerchantCommissionSettingsService/DriverSecuritySettingsService. The DB
 * row is the source of truth from first creation onward —
 * DEFAULT_MERCHANT_CREDIT_LIMIT/DEFAULT_DRIVER_CREDIT_LIMIT only seed a
 * row's initial value, never read directly by accrual/blocking logic.
 *
 * A limit change is prospective: it does not rewrite any CommissionAccount
 * row that already exists. CommissionAccountService re-reads the effective
 * limit and re-syncs it onto the account whenever accrue()/recordPayment()
 * runs — see docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md §3.2.
 */
@Injectable()
export class CommercialCreditSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async getEffective(ownerType: CommissionOwnerType): Promise<CommercialCreditSetting> {
    const existing = await this.prisma.commercialCreditSetting.findUnique({
      where: { ownerType },
    });
    if (existing) {
      return existing;
    }

    return await this.prisma.commercialCreditSetting.create({
      data: {
        ownerType,
        creditLimit: defaultCreditLimitFor(ownerType),
      },
    });
  }

  public async update(
    ownerType: CommissionOwnerType,
    creditLimit: number,
    adminUserId: string,
    context: AuditContext,
  ): Promise<CommercialCreditSetting> {
    const before = await this.getEffective(ownerType);

    const updated = await this.prisma.commercialCreditSetting.update({
      where: { ownerType },
      data: { creditLimit, updatedBy: adminUserId },
    });

    await this.auditService.record(
      COMMERCIAL_AUDIT_ACTIONS.CREDIT_SETTING_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'commercial_credit_settings',
        resourceId: updated.id,
        metadata: {
          ownerType,
          previousCreditLimit: Number(before.creditLimit),
          newCreditLimit: Number(updated.creditLimit),
          changedBy: adminUserId,
        },
      },
    );

    return updated;
  }
}
