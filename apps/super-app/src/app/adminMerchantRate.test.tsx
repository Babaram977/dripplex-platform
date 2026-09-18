import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DPX-MERCHANT-016 — the merchant negotiated commission rate, in the
 * Operations Console. Founder-locked 2026-09-11.
 *
 * This is the first WRITE ported in the migration, and it writes a live
 * commercial rate that settlement snapshots. The guarantees it must not lose:
 *
 *  - THE PROFILE ID, NOT THE USER ID. AdminMerchantDto carries both `id`
 *    (profile) and `merchantId` (user), adjacent, and this endpoint takes the
 *    profile id while /admin/merchant/:id takes the user id. The wrong one
 *    404s at best and names a DIFFERENT MERCHANT at worst — invisible from
 *    the call site, and the thing most likely to ship past a green suite.
 *
 *  - PERCENT IN, FRACTION OUT. The operator types 7.5 because that is how a
 *    rate is agreed; the server stores 0.075. Sending 7.5 would be a 750%
 *    commission if the bounds ever moved.
 *
 *  - ZERO IS NOT EXPRESSIBLE, and null is not zero. Null clears the agreement
 *    back to the platform rate; zero is refused, because a merchant DrippleX
 *    charges nothing is a decision with no ceiling on its cost and a campaign
 *    is the instrument for that. The client guard mirrors the server's bounds
 *    and must never be looser than them.
 *
 *  - The control is gated on admin:merchant-settlement:commission:manage,
 *    which the seed grants to administrator and super_administrator only.
 */

const listMerchants = vi.fn();
const setMerchantNegotiatedRate = vi.fn();
let permissions: string[] = [];

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
      listMerchants: () => listMerchants(),
      setMerchantNegotiatedRate: (id: string, rate: number | null, note?: string) =>
        setMerchantNegotiatedRate(id, rate, note),
      listVehicles: () => Promise.resolve({ items: [] }),
      listDrivers: () => Promise.resolve({ items: [] }),
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

const MANAGE = 'admin:merchant-settlement:commission:manage';

/** `id` is the PROFILE id; `merchantId` is the USER id. Deliberately unlike
 *  each other so a swap is unmistakable in an assertion. */
const merchant = (over: Record<string, unknown> = {}) => ({
  id: 'PROFILE-1111',
  merchantId: 'USER-9999',
  email: 'shop@dripplex.test',
  phone: '+2348010000001',
  firstName: 'Ada',
  lastName: 'Merchant',
  status: 'APPROVED',
  isApproved: true,
  rejectedReason: null,
  negotiatedRate: null,
  negotiatedBy: null,
  negotiatedAt: null,
  negotiationNote: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  business: {
    businessName: 'Ada Stores',
    businessType: 'LIMITED',
    category: null,
    verificationStatus: 'VERIFIED',
    city: 'Lagos',
    state: 'Lagos',
    latitude: 6.5,
    longitude: 3.3,
    address: '1 Test Road',
  },
  kyc: null,
  ...over,
});

async function renderPage() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="merchants" />);
}

const rateBox = () => screen.getByLabelText('Commission rate percent');

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [MANAGE];
  listMerchants.mockResolvedValue({ items: [merchant()], meta: { total: 1 } });
  setMerchantNegotiatedRate.mockResolvedValue({});
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('Merchant negotiated rate — the id that is sent', () => {
  it('sends the merchant PROFILE id, never the user id', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Commission rate')).toBeTruthy());

    fireEvent.change(rateBox(), { target: { value: '7.5' } });
    fireEvent.click(screen.getByText('Save rate'));

    await waitFor(() => expect(setMerchantNegotiatedRate).toHaveBeenCalled());
    const [sentId] = setMerchantNegotiatedRate.mock.calls[0] as [string, number | null, unknown];
    expect(sentId).toBe('PROFILE-1111');
    // The failure this pins: the adjacent, invitingly-named field.
    expect(sentId).not.toBe('USER-9999');
  });
});

describe('Merchant negotiated rate — percent in, fraction out', () => {
  it('converts the typed percentage to the fraction the server stores', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Commission rate')).toBeTruthy());

    fireEvent.change(rateBox(), { target: { value: '7.5' } });
    fireEvent.click(screen.getByText('Save rate'));

    await waitFor(() => expect(setMerchantNegotiatedRate).toHaveBeenCalled());
    expect(setMerchantNegotiatedRate).toHaveBeenCalledWith('PROFILE-1111', 0.075, undefined);
  });

  it('passes the note when one is given, and undefined when it is blank', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Commission rate')).toBeTruthy());

    fireEvent.change(rateBox(), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('What was agreed'), {
      target: { value: 'Launch agreement' },
    });
    fireEvent.click(screen.getByText('Save rate'));

    await waitFor(() => expect(setMerchantNegotiatedRate).toHaveBeenCalled());
    expect(setMerchantNegotiatedRate).toHaveBeenCalledWith(
      'PROFILE-1111',
      0.06,
      'Launch agreement',
    );
  });

  it('renders a stored fraction back as a percentage', async () => {
    listMerchants.mockResolvedValue({
      items: [merchant({ negotiatedRate: 0.075, negotiatedAt: '2026-09-11T00:00:00.000Z' })],
      meta: { total: 1 },
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText(/7\.5% agreed/)).toBeTruthy());
  });
});

describe('Merchant negotiated rate — zero is not expressible', () => {
  it('refuses zero without calling the server', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Commission rate')).toBeTruthy());

    fireEvent.change(rateBox(), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Save rate'));

    await waitFor(() => expect(screen.getByText(/between 0 and 100/)).toBeTruthy());
    expect(setMerchantNegotiatedRate).not.toHaveBeenCalled();
  });

  it('refuses 100 and above without calling the server', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Commission rate')).toBeTruthy());

    fireEvent.change(rateBox(), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Save rate'));

    await waitFor(() => expect(screen.getByText(/between 0 and 100/)).toBeTruthy());
    expect(setMerchantNegotiatedRate).not.toHaveBeenCalled();
  });

  it('refuses text without calling the server', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Commission rate')).toBeTruthy());

    fireEvent.change(rateBox(), { target: { value: 'seven' } });
    fireEvent.click(screen.getByText('Save rate'));

    await waitFor(() => expect(screen.getByText(/between 0 and 100/)).toBeTruthy());
    expect(setMerchantNegotiatedRate).not.toHaveBeenCalled();
  });
});

describe('Merchant negotiated rate — clearing is null, not zero', () => {
  it('sends null to clear the agreement back to the platform rate', async () => {
    listMerchants.mockResolvedValue({
      items: [merchant({ negotiatedRate: 0.075 })],
      meta: { total: 1 },
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Clear')).toBeTruthy());

    fireEvent.click(screen.getByText('Clear'));

    await waitFor(() => expect(setMerchantNegotiatedRate).toHaveBeenCalled());
    const [id, rate] = setMerchantNegotiatedRate.mock.calls[0] as [string, number | null];
    expect(id).toBe('PROFILE-1111');
    expect(rate).toBeNull();
    // Zero would be refused by the server — an operator could not act on the 400.
    expect(rate).not.toBe(0);
  });

  it('offers no Clear when there is no agreement to clear', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Commission rate')).toBeTruthy());
    expect(screen.queryByText('Clear')).toBeNull();
  });
});

describe('Merchant negotiated rate — failures are surfaced', () => {
  it('shows the server refusal rather than reporting success', async () => {
    setMerchantNegotiatedRate.mockRejectedValue(new Error('rate must not be less than 0.0001'));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Commission rate')).toBeTruthy());

    fireEvent.change(rateBox(), { target: { value: '7.5' } });
    fireEvent.click(screen.getByText('Save rate'));

    await waitFor(() => expect(screen.getByText(/rate must not be less than 0.0001/)).toBeTruthy());
    expect(screen.queryByText(/is now on/)).toBeNull();
  });
});

describe('Merchant negotiated rate — permission gating', () => {
  it('is absent without admin:merchant-settlement:commission:manage', async () => {
    permissions = [];
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ada Stores')).toBeTruthy());
    // Correctly invisible to an operations_staff session — the seed grants
    // this to administrator and super_administrator only. Absent, not
    // disabled: there is nothing here such a session may do.
    expect(screen.queryByText('Commission rate')).toBeNull();
    expect(screen.queryByText('Save rate')).toBeNull();
  });
});
