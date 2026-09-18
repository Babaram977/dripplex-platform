import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Inspection Centres in the Operations Console.
 *
 * Ported out of apps/operations-console on the founder ruling of 2026-09-16
 * (ops.dripplex.com is the one operator surface). The server contract this
 * renders is pinned by
 * apps/backend/src/drivers/inspection-centres-surface.spec.ts; these tests pin
 * what the SCREEN has to keep true, so a later restyle cannot quietly cost it:
 *
 *  - THERE IS NO DELETE, and this page must never grow one. Inspections point
 *    at centre records; removing one erases where a vehicle was actually
 *    inspected. A centre is retired by being switched off. Asserted against the
 *    page's interactive elements, not its prose.
 *
 *  - SWITCHING A CENTRE OFF DOES NOT CASCADE. The active check runs only when
 *    an inspection is BOOKED, so inspections already scheduled at a centre keep
 *    pointing at it. That is plausibly intended — a centre winding down
 *    honouring its appointments — so the operator is TOLD, not protected by a
 *    cascade this console would have had to invent.
 *
 *  - AN ERROR IS NOT AN EMPTY LIST. "No centres exist" and "we could not ask"
 *    are different facts, and the second must never render as the first: an
 *    operator who reads "no centres yet" goes and creates a duplicate.
 *
 *  - ADDRESS IS OPTIONAL and blank means ABSENT, not empty. The server's own
 *    reason: a placeholder street line would read to a driver as a real one.
 *    Sending '' would also be a 400 on @MinLength(5).
 */

const getInspectionCentres = vi.fn();
const createInspectionCentre = vi.fn();
const updateInspectionCentre = vi.fn();
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
      getInspectionCentres: () => getInspectionCentres(),
      createInspectionCentre: (body: unknown) => createInspectionCentre(body),
      updateInspectionCentre: (id: string, body: unknown) => updateInspectionCentre(id, body),
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

const MANAGE = 'admin:inspection-centres:manage';

function centre(over: Record<string, unknown> = {}) {
  return {
    id: 'c-1',
    name: 'Ikeja Vehicle Testing',
    address: '12 Allen Avenue',
    city: 'Lagos',
    latitude: null,
    longitude: null,
    isActive: true,
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
  };
}

async function renderPage() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="inspectioncentres" />);
}

function pageBody(): HTMLElement {
  const body = document.querySelector('.dx-console-body');
  if (!(body instanceof HTMLElement)) throw new Error('console body not rendered');
  return body;
}

function controls(): HTMLElement[] {
  return [...pageBody().querySelectorAll('button, input, select, textarea, a[href]')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [MANAGE];
  getInspectionCentres.mockResolvedValue([centre()]);
  createInspectionCentre.mockResolvedValue(centre({ id: 'c-2' }));
  updateInspectionCentre.mockResolvedValue(centre({ isActive: false }));
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('Inspection Centres — what the operator can see', () => {
  it('lists the centres the platform actually returned', async () => {
    getInspectionCentres.mockResolvedValue([
      centre(),
      centre({ id: 'c-2', name: 'Abuja Testing Station', city: 'Abuja', isActive: false }),
    ]);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ikeja Vehicle Testing')).toBeTruthy());
    expect(screen.getByText('Abuja Testing Station')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('Closed')).toBeTruthy();
  });

  it('shows the city alone when a centre has no published street address', async () => {
    getInspectionCentres.mockResolvedValue([centre({ address: null, city: 'Kano' })]);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Kano')).toBeTruthy());
    // Not "null, Kano", and not a leading comma either.
    expect(screen.queryByText(/^,/)).toBeNull();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('says plainly that drivers cannot book when there are none', async () => {
    getInspectionCentres.mockResolvedValue([]);
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Drivers cannot book an inspection until one exists/)).toBeTruthy(),
    );
  });
});

describe('Inspection Centres — a failed read is never an empty list', () => {
  it('distinguishes "could not ask" from "there are none"', async () => {
    getInspectionCentres.mockRejectedValue(new Error('Network request failed'));
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Couldn’t load inspection centres/)).toBeTruthy());
    expect(screen.getByText(/not the same as there being none/)).toBeTruthy();
    // The empty-state sentence would send the operator off to create a
    // duplicate of a centre that already exists.
    expect(screen.queryByText(/Drivers cannot book an inspection until one exists/)).toBeNull();
  });

  it('surfaces the underlying failure rather than swallowing it', async () => {
    getInspectionCentres.mockRejectedValue(new Error('Session expired'));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Session expired')).toBeTruthy());
  });
});

describe('Inspection Centres — creating one', () => {
  it('will not submit without a name and a city', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ikeja Vehicle Testing')).toBeTruthy());

    const add = screen.getByText('Add centre').closest('button');
    expect(add).toBeTruthy();
    expect((add as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Centre name'), { target: { value: 'Yaba Centre' } });
    expect((add as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Lagos' } });
    expect((add as HTMLButtonElement).disabled).toBe(false);
  });

  it('OMITS the address entirely when it is left blank, rather than sending an empty one', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ikeja Vehicle Testing')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Centre name'), { target: { value: 'Yaba Centre' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Lagos' } });
    fireEvent.click(screen.getByText('Add centre'));

    await waitFor(() => expect(createInspectionCentre).toHaveBeenCalled());
    const body = createInspectionCentre.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).toEqual({ name: 'Yaba Centre', city: 'Lagos' });
    expect('address' in body).toBe(false);
  });

  it('sends a trimmed address when one is given', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ikeja Vehicle Testing')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Centre name'), { target: { value: '  Yaba Centre ' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: ' Lagos ' } });
    fireEvent.change(screen.getByLabelText('Street address'), {
      target: { value: '  7 Herbert Macaulay Way ' },
    });
    fireEvent.click(screen.getByText('Add centre'));

    await waitFor(() => expect(createInspectionCentre).toHaveBeenCalled());
    expect(createInspectionCentre.mock.calls[0]?.[0]).toEqual({
      name: 'Yaba Centre',
      city: 'Lagos',
      address: '7 Herbert Macaulay Way',
    });
  });

  it('re-reads the list after creating, rather than trusting its own optimistic guess', async () => {
    await renderPage();
    await waitFor(() => expect(getInspectionCentres).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Centre name'), { target: { value: 'Yaba Centre' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Lagos' } });
    fireEvent.click(screen.getByText('Add centre'));

    await waitFor(() => expect(getInspectionCentres).toHaveBeenCalledTimes(2));
  });

  it('reports a rejected create instead of implying it worked', async () => {
    createInspectionCentre.mockRejectedValue(new Error('A centre with that name already exists'));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ikeja Vehicle Testing')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Centre name'), { target: { value: 'Yaba Centre' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Lagos' } });
    fireEvent.click(screen.getByText('Add centre'));

    await waitFor(() =>
      expect(screen.getByText('A centre with that name already exists')).toBeTruthy(),
    );
  });
});

describe('Inspection Centres — retiring one', () => {
  it('closes a centre through isActive, never through a delete', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ikeja Vehicle Testing')).toBeTruthy());

    fireEvent.click(screen.getByText('Close to bookings'));

    await waitFor(() => expect(updateInspectionCentre).toHaveBeenCalled());
    expect(updateInspectionCentre).toHaveBeenCalledWith('c-1', { isActive: false });
  });

  it('TELLS THE OPERATOR that closing a centre leaves booked inspections where they are', async () => {
    // The consequence the server does not handle. An operator who thinks
    // closing a centre moves its appointments will find out from a driver.
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ikeja Vehicle Testing')).toBeTruthy());

    fireEvent.click(screen.getByText('Close to bookings'));

    await waitFor(() =>
      expect(screen.getByText(/Inspections already booked there are unchanged/)).toBeTruthy(),
    );
  });

  it('reopens a closed centre', async () => {
    getInspectionCentres.mockResolvedValue([centre({ isActive: false })]);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Reopen')).toBeTruthy());

    fireEvent.click(screen.getByText('Reopen'));

    await waitFor(() => expect(updateInspectionCentre).toHaveBeenCalled());
    expect(updateInspectionCentre).toHaveBeenCalledWith('c-1', { isActive: true });
  });

  it('OFFERS NO DELETE — checked against the controls, not the prose', async () => {
    // One open, one closed — a delete, if one existed, would most plausibly
    // be offered on the one already retired.
    getInspectionCentres.mockResolvedValue([
      centre(),
      centre({ id: 'c-2', name: 'Abuja Testing Station', isActive: false }),
    ]);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Abuja Testing Station')).toBeTruthy());

    const labels = controls().map((el) => (el.textContent ?? '').toLowerCase());
    for (const label of labels) {
      expect(label).not.toMatch(/delete|remove|destroy|archive/);
    }
  });

  it('reports a rejected close instead of showing the centre as closed', async () => {
    updateInspectionCentre.mockRejectedValue(new Error('Insufficient permissions'));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ikeja Vehicle Testing')).toBeTruthy());

    fireEvent.click(screen.getByText('Close to bookings'));

    await waitFor(() => expect(screen.getByText('Insufficient permissions')).toBeTruthy());
    // The row still reads Open, because it still is.
    expect(screen.getByText('Open')).toBeTruthy();
  });
});

describe('Inspection Centres — the nav entry', () => {
  it('is hidden from an account without the manage permission, because listing needs it too', async () => {
    // There is no read-only tier on the server: GET /admin/inspection-centres
    // is behind the same admin:inspection-centres:manage as the writes. A menu
    // entry whose only possible answer for this account is 403 is worse than
    // no entry.
    permissions = ['operations:queues:read'];
    await renderPage();
    await waitFor(() =>
      expect(document.querySelectorAll('.dx-nav-item').length).toBeGreaterThan(0),
    );

    // Scoped to the NAV. The page's own heading says "Inspection Centres" too,
    // and this suite reaches the page directly via initialPage — asserting on
    // the whole document would be asserting that the page does not render,
    // which is not what is being claimed.
    const navLabels = [...document.querySelectorAll('.dx-nav-item')].map((el) => el.textContent);
    expect(navLabels.some((l) => l?.includes('Inspection Centres'))).toBe(false);
    // The control: an entry this account CAN see is still there, so a nav that
    // simply failed to render could not pass this test.
    expect(navLabels.length).toBeGreaterThan(0);
  });
});
