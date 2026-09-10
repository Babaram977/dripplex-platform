import { useEffect, useState } from 'react';

import { referralShareUrl } from '../lib/referralLink';

import type { ReferralStatsDto } from '../lib/api';

const IT = "'Inter',sans-serif";
const PP = "'Poppins',sans-serif";
const G2 = '#2BAC52';
const G3 = '#47CF72';
const MUTED = 'rgba(255,255,255,.5)';
const SECONDARY = 'rgba(255,255,255,.65)';
const BORDER = 'rgba(255,255,255,.08)';
const SURFACE = '#101F35';

const naira = (n: number): string => `₦${Math.round(n).toLocaleString()}`;

/**
 * A partner's standing referral code — the scheme that is always on.
 *
 * One component for drivers and riders because it is one scheme: a customer
 * who registers with the code earns the partner wallet cash, released on that
 * customer's first completed ride rather than on signup, since paying at
 * registration makes self-signup free money.
 *
 * Shared rather than copied per persona. The bank-name matching in this
 * codebase was reimplemented at five call sites and the copies drifted until a
 * fleet owner and a driver typing the same three letters got different
 * answers; a referral card duplicated per persona would drift the same way,
 * and the difference would be money.
 *
 * Deliberately NOT the Driver Growth Campaign, which is a monthly promo with
 * tiers, thresholds and admin approval. That runs alongside this and is a
 * separate card.
 *
 * Reward amounts come from the server (`referrerRewardAmount`), never literals
 * here, so changing the payout does not need an app release.
 */
export function StandingReferralCard({
  loadStats,
}: {
  /** The persona's own stats endpoint. It creates the code on first read, so
   *  this is the only call needed. */
  loadStats: () => Promise<ReferralStatsDto>;
}): React.JSX.Element | null {
  const [stats, setStats] = useState<ReferralStatsDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    loadStats()
      .then((s) => {
        if (live) {
          setStats(s);
        }
      })
      .catch(() => {
        if (live) {
          setFailed(true);
        }
      });
    return () => {
      live = false;
    };
  }, [loadStats]);

  const share = async (): Promise<void> => {
    if (stats === null) {
      return;
    }
    const shareUrl = referralShareUrl(stats.code);
    const message = `Join me on DrippleX — use my code ${stats.code} when you sign up. ${shareUrl}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text: message, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // A cancelled share sheet lands here too. Nothing to report.
    }
  };

  // Somebody who cannot reach the endpoint sees nothing rather than an error
  // banner on their wallet; the balance above is the screen's real business.
  if (failed || stats === null) {
    return null;
  }

  return (
    <div
      className="mb-5 rounded-2xl p-4"
      style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
    >
      <p className="mb-1 text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
        Your referral code
      </p>
      <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: SECONDARY }}>
        {naira(stats.referrerRewardAmount)} lands in this wallet for every passenger who signs up
        with your code — paid when they complete their first ride. They get{' '}
        {naira(stats.refereeRewardAmount)} too.
      </p>

      <div
        className="mb-3 flex items-center gap-2 rounded-xl p-3"
        style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.2)' }}
      >
        <p
          className="flex-1 text-[18px] font-bold tracking-[3px]"
          style={{ fontFamily: PP, color: G3 }}
        >
          {stats.code}
        </p>
        <button
          type="button"
          onClick={() => void share()}
          className="rounded-lg px-4 py-2 text-[12px] font-bold"
          style={{ background: G2, color: '#fff', fontFamily: PP }}
        >
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>

      <div className="flex gap-3">
        {[
          { v: stats.totalRedemptions, l: 'Signed up' },
          // "Awaiting first ride" rather than "Pending", which reads as "we are
          // checking it" — nothing is owed until that passenger rides, and the
          // label should say which it is.
          { v: stats.pendingRedemptions, l: 'Awaiting first ride' },
          { v: stats.rewardedRedemptions, l: 'Paid' },
        ].map((s) => (
          <div key={s.l} className="flex-1 text-center">
            <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              {s.v}
            </p>
            <p className="text-[10px]" style={{ fontFamily: IT, color: MUTED }}>
              {s.l}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
