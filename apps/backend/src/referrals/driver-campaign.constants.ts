export const DRIVER_CAMPAIGN_AUDIT_ACTIONS = {
  CAMPAIGN_CREATED: 'driver_referral_campaign.created',
  CAMPAIGN_UPDATED: 'driver_referral_campaign.updated',
  CAMPAIGN_PAUSED: 'driver_referral_campaign.paused',
  CAMPAIGN_RESUMED: 'driver_referral_campaign.resumed',
  CAMPAIGN_ENDED: 'driver_referral_campaign.ended',
  CODE_GENERATED: 'driver_referral_campaign.code_generated',
  PASSENGER_REGISTERED: 'driver_referral_campaign.passenger_registered',
  PASSENGER_QUALIFIED: 'driver_referral_campaign.passenger_qualified',
  REWARD_APPROVED: 'driver_referral_campaign.reward_approved',
  REWARD_REJECTED: 'driver_referral_campaign.reward_rejected',
  REWARD_PAID: 'driver_referral_campaign.reward_paid',
  FRAUD_CHECK_REVIEWED: 'driver_referral_campaign.fraud_check_reviewed',
} as const;

export const DRIVER_CAMPAIGN_PERMISSIONS = {
  DRIVER_USE: 'driver:referral_campaign:use',
  ADMIN_MANAGE: 'admin:referral_campaigns:manage',
} as const;

/**
 * WalletLedgerEntry.referenceType for campaign reward payouts, paired with
 * referenceId = ReferralReward.id — same idempotency pattern as
 * RIDE_WALLET_REFERENCE_TYPES / REFERRAL_WALLET_REFERENCE_TYPES.
 */
export const DRIVER_CAMPAIGN_WALLET_REFERENCE_TYPE = 'driver_referral_campaign_reward';

/** How often the sweep checks for campaigns that need to start or end. */
export const DRIVER_CAMPAIGN_SWEEP_INTERVAL_MS = 5 * 60_000;
