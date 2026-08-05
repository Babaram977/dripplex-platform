import { Injectable } from '@nestjs/common';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import {
  DEFAULT_MERCHANT_COMMISSION_RATE,
  MERCHANT_COMMISSION_SETTING_ID,
  ORDER_AUDIT_ACTIONS,
} from './order.constants';

import type { MerchantCommissionSetting } from '@prisma/client';

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
