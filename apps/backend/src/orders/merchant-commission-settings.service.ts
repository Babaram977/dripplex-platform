import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import {
  DEFAULT_MERCHANT_COMMISSION_RATE,
  MERCHANT_COMMISSION_SETTING_ID,
  ORDER_AUDIT_ACTIONS,
} from './order.constants';

import type { MerchantCommissionSetting, MerchantProfile } from '@prisma/client';

/**
 * DPX-MERCHANT-002 — the admin-configurable Marketplace merchant
 * commission rate. A single row, read on every settlement calculation and
 * editable by an admin without a redeploy — same pattern as
 * `DriverSecuritySettingsService`. The DB row is the source of truth from
 * first creation onward; `DEFAULT_MERCHANT_COMMISSION_RATE` only seeds the
 * row's initial value.
 *
 * Changing the rate here never touches an already-created
 * `OrderSettlement` row — each settlement snapshots the rate it used at
 * calculation time. See docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md.
 */
@Injectable()
export class MerchantCommissionSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async getEffective(): Promise<MerchantCommissionSetting> {
    const existing = await this.prisma.merchantCommissionSetting.findUnique({
      where: { id: MERCHANT_COMMISSION_SETTING_ID },
    });
    if (existing) {
      return existing;
    }

    return await this.prisma.merchantCommissionSetting.create({
      data: {
        id: MERCHANT_COMMISSION_SETTING_ID,
        commissionRate: DEFAULT_MERCHANT_COMMISSION_RATE,
      },
    });
  }

  /**
   * The rate agreed with one merchant, or null when none has been.
   *
   * Keyed on the **merchant profile id**, which is what `Order.merchantId` and
   * `OrderSettlement.merchantId` hold — not the user id. Getting that wrong
   * reads as "no agreement" and silently bills the standing rate, which is the
   * kind of mistake that only shows up on somebody's invoice.
   */
  public async negotiatedRateFor(merchantProfileId: string): Promise<number | null> {
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantProfileId },
      select: { negotiatedRate: true },
    });
    const negotiated = profile?.negotiatedRate ?? null;
    return negotiated === null ? null : Number(negotiated);
  }

  /**
   * Agrees a rate with one merchant, or clears it back to the platform rate.
   *
   * A negotiated rate is a commercial commitment, so it carries who agreed it
   * and on what terms rather than living only in the audit log — the same shape
   * `Fleet.negotiatedRate` and `CommissionAccount.negotiatedCreditLimit` use.
   *
   * Clearing wipes the whole agreement, note included: a note left behind
   * would describe terms that no longer apply.
   */
  public async setNegotiatedRate(input: {
    merchantProfileId: string;
    rate: number | null;
    note?: string;
    adminUserId: string;
    context: AuditContext;
  }): Promise<MerchantProfile> {
    if (input.rate !== null && (input.rate <= 0 || input.rate >= 1)) {
      throw new ValidationDomainException(
        `Rate must be a fraction between 0 and 1 — 0.075 for 7.5%. Got ${String(input.rate)}`,
      );
    }

    const before = await this.prisma.merchantProfile.findUnique({
      where: { id: input.merchantProfileId },
      select: { negotiatedRate: true },
    });
    if (before === null) {
      throw new NotFoundDomainException('Merchant profile not found');
    }

    const updated = await this.prisma.merchantProfile.update({
      where: { id: input.merchantProfileId },
      data:
        input.rate === null
          ? {
              negotiatedRate: null,
              negotiatedBy: null,
              negotiatedAt: null,
              negotiationNote: null,
            }
          : {
              negotiatedRate: new Prisma.Decimal(input.rate),
              negotiatedBy: input.adminUserId,
              negotiatedAt: new Date(),
              negotiationNote: input.note?.trim() ?? null,
            },
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.MERCHANT_RATE_NEGOTIATED,
      { ...input.context, userId: input.adminUserId },
      {
        resource: 'merchant_profile',
        resourceId: updated.id,
        metadata: {
          previousRate: before.negotiatedRate === null ? null : Number(before.negotiatedRate),
          newRate: input.rate,
          note: input.note ?? null,
        },
      },
    );

    return updated;
  }

  public async update(
    commissionRate: number,
    adminUserId: string,
    context: AuditContext,
  ): Promise<MerchantCommissionSetting> {
    const before = await this.getEffective();

    const updated = await this.prisma.merchantCommissionSetting.update({
      where: { id: MERCHANT_COMMISSION_SETTING_ID },
      data: { commissionRate, updatedBy: adminUserId },
    });

    await this.auditService.record(
      ORDER_AUDIT_ACTIONS.COMMISSION_SETTINGS_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant_commission_settings',
        resourceId: updated.id,
        metadata: {
          previousRate: Number(before.commissionRate),
          newRate: Number(updated.commissionRate),
          changedBy: adminUserId,
        },
      },
    );

    return updated;
  }
}
