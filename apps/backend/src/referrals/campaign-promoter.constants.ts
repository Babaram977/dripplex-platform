import { CampaignParticipantType, ReferralOwnerType } from '@prisma/client';

/**
 * DPX-PROMO-REF-001 — the campaign promoter vocabulary.
 *
 * Kept separate from `referral.constants.ts`, which is the vocabulary of a
 * user's own standing referral code. A campaign token and a public referral
 * code are deliberately different things and mixing their constants is the
 * first step to mixing their namespaces.
 */

/**
 * How long a private campaign token is.
 *
 * 32 characters against `Referral.code`'s 8. The length is not the guarantee —
 * resolution looks in exactly one table, so a token and a public code can never
 * be confused however they are spelled — but it means a human reading a log can
 * tell at a glance which namespace a string came from, and it puts the
 * collision probability over the 31-character alphabet somewhere no operator
 * will ever meet it.
 */
export const CAMPAIGN_TOKEN_LENGTH = 32;

/** Matches `REFERRAL_CODE_MAX_GENERATION_ATTEMPTS`: a collision is retried, not
 *  reported, and a run of collisions is a real fault worth surfacing. */
export const CAMPAIGN_TOKEN_MAX_GENERATION_ATTEMPTS = 10;

/**
 * Which wallet a participant class is paid into — by way of the
 * `ReferralOwnerType` on their `Referral` row, which is what
 * `REFERRER_WALLETS` actually reads at payout time.
 *
 * This map is the single place the founder's invariant is expressed:
 * **participant type decides the rate, owner type decides the destination.**
 * Two classes route somewhere that is not their own name, and both are
 * deliberate:
 *
 * - `PIONEER_DRIVER` routes to `DRIVER`. A pioneer driver earns ₦350 where an
 *   ordinary driver earns ₦200, but it is the same person with the same driver
 *   wallet. The ₦350 is a rate, not a destination.
 * - `INFLUENCER`, `CREATOR` and `AMBASSADOR` route to `CUSTOMER` — their
 *   personal, withdrawable wallet. This is not a fallback: it is the same
 *   reasoning already committed for `FLEET_OWNER`, whose comment in
 *   `referral-lifecycle.service.ts` reads "a referral … is the owner's own
 *   marketing, earned by the person, so it is paid into the personal wallet
 *   they can actually withdraw from". An influencer's reward is exactly that.
 *
 * Exhaustive by construction: `Record<CampaignParticipantType, …>` means adding
 * a participant class without deciding where its money goes will not compile.
 */
export const PARTICIPANT_OWNER_TYPE: Record<CampaignParticipantType, ReferralOwnerType> = {
  [CampaignParticipantType.CUSTOMER]: ReferralOwnerType.CUSTOMER,
  [CampaignParticipantType.RIDER]: ReferralOwnerType.RIDER,
  [CampaignParticipantType.DRIVER]: ReferralOwnerType.DRIVER,
  [CampaignParticipantType.PIONEER_DRIVER]: ReferralOwnerType.DRIVER,
  [CampaignParticipantType.INFLUENCER]: ReferralOwnerType.CUSTOMER,
  [CampaignParticipantType.CREATOR]: ReferralOwnerType.CUSTOMER,
  [CampaignParticipantType.AMBASSADOR]: ReferralOwnerType.CUSTOMER,
};

export const CAMPAIGN_ATTRIBUTION_AUDIT_ACTIONS = {
  ATTRIBUTED: 'campaign.attribution.recorded',
} as const;

export const CAMPAIGN_PROMOTER_AUDIT_ACTIONS = {
  ADDED: 'campaign.promoter.added',
  REMOVED: 'campaign.promoter.removed',
} as const;
