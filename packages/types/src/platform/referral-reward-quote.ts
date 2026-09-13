/**
 * What a referral code pays, resolved to exactly one currency.
 *
 * Points and naira are never both populated. That is the whole point of this
 * type: a promoter's code carries one rate at a time (founder ruling
 * 2026-09-13), and a screen that could reach for either figure is a screen that
 * can print ₦350 to somebody the ledger pays in DX Points.
 */
export type ReferralRewardQuote =
  { kind: 'NGN'; amountNgn: number } | { kind: 'POINTS'; points: number };

/**
 * Decide which figure a referral surface may show.
 *
 * Lives here, shared, rather than at each call site. The bank-name matching in
 * this codebase was reimplemented at five call sites and the copies drifted
 * until two personas typing the same three letters got different answers; the
 * same drift across referral surfaces would be a wrong statement about
 * somebody's earnings, made in one app and not the other.
 *
 * A points campaign is quoted in points. No conversion is applied and none is
 * available here — 5,000 DX Points is not ₦5,000, and any client that computed
 * a naira equivalent would be inventing a rate.
 */
export function referralRewardQuote(stats: {
  referrerRewardAmount: number;
  campaignRewardPoints: number | null;
}): ReferralRewardQuote {
  if (stats.campaignRewardPoints !== null) {
    return { kind: 'POINTS', points: stats.campaignRewardPoints };
  }
  return { kind: 'NGN', amountNgn: stats.referrerRewardAmount };
}
