import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Assigning an operations case in the Operations Console.
 *
 * ops.dripplex.com already showed `Assigned: <name> | Unassigned` on a case and
 * offered no way to change it; the control lived only in
 * apps/operations-console. Ported here on the founder ruling of 2026-09-16,
 * rendered in this console's language rather than the standalone's.
 *
 * The server contract is pinned by
 * apps/backend/src/operations/operations-staff-assignment-surface.spec.ts.
 * Four of its findings are guarantees this SCREEN carries, and each has a test
 * here that fails if the screen stops carrying it:
 *
 *  1. TWO PERMISSIONS. The pool is readable with operations:queues:read; the
 *     PATCH that assigns needs operations:queues:manage. A read-only account
 *     gets told who holds the case, not a button that can only 403.
 *
 *  2. THE ROLE IS ALWAYS SENT. Omitting assignedToRole makes the server record
 *     a supervisor as an operator — silently, in the row and the timeline.
 *
 *  3. THE SERVER DOES NOT VALIDATE THE ASSIGNEE. assignedToId is @IsUUID() and
 *     nothing more. This select is the only guard that exists, so it must stay
 *     a select over the pool.
 *
 *  4. UNASSIGNING DOES NOT REVERT THE STATUS. A case that went NEW → ASSIGNED
 *     stays ASSIGNED once unassigned: visibly handled, with nobody on it. The
 *     screen says so rather than inventing a second call to walk it back.
 */

const getOperationsStaff = vi.fn();
const getIncidentQueue = vi.fn();
const getSosQueue = vi.fn();
const updateCase = vi.fn();
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
      getOperationsStaff: () => getOperationsStaff(),
      getIncidentQueue: () => getIncidentQueue(),
      getSosQueue: () => getSosQueue(),
      updateCase: (id: string, body: unknown) => updateCase(id, body),
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

const READ = 'operations:queues:read';
const MANAGE = 'operations:queues:manage';

function kase(over: Record<string, unknown> = {}) {
  return {
    caseId: 'case-1',
    caseType: 'INCIDENT',
    sourceId: 'inc-1',
    status: 'NEW',
    priority: 'HIGH',
    version: 3,
    assignedToId: null,
    assignedToName: null,
    assignedToRole: null,
    driverId: 'd-1',
    driverName: 'Musa Bello',
    driverPhone: '+2348010000000',
    customerName: null,
    rideId: null,
    vehicleId: null,
    latitude: null,
    longitude: null,
    category: 'ACCIDENT',
    description: 'Minor collision reported.',
    createdAt: '2026-09-17T08:00:00.000Z',
    updatedAt: '2026-09-17T08:00:00.000Z',
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    ...over,
  };
}

const POOL = [
  { id: 'u-op', firstName: 'Ada', lastName: 'Okafor', role: 'OPERATOR' },
  { id: 'u-sup', firstName: 'Bayo', lastName: 'Ade', role: 'SUPERVISOR' },
];

async function renderPage() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="incidents" />);
}

/** The Assignment card, so a query cannot drift onto the page's other cards. */
function panel(): HTMLElement {
  const heading = screen.getByText('Assignment');
  const card = heading.closest('div')?.parentElement;
  if (!(card instanceof HTMLElement)) throw new Error('assignment panel not rendered');
  return card;
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [READ, MANAGE];
  getOperationsStaff.mockResolvedValue(POOL);
  getIncidentQueue.mockResolvedValue({ items: [kase()], summary: {} });
  getSosQueue.mockResolvedValue({ items: [], summary: {} });
  updateCase.mockResolvedValue(kase({ version: 4 }));
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('Case assignment — the control exists at all', () => {
  it('offers the operations staff the platform returned', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());

    expect(within(panel()).getByText('Ada Okafor · Operator')).toBeTruthy();
    expect(within(panel()).getByText('Bayo Ade · Supervisor')).toBeTruthy();
  });

  it('reads the pool from the real endpoint', async () => {
    await renderPage();
    await waitFor(() => expect(getOperationsStaff).toHaveBeenCalled());
  });

  it('shows who holds the case when somebody does', async () => {
    getIncidentQueue.mockResolvedValue({
      items: [
        kase({
          status: 'ASSIGNED',
          assignedToId: 'u-sup',
          assignedToName: 'Bayo Ade',
          assignedToRole: 'SUPERVISOR',
        }),
      ],
      summary: {},
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Bayo Ade · supervisor')).toBeTruthy());
  });
});

describe('Case assignment — the assignee comes from the pool, and carries their role', () => {
  it('SENDS THE ROLE with the id, so a supervisor is not recorded as an operator', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'u-sup' } });
    fireEvent.click(within(panel()).getByText('Assign'));

    await waitFor(() => expect(updateCase).toHaveBeenCalled());
    expect(updateCase).toHaveBeenCalledWith('case-1', {
      version: 3,
      assignedToId: 'u-sup',
      assignedToRole: 'SUPERVISOR',
    });
  });

  it('sends the operator role for an operator, not a blanket default', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'u-op' } });
    fireEvent.click(within(panel()).getByText('Assign'));

    await waitFor(() => expect(updateCase).toHaveBeenCalled());
    expect(updateCase.mock.calls[0]?.[1]).toMatchObject({ assignedToRole: 'OPERATOR' });
  });

  it('sends the version it read, so a stale action loses the race instead of overwriting', async () => {
    getIncidentQueue.mockResolvedValue({ items: [kase({ version: 11 })], summary: {} });
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'u-op' } });
    fireEvent.click(within(panel()).getByText('Assign'));

    await waitFor(() => expect(updateCase).toHaveBeenCalled());
    expect(updateCase.mock.calls[0]?.[1]).toMatchObject({ version: 11 });
  });

  it('IS A SELECT OVER THE POOL, never a free-text id field', async () => {
    // The server accepts any well-formed UUID as an assignee — a customer's,
    // a deactivated operator's, one belonging to nobody. This control is the
    // only guard that exists.
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());

    const control = screen.getByLabelText('Assign to');
    expect(control.tagName).toBe('SELECT');
    const values = [...(control as HTMLSelectElement).options].map((o) => o.value);
    // The empty prompt plus exactly the pool — nothing else is offerable.
    expect(values).toEqual(['', 'u-op', 'u-sup']);
  });

  it('will not assign until somebody is chosen', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());

    const assign = within(panel()).getByText('Assign').closest('button');
    expect((assign as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'u-op' } });
    expect((assign as HTMLButtonElement).disabled).toBe(false);
  });

  it('re-reads the queue afterwards, because the case version has moved on', async () => {
    await renderPage();
    await waitFor(() => expect(getIncidentQueue).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'u-op' } });
    fireEvent.click(within(panel()).getByText('Assign'));

    await waitFor(() => expect(getIncidentQueue).toHaveBeenCalledTimes(2));
  });
});

describe('Case assignment — unassigning', () => {
  function assignedCase(status: string) {
    getIncidentQueue.mockResolvedValue({
      items: [
        kase({
          status,
          assignedToId: 'u-op',
          assignedToName: 'Ada Okafor',
          assignedToRole: 'OPERATOR',
        }),
      ],
      summary: {},
    });
  }

  it('clears the assignee with a null, not with an empty string', async () => {
    assignedCase('ASSIGNED');
    await renderPage();
    await waitFor(() => expect(screen.getByText('Unassign')).toBeTruthy());

    fireEvent.click(screen.getByText('Unassign'));

    await waitFor(() => expect(updateCase).toHaveBeenCalled());
    expect(updateCase).toHaveBeenCalledWith('case-1', { version: 3, assignedToId: null });
  });

  it('SAYS THE CASE KEEPS THE STATUS assigning gave it', async () => {
    // The consequence the server does not handle: ASSIGNED with nobody on it
    // looks handled in every queue that sorts by status.
    assignedCase('ASSIGNED');
    await renderPage();
    await waitFor(() => expect(screen.getByText('Unassign')).toBeTruthy());

    fireEvent.click(screen.getByText('Unassign'));

    await waitFor(() => expect(screen.getByText(/stays Assigned with nobody on it/)).toBeTruthy());
  });

  it('does not warn about a status a case never left', async () => {
    // A case still in NEW was never advanced by an assignment, so there is
    // nothing to leave behind and nothing to warn about. A warning that fires
    // every time is a warning nobody reads.
    assignedCase('NEW');
    await renderPage();
    await waitFor(() => expect(screen.getByText('Unassign')).toBeTruthy());

    fireEvent.click(screen.getByText('Unassign'));

    await waitFor(() => expect(within(panel()).getByText('Unassigned.')).toBeTruthy());
    expect(screen.queryByText(/with nobody on it/)).toBeNull();
  });

  it('offers no Unassign on a case nobody holds', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());
    expect(screen.queryByText('Unassign')).toBeNull();
  });
});

describe('Case assignment — permission, failure and pool states', () => {
  it('offers no control to an account that can see the pool but not assign', async () => {
    permissions = [READ];
    await renderPage();
    await waitFor(() => expect(screen.getByText('Assignment')).toBeTruthy());

    expect(screen.queryByLabelText('Assign to')).toBeNull();
    expect(within(panel()).queryByText('Assign')).toBeNull();
    expect(screen.getByText(/needs the operations queue-manage permission/)).toBeTruthy();
  });

  it('still tells a read-only account who holds the case', async () => {
    permissions = [READ];
    getIncidentQueue.mockResolvedValue({
      items: [
        kase({
          status: 'ASSIGNED',
          assignedToId: 'u-op',
          assignedToName: 'Ada Okafor',
          assignedToRole: 'OPERATOR',
        }),
      ],
      summary: {},
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('Ada Okafor · operator')).toBeTruthy());
  });

  it('distinguishes a failed pool read from there being nobody to assign', async () => {
    getOperationsStaff.mockRejectedValue(new Error('Network request failed'));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/not the same as there being nobody to assign/)).toBeTruthy(),
    );
    expect(screen.queryByLabelText('Assign to')).toBeNull();
  });

  it('says plainly when nobody holds the permission to be assigned work', async () => {
    getOperationsStaff.mockResolvedValue([]);
    await renderPage();
    await waitFor(() => expect(screen.getByText(/nobody to assign this to/)).toBeTruthy());
  });

  it('reports a lost version race as somebody else having got there first', async () => {
    updateCase.mockRejectedValue(new Error('Conflict: this case was updated by someone else'));
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'u-op' } });
    fireEvent.click(within(panel()).getByText('Assign'));

    await waitFor(() =>
      expect(screen.getByText(/Someone else changed this case first/)).toBeTruthy(),
    );
  });

  it('surfaces any other failure instead of implying the assignment landed', async () => {
    updateCase.mockRejectedValue(new Error('Insufficient permissions'));
    await renderPage();
    await waitFor(() => expect(screen.getByLabelText('Assign to')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'u-op' } });
    fireEvent.click(within(panel()).getByText('Assign'));

    await waitFor(() => expect(within(panel()).getByText('Insufficient permissions')).toBeTruthy());
  });
});
