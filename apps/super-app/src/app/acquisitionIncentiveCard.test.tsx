import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The universal acquisition incentive card.
 *
 * Reported from the console on 2026-09-13: the 20% discount and the ₦150
 * new-customer reward were text nobody could change, on a page whose whole job
 * is setting what the platform pays. They are configuration — the founder
 * reprices them — so a readout made the screen look finished while offering no
 * way to do the thing it described.
 *
 * The distinction these tests defend is which numbers are settings and which
 * are measurements:
 *
 *  - Discount and New-customer reward are settings, and are editable.
 *  - Discounted rides and Discount given are counted from real rides. A
 *    measurement you can type over is not a measurement.
 *  - The three-ride cap is a founder ruling of 2026-09-12, enforced under a row
 *    lock at ride creation. Editing it here would imply an authority this
 *    screen does not have.
 */

const getAcquisitionIncentive = vi.fn();
const updatePromotion = vi.fn();
const updateReferralProgramme = vi.fn();
const listPromotions = vi.fn();
const listCampaignPromotions = vi.fn();
const READ = 'operations:promotions:read';
let permissions: string[] = [READ];

vi.mock('../lib/api', () => ({
  api: {
    auth: {
      me: () =>
        Promise.resolve({
          id: 'u-ops-1',
          email: 'ops@dripplex.test',
          phone: null,
          firstName: 'Dan',
          lastName: 'Operator',
          profilePhotoUrl: null,
          dateOfBirth: null,
          gender: null,
          status: 'ACTIVE',
          roles: ['operations_staff'],
          permissions,
        }),
    },
    admin: {
      getAcquisitionIncentive: () => getAcquisitionIncentive(),
      updatePromotion: (id: string, body: unknown) => updatePromotion(id, body),
      updateReferralProgramme: (t: string, body: unknown) => updateReferralProgramme(t, body),
      listPromotions: () => listPromotions(),
      listCampaignPromotions: () => listCampaignPromotions(),
      listCustomers: () => Promise.resolve({ items: [] }),
      listDrivers: () => Promise.resolve({ items: [] }),
      listRiders: () => Promise.resolve({ items: [] }),
      listVehicles: () => Promise.resolve({ items: [] }),
      getOpsCounters: () => Promise.resolve({ openIncidentsCount: 0, openSupportTicketsCount: 0 }),
    },
  },
  MERCHANT_CATEGORY_LABEL: {},
}));

vi.mock('../lib/auth', () => ({
  auth: {
    getUser: () => ({ permissions, roles: ['operations_staff'] }),
    getAccessToken: () => 'token',
    setUser: () => undefined,
    clear: () => undefined,
  },
}));

vi.mock('../lib/maps', () => ({
  addressPredictions: () => Promise.resolve([]),
  geocodeAddress: () => Promise.resolve(null),
  mapsEnabled: () => false,
  mapsLibrary: () => Promise.resolve(null),
}));

const INCENTIVE = {
  promotionId: '00000000-0000-4000-8000-00000000200a',
  status: 'ACTIVE',
  percentOff: 20,
  maxDiscountedRides: 3,
  refereeRewardNgn: 150,
  discountedRides: 7,
  customersBenefiting: 4,
  totalDiscountNgn: 5400,
};

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

async function renderCampaigns(): Promise<void> {
  const { AdminCampaignsScreen } = await import('./adminConsoleScreen');
  render(<AdminCampaignsScreen />);
  await waitFor(() => expect(screen.getByText('Universal acquisition incentive')).toBeTruthy());
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [READ, 'admin:promotions:manage', 'admin:referrals:manage'];
  getAcquisitionIncentive.mockResolvedValue(INCENTIVE);
  updatePromotion.mockResolvedValue({});
  updateReferralProgramme.mockResolvedValue({});
  listPromotions.mockResolvedValue([]);
  listCampaignPromotions.mockResolvedValue([]);
});

describe('the two settings can be changed', () => {
  it('sends a repriced discount to the promotion row', async () => {
    await renderCampaigns();
    fireEvent.click(screen.getAllByText('Change')[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText('Discount percent'), { target: { value: '25' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updatePromotion).toHaveBeenCalledWith(INCENTIVE.promotionId, { percentOff: 25 }),
    );
  });

  it('sends a repriced new-customer reward to the customer programme', async () => {
    await renderCampaigns();
    fireEvent.click(screen.getAllByText('Change')[1] as HTMLElement);
    fireEvent.change(screen.getByLabelText('New-customer reward in naira'), {
      target: { value: '200' },
    });
    fireEvent.click(screen.getByText('Save'));

    // The referee reward is the programme's row, not the promotion's — the same
    // row the Referral Programmes desk edits, so the two cannot drift apart.
    await waitFor(() =>
      expect(updateReferralProgramme).toHaveBeenCalledWith('CUSTOMER', {
        refereeRewardAmount: 200,
      }),
    );
  });

  it('reports a refusal instead of claiming it saved', async () => {
    updatePromotion.mockRejectedValue(new Error('percentOff must be between 1 and 100'));
    await renderCampaigns();
    fireEvent.click(screen.getAllByText('Change')[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText('Discount percent'), { target: { value: '900' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('percentOff must be between 1 and 100')).toBeTruthy();
  });

  it('refuses to send something that is not a number', async () => {
    await renderCampaigns();
    fireEvent.click(screen.getAllByText('Change')[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText('Discount percent'), { target: { value: 'twenty' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Enter a number.')).toBeTruthy());
    expect(updatePromotion).not.toHaveBeenCalled();
  });

  it('cancelling changes nothing', async () => {
    await renderCampaigns();
    fireEvent.click(screen.getAllByText('Change')[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText('Discount percent'), { target: { value: '99' } });
    fireEvent.click(screen.getByText('Cancel'));

    expect(updatePromotion).not.toHaveBeenCalled();
    expect(screen.getByText('20%')).toBeTruthy();
  });
});

describe('measurements and rulings are not settings', () => {
  it('counts discounted rides from the server and offers no way to type over them', async () => {
    await renderCampaigns();

    // The server counts rides holding an incentive slot; this screen prints
    // that number and must never let anyone edit it.
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('4 customers')).toBeTruthy();
    expect(screen.queryByLabelText('Discounted rides')).toBeNull();
    expect(screen.queryByLabelText('Discount given')).toBeNull();
  });

  it('states the ride cap as a ruling rather than offering it', async () => {
    await renderCampaigns();
    expect(screen.getByText(/cap is a founder ruling/)).toBeTruthy();
    expect(screen.queryByLabelText('Max discounted rides')).toBeNull();
  });

  it('offers exactly two changeable numbers, not four', async () => {
    await renderCampaigns();
    expect(screen.getAllByText('Change')).toHaveLength(2);
  });
});

describe('permission gates', () => {
  it('offers no discount edit without admin:promotions:manage', async () => {
    permissions = [READ, 'admin:referrals:manage'];
    await renderCampaigns();
    // Only the reward remains changeable.
    expect(screen.getAllByText('Change')).toHaveLength(1);
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByLabelText('New-customer reward in naira')).toBeTruthy();
  });

  it('offers nothing changeable without either permission', async () => {
    permissions = [READ];
    await renderCampaigns();
    expect(screen.queryAllByText('Change')).toHaveLength(0);
  });
});
