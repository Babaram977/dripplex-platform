import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { ValidationDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import {
  LOYALTY_AUDIT_ACTIONS,
  LOYALTY_POINTS_PER_NAIRA,
  LOYALTY_SETTING_ID,
} from './loyalty.constants';

import type { LoyaltySetting } from '@prisma/client';

export interface LoyaltySettingDto {
  pointsPerNaira: number;
  walletRedemptionEnabled: boolean;
  storeRedemptionEnabled: boolean;
  minRedemptionPoints: number;
  dailyRedemptionPointsCap: number | null;
  updatedAt: string;
}

/**
 * DPX-LOYALTY-005 — the Ops-configurable terms on which DX Points convert.
 *
 * Founder decision, 2026-09-11: "let it be as shipped but can be controlled."
 *
 * Nothing about today's behaviour changes. 200 points still buy ₦1, cash-out is
 * still on, in-store spending is still on, there is still no daily cap. What
 * changes is that each of those stops being a constant only a deployment can
 * move.
 *
 * That is also the answer to Nora's §7 — that DX Points must not be treated as
 * cash — without removing a feature the founder shipped deliberately. The cash
 * door now has a handle: Operations can close it and leave points fully
 * spendable in store and against the rewards catalogue, or narrow it with a
 * daily cap, which is the setting between "points are cash" and "points are not
 * cash at all".
 *
 * Same fixed-id singleton pattern as `PlatformCommissionSettingsService`: the
 * row is the source of truth from first creation onward, and the constants only
 * seed it.
 */
@Injectable()
export class LoyaltySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async getEffective(): Promise<LoyaltySetting> {
    const existing = await this.prisma.loyaltySetting.findUnique({
      where: { id: LOYALTY_SETTING_ID },
    });
    if (existing) {
      return existing;
    }

    // First-touch seed, for a database whose migration seed was somehow
    // skipped. Two racing redemptions can both land here; the fixed id lets
    // exactly one create win and the loser reads what the winner wrote, so a
    // redemption is never failed by the seed race.
    try {
      return await this.prisma.loyaltySetting.create({
        data: { id: LOYALTY_SETTING_ID, pointsPerNaira: LOYALTY_POINTS_PER_NAIRA },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return await this.prisma.loyaltySetting.findUniqueOrThrow({
          where: { id: LOYALTY_SETTING_ID },
        });
      }
      throw error;
    }
  }

  public async get(): Promise<LoyaltySettingDto> {
    return toDto(await this.getEffective());
  }

  public async update(
    input: {
      pointsPerNaira?: number;
      walletRedemptionEnabled?: boolean;
      storeRedemptionEnabled?: boolean;
      minRedemptionPoints?: number;
      dailyRedemptionPointsCap?: number | null;
    },
    adminUserId: string,
    context: AuditContext = {},
  ): Promise<LoyaltySettingDto> {
    // The conversion rate re-prices every unspent balance on the platform at
    // once, so it is checked hard rather than trusted to a DTO decorator alone.
    if (input.pointsPerNaira !== undefined) {
      if (!Number.isInteger(input.pointsPerNaira) || input.pointsPerNaira < 1) {
        throw new ValidationDomainException(
          'Points per naira must be a whole number of at least 1',
        );
      }
    }
    if (input.minRedemptionPoints !== undefined) {
      if (!Number.isInteger(input.minRedemptionPoints) || input.minRedemptionPoints < 1) {
        throw new ValidationDomainException(
          'The minimum redemption must be a whole number of at least 1 point',
        );
      }
    }
    if (
      input.dailyRedemptionPointsCap !== undefined &&
      input.dailyRedemptionPointsCap !== null &&
      (!Number.isInteger(input.dailyRedemptionPointsCap) || input.dailyRedemptionPointsCap < 1)
    ) {
      throw new ValidationDomainException(
        'A daily cap must be a whole number of at least 1 point, or null for no cap',
      );
    }

    const before = await this.getEffective();
    const merged = {
      pointsPerNaira: input.pointsPerNaira ?? before.pointsPerNaira,
      minRedemptionPoints: input.minRedemptionPoints ?? before.minRedemptionPoints,
    };
    // A minimum that is not a whole number of naira would refuse every
    // redemption: the redeem path requires multiples of the conversion rate, so
    // no amount could satisfy both rules at once. Checked against the merged
    // values because either field can be the one that breaks it.
    if (merged.minRedemptionPoints % merged.pointsPerNaira !== 0) {
      throw new ValidationDomainException(
        `The minimum redemption must be a whole number of naira — a multiple of ${String(merged.pointsPerNaira)} points`,
      );
    }

    const updated = await this.prisma.loyaltySetting.update({
      where: { id: before.id },
      data: {
        ...(input.pointsPerNaira !== undefined ? { pointsPerNaira: input.pointsPerNaira } : {}),
        ...(input.walletRedemptionEnabled !== undefined
          ? { walletRedemptionEnabled: input.walletRedemptionEnabled }
          : {}),
        ...(input.storeRedemptionEnabled !== undefined
          ? { storeRedemptionEnabled: input.storeRedemptionEnabled }
          : {}),
        ...(input.minRedemptionPoints !== undefined
          ? { minRedemptionPoints: input.minRedemptionPoints }
          : {}),
        ...(input.dailyRedemptionPointsCap !== undefined
          ? { dailyRedemptionPointsCap: input.dailyRedemptionPointsCap }
          : {}),
        updatedBy: adminUserId,
      },
    });

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.SETTINGS_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'loyalty_setting',
        resourceId: updated.id,
        metadata: {
          previousPointsPerNaira: before.pointsPerNaira,
          newPointsPerNaira: updated.pointsPerNaira,
          previousWalletRedemptionEnabled: before.walletRedemptionEnabled,
          newWalletRedemptionEnabled: updated.walletRedemptionEnabled,
          previousStoreRedemptionEnabled: before.storeRedemptionEnabled,
          newStoreRedemptionEnabled: updated.storeRedemptionEnabled,
          previousDailyCap: before.dailyRedemptionPointsCap,
          newDailyCap: updated.dailyRedemptionPointsCap,
        },
      },
    );

    return toDto(updated);
  }
}

function toDto(setting: LoyaltySetting): LoyaltySettingDto {
  return {
    pointsPerNaira: setting.pointsPerNaira,
    walletRedemptionEnabled: setting.walletRedemptionEnabled,
    storeRedemptionEnabled: setting.storeRedemptionEnabled,
    minRedemptionPoints: setting.minRedemptionPoints,
    dailyRedemptionPointsCap: setting.dailyRedemptionPointsCap,
    updatedAt: setting.updatedAt.toISOString(),
  };
}
