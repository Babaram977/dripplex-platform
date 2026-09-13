import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DPX-PROMO-REF-001 — Referral Campaigns in the Operations Console.
 *
 * The console is a management and read surface. It holds no reward economics:
 * every figure it prints was summed by the server, and the one thing it sends
 * (a new promoter's reward) is ruled on by the server, not validated into
 * legality here.
 *
 * The tests that matter are the ones that fail if that stops being true:
 *
 *  - points must never be divided by today's rate to produce a naira value.
 *    The rate moved 200 -> 100 on 2026-09-12, so a client-side conversion of
 *    an aggregate reports double what the grant actually cost. The server
 *    sends the per-grant sum and the screen must print that number.
 *  - a null conversion rate is "—", not "0.0%". No referrals is not a zero
 *    conversion.
 *  - a promoter's token is a credential. Masked until asked for.
 *  - a removed promoter keeps their earnings but must never render as active
 *    or carry a Remove control.
 *  - manage controls are absent without operations:promotions:manage. That is
 *    a courtesy; the server's 403 is the boundary, and the read-only render
 *    must not offer the action at all.
 */

const listCampaignPromotions = vi.fn();
const getCampaignPromotion = vi.fn();
const getAcquisitionIncentive = vi.fn();
const addCampaignPromoter = vi.fn();
const removeCampaignPromoter = vi.fn();
let permissions: string[] = [];

vi.mock('../lib/api', () => ({
  api: {
    admin: {
      listCampaignPromotions: () => listCampaignPromotions(),
      getCampaignPromotion: (id: string) => getCampaignPromotion(id),
      getAcquisitionIncentive: () => getAcquisitionIncentive(),
      addCampaignPromoter: (id: string, body: unknown) => addCampaignPromoter(id, body),
      removeCampaignPromoter: (id: string) => removeCampaignPromoter(id),
    },
  },
  MERCHANT_CATEGORY_LABEL: {},
}));

vi.mock('../lib/auth', () => ({
  auth: {
    getUser: () => ({ permissions, roles: ['operations_staff'] }),
    getAccessToken: () => 'token',
    clear: () => undefined,
  },
}));

vi.mock('../lib/maps', () => ({
  addressPredictions: () => Promise.resolve([]),
  geocodeAddress: () => Promise.resolve(null),
  mapsEnabled: () => false,
  mapsLibrary: () => Promise.resolve(null),
}));

const perf = (over: Partial<Record<string, unknown>> = {}) => ({
  totalReferrals: 10,
  qualifiedReferrals: 4,
  firstCompletedRides: 3,
  conversionRate: 0.4,
  rewardsEarnedNgn: 1400,
  rewardsPendingNgn: 400,
  rewardsPaidNgn: 1000,
  rewardsEarnedPoints: 10000,
  rewardsEarnedPointsValueNgn: 100,
  ...over,
});

const promoter = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'p1',
  userId: 'u1',
  name: 'Ada Promoter',
  participantType: 'INFLUENCER',
  token: 'CAMPAIGNTOKEN123',
  status: 'ACTIVE',
  addedAt: '2026-09-01T00:00:00.000Z',
  removedAt: null,
  rewardAmountNgn: 500,
  rewardPoints: null,
  rewardPointsValueNgn: null,
  performance: perf(),
  ...over,
});

const incentive = {
  promotionId: 'promo-1',
  status: 'ACTIVE',
  percentOff: 20,
  maxDiscountedRides: 3,
  refereeRewardNgn: 150,
  discountedRides: 12,
  customersBenefiting: 5,
  totalDiscountNgn: 3400,
};

async function renderPage() {
  const { AdminCampaignsScreen } = await import('./adminConsoleScreen');
  return render(<AdminCampaignsScreen />);
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = ['operations:promotions:read'];
  listCampaignPromotions.mockResolvedValue([
    {
      id: 'c1',
      name: 'Lagos Influencers',
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
      promoterCount: 1,
      performance: perf(),
    },
  ]);
  getCampaignPromotion.mockResolvedValue({
    id: 'c1',
    name: 'Lagos Influencers',
    status: 'ACTIVE',
    startsAt: null,
    endsAt: null,
    pointsPerNaira: 100,
    performance: perf(),
    promoters: [promoter()],
  });
  getAcquisitionIncentive.mockResolvedValue(incentive);
});

describe('Referral Campaigns — states', () => {
  it('shows a loading state before the campaigns arrive', async () => {
    let release: (v: unknown) => void = () => undefined;
    listCampaignPromotions.mockReturnValue(new Promise((r) => (release = r)));
    await renderPage();
    expect(screen.getByText('Loading…')).toBeTruthy();
    release([]);
  });

  it('shows the API error rather than an empty page', async () => {
    listCampaignPromotions.mockRejectedValue({ message: 'Backend unavailable' });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Backend unavailable')).toBeTruthy());
  });

  it('shows an empty state when no campaign carries promoters', async () => {
    listCampaignPromotions.mockResolvedValue([]);
    await renderPage();
    await waitFor(() => expect(screen.getByText('No campaigns with promoters yet.')).toBeTruthy());
  });

  it('renders the populated campaign list', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    expect(screen.getByText('1 promoter')).toBeTruthy();
  });

  it('keeps the campaign list alive when only the incentive panel fails', async () => {
    getAcquisitionIncentive.mockRejectedValue({ message: 'Incentive unavailable' });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Incentive unavailable')).toBeTruthy());
    expect(screen.getByText('Lagos Influencers')).toBeTruthy();
  });
});

describe('Referral Campaigns — money and points are the server’s', () => {
  it('prints the server’s naira value for points, not points ÷ today’s rate', async () => {
    // 10,000 points at pointsPerNaira 100 would be ₦100 by naive division and
    // that is exactly the trap: the server says the grants were worth ₦100 in
    // aggregate only because it summed each at its own rate. Assert the
    // server's field is what reaches the screen.
    getAcquisitionIncentive.mockResolvedValue(incentive);
    listCampaignPromotions.mockResolvedValue([
      {
        id: 'c1',
        name: 'Points Campaign',
        status: 'ACTIVE',
        startsAt: null,
        endsAt: null,
        promoterCount: 1,
        performance: perf({ rewardsEarnedPoints: 10000, rewardsEarnedPointsValueNgn: 75 }),
      },
    ]);
    getCampaignPromotion.mockResolvedValue({
      id: 'c1',
      name: 'Points Campaign',
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
      pointsPerNaira: 100,
      performance: perf({ rewardsEarnedPoints: 10000, rewardsEarnedPointsValueNgn: 75 }),
      promoters: [],
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Points Campaign')).toBeTruthy());
    fireEvent.click(screen.getByText('Points Campaign'));
    await waitFor(() => expect(screen.getByText('10,000 DX')).toBeTruthy());
    expect(screen.getByText('₦75 when granted')).toBeTruthy();
    expect(screen.queryByText('₦100 when granted')).toBeNull();
  });

  it('shows a points-paid promoter the server’s naira value, not points ÷ rate', async () => {
    // The trap this test exists for: pointsPerNaira is 100 and the promoter
    // holds 10,000 points, so dividing would print ₦100. The server says the
    // reward is worth ₦250. Only the server's figure may reach the screen.
    getCampaignPromotion.mockResolvedValue({
      id: 'c1',
      name: 'Lagos Influencers',
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
      pointsPerNaira: 100,
      performance: perf(),
      promoters: [
        promoter({
          name: 'Points Promoter',
          rewardAmountNgn: null,
          rewardPoints: 10000,
          rewardPointsValueNgn: 250,
        }),
      ],
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Points Promoter')).toBeTruthy());
    expect(screen.getByText('(₦250 when granted)')).toBeTruthy();
    expect(screen.queryByText('(₦100 when granted)')).toBeNull();
  });

  it('says a promoter’s points value is unavailable rather than deriving one', async () => {
    getCampaignPromotion.mockResolvedValue({
      id: 'c1',
      name: 'Lagos Influencers',
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
      pointsPerNaira: 100,
      performance: perf(),
      promoters: [
        promoter({
          name: 'Rateless Promoter',
          rewardAmountNgn: null,
          rewardPoints: 4000,
          rewardPointsValueNgn: null,
        }),
      ],
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Rateless Promoter')).toBeTruthy());
    expect(screen.getByText('(value unavailable)')).toBeTruthy();
    expect(screen.queryByText('(₦40 when granted)')).toBeNull();
  });

  it('says the value is unavailable rather than inventing one', async () => {
    listCampaignPromotions.mockResolvedValue([
      {
        id: 'c1',
        name: 'No Rate Campaign',
        status: 'ACTIVE',
        startsAt: null,
        endsAt: null,
        promoterCount: 0,
        performance: perf({ rewardsEarnedPoints: 500, rewardsEarnedPointsValueNgn: null }),
      },
    ]);
    getCampaignPromotion.mockResolvedValue({
      id: 'c1',
      name: 'No Rate Campaign',
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
      pointsPerNaira: null,
      performance: perf({ rewardsEarnedPoints: 500, rewardsEarnedPointsValueNgn: null }),
      promoters: [],
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('No Rate Campaign')).toBeTruthy());
    fireEvent.click(screen.getByText('No Rate Campaign'));
    await waitFor(() => expect(screen.getByText('Value unavailable')).toBeTruthy());
  });

  it('shows “—” for a null conversion rate, never 0%', async () => {
    listCampaignPromotions.mockResolvedValue([
      {
        id: 'c1',
        name: 'Fresh Campaign',
        status: 'ACTIVE',
        startsAt: null,
        endsAt: null,
        promoterCount: 0,
        performance: perf({ totalReferrals: 0, qualifiedReferrals: 0, conversionRate: null }),
      },
    ]);
    getCampaignPromotion.mockResolvedValue({
      id: 'c1',
      name: 'Fresh Campaign',
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
      pointsPerNaira: 100,
      performance: perf({ totalReferrals: 0, qualifiedReferrals: 0, conversionRate: null }),
      promoters: [],
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Fresh Campaign')).toBeTruthy());
    fireEvent.click(screen.getByText('Fresh Campaign'));
    await waitFor(() => expect(screen.getByText('—')).toBeTruthy());
    expect(screen.queryByText('0.0%')).toBeNull();
  });

  it('states the incentive terms from the server, not from constants', async () => {
    getAcquisitionIncentive.mockResolvedValue({
      ...incentive,
      percentOff: 35,
      refereeRewardNgn: 275,
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('35%')).toBeTruthy());
    expect(screen.getByText('₦275')).toBeTruthy();
    expect(screen.queryByText('20%')).toBeNull();
    expect(screen.queryByText('₦150')).toBeNull();
  });
});

describe('Referral Campaigns — promoters', () => {
  it('masks a promoter token until it is asked for', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Ada Promoter')).toBeTruthy());
    expect(screen.queryByText('CAMPAIGNTOKEN123')).toBeNull();
    fireEvent.click(screen.getByText('Reveal'));
    expect(screen.getByText('CAMPAIGNTOKEN123')).toBeTruthy();
  });

  it('never renders a removed promoter as active or offers to remove them', async () => {
    permissions = ['operations:promotions:read', 'operations:promotions:manage'];
    getCampaignPromotion.mockResolvedValue({
      id: 'c1',
      name: 'Lagos Influencers',
      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,
      pointsPerNaira: 100,
      performance: perf(),
      promoters: [promoter({ id: 'p2', name: 'Gone Promoter', status: 'REMOVED' })],
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Gone Promoter')).toBeTruthy());
    expect(screen.getByText('No active promoters on this campaign.')).toBeTruthy();
    expect(screen.queryByText('Remove')).toBeNull();
  });
});

describe('Referral Campaigns — permission-aware rendering', () => {
  it('offers no manage controls on a read-only session', async () => {
    permissions = ['operations:promotions:read'];
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Ada Promoter')).toBeTruthy());
    expect(screen.queryByText('Remove')).toBeNull();
    expect(screen.queryByText('Add promoter')).toBeNull();
  });

  it('offers add and remove with the manage permission', async () => {
    permissions = ['operations:promotions:read', 'operations:promotions:manage'];
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Ada Promoter')).toBeTruthy());
    expect(screen.getByText('Remove')).toBeTruthy();
    expect(screen.getByText('Add promoter')).toBeTruthy();
  });
});

describe('Referral Campaigns — manage flows send exactly what the operator typed', () => {
  beforeEach(() => {
    permissions = ['operations:promotions:read', 'operations:promotions:manage'];
  });

  it('sends cash as rewardAmountNgn and never both reward kinds', async () => {
    addCampaignPromoter.mockResolvedValue(promoter({ name: 'New Promoter' }));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('User ID'), { target: { value: 'user-9' } });
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '750' } });
    fireEvent.click(screen.getByText('Add promoter'));

    await waitFor(() => expect(addCampaignPromoter).toHaveBeenCalledTimes(1));
    const [, body] = addCampaignPromoter.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.rewardAmountNgn).toBe(750);
    expect('rewardPoints' in body).toBe(false);
  });

  it('refuses to send a non-positive reward', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('User ID'), { target: { value: 'user-9' } });
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Add promoter'));

    await waitFor(() =>
      expect(screen.getByText('Enter a user ID and a reward greater than zero.')).toBeTruthy(),
    );
    expect(addCampaignPromoter).not.toHaveBeenCalled();
  });

  it('surfaces a server refusal instead of claiming the promoter was added', async () => {
    addCampaignPromoter.mockRejectedValue({ message: 'Reward exceeds the campaign ceiling' });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('User ID'), { target: { value: 'user-9' } });
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '999999' } });
    fireEvent.click(screen.getByText('Add promoter'));

    await waitFor(() =>
      expect(screen.getByText('Reward exceeds the campaign ceiling')).toBeTruthy(),
    );
  });

  it('removes a promoter through the API and reports the returned status', async () => {
    removeCampaignPromoter.mockResolvedValue({
      id: 'p1',
      status: 'REMOVED',
      removedAt: '2026-09-13T00:00:00.000Z',
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    fireEvent.click(screen.getByText('Lagos Influencers'));
    await waitFor(() => expect(screen.getByText('Remove')).toBeTruthy());

    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => expect(removeCampaignPromoter).toHaveBeenCalledWith('p1'));
    await waitFor(() =>
      expect(screen.getByText('Promoter removed. Their status is now REMOVED.')).toBeTruthy(),
    );
  });
});
