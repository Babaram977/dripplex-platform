import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acquisitionIncentive,
  campaignDetail,
  campaignSummary,
  firstPromoter,
  QueryHarness,
  required,
} from '@/test/promotions-fixtures';

const permissions = new Set<string>();

vi.mock('@dripplex/hooks', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@dripplex/hooks');
  return { ...actual, usePermission: (permission: string) => permissions.has(permission) };
});

const campaigns = vi.fn<() => Promise<unknown>>();
const campaign = vi.fn<(id: string) => Promise<unknown>>();
const incentive = vi.fn<() => Promise<unknown>>();
const addPromoter = vi.fn<(id: string, body: unknown) => Promise<unknown>>();
const removePromoter = vi.fn<(id: string) => Promise<unknown>>();
const loyaltySettings = vi.fn<() => Promise<unknown>>();

vi.mock('@/lib/sdk', async () => {
  const errors = await vi.importActual<Record<string, unknown>>('@dripplex/sdk/sdk-admin');
  return {
    ...errors,
    sdk: {
      operationsPromotions: {
        campaigns: () => campaigns(),
        campaign: (id: string) => campaign(id),
        acquisitionIncentive: () => incentive(),
        addPromoter: (id: string, body: unknown) => addPromoter(id, body),
        removePromoter: (id: string) => removePromoter(id),
      },
      adminLoyalty: { settings: () => loyaltySettings() },
    },
  };
});

// Imported after the mocks so the modules under test pick them up.
const { PromotionsOverview } = await import('./page');
const { CampaignDetail } = await import('./[promotionId]/page');

function never(): Promise<never> {
  return new Promise<never>(() => undefined);
}

beforeEach(() => {
  permissions.clear();
  permissions.add('operations:promotions:read');
  campaigns.mockResolvedValue([campaignSummary]);
  campaign.mockResolvedValue(campaignDetail);
  incentive.mockResolvedValue(acquisitionIncentive);
  loyaltySettings.mockResolvedValue({ pointsPerNaira: 100 });
  addPromoter.mockResolvedValue(campaignDetail.promoters[0]);
  removePromoter.mockResolvedValue({
    id: 'promoter-cash',
    status: 'REMOVED',
    removedAt: '2026-09-12T00:00:00.000Z',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function renderOverview(): void {
  render(
    <QueryHarness>
      <PromotionsOverview />
    </QueryHarness>,
  );
}

function renderDetail(): void {
  render(
    <QueryHarness>
      <CampaignDetail promotionId="campaign-1" />
    </QueryHarness>,
  );
}

describe('Promotions overview — the four states', () => {
  it('shows a loading indicator while campaigns are in flight', () => {
    campaigns.mockImplementation(never);
    renderOverview();
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an empty state rather than an empty table', async () => {
    campaigns.mockResolvedValue([]);
    renderOverview();
    expect(await screen.findByText('No campaigns with promoters')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server error, with a retry that refetches', async () => {
    const user = userEvent.setup();
    const { DripplexApiError } = await import('@dripplex/sdk/sdk-admin');
    campaigns.mockRejectedValue(
      new DripplexApiError({
        statusCode: 500,
        message: 'Server error',
        errorCode: 'X',
        path: '/p',
      } as never),
    );
    renderOverview();

    expect(await screen.findByText('Server error')).toBeInTheDocument();
    campaigns.mockResolvedValue([campaignSummary]);
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Lagos Pioneer Drive')).toBeInTheDocument();
  });

  it('shows the populated table with its lifecycle badge', async () => {
    renderOverview();
    const name = await screen.findByText('Lagos Pioneer Drive');
    const row = name.closest('tr') as HTMLElement;

    // Scoped to the campaign row: the incentive panel carries its own ACTIVE
    // badge, and the campaign's lifecycle is a different fact from the
    // incentive's.
    expect(within(row).getByText('ACTIVE')).toBeInTheDocument();
    expect(within(row).getByText('25.0%')).toBeInTheDocument();
  });

  it('keeps points in their own column beside the cash column', async () => {
    campaigns.mockResolvedValue([
      {
        ...campaignSummary,
        performance: { ...campaignSummary.performance, rewardsEarnedPoints: 30_000 },
      },
    ]);
    renderOverview();

    const row = (await screen.findByText('Lagos Pioneer Drive')).closest('tr');
    expect(within(row as HTMLElement).getByText('₦3,500')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('30,000')).toBeInTheDocument();
    // 30,000 points is ₦300, shown as an aside — never added to the ₦3,500.
    expect(within(row as HTMLElement).getByText('≈ ₦300')).toBeInTheDocument();
  });
});

describe('the DX Points valuation is never assumed', () => {
  it('omits the naira equivalent when the rate cannot be loaded', async () => {
    loyaltySettings.mockRejectedValue(new Error('down'));
    campaigns.mockResolvedValue([
      {
        ...campaignSummary,
        performance: { ...campaignSummary.performance, rewardsEarnedPoints: 30_000 },
      },
    ]);
    renderOverview();

    expect(
      await screen.findByText(/The DX Points valuation could not be loaded/),
    ).toBeInTheDocument();
    const row = screen.getByText('Lagos Pioneer Drive').closest('tr');
    expect(within(row as HTMLElement).getByText('30,000')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText(/≈ ₦/)).not.toBeInTheDocument();
  });

  it('uses the rate the server states, not a remembered 100', async () => {
    loyaltySettings.mockResolvedValue({ pointsPerNaira: 200 });
    renderDetail();

    // 30,000 points at 200:₦1 is ₦150, not ₦300.
    expect(await screen.findByText(/≈ ₦150 at 200:₦1/)).toBeInTheDocument();
  });
});

describe('permission-aware rendering', () => {
  it('offers no add form and no remove buttons without the manage permission', async () => {
    renderDetail();
    await screen.findByText('Amaka Pioneer');

    expect(screen.queryByRole('form', { name: 'Add promoter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('offers both once the manage permission is held', async () => {
    permissions.add('operations:promotions:manage');
    renderDetail();
    await screen.findByText('Amaka Pioneer');

    expect(screen.getByRole('form', { name: 'Add promoter' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' }).length).toBeGreaterThan(0);
  });

  it('still reads the campaign with read alone — manage is not required to look', async () => {
    renderDetail();
    expect(await screen.findByText('Lagos Pioneer Drive')).toBeInTheDocument();
    expect(campaign).toHaveBeenCalledWith('campaign-1');
  });

  it('warns, and still calls the API, when the read permission is absent', async () => {
    permissions.clear();
    renderOverview();

    // The sentence is split across a <code> element, so match the container.
    expect(
      await screen.findByText(
        (_text, element) =>
          element?.tagName === 'P' && element.textContent.includes('operations:promotions:read'),
      ),
    ).toBeInTheDocument();
    // The client does not pretend to enforce anything. The request goes out and
    // the server's 403 is the answer — a UI that silently skipped the call
    // would be the only thing standing between a user and the data.
    await waitFor(() => {
      expect(campaigns).toHaveBeenCalled();
    });
  });
});

describe('add promoter flow', () => {
  beforeEach(() => {
    permissions.add('operations:promotions:manage');
  });

  it('sends what the operator typed and refreshes the campaign', async () => {
    const user = userEvent.setup();
    campaign.mockResolvedValueOnce(campaignDetail).mockResolvedValue({
      ...campaignDetail,
      promoters: [
        ...campaignDetail.promoters,
        { ...firstPromoter(), id: 'promoter-new', name: 'Dupe Newcomer' },
      ],
    });
    renderDetail();
    await screen.findByText('Amaka Pioneer');
    expect(screen.queryByText('Dupe Newcomer')).not.toBeInTheDocument();

    const form = screen.getByRole('form', { name: 'Add promoter' });
    await user.type(within(form).getByRole('textbox'), 'user-99');
    await user.selectOptions(within(form).getByLabelText('Participant type'), 'PIONEER_DRIVER');
    await user.type(within(form).getByLabelText('Amount (₦)'), '350');
    await user.click(within(form).getByRole('button', { name: 'Add promoter' }));

    await waitFor(() => {
      expect(addPromoter).toHaveBeenCalledWith('campaign-1', {
        userId: 'user-99',
        participantType: 'PIONEER_DRIVER',
        rewardAmountNgn: 350,
      });
    });
    // Asserted through the screen, not through a call count: only a genuine
    // re-read of the campaign can put a promoter on the page that the first
    // response never contained. The server decides what the new row looks
    // like, including the token it issued — the client never invents it.
    expect(await screen.findByText('Dupe Newcomer')).toBeInTheDocument();
  });

  it('surfaces a 409 from the server and adds nobody', async () => {
    const user = userEvent.setup();
    const { DripplexApiError } = await import('@dripplex/sdk/sdk-admin');
    addPromoter.mockRejectedValue(
      new DripplexApiError({
        statusCode: 409,
        message: 'Already an active promoter on this campaign',
        errorCode: 'CONFLICT',
        path: '/p',
      } as never),
    );
    renderDetail();
    await screen.findByText('Amaka Pioneer');

    const form = screen.getByRole('form', { name: 'Add promoter' });
    await user.type(within(form).getByRole('textbox'), 'user-99');
    await user.type(within(form).getByLabelText('Amount (₦)'), '350');
    await user.click(within(form).getByRole('button', { name: 'Add promoter' }));

    expect(
      await screen.findByText('Already an active promoter on this campaign'),
    ).toBeInTheDocument();
  });
});

describe('remove promoter flow', () => {
  beforeEach(() => {
    permissions.add('operations:promotions:manage');
  });

  it('removes by promoter id and re-reads rather than flipping the badge itself', async () => {
    const user = userEvent.setup();
    campaign.mockResolvedValueOnce(campaignDetail).mockResolvedValue({
      ...campaignDetail,
      promoters: campaignDetail.promoters.map((promoter) =>
        promoter.id === 'promoter-cash'
          ? { ...promoter, status: 'REMOVED' as const, removedAt: '2026-09-12T00:00:00.000Z' }
          : promoter,
      ),
    });
    renderDetail();
    const row = (await screen.findByText('Amaka Pioneer')).closest('tr') as HTMLElement;
    expect(within(row).getByText('ACTIVE')).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(removePromoter).toHaveBeenCalledWith('promoter-cash');
    });
    // The badge flips only because the server said so on the re-read. Nothing
    // here patches the row locally, so a missing invalidation leaves it ACTIVE.
    await waitFor(() => {
      const refreshed = screen.getByText('Amaka Pioneer').closest('tr') as HTMLElement;
      expect(within(refreshed).getByText('REMOVED')).toBeInTheDocument();
    });
  });

  it('leaves the promoter active on screen when the server refuses', async () => {
    const user = userEvent.setup();
    const { DripplexApiError } = await import('@dripplex/sdk/sdk-admin');
    removePromoter.mockRejectedValue(
      new DripplexApiError({
        statusCode: 403,
        message: 'You do not have permission to perform this action.',
        errorCode: 'FORBIDDEN',
        path: '/p',
      } as never),
    );
    renderDetail();
    await screen.findByText('Amaka Pioneer');

    await user.click(
      required(screen.getAllByRole('button', { name: 'Remove' })[0], 'a Remove button'),
    );

    expect(
      await screen.findByText('You do not have permission to perform this action.'),
    ).toBeInTheDocument();
    // The row that failed to be removed must not read as removed.
    const row = screen.getByText('Amaka Pioneer').closest('tr');
    expect(within(row as HTMLElement).getByText('ACTIVE')).toBeInTheDocument();
  });
});

describe('campaign detail', () => {
  it('lists a removed promoter alongside the active ones, visibly removed', async () => {
    renderDetail();
    await screen.findByText('Chidi Former');

    const row = screen.getByText('Chidi Former').closest('tr');
    expect(within(row as HTMLElement).getByText('REMOVED')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('shows the participant type of each promoter, pioneer driver included', async () => {
    renderDetail();
    expect(await screen.findByText('Pioneer driver')).toBeInTheDocument();
    expect(screen.getByText('Influencer')).toBeInTheDocument();
    expect(screen.getByText('Driver')).toBeInTheDocument();
  });

  it('masks every token until asked', async () => {
    renderDetail();
    await screen.findByText('Amaka Pioneer');
    expect(screen.getAllByText('••••••••')).toHaveLength(3);
    expect(screen.queryByText(firstPromoter().token)).not.toBeInTheDocument();
  });

  it('reports a campaign that does not exist instead of rendering an empty shell', async () => {
    const { DripplexApiError } = await import('@dripplex/sdk/sdk-admin');
    campaign.mockRejectedValue(
      new DripplexApiError({
        statusCode: 404,
        message: 'Campaign not found',
        errorCode: 'NOT_FOUND',
        path: '/p',
      } as never),
    );
    renderDetail();

    expect(await screen.findByText('Campaign not found')).toBeInTheDocument();
    expect(screen.queryByText('Promoters')).not.toBeInTheDocument();
  });
});
