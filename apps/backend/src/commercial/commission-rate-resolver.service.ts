import { Injectable, Logger } from '@nestjs/common';
import { CommissionCampaignStatus, CommissionScope } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { evaluatePromotionRules } from '../promotions/promotion-rules';

import type { PromotionEligibilityContext, PromotionRules } from '../promotions/promotion-rules';

/**
 * What the caller knows about the transaction being settled.
 *
 * Deliberately the same shape the promotions engine evaluates against, minus
 * the fields that only make sense for a customer discount. A rule the context
 * cannot answer fails closed — see `resolve`.
 */
export interface CommissionRateContext {
  /** The partner being charged. Lets a campaign be aimed at named partners. */
  userId?: string;
  city?: string;
  state?: string;
  country?: string;
  merchantCategory?: string;
  paymentMethod?: string;
  rideType?: PromotionEligibilityContext['rideType'];
  now?: Date;
}

export interface ResolvedCommissionRate {
  rate: number;
  /** The campaign that set it, or null when the standing rate applied. */
  campaignId: string | null;
  campaignName: string | null;
}

/**
 * DPX-COMMISSION-001 — the rate to charge, for this scope, right now.
 *
 * Commission used to be two numbers in two singleton rows. That is still the
 * standing rate — what DrippleX charges when nothing special is running — but
 * it could not express "7% this week, 14% next week" or "5% on weekend orders"
 * without an Ops person editing the singleton on a Monday and remembering to
 * edit it back. Editing it back is the part that does not happen, and the
 * failure mode is charging partners the promotional rate indefinitely.
 *
 * A campaign is a window with a rate and, optionally, conditions. This resolves
 * the two together:
 *
 * 1. Campaigns for the scope that are ACTIVE and whose window contains `now`.
 * 2. Of those, the ones whose rules the context satisfies.
 * 3. Highest `priority` wins; ties break on most recently created.
 * 4. Nothing matches → the standing rate, unchanged.
 *
 * **Rules fail closed.** A campaign that constrains something the caller cannot
 * tell us about does not apply, and the standing rate is used. That is the only
 * defensible default for money: the standing rate is the one both sides already
 * agreed to, so falling back to it is never a surprise in either direction —
 * whereas guessing could either deny a partner a rate cut they were promised or
 * charge them a rise they were never told applied to this transaction.
 */
@Injectable()
export class CommissionRateResolverService {
  private readonly logger = new Logger(CommissionRateResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async resolve(
    scope: CommissionScope,
    standingRate: number,
    context: CommissionRateContext = {},
  ): Promise<ResolvedCommissionRate> {
    const campaign = await this.activeCampaign(scope, context);
    return campaign ?? { rate: standingRate, campaignId: null, campaignName: null };
  }

  /**
   * The campaign in force, if any, without needing a standing rate to fall back
   * to.
   *
   * Fleets need this: their standing rate is banded on the month's final
   * volume, so at the moment a job completes there is no standing rate to pass
   * in — only the question of whether a campaign was running.
   */
  public async activeCampaign(
    scope: CommissionScope,
    context: CommissionRateContext = {},
  ): Promise<ResolvedCommissionRate | null> {
    const now = context.now ?? new Date();

    const candidates = await this.prisma.commissionCampaign.findMany({
      where: {
        scope,
        status: CommissionCampaignStatus.ACTIVE,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    for (const campaign of candidates) {
      const rules = (campaign.rules ?? null) as PromotionRules | null;
      const { eligible } = evaluatePromotionRules(rules, {
        // The promotions evaluator keys whitelists and blacklists on userId.
        // An empty string matches no list, which is what we want when the
        // caller has no partner to name: a campaign aimed at named partners
        // should not apply to a transaction we cannot attribute.
        userId: context.userId ?? '',
        ...(context.city !== undefined ? { city: context.city } : {}),
        ...(context.state !== undefined ? { state: context.state } : {}),
        ...(context.country !== undefined ? { country: context.country } : {}),
        ...(context.merchantCategory !== undefined
          ? { merchantCategory: context.merchantCategory }
          : {}),
        ...(context.paymentMethod !== undefined ? { paymentMethod: context.paymentMethod } : {}),
        ...(context.rideType !== undefined ? { rideType: context.rideType } : {}),
        now,
      });

      if (eligible) {
        const rate = Number(campaign.commissionRate);
        if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
          // A stored rate outside (0, 1) would silently rewrite what a partner
          // earns. Refuse it and charge the standing rate rather than act on a
          // figure that cannot be right.
          this.logger.error(
            `Commission campaign ${campaign.id} has an out-of-range rate (${String(rate)}); using the standing rate instead.`,
          );
          continue;
        }
        return { rate, campaignId: campaign.id, campaignName: campaign.name };
      }
    }

    return null;
  }
}
