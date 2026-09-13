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
 * The first version of this page could only list promotions that already had a
 * promoter, so with none anywhere it showed an empty state and offered no way
 * in — a campaign could never gain its first promoter through the UI. The
 * tests below pin the way out of that: every campaign is listed whether or not
 * it has promoters, one can be created, and the enrolment form is present on a
 * campaign with none.
 *
 * The rest are the guards that must not quietly stop being true:
 *
 *  - points must never be divided by today's rate to produce a naira value.
 *    The rate moved 200 -> 100 on 2026-09-12, so a client-side conversion of
 *    an aggregate reports double what the grant actually cost.
 *  - a null conversion rate is "—", not "0.0%".
 *  - a promoter's token is a credential. Masked until asked for.
 *  - a removed promoter keeps their earnings but must never render as active.
 *  - manage controls are absent without the permission. That is a courtesy;
 *    the server's 403 is the boundary.
 */

const listCustomers = vi.fn();
const listDrivers = vi.fn();
const listRiders = vi.fn();
const listPromotions = vi.fn();
const createPromotion = vi.fn();
const listCampaignPromotions = vi.fn();
const getCampaignPromotion = vi.fn();
const getAcquisitionIncentive = vi.fn();
const addCampaignPromoter = vi.fn();
const removeCampaignPromoter = vi.fn();
let permissions: string[] = [];

vi.mock('../lib/api', () => ({
  api: {
    admin: {
      listCustomers: (q: unknown) => listCustomers(q),
      listDrivers: (q: unknown) => listDrivers(q),
      listRiders: (q: unknown) => listRiders(q),
      listPromotions: () => listPromotions(),
      createPromotion: (body: unknown) => createPromotion(body),
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

const READ = 'operations:promotions:read';
const MANAGE = 'operations:promotions:manage';
const CREATE = 'promotions:admin:manage';

const promotion = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  code: null,
  name: 'Lagos Influencers',
  type: 'REFERRAL',
  status: 'ACTIVE',
  domains: [],
  percentOff: null,
  amountOff: null,
  maxDiscount: null,
  minOrderAmount: null,
  usageLimit: null,
  usageCount: 0,
  perUserLimit: null,
  startsAt: null,
  endsAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const perf = (over: Record<string, unknown> = {}) => ({
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

const promoter = (over: Record<string, unknown> = {}) => ({
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

const summary = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Lagos Influencers',
  status: 'ACTIVE',
  startsAt: null,
  endsAt: null,
  promoterCount: 1,
  performance: perf(),
  ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Lagos Influencers',
  status: 'ACTIVE',
  startsAt: null,
  endsAt: null,
  pointsPerNaira: 100,
  performance: perf(),
  promoters: [promoter()],
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

const customerRow = (over: Record<string, unknown> = {}) => ({
  id: 'user-cust-1',
  firstName: 'Ada',
  lastName: 'Customer',
  email: 'ada@dripplex.test',
  phone: '+2348010000001',
  status: 'ACTIVE',
  tripsCount: 3,
  totalSpent: 9000,
  createdAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

/** `id` is the DRIVER PROFILE id; `driverId` is the user id the enrolment needs. */
const driverRow = (over: Record<string, unknown> = {}) => ({
  id: 'driver-profile-1',
  driverId: 'user-driver-1',
  firstName: 'Musa',
  lastName: 'Driver',
  email: 'musa@dripplex.test',
  phone: '+2348020000002',
  status: 'APPROVED',
  isApproved: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  kyc: [],
  ...over,
});

/** Same shape of trap: `id` is the rider profile, `riderId` is the user. */
const riderRow = (over: Record<string, unknown> = {}) => ({
  id: 'rider-profile-1',
  riderId: 'user-rider-1',
  firstName: 'Chidi',
  lastName: 'Rider',
  email: 'chidi@dripplex.test',
  phone: '+2348030000003',
  status: 'APPROVED',
  companyName: null,
  isApproved: true,
  rejectedReason: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  kyc: [],
  ...over,
});

/** Search for someone and pick the first result. */
async function pickPerson(term: string) {
  fireEvent.change(screen.getByLabelText('Find a promoter'), { target: { value: term } });
  fireEvent.click(screen.getByText('Find'));
}

async function renderPage() {
  const { AdminCampaignsScreen } = await import('./adminConsoleScreen');
  return render(<AdminCampaignsScreen />);
}

/** Open the campaign card so the promoter section renders. */
async function openCampaign(name = 'Lagos Influencers') {
  await waitFor(() => expect(screen.getByText(name)).toBeTruthy());
  fireEvent.click(screen.getByText(name));
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [READ];
  listPromotions.mockResolvedValue([promotion()]);
  listCampaignPromotions.mockResolvedValue([summary()]);
  getCampaignPromotion.mockResolvedValue(detail());
  getAcquisitionIncentive.mockResolvedValue(incentive);
  listCustomers.mockResolvedValue({ items: [customerRow()], meta: { total: 1 } });
  listDrivers.mockResolvedValue({ items: [driverRow()], meta: { total: 1 } });
  listRiders.mockResolvedValue({ items: [riderRow()], meta: { total: 1 } });
});

describe('Referral Campaigns — a campaign can actually be run', () => {
  it('lists a campaign that has no promoters yet, instead of hiding it', async () => {
    // The defect this test exists for: the operations list is keyed on promoter
    // presence, so a campaign awaiting its first promoter was invisible and
    // could never be given one.
    listCampaignPromotions.mockResolvedValue([]);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    expect(screen.getByText('No promoters yet')).toBeTruthy();
  });

  it('offers the enrolment form on a campaign with no promoters', async () => {
    permissions = [READ, MANAGE];
    listCampaignPromotions.mockResolvedValue([]);
    getCampaignPromotion.mockResolvedValue(detail({ promoters: [] }));
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());
  });

  it('enrols an influencer onto a campaign that had none', async () => {
    permissions = [READ, MANAGE];
    listCampaignPromotions.mockResolvedValue([]);
    getCampaignPromotion.mockResolvedValue(detail({ promoters: [] }));
    addCampaignPromoter.mockResolvedValue(promoter({ name: 'Big Creator' }));
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    await pickPerson('Ada');
    await waitFor(() => expect(screen.getByText('Ada Customer')).toBeTruthy());
    fireEvent.click(screen.getByText('Ada Customer'));
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '750' } });
    fireEvent.click(screen.getByText('Add promoter'));

    await waitFor(() => expect(addCampaignPromoter).toHaveBeenCalledTimes(1));
    const [promotionId, body] = addCampaignPromoter.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(promotionId).toBe('c1');
    expect(body.userId).toBe('user-cust-1');
    expect(body.rewardAmountNgn).toBe(750);
  });

  it('finds a promoter by name instead of asking for a UUID', async () => {
    permissions = [READ, MANAGE];
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    // The field the operator types into is a search, not an id box.
    expect(screen.queryByPlaceholderText('User ID')).toBeNull();
    await pickPerson('Ada');
    await waitFor(() => expect(listCustomers).toHaveBeenCalledTimes(1));
    expect((listCustomers.mock.calls[0][0] as { search: string }).search).toBe('Ada');
    await waitFor(() => expect(screen.getByText('Ada Customer')).toBeTruthy());
  });

  it('enrols a DRIVER by their user id, not their driver-profile id', async () => {
    // The trap: /admin/drivers returns `id` = DriverProfile.id and
    // `driverId` = User.id. Sending `id` would attach the reward to a row that
    // is not a user at all.
    permissions = [READ, MANAGE];
    addCampaignPromoter.mockResolvedValue(promoter({ name: 'Musa Driver' }));
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Promoter class'), { target: { value: 'DRIVER' } });
    await pickPerson('Musa');
    await waitFor(() => expect(screen.getByText('Musa Driver')).toBeTruthy());
    fireEvent.click(screen.getByText('Musa Driver'));
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '500' } });
    fireEvent.click(screen.getByText('Add promoter'));

    await waitFor(() => expect(addCampaignPromoter).toHaveBeenCalledTimes(1));
    const [, body] = addCampaignPromoter.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.userId).toBe('user-driver-1');
    expect(body.userId).not.toBe('driver-profile-1');
    expect(body.participantType).toBe('DRIVER');
    // Drivers have no server-side search; the roster is pulled and filtered.
    expect(listCustomers).not.toHaveBeenCalled();
  });

  it('enrols a RIDER by their user id, not their rider-profile id', async () => {
    permissions = [READ, MANAGE];
    addCampaignPromoter.mockResolvedValue(promoter({ name: 'Chidi Rider' }));
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Promoter class'), { target: { value: 'RIDER' } });
    await pickPerson('Chidi');
    await waitFor(() => expect(screen.getByText('Chidi Rider')).toBeTruthy());
    fireEvent.click(screen.getByText('Chidi Rider'));
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '500' } });
    fireEvent.click(screen.getByText('Add promoter'));

    await waitFor(() => expect(addCampaignPromoter).toHaveBeenCalledTimes(1));
    const [, body] = addCampaignPromoter.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.userId).toBe('user-rider-1');
    expect(body.userId).not.toBe('rider-profile-1');
  });

  it('never sends `search` to the driver roster, which would be a 400', async () => {
    // ListDriversQueryDto accepts page/limit only, and the global
    // ValidationPipe runs forbidNonWhitelisted.
    permissions = [READ, MANAGE];
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Promoter class'), { target: { value: 'DRIVER' } });
    await pickPerson('Musa');
    // The sidebar badge loader also calls listDrivers, so assert across every
    // call rather than assuming the picker's is the only one.
    await waitFor(() => expect(listDrivers.mock.calls.length).toBeGreaterThan(0));
    for (const [query] of listDrivers.mock.calls as [Record<string, unknown> | undefined][]) {
      expect(query ?? {}).not.toHaveProperty('search');
    }
  });

  it('clears the person when the promoter class changes rosters', async () => {
    // A person found in one roster must not stay attached to a class they were
    // not found under — that is how a rider id ends up sent as a driver.
    permissions = [READ, MANAGE];
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());
    await pickPerson('Ada');
    await waitFor(() => expect(screen.getByText('Ada Customer')).toBeTruthy());
    fireEvent.click(screen.getByText('Ada Customer'));
    expect(screen.getByText('Change')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Promoter class'), { target: { value: 'DRIVER' } });
    expect(screen.queryByText('Change')).toBeNull();
  });

  it('refuses to enrol before a person is chosen', async () => {
    permissions = [READ, MANAGE];
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '500' } });
    fireEvent.click(screen.getByText('Add promoter'));
    await waitFor(() => expect(screen.getByText('Find the person first.')).toBeTruthy());
    expect(addCampaignPromoter).not.toHaveBeenCalled();
  });

  it('says so plainly when nobody matches', async () => {
    permissions = [READ, MANAGE];
    listCustomers.mockResolvedValue({ items: [], meta: { total: 0 } });
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());
    await pickPerson('Nobody');
    await waitFor(() =>
      expect(
        screen.getByText('No account matches that. They must be registered on DrippleX first.'),
      ).toBeTruthy(),
    );
  });

  it('offers every promoter class the server supports, not just influencers', async () => {
    permissions = [READ, MANAGE];
    listCampaignPromotions.mockResolvedValue([]);
    getCampaignPromotion.mockResolvedValue(detail({ promoters: [] }));
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    for (const label of [
      'Customer',
      'Rider',
      'Driver',
      'Pioneer driver',
      'Influencer',
      'Creator',
      'Ambassador',
    ]) {
      expect(screen.getByRole('option', { name: label })).toBeTruthy();
    }
  });

  it('creates a campaign and sends type REFERRAL', async () => {
    permissions = [READ, CREATE];
    createPromotion.mockResolvedValue(promotion({ id: 'c2', name: 'Creator Push' }));
    await renderPage();
    await waitFor(() => expect(screen.getByText('New campaign')).toBeTruthy());
    fireEvent.click(screen.getByText('New campaign'));

    fireEvent.change(screen.getByLabelText('Campaign name'), {
      target: { value: 'Creator Push' },
    });
    fireEvent.click(screen.getByText('Create campaign'));

    await waitFor(() => expect(createPromotion).toHaveBeenCalledTimes(1));
    const [body] = createPromotion.mock.calls[0] as [Record<string, unknown>];
    expect(body.name).toBe('Creator Push');
    expect(body.type).toBe('REFERRAL');
  });

  it('refuses to create a nameless campaign', async () => {
    permissions = [READ, CREATE];
    await renderPage();
    await waitFor(() => expect(screen.getByText('New campaign')).toBeTruthy());
    fireEvent.click(screen.getByText('New campaign'));
    fireEvent.click(screen.getByText('Create campaign'));

    await waitFor(() => expect(screen.getByText('Give the campaign a name.')).toBeTruthy());
    expect(createPromotion).not.toHaveBeenCalled();
  });

  it('hides campaign creation without promotions:admin:manage', async () => {
    permissions = [READ];
    await renderPage();
    await waitFor(() => expect(screen.getByText('Lagos Influencers')).toBeTruthy());
    expect(screen.queryByText('New campaign')).toBeNull();
  });

  it('surfaces a refused creation instead of claiming success', async () => {
    permissions = [READ, CREATE];
    createPromotion.mockRejectedValue({ message: 'A campaign with that name exists' });
    await renderPage();
    await waitFor(() => expect(screen.getByText('New campaign')).toBeTruthy());
    fireEvent.click(screen.getByText('New campaign'));
    fireEvent.change(screen.getByLabelText('Campaign name'), { target: { value: 'Dupe' } });
    fireEvent.click(screen.getByText('Create campaign'));
    await waitFor(() => expect(screen.getByText('A campaign with that name exists')).toBeTruthy());
  });
});

describe('Referral Campaigns — states', () => {
  it('shows a loading state before the campaigns arrive', async () => {
    let release: (v: unknown) => void = () => undefined;
    listPromotions.mockReturnValue(new Promise((r) => (release = r)));
    await renderPage();
    expect(screen.getByText('Loading…')).toBeTruthy();
    release([]);
  });

  it('shows the API error rather than an empty page', async () => {
    listPromotions.mockRejectedValue({ message: 'Backend unavailable' });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Backend unavailable')).toBeTruthy());
  });

  it('shows an empty state when no campaign exists at all', async () => {
    listPromotions.mockResolvedValue([]);
    listCampaignPromotions.mockResolvedValue([]);
    await renderPage();
    await waitFor(() => expect(screen.getByText(/No referral campaigns exist yet/)).toBeTruthy());
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
    listCampaignPromotions.mockResolvedValue([
      summary({ performance: perf({ rewardsEarnedPointsValueNgn: 75 }) }),
    ]);
    getCampaignPromotion.mockResolvedValue(
      detail({ promoters: [], performance: perf({ rewardsEarnedPointsValueNgn: 75 }) }),
    );
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('10,000 DX')).toBeTruthy());
    expect(screen.getByText('₦75 when granted')).toBeTruthy();
    expect(screen.queryByText('₦100 when granted')).toBeNull();
  });

  it('shows a points-paid promoter the server’s naira value, not points ÷ rate', async () => {
    // pointsPerNaira is 100 and the promoter holds 10,000 points, so dividing
    // would print ₦100. The server says ₦250. Only the server's figure may show.
    getCampaignPromotion.mockResolvedValue(
      detail({
        promoters: [
          promoter({
            name: 'Points Promoter',
            rewardAmountNgn: null,
            rewardPoints: 10000,
            rewardPointsValueNgn: 250,
          }),
        ],
      }),
    );
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Points Promoter')).toBeTruthy());
    expect(screen.getByText('(₦250 when granted)')).toBeTruthy();
    expect(screen.queryByText('(₦100 when granted)')).toBeNull();
  });

  it('says a promoter’s points value is unavailable rather than deriving one', async () => {
    getCampaignPromotion.mockResolvedValue(
      detail({
        promoters: [
          promoter({
            name: 'Rateless Promoter',
            rewardAmountNgn: null,
            rewardPoints: 4000,
            rewardPointsValueNgn: null,
          }),
        ],
      }),
    );
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Rateless Promoter')).toBeTruthy());
    expect(screen.getByText('(value unavailable)')).toBeTruthy();
    expect(screen.queryByText('(₦40 when granted)')).toBeNull();
  });

  it('shows “—” for a null conversion rate, never 0%', async () => {
    listCampaignPromotions.mockResolvedValue([
      summary({
        performance: perf({ totalReferrals: 0, qualifiedReferrals: 0, conversionRate: null }),
      }),
    ]);
    getCampaignPromotion.mockResolvedValue(detail({ promoters: [] }));
    await renderPage();
    await openCampaign();
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
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Ada Promoter')).toBeTruthy());
    expect(screen.queryByText('CAMPAIGNTOKEN123')).toBeNull();
    fireEvent.click(screen.getByText('Reveal'));
    expect(screen.getByText('CAMPAIGNTOKEN123')).toBeTruthy();
  });

  it('never renders a removed promoter as active or offers to remove them', async () => {
    permissions = [READ, MANAGE];
    getCampaignPromotion.mockResolvedValue(
      detail({ promoters: [promoter({ id: 'p2', name: 'Gone Promoter', status: 'REMOVED' })] }),
    );
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Gone Promoter')).toBeTruthy());
    expect(screen.getByText('No active promoters on this campaign.')).toBeTruthy();
    expect(screen.queryByText('Remove')).toBeNull();
  });
});

describe('Referral Campaigns — permission-aware rendering', () => {
  it('offers no manage controls on a read-only session', async () => {
    permissions = [READ];
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Ada Promoter')).toBeTruthy());
    expect(screen.queryByText('Remove')).toBeNull();
    expect(screen.queryByText('Add promoter')).toBeNull();
  });

  it('offers add and remove with the manage permission', async () => {
    permissions = [READ, MANAGE];
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Ada Promoter')).toBeTruthy());
    expect(screen.getByText('Remove')).toBeTruthy();
    expect(screen.getByText('Add promoter')).toBeTruthy();
  });
});

describe('Referral Campaigns — manage flows send exactly what the operator typed', () => {
  beforeEach(() => {
    permissions = [READ, MANAGE];
  });

  it('sends cash as rewardAmountNgn and never both reward kinds', async () => {
    addCampaignPromoter.mockResolvedValue(promoter({ name: 'New Promoter' }));
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    await pickPerson('Ada');
    await waitFor(() => expect(screen.getByText('Ada Customer')).toBeTruthy());
    fireEvent.click(screen.getByText('Ada Customer'));
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '750' } });
    fireEvent.click(screen.getByText('Add promoter'));

    await waitFor(() => expect(addCampaignPromoter).toHaveBeenCalledTimes(1));
    const [, body] = addCampaignPromoter.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.rewardAmountNgn).toBe(750);
    expect('rewardPoints' in body).toBe(false);
  });

  it('refuses to send a non-positive reward', async () => {
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    await pickPerson('Ada');
    await waitFor(() => expect(screen.getByText('Ada Customer')).toBeTruthy());
    fireEvent.click(screen.getByText('Ada Customer'));
    fireEvent.change(screen.getByPlaceholderText('Amount in ₦'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Add promoter'));

    await waitFor(() => expect(screen.getByText('Enter a reward greater than zero.')).toBeTruthy());
    expect(addCampaignPromoter).not.toHaveBeenCalled();
  });

  it('surfaces a server refusal instead of claiming the promoter was added', async () => {
    addCampaignPromoter.mockRejectedValue({ message: 'Reward exceeds the campaign ceiling' });
    await renderPage();
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Add promoter')).toBeTruthy());

    await pickPerson('Ada');
    await waitFor(() => expect(screen.getByText('Ada Customer')).toBeTruthy());
    fireEvent.click(screen.getByText('Ada Customer'));
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
    await openCampaign();
    await waitFor(() => expect(screen.getByText('Remove')).toBeTruthy());

    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => expect(removeCampaignPromoter).toHaveBeenCalledWith('p1'));
    await waitFor(() =>
      expect(screen.getByText('Promoter removed. Their status is now REMOVED.')).toBeTruthy(),
    );
  });
});
