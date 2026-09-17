import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DPX-RIDE-201 — the operator ride detail surface, reached from Trips → View.
 *
 * Structure is deliberate: Trips already had the operator workflow AND an
 * unused "View" affordance that echoed back the row you clicked. Ride Detail
 * fills it. No new navigation entry, no visual divergence.
 *
 * The four capabilities are proven read-only at the service layer by
 * apps/backend/src/operations/operations-rides-read-only.spec.ts, which builds
 * each service with a Prisma stub whose write verbs throw and catches an
 * injected rideOffer.create BY NAME. These tests pin the same invariant at the
 * operator surface, because a backend that cannot allocate is not the same
 * guarantee as a console that does not offer to.
 */

const getRideQueue = vi.fn();
const getOperationsRideDetail = vi.fn();
const getOperationsRideAllocation = vi.fn();
const getOperationsRideTracking = vi.fn();
const getOperationsDispatchCandidates = vi.fn();
const cancelRide = vi.fn();
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
      getRideQueue: () => getRideQueue(),
      getOperationsRideDetail: (id: string) => getOperationsRideDetail(id),
      getOperationsRideAllocation: (id: string) => getOperationsRideAllocation(id),
      getOperationsRideTracking: (id: string) => getOperationsRideTracking(id),
      getOperationsDispatchCandidates: (id: string) => getOperationsDispatchCandidates(id),
      cancelRide: (id: string, reason: string) => cancelRide(id, reason),
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

const RIDE_ID = 'ride-aaaabbbb-1111-2222-3333-444455556666';

const queueRide = {
  rideId: RIDE_ID,
  status: 'REQUESTED',
  customerName: 'Ada Customer',
  driverName: null,
  pickupAddress: '1 Pickup Road',
  dropoffAddress: '2 Dropoff Road',
  pickupLatitude: 6.5,
  pickupLongitude: 3.3,
  dropoffLatitude: 6.6,
  dropoffLongitude: 3.4,
  totalFare: 1400,
  requestedAt: '2026-09-17T06:00:00.000Z',
};

const detail = (over: Record<string, unknown> = {}) => ({
  rideId: RIDE_ID,
  status: 'REQUESTED',
  rideType: 'STANDARD',
  customerId: 'cust-1',
  customerName: 'Ada Customer',
  customerPhone: '+2348010000001',
  driverId: null,
  driverName: null,
  driverPhone: null,
  pickupLatitude: 6.5,
  pickupLongitude: 3.3,
  pickupAddress: '1 Pickup Road',
  dropoffLatitude: 6.6,
  dropoffLongitude: 3.4,
  dropoffAddress: '2 Dropoff Road',
  estimatedDistanceMeters: 4200,
  estimatedDurationSeconds: 900,
  baseFare: 500,
  distanceFare: 700,
  timeFare: 200,
  totalFare: 1400,
  promoDiscount: 0,
  paymentMethod: 'DX_WALLET',
  paymentStatus: 'PENDING',
  tipAmount: null,
  requestedAt: '2026-09-17T06:00:00.000Z',
  assignedAt: null,
  arrivedAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  noDriversFound: false,
  hasOpenSos: false,
  createdAt: '2026-09-17T06:00:00.000Z',
  updatedAt: '2026-09-17T06:00:00.000Z',
  ...over,
});

const candidate = (over: Record<string, unknown> = {}) => ({
  driverId: 'driver-1',
  driverName: 'Musa Driver',
  driverPhone: '+2348020000002',
  vehiclePlateNumber: 'LAG-123-XY',
  latitude: 6.5009,
  longitude: 3.3009,
  distanceMeters: 420,
  etaSeconds: 180,
  isEstimate: true,
  averageRating: 4.8,
  ratingCount: 51,
  ...over,
});

async function openRideDetail() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  const view = render(<AdminConsoleScreen initialPage="trips" />);
  await waitFor(() => expect(screen.getByText('View')).toBeTruthy());
  fireEvent.click(screen.getByText('View'));
  return view;
}

function controls(): HTMLElement[] {
  const body = document.querySelector('.dx-console-body');
  if (!(body instanceof HTMLElement)) throw new Error('console body not rendered');
  return [...body.querySelectorAll('button, input, select, textarea, a[href]')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

function controlLabels(): string[] {
  return controls().map((el) =>
    `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`.trim(),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [];
  getRideQueue.mockResolvedValue({ rides: [queueRide] });
  getOperationsRideDetail.mockResolvedValue(detail());
  getOperationsRideAllocation.mockResolvedValue({
    offers: [],
    currentDriverId: null,
    currentDriverName: null,
  });
  getOperationsRideTracking.mockResolvedValue({ points: [] });
  getOperationsDispatchCandidates.mockResolvedValue({ candidates: [candidate()] });
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('Trips → View opens the ride detail, using the row’s own ride id', () => {
  it('asks the server for the id shown in the row, not another identifier', async () => {
    await openRideDetail();
    await waitFor(() => expect(getOperationsRideDetail).toHaveBeenCalledWith(RIDE_ID));
  });

  it('shows the ride overview', async () => {
    await openRideDetail();
    await waitFor(() => expect(screen.getByText('Ada Customer · +2348010000001')).toBeTruthy());
    expect(screen.getByText('Not assigned')).toBeTruthy();
  });

  it('loads only the visible section, not all four at once', async () => {
    // Four endpoints fired for a panel an operator may only glance at is four
    // times the load on a live ride.
    await openRideDetail();
    await waitFor(() => expect(getOperationsRideDetail).toHaveBeenCalled());
    expect(getOperationsRideAllocation).not.toHaveBeenCalled();
    expect(getOperationsRideTracking).not.toHaveBeenCalled();
    expect(getOperationsDispatchCandidates).not.toHaveBeenCalled();
  });

  it('keeps the four contracts distinct — each tab calls its own endpoint', async () => {
    await openRideDetail();
    await waitFor(() => expect(getOperationsRideDetail).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Allocation'));
    await waitFor(() => expect(getOperationsRideAllocation).toHaveBeenCalledWith(RIDE_ID));

    fireEvent.click(screen.getByText('Tracking'));
    await waitFor(() => expect(getOperationsRideTracking).toHaveBeenCalledWith(RIDE_ID));

    fireEvent.click(screen.getByText('Dispatch Candidates'));
    await waitFor(() => expect(getOperationsDispatchCandidates).toHaveBeenCalledWith(RIDE_ID));
  });
});

describe('Empty is not an error, and an error is not empty', () => {
  it('says there are no offers rather than showing a failure', async () => {
    await openRideDetail();
    fireEvent.click(screen.getByText('Allocation'));
    await waitFor(() =>
      expect(screen.getByText(/No offers have been made for this ride yet/)).toBeTruthy(),
    );
    expect(screen.queryByText(/Couldn’t load this section/)).toBeNull();
  });

  it('says there are no tracking points rather than showing a failure', async () => {
    await openRideDetail();
    fireEvent.click(screen.getByText('Tracking'));
    await waitFor(() =>
      expect(screen.getByText(/No tracking points recorded for this ride/)).toBeTruthy(),
    );
  });

  it('says there are no candidates in range rather than showing a failure', async () => {
    getOperationsDispatchCandidates.mockResolvedValue({ candidates: [] });
    await openRideDetail();
    fireEvent.click(screen.getByText('Dispatch Candidates'));
    await waitFor(() => expect(screen.getByText(/No available drivers within range/)).toBeTruthy());
  });

  it('a failed section says so, and never claims there were none', async () => {
    getOperationsRideAllocation.mockRejectedValue(new Error('Network request failed'));
    await openRideDetail();
    fireEvent.click(screen.getByText('Allocation'));
    await waitFor(() => expect(screen.getByText(/Couldn’t load this section/)).toBeTruthy());
    expect(screen.getByText(/not the same as there being none/)).toBeTruthy();
    expect(screen.queryByText(/No offers have been made/)).toBeNull();
  });

  it('distinguishes a missing ride from a failed request', async () => {
    getOperationsRideDetail.mockRejectedValue(
      Object.assign(new Error('Ride not found'), { status: 404 }),
    );
    await openRideDetail();
    await waitFor(() => expect(screen.getByText(/Ride not found/)).toBeTruthy());
    expect(screen.queryByText(/Couldn’t load this section/)).toBeNull();
  });
});

describe('One failing section does not take down the Trips page', () => {
  it('leaves the queue table and its controls intact', async () => {
    getOperationsRideDetail.mockRejectedValue(new Error('Network request failed'));
    await openRideDetail();
    await waitFor(() => expect(screen.getByText(/Couldn’t load this section/)).toBeTruthy());

    // The row, its Cancel action and the other tabs are all still there.
    expect(screen.getByText('Ada Customer')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Allocation')).toBeTruthy();
  });
});

describe('Dispatch candidates are decision support, not an allocation control', () => {
  it('shows the candidate with distance and a STRAIGHT-LINE estimate', async () => {
    await openRideDetail();
    fireEvent.click(screen.getByText('Dispatch Candidates'));
    await waitFor(() => expect(screen.getByText(/Musa Driver · LAG-123-XY/)).toBeTruthy());
    // isEstimate is always true in the contract precisely so a console cannot
    // imply a routed, traffic-aware duration. Say "straight-line" or nothing.
    expect(screen.getByText(/straight-line estimate/)).toBeTruthy();
  });

  it('says on screen that reading it assigns nobody', async () => {
    await openRideDetail();
    fireEvent.click(screen.getByText('Dispatch Candidates'));
    await waitFor(() => expect(screen.getByText(/Decision support only/)).toBeTruthy());
  });

  it('offers no assign, allocate, reassign, offer or dispatch control', async () => {
    await openRideDetail();
    fireEvent.click(screen.getByText('Dispatch Candidates'));
    await waitFor(() => expect(screen.getByText(/Musa Driver/)).toBeTruthy());

    const forbidden = /\b(assign|allocate|reassign|offer|dispatch to|send|push)\b/i;
    // "Dispatch Candidates" is the tab's own name; the check is on ACTIONS.
    const offending = controlLabels().filter(
      (l) => forbidden.test(l) && l !== 'Dispatch Candidates',
    );
    expect(offending).toEqual([]);
  });

  it('does not grow a control just because the payload suggests one', async () => {
    // The founder's check: the backend being read-only is not the same
    // guarantee as the console declining to offer an action. If a future
    // payload carried something that looked actionable, the surface must stay
    // informational rather than rendering it.
    getOperationsDispatchCandidates.mockResolvedValue({
      candidates: [
        candidate({
          canAssign: true,
          assignUrl: '/operations/rides/x/assign',
          actions: [{ label: 'Assign', href: '/assign' }],
        }),
      ],
    });
    await openRideDetail();
    fireEvent.click(screen.getByText('Dispatch Candidates'));
    await waitFor(() => expect(screen.getByText(/Musa Driver/)).toBeTruthy());

    const forbidden = /\b(assign|allocate|reassign|offer)\b/i;
    expect(controlLabels().filter((l) => forbidden.test(l))).toEqual([]);
    expect(screen.queryByText('Assign')).toBeNull();
  });
});

describe('The panel adds no action of its own', () => {
  it('offers only navigation — tabs and Close', async () => {
    await openRideDetail();
    await waitFor(() => expect(screen.getByText('Detail')).toBeTruthy());

    // Everything the panel itself renders, minus what the Trips page already
    // had. Cancel stays on the row, untouched by this port.
    for (const label of ['Detail', 'Allocation', 'Tracking', 'Dispatch Candidates', 'Close']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const panelActions = controlLabels().filter((l) =>
      /\b(save|update|edit|assign|allocate|resolve|retry|delete|create)\b/i.test(l),
    );
    expect(panelActions).toEqual([]);
  });

  it('closes without touching the queue', async () => {
    await openRideDetail();
    await waitFor(() => expect(screen.getByText('Detail')).toBeTruthy());
    fireEvent.click(screen.getByText('Close'));
    await waitFor(() => expect(screen.queryByText('Detail')).toBeNull());
    expect(screen.getByText('Ada Customer')).toBeTruthy();
  });

  it('leaves the existing Cancel action alone', async () => {
    await openRideDetail();
    await waitFor(() => expect(screen.getByText('Detail')).toBeTruthy());
    // Opening the panel must not have fired a cancellation or changed it.
    expect(cancelRide).not.toHaveBeenCalled();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});
