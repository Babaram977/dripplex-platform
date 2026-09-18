import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Drivers on the Referral Programmes desk — founder ruling, 2026-09-18.
 *
 * The desk is data-driven: it renders whatever `/admin/referrals/programmes`
 * returns. So the thing worth pinning here is not that a row appears — it is
 * that the row an operator gets is a WORKING one:
 *
 *  - it is labelled "Drivers" rather than falling back to the raw enum, which
 *    is what an unmapped persona renders as;
 *  - its amounts are EDITABLE, because the founder's instruction was to give it
 *    adjustable values rather than a commission specified in the repository;
 *  - an inactive programme is visibly inactive, because DRIVER ships inactive
 *    and an operator who cannot see that will wonder why nobody is being paid.
 */

const referralProgrammes = vi.fn();
const updateReferralProgramme = vi.fn();
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
      referralProgrammes: () => referralProgrammes(),
      updateReferralProgramme: (t: unknown, b: unknown) => updateReferralProgramme(t, b),
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

// TWO permissions, and the page is unusable with either alone: the nav gate
// asks for operations:finance:read to open the desk, and the edit controls ask
// for admin:referrals:manage to change anything. The first draft of this file
// granted only the second and got "This account does not have access to that
// page" — while its first assertion still passed, because "Drivers" also
// appears outside the page body. Both granted, and the page body is what is
// asserted against.
const OPEN_THE_DESK = 'operations:finance:read';
const MANAGE = 'admin:referrals:manage';

const programme = (over: Record<string, unknown> = {}) => ({
  id: 'prog-driver',
  refereeType: 'DRIVER',
  referrerRewardAmount: 350,
  refereeRewardAmount: 350,
  holdDays: 7,
  qualificationWindowDays: 90,
  requireKycVerified: false,
  active: false,
  updatedBy: null,
  createdAt: '2026-09-18T11:00:00.000Z',
  updatedAt: '2026-09-18T11:00:00.000Z',
  ...over,
});

async function renderConsole() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="referralprogrammes" />);
}

function pageBody(): HTMLElement {
  const body = document.querySelector('.dx-console-body');
  if (!(body instanceof HTMLElement)) throw new Error('console body not rendered');
  return body;
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [OPEN_THE_DESK, MANAGE];
  referralProgrammes.mockResolvedValue([programme()]);
  updateReferralProgramme.mockResolvedValue(programme({ active: true }));
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('drivers on the referral programmes desk', () => {
  it('labels the row "Drivers", not the raw enum', async () => {
    await renderConsole();
    await waitFor(() => {
      expect(pageBody().textContent).toContain('Drivers');
    });
  });

  it('shows that the programme is not active yet', async () => {
    await renderConsole();
    await waitFor(() => {
      expect(pageBody().textContent).toContain('Drivers');
    });
    // DRIVER ships inactive so Operations prices it first. An operator who
    // cannot see that will report "driver referrals are not paying" as a bug.
    expect(pageBody().textContent).toMatch(/paused|inactive|not active/i);
  });

  it('lets Operations set the amounts — the values are adjustable, not fixed here', async () => {
    await renderConsole();
    await waitFor(() => {
      expect(pageBody().textContent).toContain('Drivers');
    });

    const edit = [...pageBody().querySelectorAll('button')].find((b) =>
      /edit/i.test(b.textContent ?? ''),
    );
    expect(edit).toBeTruthy();
    fireEvent.click(edit as HTMLButtonElement);

    const referrer = await screen.findByLabelText(/Referrer ₦/i);
    const referee = await screen.findByLabelText(/Referee ₦/i);
    fireEvent.change(referrer, { target: { value: '500' } });
    fireEvent.change(referee, { target: { value: '250' } });

    const save = [...pageBody().querySelectorAll('button')].find((b) =>
      /^save/i.test(b.textContent ?? ''),
    );
    fireEvent.click(save as HTMLButtonElement);

    await waitFor(() => {
      expect(updateReferralProgramme).toHaveBeenCalled();
    });
    const [refereeType, body] = updateReferralProgramme.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(refereeType).toBe('DRIVER');
    // The amounts the operator typed, sent as typed. If this desk ever sends a
    // figure the repository chose instead, this is what says so.
    expect(body['referrerRewardAmount']).toBe(500);
    expect(body['refereeRewardAmount']).toBe(250);
  });
});
