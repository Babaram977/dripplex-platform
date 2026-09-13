import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StandingReferralCard } from './standingReferralCard';

import type { ReferralStatsDto } from '../lib/api';

/**
 * DPX-PROMO-REF-002 — one code, one rate (founder ruling 2026-09-13).
 *
 * A promoter shares their own referral code and nothing else. Being enrolled on
 * a campaign does not give them a second code or a second link: it raises what
 * the one code pays. So this card has exactly one number to get right, and
 * getting it wrong is a financial statement to the person doing the promoting —
 * quoting ₦150 to somebody the ledger will pay ₦350 is a promise DrippleX would
 * then have to argue about.
 *
 * These tests are written so that a hardcoded figure fails whichever figure is
 * hardcoded, so that a points campaign can never be rendered as naira, and so
 * that the QR encodes the promoter's own link rather than a bare code or a
 * campaign token.
 */

// The real encoder, with the call recorded. Mocking the encoding away would
// leave the QR untested in the only way that matters — whether it is a QR of
// the right URL — so this delegates and merely watches.
const toDataURLSpy = vi.fn();
vi.mock('qrcode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('qrcode')>();
  return {
    ...actual,
    toDataURL: (...args: Parameters<typeof actual.toDataURL>) => {
      toDataURLSpy(...args);
      return (actual.toDataURL as (...a: unknown[]) => Promise<string>)(...args);
    },
  };
});

const PROGRAMME: ReferralStatsDto = {
  code: 'DRPX7788',
  totalRedemptions: 4,
  pendingRedemptions: 1,
  rewardedRedemptions: 3,
  refereeRewardAmount: 150,
  referrerRewardAmount: 150,
  campaignName: null,
  campaignRewardPoints: null,
};

/** The same code, enrolled on a campaign that pays more for it. */
const ON_CAMPAIGN: ReferralStatsDto = {
  ...PROGRAMME,
  referrerRewardAmount: 350,
  campaignName: 'Pioneer Drivers',
  campaignRewardPoints: null,
};

async function cardFor(stats: ReferralStatsDto): Promise<HTMLElement> {
  render(<StandingReferralCard loadStats={() => Promise.resolve(stats)} />);
  // The card renders nothing until the stats resolve, so waiting on the code is
  // what separates "the server answered" from "the card is still empty".
  const code = await screen.findByText(stats.code);
  const card = code.closest('div[class*="rounded-2xl"]');
  if (card === null) throw new Error('card not found');
  return card as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('standing referral card — the rate it quotes', () => {
  it('quotes the programme amount the server returned', async () => {
    const card = await cardFor(PROGRAMME);
    expect(card.textContent).toContain('₦150 lands in this wallet');
  });

  it('quotes the campaign amount when the code is enrolled, not the programme one', async () => {
    const card = await cardFor(ON_CAMPAIGN);
    expect(card.textContent).toContain('₦350 lands in this wallet');
    // The failure this guards is the one that was live in getStats: the card
    // showing a promoter the ordinary rate while the ledger pays the campaign
    // rate.
    expect(card.textContent).not.toContain('₦150 lands in this wallet');
  });

  it('follows the server to any figure, so no amount is compiled in', async () => {
    const card = await cardFor({ ...ON_CAMPAIGN, referrerRewardAmount: 1275 });
    expect(card.textContent).toContain('₦1,275 lands in this wallet');
  });

  it('names the campaign rather than leaving a larger number to be inferred', async () => {
    const card = await cardFor(ON_CAMPAIGN);
    expect(card.textContent).toContain('Pioneer Drivers');
  });

  it('shows no campaign name for an ordinary referral', async () => {
    await cardFor(PROGRAMME);
    expect(screen.queryByText('Pioneer Drivers')).toBeNull();
  });
});

describe('standing referral card — points campaigns', () => {
  const POINTS: ReferralStatsDto = {
    ...PROGRAMME,
    referrerRewardAmount: 350,
    campaignName: 'Content Creators',
    campaignRewardPoints: 5000,
  };

  it('quotes points as points', async () => {
    const card = await cardFor(POINTS);
    expect(card.textContent).toContain('5,000 DX Points lands in this wallet');
  });

  it('never prints a naira figure for the referrer alongside them', async () => {
    // 5,000 DX Points is not ₦5,000 and is not ₦350 either. Printing a naira
    // figure here would be this screen inventing a conversion rate, which is
    // the one thing it must not do.
    const card = await cardFor(POINTS);
    expect(card.textContent).not.toContain('₦350');
    expect(card.textContent).not.toContain('₦5,000');
    expect(card.textContent).not.toContain('₦5000');
  });

  it('still states the referee reward, which is paid in naira', async () => {
    const card = await cardFor(POINTS);
    expect(card.textContent).toContain('₦150');
  });
});

describe('standing referral card — the QR', () => {
  it('encodes the share link carrying this promoter’s own code', async () => {
    await cardFor(PROGRAMME);
    await waitFor(() => {
      expect(toDataURLSpy).toHaveBeenCalled();
    });
    const encoded = String(toDataURLSpy.mock.calls[0]?.[0]);
    expect(encoded).toBe(`${window.location.origin}/?ref=DRPX7788`);
  });

  it('encodes the same one code when a campaign is running', async () => {
    // The per-campaign promoter token is a backend identifier. If it ever
    // reached the QR, a promoter would be handing out a link nobody can read
    // back to them.
    await cardFor(ON_CAMPAIGN);
    await waitFor(() => {
      expect(toDataURLSpy).toHaveBeenCalled();
    });
    expect(String(toDataURLSpy.mock.calls[0]?.[0])).toBe(`${window.location.origin}/?ref=DRPX7788`);
  });

  it('renders a scannable image, not a placeholder', async () => {
    await cardFor(PROGRAMME);
    const img = await screen.findByRole('img', { name: 'Referral QR code' });
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect((img.getAttribute('src') ?? '').length).toBeGreaterThan(500);
  });

  it('produces a different image for a different code', async () => {
    await cardFor(PROGRAMME);
    const first = (await screen.findByRole('img', { name: 'Referral QR code' })).getAttribute(
      'src',
    );
    screen.getByText('DRPX7788');
    render(
      <StandingReferralCard
        loadStats={() => Promise.resolve({ ...PROGRAMME, code: 'DRPX0001' })}
      />,
    );
    await screen.findByText('DRPX0001');
    await waitFor(() => {
      const images = screen.getAllByRole('img', { name: 'Referral QR code' });
      expect(images).toHaveLength(2);
      expect(images[1]?.getAttribute('src')).not.toBe(first);
    });
  });
});
