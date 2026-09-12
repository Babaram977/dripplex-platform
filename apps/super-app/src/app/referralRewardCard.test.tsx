import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DPX-PROMO-REF-001 — the wallet referral card promises what the server says,
 * and nothing else.
 *
 * This card shipped the string "Share and earn ₦350 per friend who signs up".
 * The amount was compiled into the bundle: the screen fetched the referral
 * *code* from the API and never asked what the reward was, so the number
 * survived any repricing of the programme. With the CUSTOMER programme moving
 * to ₦150, the card would have gone on promising ₦350 to every customer who
 * opened their wallet — a figure nobody would honour.
 *
 * The wording was wrong too. The referrer is paid when the referred customer
 * reaches their first milestone, not when they sign up; the signup reward is
 * the referee's, and is a different amount.
 *
 * These tests are written so a hardcode fails whichever number is hardcoded —
 * restoring 350, or "fixing" it to a literal 150.
 */

const stats = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    referrals: {
      me: () => Promise.resolve({ id: 'r1', userId: 'u1', code: 'DRPX1234', createdAt: '' }),
      stats: () => stats(),
    },
    loyalty: {
      get: () =>
        Promise.resolve({
          account: { pointsBalance: 0, lifetimePoints: 0, tier: 'BRONZE' },
          nextTier: null,
        }),
      history: () => Promise.resolve({ items: [] }),
    },
  },
}));

vi.mock('../lib/auth', () => ({
  auth: {
    isLoggedIn: () => true,
    getUser: () => ({ firstName: 'Ada' }),
    greetingName: () => 'Ada',
  },
}));

const { RewardsScreen } = await import('./walletScreen');

beforeEach(() => {
  vi.clearAllMocks();
});

/** Whatever the server says, that is what the card says. */
async function rewardTextFor(referrerRewardAmount: number): Promise<string> {
  stats.mockResolvedValue({
    code: 'DRPX1234',
    totalRedemptions: 0,
    pendingRedemptions: 0,
    rewardedRedemptions: 0,
    refereeRewardAmount: 999,
    referrerRewardAmount,
  });
  const { unmount } = render(<RewardsScreen />);
  // Waits for the resolved state, not the placeholder: the fallback copy also
  // starts "Share and earn", so matching that alone would read the card before
  // the server's answer arrived and pass against any implementation.
  const node = await screen.findByText(/Share and earn ₦/);
  const text = node.textContent ?? '';
  unmount();
  return text;
}

describe('wallet referral card', () => {
  it('shows the amount the server returned', async () => {
    expect(await rewardTextFor(150)).toContain('₦150');
  });

  /**
   * The assertion that makes a hardcode impossible to hide.
   *
   * A literal 350 fails the first case; a literal 150 fails this one. Only a
   * card that actually reads the server's number satisfies both.
   */
  it('follows the server when the programme is priced differently', async () => {
    expect(await rewardTextFor(275)).toContain('₦275');
  });

  it('never shows a reward the server did not state', async () => {
    const text = await rewardTextFor(150);
    // The superseded literal, and the referee's amount, which belongs to the
    // other side of the referral and is a different number.
    expect(text).not.toContain('₦350');
    expect(text).not.toContain('₦999');
  });

  it('does not claim the reward is earned at signup', async () => {
    const text = await rewardTextFor(150);
    // The referrer is paid on the referee's first qualifying milestone. "Per
    // friend who signs up" described the referee's reward, not this one.
    expect(text).not.toMatch(/signs? up/i);
    expect(text).toMatch(/qualif/i);
  });

  it('shows no amount at all when the server does not answer', async () => {
    stats.mockRejectedValue(new Error('offline'));
    render(<RewardsScreen />);

    const node = await screen.findByText(/Share and earn/);
    await waitFor(() => {
      expect(node.textContent ?? '').not.toMatch(/₦\d/);
    });
    // A dash, not a default economic value: no number beats a wrong number.
    expect(node.textContent ?? '').toContain('—');
  });
});
