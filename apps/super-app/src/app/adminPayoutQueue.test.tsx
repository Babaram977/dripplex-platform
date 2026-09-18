import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { payoutWaitingFor } from './adminConsoleScreen';

/**
 * DPX-OPS finance — the payout queue on ops.dripplex.com.
 *
 * The service layer is proven read-only by
 * apps/backend/src/operations/operations-payouts-read-only.spec.ts, which
 * catches an auto-approval injected into the SUMMARY read by name.
 *
 * These pin the operator surface, and one invariant matters more here than
 * anywhere else in the migration: `actionPath` names the endpoint where a
 * payout is APPROVED. It is the only payload in this programme whose own field
 * points at money leaving the platform. It renders as text and must never
 * become a link, a button, or the target of a fetch.
 */

const getPayoutRequests = vi.fn();
const getPayoutSummary = vi.fn();
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
      getPayoutRequests: (q: unknown) => getPayoutRequests(q),
      getPayoutSummary: () => getPayoutSummary(),
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

const READ = 'operations:finance:read';

const walletPayout = (over: Record<string, unknown> = {}) => ({
  id: 'p-1',
  kind: 'WALLET_PAYOUT',
  requesterType: 'DRIVER',
  requesterUserId: 'u-1',
  requesterName: 'Musa Driver',
  requesterReference: null,
  amount: 45000,
  currency: 'NGN',
  status: 'PENDING',
  requestedAt: '2026-09-17T06:00:00.000Z',
  resolvedAt: null,
  note: null,
  actionPath: '/admin/wallet/withdrawals/p-1/approve',
  ...over,
});

const fleetReceivable = (over: Record<string, unknown> = {}) => ({
  ...walletPayout(),
  id: 'p-2',
  kind: 'FLEET_RECEIVABLE',
  requesterType: 'FLEET_OWNER',
  requesterName: 'Lagos Fleet Ltd',
  requesterReference: 'DX-FLEET-0042',
  amount: 250000,
  actionPath: '/admin/fleets/f-1/commission/settle',
  ...over,
});

const page = (items: unknown[], total = items.length) => ({
  items,
  meta: { page: 1, limit: 50, total, totalPages: 1 },
});

const summary = {
  pendingCount: 2,
  pendingAmount: 295000,
  pendingByRequester: [
    { requesterType: 'DRIVER', count: 1, amount: 45000 },
    { requesterType: 'FLEET_OWNER', count: 1, amount: 250000 },
  ],
};

async function renderQueue() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="payoutqueue" />);
}

function pageBody(): HTMLElement {
  const body = document.querySelector('.dx-console-body');
  if (!(body instanceof HTMLElement)) throw new Error('console body not rendered');
  return body;
}

/** The five status filters are navigation, not actions. "Approved" is a
 *  filter label; excluding them is what keeps the action checks honest
 *  instead of failing on the console's own tabs. */
const STATUS_FILTER_LABELS = ['Pending', 'Approved', 'Paid', 'Failed', 'All'];

function actionControls(): string[] {
  return controls()
    .map((el) => `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`.trim())
    .filter((l) => !STATUS_FILTER_LABELS.includes(l));
}

function controls(): HTMLElement[] {
  return [...pageBody().querySelectorAll('button, input, select, textarea, a[href]')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [READ];
  getPayoutRequests.mockResolvedValue(page([walletPayout(), fleetReceivable()]));
  getPayoutSummary.mockResolvedValue(summary);
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('payoutWaitingFor', () => {
  const base = Date.parse('2026-09-17T06:00:00.000Z');
  it('reads minutes under an hour', () => {
    expect(payoutWaitingFor('2026-09-17T06:00:00.000Z', base + 30 * 60000)).toBe('30m');
  });
  it('reads hours under a day', () => {
    expect(payoutWaitingFor('2026-09-17T06:00:00.000Z', base + 5 * 3600000)).toBe('5h');
  });
  it('reads days beyond that — the number the queue exists to expose', () => {
    expect(payoutWaitingFor('2026-09-17T06:00:00.000Z', base + 3 * 86400000)).toBe('3d');
  });
  it('never reports negative time from a clock skew', () => {
    expect(payoutWaitingFor('2026-09-17T06:00:00.000Z', base - 60000)).toBe('0m');
  });
});

describe('The queue distinguishes its two sources', () => {
  it('names a wallet payout and a fleet settlement differently', async () => {
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/Musa Driver/)).toBeTruthy());
    expect(screen.getByText(/Wallet payout/)).toBeTruthy();
    expect(screen.getByText(/Fleet settlement/)).toBeTruthy();
  });

  it('shows a fleet’s reference so Operations can quote it back', async () => {
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/DX-FLEET-0042/)).toBeTruthy());
  });

  it('opens on PENDING and asks the server for exactly that', async () => {
    await renderQueue();
    await waitFor(() => expect(getPayoutRequests).toHaveBeenCalled());
    expect(getPayoutRequests).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', pageSize: 50 }),
    );
  });

  it('re-queries the server when the status filter changes', async () => {
    await renderQueue();
    await waitFor(() => expect(getPayoutRequests).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Paid'));
    await waitFor(() =>
      expect(getPayoutRequests).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAID' })),
    );
  });

  it('sends no status at all for All, rather than an invented one', async () => {
    await renderQueue();
    await waitFor(() => expect(getPayoutRequests).toHaveBeenCalled());
    fireEvent.click(screen.getByText('All'));
    await waitFor(() => expect(getPayoutRequests).toHaveBeenCalledTimes(2));
    const arg = getPayoutRequests.mock.calls[1]?.[0] as Record<string, unknown>;
    expect('status' in arg).toBe(false);
  });
});

describe('actionPath is information, never an affordance', () => {
  it('renders the approval endpoint as text', async () => {
    await renderQueue();
    await waitFor(() =>
      expect(screen.getByText('/admin/wallet/withdrawals/p-1/approve')).toBeTruthy(),
    );
  });

  it('never renders it as a link or a button', async () => {
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/Musa Driver/)).toBeTruthy());

    // The sharpest invariant in this migration: this field names where money
    // leaves the platform. It must not be clickable.
    const clickable = controls().map((el) => el.textContent ?? '');
    expect(clickable.filter((t) => t.includes('/approve') || t.includes('/settle'))).toEqual([]);
    expect(pageBody().querySelectorAll('a[href]').length).toBe(0);
  });

  it('offers no approve, reject, pay or retry control', async () => {
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/Musa Driver/)).toBeTruthy());

    const forbidden = /\b(approve|reject|pay|payout now|retry|release|settle|transfer|send)\b/i;
    expect(actionControls().filter((l) => forbidden.test(l))).toEqual([]);
  });

  it('does not grow a control because the payload suggests one', async () => {
    getPayoutRequests.mockResolvedValue(
      page([
        walletPayout({
          canApprove: true,
          approveUrl: '/admin/wallet/withdrawals/p-1/approve',
          actions: [{ label: 'Approve', href: '/approve' }],
        }),
      ]),
    );
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/Musa Driver/)).toBeTruthy());
    expect(screen.queryByText('Approve')).toBeNull();
    // Scoped past the STATUS FILTERS, which legitimately include "Approved" —
    // a filter label, not an action. Matching raw text here would fail on the
    // console's own navigation, which is the same trap that produced a false
    // positive on the recovery page's body copy earlier in this migration.
    expect(actionControls().filter((t) => /approve/i.test(t))).toEqual([]);
  });

  it('offers only the status filters', async () => {
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/Musa Driver/)).toBeTruthy());
    expect(controls().map((el) => el.textContent)).toEqual([
      'Pending',
      'Approved',
      'Paid',
      'Failed',
      'All',
    ]);
  });
});

describe('Summary and list fail independently', () => {
  it('a failed summary does not blank the rows', async () => {
    getPayoutSummary.mockRejectedValue(new Error('Network request failed'));
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/this is not ₦0/)).toBeTruthy());
    // The queue underneath still loaded.
    expect(screen.getByText(/Musa Driver/)).toBeTruthy();
  });

  it('a failed summary never renders ₦0 outstanding', async () => {
    getPayoutSummary.mockRejectedValue(new Error('Network request failed'));
    await renderQueue();
    await waitFor(() =>
      expect(screen.getByText(/Couldn’t load the outstanding total/)).toBeTruthy(),
    );
    // Zero owed is the most reassuring possible way to be wrong about money.
    expect(screen.queryByText('₦0')).toBeNull();
  });

  it('a failed list does not blank the summary', async () => {
    getPayoutRequests.mockRejectedValue(new Error('Network request failed'));
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/Couldn’t load the payout queue/)).toBeTruthy());
    expect(screen.getByText('₦295,000')).toBeTruthy();
  });

  it('a failed list never claims nobody is waiting', async () => {
    getPayoutRequests.mockRejectedValue(new Error('Network request failed'));
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/Couldn’t load the payout queue/)).toBeTruthy());
    expect(screen.queryByText(/Nobody is waiting to be paid/)).toBeNull();
    expect(screen.getByText(/not the same as nobody waiting to be paid/)).toBeTruthy();
  });

  it('a genuinely empty queue says so', async () => {
    getPayoutRequests.mockResolvedValue(page([]));
    await renderQueue();
    await waitFor(() => expect(screen.getByText(/Nobody is waiting to be paid/)).toBeTruthy());
  });
});

describe('Permission gating', () => {
  it('refuses the page without operations:finance:read', async () => {
    permissions = [];
    await renderQueue();
    await waitFor(() =>
      expect(screen.getByText('This account does not have access to that page.')).toBeTruthy(),
    );
    expect(getPayoutRequests).not.toHaveBeenCalled();
    expect(getPayoutSummary).not.toHaveBeenCalled();
  });
});
