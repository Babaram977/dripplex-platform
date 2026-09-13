import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The referral desks and DX Points earning, ported into the Operations Console
 * the founder actually uses.
 *
 * Same rule as everywhere else in this console: the server owns the money.
 * These tests pin the places where a UI is most tempted to decide something
 * itself —
 *
 *  - a persona with no Driver Growth Campaign has *no* cash figure, which is a
 *    different fact from earning ₦0. Null renders "—".
 *  - an uncapped DX Points programme has no ceiling to project. That absence
 *    is the finding, not a zero.
 *  - a referral whose hold has elapsed is waiting on a human and must say so.
 *  - decisions and programme edits are hidden without their own manage
 *    permission, which is separate from the read permission for the desk.
 *  - a programme edit sends what the operator typed; legality is the server's.
 */

const referralOverview = vi.fn();
const referralPerformers = vi.fn();
const referralReviewQueue = vi.fn();
const referralProgrammes = vi.fn();
const updateReferralProgramme = vi.fn();
const approveReferralRedemption = vi.fn();
const rejectReferralRedemption = vi.fn();
const loyaltyEarningProgrammes = vi.fn();
const loyaltyEarningImpact = vi.fn();
const updateLoyaltyEarningProgramme = vi.fn();
let permissions: string[] = [];

vi.mock('../lib/api', () => ({
  api: {
    admin: {
      referralOverview: () => referralOverview(),
      referralPerformers: (p: string) => referralPerformers(p),
      referralReviewQueue: () => referralReviewQueue(),
      referralProgrammes: () => referralProgrammes(),
      updateReferralProgramme: (t: string, b: unknown) => updateReferralProgramme(t, b),
      approveReferralRedemption: (id: string) => approveReferralRedemption(id),
      rejectReferralRedemption: (id: string) => rejectReferralRedemption(id),
      loyaltyEarningProgrammes: () => loyaltyEarningProgrammes(),
      loyaltyEarningImpact: () => loyaltyEarningImpact(),
      updateLoyaltyEarningProgramme: (p: string, b: unknown) => updateLoyaltyEarningProgramme(p, b),
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

async function renderScreen(name: string) {
  const mod = await import('./adminConsoleScreen');
  const Screen = (mod as unknown as Record<string, React.ComponentType>)[name];
  return render(<Screen />);
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = ['operations:finance:read'];
  referralOverview.mockResolvedValue({
    personas: [
      {
        persona: 'CUSTOMER',
        referrers: 40,
        activeReferrers: 12,
        redemptions: 20,
        pendingRedemptions: 5,
        rewardedRedemptions: 15,
        conversionRate: 0.75,
      },
    ],
    driverCampaigns: [],
    personasWithoutProgramme: [],
  });
  referralPerformers.mockResolvedValue({ items: [], meta: { total: 0 } });
  referralReviewQueue.mockResolvedValue({ items: [], meta: { total: 0 } });
  referralProgrammes.mockResolvedValue([]);
  loyaltyEarningProgrammes.mockResolvedValue([]);
  loyaltyEarningImpact.mockResolvedValue([]);
});

describe('Referral Performance', () => {
  it('renders persona performance from the server', async () => {
    await renderScreen('AdminReferralsScreen');
    await waitFor(() => expect(screen.getByText('12 active of 40 referrers')).toBeTruthy());
    expect(screen.getByText('75.0%')).toBeTruthy();
  });

  it('names personas that have no programme instead of showing them as zeros', async () => {
    referralOverview.mockResolvedValue({
      personas: [],
      driverCampaigns: [],
      personasWithoutProgramme: ['RIDER', 'FLEET_OWNER'],
    });
    await renderScreen('AdminReferralsScreen');
    await waitFor(() =>
      expect(
        screen.getByText('No referral programme exists yet for Riders, Fleet owners.'),
      ).toBeTruthy(),
    );
  });

  it('shows “—” for a persona with no campaign cash, not ₦0', async () => {
    referralPerformers.mockResolvedValue({
      items: [
        {
          userId: 'u1',
          name: 'Ada Referrer',
          persona: 'CUSTOMER',
          code: 'DRPX1',
          redemptions: 6,
          rewardedRedemptions: 4,
          rewardAmountEarned: null,
          rewardAmountUnpaid: null,
        },
      ],
      meta: { total: 1 },
    });
    await renderScreen('AdminReferralsScreen');
    await waitFor(() => expect(screen.getByText('Ada Referrer')).toBeTruthy());
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('₦0')).toBeNull();
  });

  it('keeps the platform totals when only the performer list fails', async () => {
    referralPerformers.mockRejectedValue({ message: 'Performers unavailable' });
    await renderScreen('AdminReferralsScreen');
    await waitFor(() => expect(screen.getByText('Performers unavailable')).toBeTruthy());
    expect(screen.getByText('12 active of 40 referrers')).toBeTruthy();
  });

  it('surfaces a failure rather than an empty desk', async () => {
    referralOverview.mockRejectedValue({ message: 'Finance desk unavailable' });
    await renderScreen('AdminReferralsScreen');
    await waitFor(() => expect(screen.getByText('Finance desk unavailable')).toBeTruthy());
  });
});

describe('Referral Review Queue', () => {
  const item = (over: Record<string, unknown> = {}) => ({
    redemptionId: 'r1',
    referrerName: 'Ada',
    referrerCode: 'DRPX1',
    refereeName: 'Bola',
    refereeType: 'CUSTOMER',
    flaggedReason: 'SAME_DEVICE',
    referrerRewardAmount: 150,
    refereeRewardAmount: 150,
    qualifiedAt: '2026-09-10T00:00:00.000Z',
    releasesAt: '2026-09-12T00:00:00.000Z',
    holdElapsed: false,
    actionPath: '/admin/referrals/redemptions/r1',
    ...over,
  });

  it('shows an empty queue plainly', async () => {
    await renderScreen('AdminReferralReviewScreen');
    await waitFor(() => expect(screen.getByText('Nothing is waiting for review.')).toBeTruthy());
  });

  it('calls out a referral whose hold has elapsed', async () => {
    referralReviewQueue.mockResolvedValue({
      items: [item({ holdElapsed: true })],
      meta: { total: 1 },
    });
    await renderScreen('AdminReferralReviewScreen');
    await waitFor(() => expect(screen.getByText('Hold elapsed — awaiting you')).toBeTruthy());
    expect(screen.queryByText('Within hold period')).toBeNull();
  });

  it('offers no decision without admin:referrals:manage', async () => {
    permissions = ['operations:finance:read'];
    referralReviewQueue.mockResolvedValue({ items: [item()], meta: { total: 1 } });
    await renderScreen('AdminReferralReviewScreen');
    await waitFor(() => expect(screen.getByText('DRPX1')).toBeTruthy());
    expect(screen.queryByText('Approve')).toBeNull();
    expect(screen.queryByText('Reject')).toBeNull();
  });

  it('approves through the API when the manage permission is held', async () => {
    permissions = ['operations:finance:read', 'admin:referrals:manage'];
    referralReviewQueue.mockResolvedValue({ items: [item()], meta: { total: 1 } });
    approveReferralRedemption.mockResolvedValue({});
    await renderScreen('AdminReferralReviewScreen');
    await waitFor(() => expect(screen.getByText('Approve')).toBeTruthy());
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(approveReferralRedemption).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(screen.getByText('Referral approved.')).toBeTruthy());
  });

  it('reports a refused decision instead of claiming success', async () => {
    permissions = ['operations:finance:read', 'admin:referrals:manage'];
    referralReviewQueue.mockResolvedValue({ items: [item()], meta: { total: 1 } });
    rejectReferralRedemption.mockRejectedValue({ message: 'Already settled' });
    await renderScreen('AdminReferralReviewScreen');
    await waitFor(() => expect(screen.getByText('Reject')).toBeTruthy());
    fireEvent.click(screen.getByText('Reject'));
    await waitFor(() => expect(screen.getByText('Already settled')).toBeTruthy());
    expect(screen.queryByText('Referral rejected.')).toBeNull();
  });
});

describe('Referral Programmes', () => {
  const programme = (over: Record<string, unknown> = {}) => ({
    refereeType: 'CUSTOMER',
    referrerRewardAmount: 150,
    refereeRewardAmount: 150,
    holdDays: 7,
    qualificationWindowDays: 30,
    requireKycVerified: true,
    active: true,
    updatedAt: '2026-09-13T00:00:00.000Z',
    ...over,
  });

  it('shows what each side is paid, from the server', async () => {
    referralProgrammes.mockResolvedValue([programme()]);
    await renderScreen('AdminReferralProgrammesScreen');
    await waitFor(() => expect(screen.getByText('Referrer ₦150 · Referee ₦150')).toBeTruthy());
    expect(screen.getByText('7-day hold · 30-day window · KYC required')).toBeTruthy();
  });

  it('says a zero-hold programme pays immediately', async () => {
    referralProgrammes.mockResolvedValue([programme({ holdDays: 0 })]);
    await renderScreen('AdminReferralProgrammesScreen');
    await waitFor(() =>
      expect(screen.getByText('Pays immediately · 30-day window · KYC required')).toBeTruthy(),
    );
  });

  it('offers no edit without admin:referrals:manage', async () => {
    permissions = ['operations:finance:read'];
    referralProgrammes.mockResolvedValue([programme()]);
    await renderScreen('AdminReferralProgrammesScreen');
    await waitFor(() => expect(screen.getByText('Customers')).toBeTruthy());
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('sends the amounts the operator typed and lets the server rule', async () => {
    permissions = ['operations:finance:read', 'admin:referrals:manage'];
    referralProgrammes.mockResolvedValue([programme()]);
    updateReferralProgramme.mockResolvedValue(programme({ referrerRewardAmount: 275 }));
    await renderScreen('AdminReferralProgrammesScreen');
    await waitFor(() => expect(screen.getByText('Edit')).toBeTruthy());
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Referrer reward'), { target: { value: '275' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(updateReferralProgramme).toHaveBeenCalledTimes(1));
    const [refereeType, body] = updateReferralProgramme.mock.calls[0] as [
      string,
      Record<string, number>,
    ];
    expect(refereeType).toBe('CUSTOMER');
    expect(body.referrerRewardAmount).toBe(275);
    expect(body.refereeRewardAmount).toBe(150);
  });

  it('refuses to send a negative amount', async () => {
    permissions = ['operations:finance:read', 'admin:referrals:manage'];
    referralProgrammes.mockResolvedValue([programme()]);
    await renderScreen('AdminReferralProgrammesScreen');
    await waitFor(() => expect(screen.getByText('Edit')).toBeTruthy());
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Referrer reward'), { target: { value: '-5' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.getByText('Both amounts must be numbers of zero or more.')).toBeTruthy(),
    );
    expect(updateReferralProgramme).not.toHaveBeenCalled();
  });
});

describe('DX Points Earning', () => {
  const prog = (over: Record<string, unknown> = {}) => ({
    persona: 'DRIVER',
    active: true,
    pointsPerCompletedJob: 10,
    pointsPerQualifyingReview: 5,
    minReviewRating: 4,
    dailyPointsCap: 200,
    updatedAt: '2026-09-13T00:00:00.000Z',
    ...over,
  });

  it('shows what a persona earns and the server’s worst-case naira', async () => {
    permissions = ['admin:loyalty:manage'];
    loyaltyEarningProgrammes.mockResolvedValue([prog()]);
    loyaltyEarningImpact.mockResolvedValue([
      {
        persona: 'DRIVER',
        eligiblePartners: 30,
        dailyPointsCap: 200,
        worstCaseDailyPoints: 6000,
        worstCaseDailyNaira: 60,
        pointsPerNaira: 100,
      },
    ]);
    await renderScreen('AdminDxPointsScreen');
    await waitFor(() => expect(screen.getByText('10 DX per job · 5 per review')).toBeTruthy());
    expect(screen.getByText('200 DX/day cap')).toBeTruthy();
    expect(screen.getByText('30 partners · up to ₦60/day')).toBeTruthy();
  });

  it('says an uncapped programme has no ceiling to project, rather than ₦0', async () => {
    permissions = ['admin:loyalty:manage'];
    loyaltyEarningProgrammes.mockResolvedValue([prog({ dailyPointsCap: null })]);
    loyaltyEarningImpact.mockResolvedValue([
      {
        persona: 'DRIVER',
        eligiblePartners: 30,
        dailyPointsCap: null,
        worstCaseDailyPoints: null,
        worstCaseDailyNaira: null,
        pointsPerNaira: 100,
      },
    ]);
    await renderScreen('AdminDxPointsScreen');
    await waitFor(() => expect(screen.getByText('Uncapped daily')).toBeTruthy());
    expect(screen.getByText('30 partners · no ceiling to project')).toBeTruthy();
    expect(screen.queryByText('30 partners · up to ₦0/day')).toBeNull();
  });

  it('keeps the settings when only the impact projection fails', async () => {
    permissions = ['admin:loyalty:manage'];
    loyaltyEarningProgrammes.mockResolvedValue([prog()]);
    loyaltyEarningImpact.mockRejectedValue({ message: 'Impact unavailable' });
    await renderScreen('AdminDxPointsScreen');
    await waitFor(() => expect(screen.getByText('Impact unavailable')).toBeTruthy());
    expect(screen.getByText('10 DX per job · 5 per review')).toBeTruthy();
  });

  it('sends the points the operator typed', async () => {
    permissions = ['admin:loyalty:manage'];
    loyaltyEarningProgrammes.mockResolvedValue([prog()]);
    updateLoyaltyEarningProgramme.mockResolvedValue(prog({ pointsPerCompletedJob: 25 }));
    await renderScreen('AdminDxPointsScreen');
    await waitFor(() => expect(screen.getByText('Edit')).toBeTruthy());
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Points per completed job'), {
      target: { value: '25' },
    });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(updateLoyaltyEarningProgramme).toHaveBeenCalledTimes(1));
    const [persona, body] = updateLoyaltyEarningProgramme.mock.calls[0] as [
      string,
      Record<string, number>,
    ];
    expect(persona).toBe('DRIVER');
    expect(body.pointsPerCompletedJob).toBe(25);
  });
});
