import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import {
  COMMERCIAL_AUDIT_ACTIONS,
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_SETTING_ID,
} from './commercial.constants';

import type { PlatformCommissionSetting } from '@prisma/client';

/**
 * DPX-LAUNCH — the Ops-configurable platform commission rate applied to ride
 * settlement. A single row, read on every ride settlement calculation and
 * editable by an administrator without a redeploy — the same
 * get-or-create-singleton + audit-logged-update pattern as
 * MerchantCommissionSettingsService / CommercialCreditSettingsService. The DB
 * row is the source of truth from first creation onward;
 * `DEFAULT_PLATFORM_COMMISSION_RATE` (10%) only seeds the row's initial value.
 *
 * Changing the rate here never touches an already-settled ride — each ride
 * snapshots the rate it settled at into `Ride.platformCommissionRate` and the
 * resulting `platformCommission` / `driverEarning` amounts, so refunds and
 * reversals always use the rate that applied when the ride settled.
 */
@Injectable()
export class PlatformCommissionSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async getEffective(): Promise<PlatformCommissionSetting> {
    const existing = await this.prisma.platformCommissionSetting.findUnique({
      where: { id: PLATFORM_COMMISSION_SETTING_ID },
    });
    if (existing) {
      return existing;
    }

    // First-touch seed. This can be hit concurrently by two racing first-ever
    // ride settlements; the fixed-id unique constraint lets exactly one create
    // win. The loser catches P2002 and reads the row the winner just wrote, so a
    // settlement is never failed by the seed race (money-path safety).
    try {
      return await this.prisma.platformCommissionSetting.create({
        data: {
          id: PLATFORM_COMMISSION_SETTING_ID,
          commissionRate: DEFAULT_PLATFORM_COMMISSION_RATE,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return await this.prisma.platformCommissionSetting.findUniqueOrThrow({
          where: { id: PLATFORM_COMMISSION_SETTING_ID },
        });
      }
      throw error;
    }
  }

  /** The active rate as a plain number (e.g. 0.1). Convenience for settlement. */
  public async getEffectiveRate(): Promise<number> {
    const setting = await this.getEffective();
    return Number(setting.commissionRate);
  }

  public async update(
    commissionRate: number,
    adminUserId: string,
    context: AuditContext,
  ): Promise<PlatformCommissionSetting> {
    const before = await this.getEffective();

    const updated = await this.prisma.platformCommissionSetting.update({
      where: { id: PLATFORM_COMMISSION_SETTING_ID },
      data: { commissionRate, updatedBy: adminUserId },
    });

    await this.auditService.record(
      COMMERCIAL_AUDIT_ACTIONS.COMMISSION_SETTING_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'platform_commission_settings',
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
