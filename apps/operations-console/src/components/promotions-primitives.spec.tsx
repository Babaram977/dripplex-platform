import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  CampaignStatusBadge,
  PointsValue,
  PromoterStatusBadge,
  PromoterToken,
  RewardValue,
  conversion,
  naira,
} from './promotions-primitives';

import { required } from '@/test/promotions-fixtures';

describe('DX Points are never presented as naira', () => {
  it('states the valuation alongside the points, never instead of them', () => {
    render(<PointsValue points={30_000} pointsPerNaira={100} />);
    expect(screen.getByText('30,000')).toBeInTheDocument();
    expect(screen.getByText('DX Points')).toBeInTheDocument();
    // The naira figure is qualified by the rate that produced it.
    expect(screen.getByText(/≈ ₦300 at 100:₦1/)).toBeInTheDocument();
  });

  it('never quotes 30,000 points as ₦30,000', () => {
    render(<PointsValue points={30_000} pointsPerNaira={100} />);
    expect(screen.queryByText(/₦30,000/)).not.toBeInTheDocument();
  });

  it('shows points with no naira value when the rate is unknown', () => {
    render(<PointsValue points={30_000} pointsPerNaira={null} />);
    expect(screen.getByText('30,000')).toBeInTheDocument();
    expect(screen.getByText('(value unavailable)')).toBeInTheDocument();
    // No naira figure at all — not a guess, and specifically not a hardcoded
    // 100 that would survive a founder repricing.
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });

  it('refuses to divide by a nonsense rate', () => {
    render(<PointsValue points={500} pointsPerNaira={0} />);
    expect(screen.getByText('(value unavailable)')).toBeInTheDocument();
    expect(screen.queryByText(/Infinity|₦/)).not.toBeInTheDocument();
  });

  it('follows a repriced rate rather than a remembered one', () => {
    const { rerender } = render(<PointsValue points={1000} pointsPerNaira={200} />);
    expect(screen.getByText(/≈ ₦5 at 200:₦1/)).toBeInTheDocument();
    rerender(<PointsValue points={1000} pointsPerNaira={100} />);
    expect(screen.getByText(/≈ ₦10 at 100:₦1/)).toBeInTheDocument();
  });
});

describe('a promoter reward is cash or points, never both and never merged', () => {
  it('shows a cash reward as cash', () => {
    render(<RewardValue rewardAmountNgn={350} rewardPoints={null} pointsPerNaira={100} />);
    expect(screen.getByText('₦350')).toBeInTheDocument();
    expect(screen.getByText('cash')).toBeInTheDocument();
    expect(screen.queryByText(/DX Points/)).not.toBeInTheDocument();
  });

  it('shows a points reward as points, with the valuation attached', () => {
    render(<RewardValue rewardAmountNgn={null} rewardPoints={35_000} pointsPerNaira={100} />);
    expect(screen.getByText('35,000')).toBeInTheDocument();
    expect(screen.getByText('DX Points')).toBeInTheDocument();
    expect(screen.getByText(/≈ ₦350 at 100:₦1/)).toBeInTheDocument();
    expect(screen.queryByText('cash')).not.toBeInTheDocument();
  });

  it('says so loudly when a row carries neither', () => {
    render(<RewardValue rewardAmountNgn={null} rewardPoints={null} pointsPerNaira={100} />);
    expect(screen.getByText('No reward set')).toBeInTheDocument();
  });
});

describe('conversion', () => {
  it('is a dash when nothing has been referred, not 0%', () => {
    expect(conversion(null)).toBe('—');
  });

  it('is 0% only when referrals exist and none converted', () => {
    expect(conversion(0)).toBe('0%');
  });

  it('keeps a decimal for partial rates and drops it at the ends', () => {
    expect(conversion(0.25)).toBe('25.0%');
    expect(conversion(1)).toBe('100%');
  });
});

describe('naira', () => {
  it('always carries the symbol', () => {
    expect(naira(1500)).toBe('₦1,500');
  });
});

describe('campaign lifecycle', () => {
  it('spells out that a paused campaign stops attributing', () => {
    render(<CampaignStatusBadge status="PAUSED" />);
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
    expect(screen.getByText('not attributing new referrals')).toBeInTheDocument();
  });

  it('spells out that a scheduled campaign still attributes', () => {
    render(<CampaignStatusBadge status="SCHEDULED" />);
    expect(screen.getByText('attributing, not yet started')).toBeInTheDocument();
  });

  it('renders every lifecycle state the API can return', () => {
    for (const status of [
      'DRAFT',
      'SCHEDULED',
      'ACTIVE',
      'PAUSED',
      'EXPIRED',
      'ARCHIVED',
      'CANCELLED',
    ] as const) {
      const { unmount } = render(<CampaignStatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('a removed promoter never reads as active', () => {
  it('is labelled REMOVED with the date it happened', () => {
    render(<PromoterStatusBadge status="REMOVED" removedAt="2026-09-05T09:00:00.000Z" />);
    expect(screen.getByText('REMOVED')).toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('is still REMOVED when the server gave no removal date', () => {
    render(<PromoterStatusBadge status="REMOVED" removedAt={null} />);
    expect(screen.getByText('REMOVED')).toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('is ACTIVE only when the server says ACTIVE', () => {
    render(<PromoterStatusBadge status="ACTIVE" removedAt={null} />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.queryByText('REMOVED')).not.toBeInTheDocument();
  });
});

/** jsdom defines `navigator.clipboard` as a getter, so it has to be redefined
 *  rather than assigned. */
function stubClipboard(writeText: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

describe('the private campaign token', () => {
  const TOKEN = 'TOKENCASH1234567890ABCDEFGHIJKLMN';

  it('is masked until an operator asks for it', () => {
    render(<PromoterToken token={TOKEN} />);
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
    expect(screen.getByText('••••••••')).toBeInTheDocument();
  });

  it('reveals and re-hides on request', async () => {
    const user = userEvent.setup();
    render(<PromoterToken token={TOKEN} />);

    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.getByText(TOKEN)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  });

  it('copies without revealing — the token need not go on screen to be used', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    // After setup(), never before: user-event installs its own clipboard stub
    // and would otherwise swallow the call this test is about.
    stubClipboard(writeText);
    render(<PromoterToken token={TOKEN} />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith(TOKEN);
    expect(screen.queryByText(TOKEN)).not.toBeInTheDocument();
  });

  it('falls back to revealing when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(<PromoterToken token={TOKEN} />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    // Better to show it than to leave the operator with a button that silently
    // does nothing.
    expect(await screen.findByText(TOKEN)).toBeInTheDocument();
  });

  it("keeps each row's token separate — revealing one reveals only one", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PromoterToken token="FIRSTTOKEN" />
        <PromoterToken token="SECONDTOKEN" />
      </>,
    );

    const [firstReveal] = screen.getAllByRole('button', { name: 'Reveal' });
    await user.click(required(firstReveal, 'the first Reveal button'));

    expect(screen.getByText('FIRSTTOKEN')).toBeInTheDocument();
    expect(screen.queryByText('SECONDTOKEN')).not.toBeInTheDocument();
  });
});
