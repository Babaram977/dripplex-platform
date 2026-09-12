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
  it('shows the value the server computed, labelled with the rate', () => {
    render(<PointsValue points={30_000} valueNgn={300} pointsPerNaira={100} />);
    expect(screen.getByText('30,000')).toBeInTheDocument();
    expect(screen.getByText('DX Points')).toBeInTheDocument();
    expect(screen.getByText(/≈ ₦300 at 100:₦1/)).toBeInTheDocument();
  });

  it('never quotes 30,000 points as ₦30,000', () => {
    render(<PointsValue points={30_000} valueNgn={300} pointsPerNaira={100} />);
    expect(screen.queryByText(/₦30,000/)).not.toBeInTheDocument();
  });

  /**
   * The defect this component used to have.
   *
   * It divided the points by the current rate. Points granted at 200:1 were
   * then reported at today's 100:1 — double what they actually cost. The
   * server now values each grant at its own snapshotted rate, and this must
   * display that figure even when it disagrees with what dividing would give.
   */
  it('displays the server value even when it differs from the naive conversion', () => {
    // 30,000 points whose grants were worth ₦225, not the ₦300 that
    // 30,000 / 100 produces.
    render(<PointsValue points={30_000} valueNgn={225} pointsPerNaira={100} />);
    expect(screen.getByText(/≈ ₦225/)).toBeInTheDocument();
    expect(screen.queryByText(/₦300/)).not.toBeInTheDocument();
  });

  it('shows points with no naira value when the server stated none', () => {
    render(<PointsValue points={30_000} valueNgn={null} pointsPerNaira={100} />);
    expect(screen.getByText('30,000')).toBeInTheDocument();
    expect(screen.getByText('(value unavailable)')).toBeInTheDocument();
    // Nothing is derived locally from the rate that is present.
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });

  it('omits the rate label when the rate is unknown but the value is not', () => {
    render(<PointsValue points={1_000} valueNgn={10} pointsPerNaira={null} />);
    expect(screen.getByText(/≈ ₦10/)).toBeInTheDocument();
    expect(screen.queryByText(/:₦1/)).not.toBeInTheDocument();
  });
});

describe('a promoter reward is cash or points, never both and never merged', () => {
  it('shows a cash reward as cash', () => {
    render(
      <RewardValue
        rewardAmountNgn={350}
        rewardPoints={null}
        rewardPointsValueNgn={null}
        pointsPerNaira={100}
      />,
    );
    expect(screen.getByText('₦350')).toBeInTheDocument();
    expect(screen.getByText('cash')).toBeInTheDocument();
    expect(screen.queryByText(/DX Points/)).not.toBeInTheDocument();
  });

  it('shows a points reward as points, with the server valuation attached', () => {
    render(
      <RewardValue
        rewardAmountNgn={null}
        rewardPoints={35_000}
        rewardPointsValueNgn={350}
        pointsPerNaira={100}
      />,
    );
    expect(screen.getByText('35,000')).toBeInTheDocument();
    expect(screen.getByText('DX Points')).toBeInTheDocument();
    expect(screen.getByText(/≈ ₦350 at 100:₦1/)).toBeInTheDocument();
    expect(screen.queryByText('cash')).not.toBeInTheDocument();
  });

  it('says so loudly when a row carries neither', () => {
    render(
      <RewardValue
        rewardAmountNgn={null}
        rewardPoints={null}
        rewardPointsValueNgn={null}
        pointsPerNaira={100}
      />,
    );
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
