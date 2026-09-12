import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  AcquisitionIncentivePanel,
  AddPromoterForm,
  ApiErrorNotice,
  PerformanceStats,
  PromoterTable,
  RewardModelPanel,
} from './promotions-panels';

import { DripplexApiError } from '@/lib/sdk';
import {
  acquisitionIncentive,
  campaignDetail,
  cashPerformance,
  emptyPerformance,
  firstPromoter,
  pointsPerformance,
  removedPromoter,
} from '@/test/promotions-fixtures';

describe('performance metrics', () => {
  it('shows referrals, qualification and conversion together', () => {
    render(<PerformanceStats performance={cashPerformance} pointsPerNaira={100} />);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText(/10 qualified · 25.0%/)).toBeInTheDocument();
  });

  it('keeps first-completed-rides as its own number, not conversion', () => {
    render(<PerformanceStats performance={cashPerformance} pointsPerNaira={100} />);
    expect(screen.getByText('First rides completed')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(
      screen.getByText(/Counted from rides — a referral can qualify on an order instead/),
    ).toBeInTheDocument();
  });

  it('splits pending from paid instead of stating one earned figure', () => {
    render(<PerformanceStats performance={cashPerformance} pointsPerNaira={100} />);
    expect(screen.getByText('₦3,500')).toBeInTheDocument();
    expect(screen.getByText(/₦1,400 pending · ₦2,100 paid/)).toBeInTheDocument();
  });

  it('gives DX Points their own heading and never adds them to the naira total', () => {
    render(<PerformanceStats performance={pointsPerformance} pointsPerNaira={100} />);
    expect(screen.getByText('Points rewards')).toBeInTheDocument();
    expect(screen.getByText('Cash rewards (₦)')).toBeInTheDocument();
    // 30,000 points at 100:1 is ₦300. The cash total stays ₦0 — the two are
    // never summed.
    expect(screen.getByText('₦0')).toBeInTheDocument();
    expect(screen.getByText(/≈ ₦300 at 100:₦1/)).toBeInTheDocument();
  });

  it('shows a dash for conversion when nothing has been referred', () => {
    render(<PerformanceStats performance={emptyPerformance} pointsPerNaira={100} />);
    expect(screen.getByText(/0 qualified · —/)).toBeInTheDocument();
  });
});

describe('the three rewards are kept apart', () => {
  it('names all three and sources every figure from the server payload', () => {
    render(<RewardModelPanel incentive={acquisitionIncentive} />);

    expect(screen.getByText('Promoter reward')).toBeInTheDocument();
    expect(screen.getByText('New customer reward')).toBeInTheDocument();
    expect(screen.getByText('Acquisition incentive')).toBeInTheDocument();

    expect(screen.getByText('₦150')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText(/× 3 rides/)).toBeInTheDocument();
  });

  it('says the discount is not a payment', () => {
    render(<RewardModelPanel incentive={acquisitionIncentive} />);
    expect(
      screen.getByText(/A discount on the new customer's fares, not a payment/),
    ).toBeInTheDocument();
  });

  it('says the customer reward does not depend on who referred them', () => {
    render(<RewardModelPanel incentive={acquisitionIncentive} />);
    expect(screen.getByText(/The same amount whoever referred them/)).toBeInTheDocument();
  });

  it('follows a repriced incentive rather than showing a remembered 20%', () => {
    render(
      <RewardModelPanel
        incentive={{ ...acquisitionIncentive, percentOff: 15, maxDiscountedRides: 2 }}
      />,
    );
    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText(/× 2 rides/)).toBeInTheDocument();
    expect(screen.queryByText('20%')).not.toBeInTheDocument();
  });

  it('shows a dash rather than inventing terms the server did not state', () => {
    render(
      <RewardModelPanel
        incentive={{ ...acquisitionIncentive, percentOff: null, refereeRewardNgn: null }}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});

describe('the universal acquisition incentive panel', () => {
  it('reports usage with cancelled rides called out as excluded', () => {
    render(<AcquisitionIncentivePanel incentive={acquisitionIncentive} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('cancelled rides excluded')).toBeInTheDocument();
    expect(screen.getByText('₦2,400')).toBeInTheDocument();
    expect(screen.getByText('fare foregone, not a payout')).toBeInTheDocument();
  });

  it('offers no control that could create a second acquisition promotion', () => {
    render(<AcquisitionIncentivePanel incentive={acquisitionIncentive} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(
      screen.getByText(/One platform-wide promotion, shown here read-only/),
    ).toBeInTheDocument();
  });

  it('says NOT CONFIGURED rather than implying it is running', () => {
    render(<AcquisitionIncentivePanel incentive={{ ...acquisitionIncentive, status: null }} />);
    expect(screen.getByText('NOT CONFIGURED')).toBeInTheDocument();
  });
});

describe('adding a promoter', () => {
  it('submits exactly one reward kind — cash', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddPromoterForm onSubmit={onSubmit} isPending={false} error={null} />);

    await user.type(screen.getByRole('textbox'), 'user-42');
    await user.selectOptions(screen.getByLabelText('Participant type'), 'PIONEER_DRIVER');
    await user.type(screen.getByLabelText('Amount (₦)'), '350');
    await user.click(screen.getByRole('button', { name: 'Add promoter' }));

    expect(onSubmit).toHaveBeenCalledWith({
      userId: 'user-42',
      participantType: 'PIONEER_DRIVER',
      rewardAmountNgn: 350,
    });
  });

  it('submits points as points, with no naira field derived from them', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddPromoterForm onSubmit={onSubmit} isPending={false} error={null} />);

    await user.type(screen.getByRole('textbox'), 'user-7');
    await user.selectOptions(screen.getByLabelText('Reward paid in'), 'points');
    await user.type(screen.getByLabelText('Points'), '35000');
    await user.click(screen.getByRole('button', { name: 'Add promoter' }));

    expect(onSubmit).toHaveBeenCalledWith({
      userId: 'user-7',
      participantType: 'CUSTOMER',
      rewardPoints: 35_000,
    });
    const body = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).not.toHaveProperty('rewardAmountNgn');
  });

  it('offers pioneer driver as a participant type', () => {
    render(<AddPromoterForm onSubmit={vi.fn()} isPending={false} error={null} />);
    expect(
      within(screen.getByLabelText('Participant type')).getByRole('option', {
        name: 'Pioneer driver',
      }),
    ).toBeInTheDocument();
  });

  it('offers every participant type the API accepts', () => {
    render(<AddPromoterForm onSubmit={vi.fn()} isPending={false} error={null} />);
    const options = within(screen.getByLabelText('Participant type')).getAllByRole('option');
    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual([
      'CUSTOMER',
      'RIDER',
      'DRIVER',
      'PIONEER_DRIVER',
      'INFLUENCER',
      'CREATOR',
      'AMBASSADOR',
    ]);
  });

  it('prefills no amount — a rate the operator did not choose is a rate nobody decided', () => {
    render(<AddPromoterForm onSubmit={vi.fn()} isPending={false} error={null} />);
    expect(screen.getByLabelText('Amount (₦)')).toHaveValue(null);
  });

  it('does not change the amount when the participant type changes', async () => {
    const user = userEvent.setup();
    render(<AddPromoterForm onSubmit={vi.fn()} isPending={false} error={null} />);

    await user.type(screen.getByLabelText('Amount (₦)'), '200');
    await user.selectOptions(screen.getByLabelText('Participant type'), 'PIONEER_DRIVER');

    // Selecting "pioneer driver" must not silently become ₦350.
    expect(screen.getByLabelText('Amount (₦)')).toHaveValue(200);
  });

  it('refuses to submit without a user or a positive amount', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddPromoterForm onSubmit={onSubmit} isPending={false} error={null} />);

    const submit = screen.getByRole('button', { name: 'Add promoter' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'user-1');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Amount (₦)'), '0');
    expect(submit).toBeDisabled();

    await user.clear(screen.getByLabelText('Amount (₦)'));
    await user.type(screen.getByLabelText('Amount (₦)'), '150');
    expect(submit).toBeEnabled();
  });

  it('shows the server refusal rather than a generic message', () => {
    render(
      <AddPromoterForm
        onSubmit={vi.fn()}
        isPending={false}
        error={Object.assign(new Error('Already an active promoter on this campaign'), {
          statusCode: 409,
        })}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('blocks a double submit while the request is in flight', () => {
    render(<AddPromoterForm onSubmit={vi.fn()} isPending error={null} />);
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
  });
});

describe('the promoter table', () => {
  const noop = (): void => undefined;

  it('lists removed promoters without ever rendering them as active', () => {
    render(
      <PromoterTable
        promoters={[removedPromoter]}
        pointsPerNaira={100}
        canManage
        onRemove={noop}
        removingId={null}
      />,
    );
    expect(screen.getByText('Chidi Former')).toBeInTheDocument();
    expect(screen.getByText('REMOVED')).toBeInTheDocument();
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('offers no remove control for someone already removed', () => {
    render(
      <PromoterTable
        promoters={[removedPromoter]}
        pointsPerNaira={100}
        canManage
        onRemove={noop}
        removingId={null}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('hides the actions column entirely without the manage permission', () => {
    render(
      <PromoterTable
        promoters={campaignDetail.promoters}
        pointsPerNaira={100}
        canManage={false}
        onRemove={noop}
        removingId={null}
      />,
    );
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('calls remove with the promoter id, not the user id', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <PromoterTable
        promoters={[firstPromoter()]}
        pointsPerNaira={100}
        canManage
        onRemove={onRemove}
        removingId={null}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onRemove).toHaveBeenCalledWith('promoter-cash');
  });

  it('disables only the row being removed', () => {
    render(
      <PromoterTable
        promoters={campaignDetail.promoters}
        pointsPerNaira={100}
        canManage
        onRemove={noop}
        removingId="promoter-cash"
      />,
    );
    expect(screen.getByRole('button', { name: 'Removing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled();
  });

  it('shows a cash promoter and a points promoter in their own currencies', () => {
    render(
      <PromoterTable
        promoters={campaignDetail.promoters}
        pointsPerNaira={100}
        canManage={false}
        onRemove={noop}
        removingId={null}
      />,
    );
    expect(screen.getByText('₦350')).toBeInTheDocument();
    expect(screen.getByText('30,000')).toBeInTheDocument();
    expect(screen.getByText(/≈ ₦300 at 100:₦1/)).toBeInTheDocument();
  });

  it('masks every token by default, however many rows there are', () => {
    render(
      <PromoterTable
        promoters={campaignDetail.promoters}
        pointsPerNaira={100}
        canManage={false}
        onRemove={noop}
        removingId={null}
      />,
    );
    expect(screen.getAllByText('••••••••')).toHaveLength(3);
    for (const promoter of campaignDetail.promoters) {
      expect(screen.queryByText(promoter.token)).not.toBeInTheDocument();
    }
  });

  it('scrolls horizontally on a narrow screen instead of truncating a money column', () => {
    const { container } = render(
      <PromoterTable
        promoters={campaignDetail.promoters}
        pointsPerNaira={100}
        canManage={false}
        onRemove={noop}
        removingId={null}
      />,
    );
    // The wrapper scrolls; the table keeps its minimum width. A squeezed table
    // is how a pending figure ends up cut off mid-digit on a tablet.
    expect(container.querySelector('.overflow-x-auto')).not.toBeNull();
    expect(container.querySelector('table')?.className).toContain('min-w-[880px]');
  });
});

function apiError(statusCode: number, message: string): DripplexApiError {
  return new DripplexApiError({
    statusCode,
    message,
    errorCode: 'TEST',
    path: '/operations/promotions/campaigns',
  } as ConstructorParameters<typeof DripplexApiError>[0]);
}

describe('API failures', () => {
  it("reports the server's own refusal, not a generic message", () => {
    render(<ApiErrorNotice error={apiError(403, 'You do not have permission.')} />);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Error 403')).toBeInTheDocument();
    expect(within(alert).getByText('You do not have permission.')).toBeInTheDocument();
  });

  it('offers no Retry on a permission denial — retrying cannot help', () => {
    render(<ApiErrorNotice error={apiError(403, 'Forbidden')} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('offers no Retry on a conflict either — the state must change first', () => {
    render(<ApiErrorNotice error={apiError(409, 'Already a promoter')} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('offers Retry on a server fault, and calls back', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ApiErrorNotice error={apiError(500, 'Server error')} onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows nothing clickable when no retry handler was supplied', () => {
    render(<ApiErrorNotice error={apiError(500, 'Server error')} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
