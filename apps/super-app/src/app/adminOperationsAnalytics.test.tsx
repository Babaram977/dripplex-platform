import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { isUsableAnalyticsRange } from './adminConsoleScreen';

/**
 * DPX-OPS analytics — the six operator drill-downs.
 *
 * The service layer is proven read-only by
 * apps/backend/src/operations/operations-analytics-read-only.spec.ts. These
 * pin the operator surface:
 *
 *  - RANGE IS A PRECONDITION, not decoration. `from`/`to` are required
 *    @IsDateString server-side, so no valid range must mean ZERO network
 *    calls, and a valid range must be sent EXACTLY as shown. The regression
 *    worth catching is a picker that displays one period while quietly
 *    querying another.
 *  - LOAD ON OPEN. Six aggregate scans fired because a screen mounted is six
 *    answers nobody asked for.
 *  - CHANGING THE RANGE DISCARDS loaded data — stale numbers under a new
 *    period answer a question the operator stopped asking.
 *  - ISOLATED STATE. One failing drill-down must not take the other five down.
 *  - cellSizeDegrees belongs to geography alone and must not leak.
 *  - NO MUTATION AFFORDANCES, including ones manufactured from response
 *    metadata.
 */

const calls: Record<string, ReturnType<typeof vi.fn>> = {
  getAnalyticsDriverUtilization: vi.fn(),
  getAnalyticsShifts: vi.fn(),
  getAnalyticsRides: vi.fn(),
  getAnalyticsDispatch: vi.fn(),
  getAnalyticsResponse: vi.fn(),
  getAnalyticsGeography: vi.fn(),
};
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
      getAnalyticsDriverUtilization: (r: unknown) => calls['getAnalyticsDriverUtilization']?.(r),
      getAnalyticsShifts: (r: unknown) => calls['getAnalyticsShifts']?.(r),
      getAnalyticsRides: (r: unknown) => calls['getAnalyticsRides']?.(r),
      getAnalyticsDispatch: (r: unknown) => calls['getAnalyticsDispatch']?.(r),
      getAnalyticsResponse: (r: unknown) => calls['getAnalyticsResponse']?.(r),
      getAnalyticsGeography: (r: unknown, c?: number) => calls['getAnalyticsGeography']?.(r, c),
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

const RANGE = { from: '2026-09-01', to: '2026-09-17' };

const utilisation = {
  range: { from: RANGE.from, to: RANGE.to },
  driverCount: 12,
  totalOnlineSeconds: 36000,
  totalOnTripSeconds: 18000,
  averageUtilizationRate: 0.5,
  totalTripsCompleted: 88,
  totalEarnings: 450000,
  topDrivers: [
    {
      driverId: 'd1',
      driverName: 'Musa Driver',
      tripsCompleted: 20,
      earnings: 90000,
      onlineSeconds: 7200,
      onTripSeconds: 3600,
      utilizationRate: 0.5,
    },
  ],
};

const geography = {
  range: { from: RANGE.from, to: RANGE.to },
  cellSizeDegrees: 0.01,
  cells: [{ latitude: 6.5, longitude: 3.3, pickupCount: 40, dropoffCount: 31 }],
  totalPickups: 40,
  totalDropoffs: 31,
};

async function renderAnalytics() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  const view = render(<AdminConsoleScreen initialPage="analytics" />);
  await waitFor(() => expect(screen.getByText('Operations analytics')).toBeTruthy());
  return view;
}

function setRange() {
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: RANGE.from } });
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: RANGE.to } });
}

function totalCalls(): number {
  return Object.values(calls).reduce((n, fn) => n + fn.mock.calls.length, 0);
}

function controls(): HTMLElement[] {
  const body = document.querySelector('.dx-console-body');
  if (!(body instanceof HTMLElement)) throw new Error('console body not rendered');
  return [...body.querySelectorAll('button, input, select, textarea, a[href]')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [];
  calls['getAnalyticsDriverUtilization']?.mockResolvedValue(utilisation);
  calls['getAnalyticsShifts']?.mockResolvedValue({
    range: RANGE,
    shiftsStarted: 3,
    shiftsEnded: 2,
    activeShiftsNow: 1,
    onBreakShiftsNow: 0,
    forceEndedCount: 0,
    averageShiftDurationSeconds: 7200,
    averageBreakSeconds: 600,
    breakReminderCount: 0,
    fatigueWarningCount: 0,
    dailyLimitNotifiedCount: 0,
  });
  calls['getAnalyticsRides']?.mockResolvedValue({
    range: RANGE,
    requested: 100,
    completed: 80,
    cancelled: 15,
    noDriversFound: 5,
    completionRate: 0.8,
    cancellationRate: 0.15,
    noDriversFoundRate: 0.05,
    cancelledByCustomer: 10,
    cancelledByDriver: 5,
  });
  calls['getAnalyticsDispatch']?.mockResolvedValue({
    range: RANGE,
    totalOffers: 200,
    acceptedOffers: 150,
    declinedOffers: 30,
    expiredOffers: 20,
    acceptanceRate: 0.75,
    averageTimeToAcceptSeconds: 12,
    ridesWithOffers: 90,
    ridesNeedingRepeatedOffers: 10,
    repeatedOfferRate: 0.11,
    averageOffersPerRide: 2.2,
  });
  calls['getAnalyticsResponse']?.mockResolvedValue({
    range: RANGE,
    totalCases: 9,
    byType: [
      {
        caseType: 'INCIDENT',
        totalCases: 9,
        averageTimeToFirstResponseSeconds: 60,
        averageTimeToResolutionSeconds: 3600,
        averageTimeToClosureSeconds: 7200,
      },
    ],
    averageTimeToFirstResponseSeconds: 60,
    averageTimeToResolutionSeconds: 3600,
    averageTimeToClosureSeconds: 7200,
    openCasesCount: 2,
  });
  calls['getAnalyticsGeography']?.mockResolvedValue(geography);
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('isUsableAnalyticsRange', () => {
  it('refuses an empty end', () => {
    expect(isUsableAnalyticsRange('2026-09-01', '')).toBe(false);
  });
  it('refuses an unparseable date', () => {
    expect(isUsableAnalyticsRange('not-a-date', '2026-09-17')).toBe(false);
  });
  it('refuses an end before the start', () => {
    expect(isUsableAnalyticsRange('2026-09-17', '2026-09-01')).toBe(false);
  });
  it('accepts a single-day range', () => {
    expect(isUsableAnalyticsRange('2026-09-17', '2026-09-17')).toBe(true);
  });
});

describe('The range is a precondition, not decoration', () => {
  it('makes ZERO analytics requests without a valid range', async () => {
    await renderAnalytics();
    // Mounting the screen must not query anything: from/to are required
    // server-side and there is no defensible default period.
    expect(totalCalls()).toBe(0);
  });

  it('still makes zero requests when a panel is clicked with no range', async () => {
    await renderAnalytics();
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() =>
      expect(screen.getByText(/Choose both a start and an end date/)).toBeTruthy(),
    );
    expect(totalCalls()).toBe(0);
  });

  it('makes zero requests when the end precedes the start', async () => {
    await renderAnalytics();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-09-17' } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-09-01' } });
    await waitFor(() => expect(screen.getByText(/end date is before the start date/)).toBeTruthy());
    fireEvent.click(screen.getByText('Driver utilisation'));
    expect(totalCalls()).toBe(0);
  });

  it('sends EXACTLY the range shown, never a substituted default', async () => {
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(calls['getAnalyticsDriverUtilization']).toHaveBeenCalled());
    // The regression this exists for: a picker showing one period while the
    // request carries another.
    expect(calls['getAnalyticsDriverUtilization']).toHaveBeenCalledWith({
      from: RANGE.from,
      to: RANGE.to,
    });
  });
});

describe('Load on open, not on mount', () => {
  it('queries nothing until a panel is opened, even with a valid range', async () => {
    await renderAnalytics();
    setRange();
    expect(totalCalls()).toBe(0);
  });

  it('opening one panel queries only that panel', async () => {
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Dispatch performance'));
    await waitFor(() => expect(calls['getAnalyticsDispatch']).toHaveBeenCalledTimes(1));
    expect(totalCalls()).toBe(1);
  });

  it('each panel calls its own endpoint', async () => {
    await renderAnalytics();
    setRange();
    for (const [label, key] of [
      ['Driver utilisation', 'getAnalyticsDriverUtilization'],
      ['Shifts', 'getAnalyticsShifts'],
      ['Ride operations', 'getAnalyticsRides'],
      ['Operations response', 'getAnalyticsResponse'],
      ['Geographic demand', 'getAnalyticsGeography'],
    ] as const) {
      fireEvent.click(screen.getByText(label));
      await waitFor(() => expect(calls[key]).toHaveBeenCalled());
    }
  });
});

describe('Changing the range discards what was loaded', () => {
  it('never shows the previous period’s numbers under a new range', async () => {
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(screen.getByText('Musa Driver')).toBeTruthy());

    // A DIFFERENT answer for the new period, so staleness would be visible.
    // With an identical fixture this test could not tell a refetch from a
    // stale render, and would pass either way.
    calls['getAnalyticsDriverUtilization']?.mockResolvedValue({
      ...utilisation,
      topDrivers: [{ ...utilisation.topDrivers[0], driverId: 'd2', driverName: 'Chidi Driver' }],
    });

    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-09-10' } });

    await waitFor(() => expect(screen.getByText('Chidi Driver')).toBeTruthy());
    expect(screen.queryByText('Musa Driver')).toBeNull();
    expect(calls['getAnalyticsDriverUtilization']).toHaveBeenCalledWith({
      from: RANGE.from,
      to: '2026-09-10',
    });
  });

  it('drops the numbers when the range becomes INVALID, not just when it changes', async () => {
    // The case resetAll() actually protects, found because a mutation deleting
    // resetAll() reddened nothing and the first replacement test was wrong
    // about why. Reopening is safe on its own — run() sets `loading`
    // synchronously before its first await, so there is no stale window there.
    //
    // What is NOT safe: changing the range to one that cannot be queried.
    // loadPanel returns early, so nothing overwrites the panel, and without
    // resetAll the previous period's numbers stay on screen underneath a
    // "choose both dates" warning — numbers for a range the operator has
    // just abandoned.
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(screen.getByText('Musa Driver')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '' } });

    await waitFor(() =>
      expect(screen.getByText(/Choose both a start and an end date/)).toBeTruthy(),
    );
    expect(screen.queryByText('Musa Driver')).toBeNull();
    // And nothing was asked for, because the range is unusable.
    expect(calls['getAnalyticsDriverUtilization']).toHaveBeenCalledTimes(1);
  });

  it('resets a CLOSED panel too, so reopening refetches instead of showing stale', async () => {
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(screen.getByText('Musa Driver')).toBeTruthy());
    // Close it, then move the range while it is shut.
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(screen.queryByText('Musa Driver')).toBeNull());

    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-09-10' } });
    expect(calls['getAnalyticsDriverUtilization']).toHaveBeenCalledTimes(1);

    // Reopening asks again, for the NEW range — it does not re-render what it
    // had from the old one.
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(calls['getAnalyticsDriverUtilization']).toHaveBeenCalledTimes(2));
    expect(calls['getAnalyticsDriverUtilization']).toHaveBeenLastCalledWith({
      from: RANGE.from,
      to: '2026-09-10',
    });
  });

  it('a preset fills the visible fields and re-asks the open panel with them', async () => {
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(calls['getAnalyticsDriverUtilization']).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Last 7 days'));

    // Re-asked automatically — discarding alone left the panel open, idle and
    // untoggleable without closing it first.
    await waitFor(() => expect(calls['getAnalyticsDriverUtilization']).toHaveBeenCalledTimes(2));

    const from = screen.getByLabelText('From date') as HTMLInputElement;
    const to = screen.getByLabelText('To date') as HTMLInputElement;
    expect(from.value).not.toBe('');

    // The second request must carry what the picker now SHOWS, not the range
    // it showed a moment ago.
    const second = calls['getAnalyticsDriverUtilization']?.mock.calls[1]?.[0] as {
      from: string;
      to: string;
    };
    expect(second).toEqual({ from: from.value, to: to.value });
    expect(second.from).not.toBe(RANGE.from);
  });
});

describe('Isolated panel state', () => {
  it('one failing drill-down does not take down the other five', async () => {
    calls['getAnalyticsShifts']?.mockRejectedValue(new Error('Network request failed'));
    await renderAnalytics();
    setRange();

    fireEvent.click(screen.getByText('Shifts'));
    await waitFor(() => expect(screen.getByText(/Couldn’t load this analysis/)).toBeTruthy());

    // The other panels are still openable and still work.
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(screen.getByText('Musa Driver')).toBeTruthy());
  });

  it('a failure says these are unknowns, not zeroes', async () => {
    calls['getAnalyticsRides']?.mockRejectedValue(new Error('Network request failed'));
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Ride operations'));
    await waitFor(() => expect(screen.getByText(/not zeroes, they are unknowns/)).toBeTruthy());
  });

  it('an empty result is stated as empty, not as a failure', async () => {
    calls['getAnalyticsGeography']?.mockResolvedValue({
      ...geography,
      cells: [],
      totalPickups: 0,
      totalDropoffs: 0,
    });
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Geographic demand'));
    await waitFor(() => expect(screen.getByText(/No demand recorded in this period/)).toBeTruthy());
    expect(screen.queryByText(/Couldn’t load this analysis/)).toBeNull();
  });
});

describe('cellSizeDegrees belongs to geography alone', () => {
  it('is never sent to the other five', async () => {
    await renderAnalytics();
    setRange();
    for (const [label, key] of [
      ['Driver utilisation', 'getAnalyticsDriverUtilization'],
      ['Shifts', 'getAnalyticsShifts'],
      ['Ride operations', 'getAnalyticsRides'],
      ['Dispatch performance', 'getAnalyticsDispatch'],
      ['Operations response', 'getAnalyticsResponse'],
    ] as const) {
      fireEvent.click(screen.getByText(label));
      await waitFor(() => expect(calls[key]).toHaveBeenCalled());
      const arg = calls[key]?.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(Object.keys(arg).sort()).toEqual(['from', 'to']);
    }
  });
});

describe('Analytics is read-only at the operator surface too', () => {
  it('offers no mutating control', async () => {
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(screen.getByText('Musa Driver')).toBeTruthy());

    const forbidden =
      /\b(save|update|edit|delete|create|assign|suspend|approve|reject|export to|recalculate|rebuild)\b/i;
    const offending = controls()
      .map((el) => `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`.trim())
      .filter((l) => forbidden.test(l));
    expect(offending).toEqual([]);
  });

  it('does not manufacture a control from response metadata', async () => {
    // Same invariant #434 pins for dispatch candidates: a backend that cannot
    // mutate is not the same guarantee as a console that declines to offer to.
    calls['getAnalyticsDriverUtilization']?.mockResolvedValue({
      ...utilisation,
      canRecalculate: true,
      recalculateUrl: '/operations/analytics/recalculate',
      actions: [{ label: 'Recalculate', href: '/recalculate' }],
      topDrivers: [
        { ...utilisation.topDrivers[0], canSuspend: true, actions: [{ label: 'Suspend' }] },
      ],
    });
    await renderAnalytics();
    setRange();
    fireEvent.click(screen.getByText('Driver utilisation'));
    await waitFor(() => expect(screen.getByText('Musa Driver')).toBeTruthy());

    expect(screen.queryByText('Recalculate')).toBeNull();
    expect(screen.queryByText('Suspend')).toBeNull();
    const forbidden = /\b(recalculate|suspend|rebuild)\b/i;
    expect(
      controls()
        .map((el) => el.textContent ?? '')
        .filter((l) => forbidden.test(l)),
    ).toEqual([]);
  });
});
