import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DPX-ORDER-8D-C — the stalled-order queue in the Operations Console.
 *
 * Ported from the standalone operations-console on the 2026-09-16 ruling. These
 * pin what the queue is FOR, so a restyle cannot cost the guarantees:
 *
 *  - AN ERROR IS NOT AN EMPTY QUEUE. "No stalled orders" and "we could not ask"
 *    are different facts, and here the reassuring one is what an operator hopes
 *    to see — which makes conflating them worse than the OFF/UNKNOWN case, not
 *    better. One union-typed variable, so a stale list cannot sit under an
 *    error banner.
 *
 *  - READ ONLY. No resolve, dismiss, assign or contact control. Asserted
 *    against INTERACTIVE elements, not body text: an earlier version of this
 *    check elsewhere failed on a page's own prose about cancelling an order.
 *
 *  - The wait is the STORED figure, rendered from `waitedMinutes`, never
 *    recomputed from `detectedAt` — a live clock disagrees with the record the
 *    moment the order moves.
 *
 *  - Counts come from `meta.total`. The endpoint nests them; the super-app's
 *    flat `PaginatedResult` typechecks against that shape and renders
 *    `undefined`, which is exactly the trap `ApiPage` exists to mark.
 */

const getOrderExceptions = vi.fn();
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
      getOrderExceptions: (q: unknown) => getOrderExceptions(q),
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

const READ = 'admin:orders:read';

const exception = (over: Record<string, unknown> = {}) => ({
  id: 'exc-1',
  orderId: 'ord-1',
  type: 'STALLED_CONFIRMED',
  status: 'OPEN',
  detectedAt: '2026-09-17T04:00:00.000Z',
  waitedMinutes: 95,
  notifiedAt: '2026-09-17T04:01:00.000Z',
  resolvedAt: null,
  resolvedStatus: null,
  createdAt: '2026-09-17T04:00:00.000Z',
  updatedAt: '2026-09-17T04:00:00.000Z',
  order: {
    id: 'ord-1',
    orderNumber: 'DPX-20260917-AB12CD',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    paymentMethod: 'DX_WALLET',
    fulfillmentType: 'DELIVERY',
    customerId: 'cust-1',
    merchantId: 'merch-1',
    total: 12500,
    currency: 'NGN',
    confirmedAt: '2026-09-17T02:25:00.000Z',
    createdAt: '2026-09-17T02:20:00.000Z',
  },
  ...over,
});

const page = (items: unknown[], total = items.length) => ({
  items,
  meta: { page: 1, limit: 50, total, totalPages: 1 },
});

async function renderPage() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="stalledorders" />);
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
  permissions = [READ];
  getOrderExceptions.mockResolvedValue(page([exception()]));
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('Stalled Orders — the queue shows what the platform has taken on', () => {
  it('lists an exception with its order number and value', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/DPX-20260917-AB12CD/)).toBeTruthy());
    expect(screen.getByText(/₦12,500/)).toBeTruthy();
  });

  it('opens on OPEN, and asks the server for exactly that', async () => {
    await renderPage();
    await waitFor(() => expect(getOrderExceptions).toHaveBeenCalled());
    expect(getOrderExceptions).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'OPEN', pageSize: 50 }),
    );
  });

  it('re-queries the server when the operator switches to Resolved', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/DPX-20260917-AB12CD/)).toBeTruthy());
    getOrderExceptions.mockResolvedValue(page([]));

    fireEvent.click(screen.getByText('Resolved'));

    await waitFor(() =>
      expect(getOrderExceptions).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RESOLVED' }),
      ),
    );
    // Filtering client-side would leave the OPEN row on screen under a
    // "Resolved" tab, which is the console lying about what it fetched.
    await waitFor(() => expect(screen.queryByText(/DPX-20260917-AB12CD/)).toBeNull());
  });

  it('reads the total from meta, where the endpoint actually puts it', async () => {
    getOrderExceptions.mockResolvedValue(page([exception()], 7));
    await renderPage();
    await waitFor(() => expect(screen.getByText('7 exceptions')).toBeTruthy());
  });

  it('says one exception, not one exceptions', async () => {
    getOrderExceptions.mockResolvedValue(page([exception()], 1));
    await renderPage();
    await waitFor(() => expect(screen.getByText('1 exception')).toBeTruthy());
  });
});

describe('Stalled Orders — the wait is the recorded one', () => {
  it('renders the stored waitedMinutes, not a clock since detection', async () => {
    // 95 stored minutes must read as 1h 35m even though detectedAt is hours
    // ago in wall-clock terms. Recomputing disagrees with the record the
    // moment the order moves, and the record is what the platform acted on.
    getOrderExceptions.mockResolvedValue(page([exception({ waitedMinutes: 95 })]));
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Waited 1h 35m/)).toBeTruthy());
  });

  it('reads long waits in days rather than thousands of minutes', async () => {
    getOrderExceptions.mockResolvedValue(page([exception({ waitedMinutes: 6382 })]));
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Waited 4d 10h/)).toBeTruthy());
  });

  it('says the merchant warning is pending when it has not been sent', async () => {
    // null is "the sweep will retry", not "lost" — and not "warned".
    getOrderExceptions.mockResolvedValue(page([exception({ notifiedAt: null })]));
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Merchant warning pending retry/)).toBeTruthy());
  });
});

describe('Stalled Orders — a failed read is never an empty queue', () => {
  it('says the load failed instead of reporting that every order is moving', async () => {
    getOrderExceptions.mockRejectedValue(new Error('Network request failed'));
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Couldn’t load stalled orders/)).toBeTruthy());

    expect(screen.queryByText(/No stalled orders/)).toBeNull();
    expect(screen.queryByText(/Every confirmed delivery order is moving/)).toBeNull();
    expect(screen.getByText(/not the same as the queue being empty/)).toBeTruthy();
  });

  it('surfaces the underlying failure rather than swallowing it', async () => {
    getOrderExceptions.mockRejectedValue(new Error('Session expired'));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Session expired')).toBeTruthy());
  });

  it('clears the previous list when a later query fails', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/DPX-20260917-AB12CD/)).toBeTruthy());

    getOrderExceptions.mockRejectedValue(new Error('Network request failed'));
    fireEvent.click(screen.getByText('Resolved'));

    await waitFor(() => expect(screen.getByText(/Couldn’t load stalled orders/)).toBeTruthy());
    expect(screen.queryByText(/DPX-20260917-AB12CD/)).toBeNull();
  });

  it('shows a genuinely empty queue as empty', async () => {
    getOrderExceptions.mockResolvedValue(page([]));
    await renderPage();
    await waitFor(() => expect(screen.getByText(/No stalled orders/)).toBeTruthy());
  });
});

describe('Stalled Orders — read only', () => {
  it('offers no control that could resolve, dismiss or assign an exception', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/DPX-20260917-AB12CD/)).toBeTruthy());

    const forbidden =
      /\b(resolve|dismiss|assign|close|cancel|refund|contact|chase|escalate|snooze|delete)\b/i;
    const offending = controls()
      .map((el) => `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`.trim())
      .filter((label) => forbidden.test(label));

    // No ruling authorises acting on a stalled order. Remove the control; do
    // not relax the pattern.
    expect(offending).toEqual([]);
  });

  it('offers only the two status filters', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/DPX-20260917-AB12CD/)).toBeTruthy());
    expect(controls().map((el) => el.textContent)).toEqual(['Open', 'Resolved']);
  });
});

describe('Stalled Orders — permission gating', () => {
  it('refuses the page to a session without admin:orders:read', async () => {
    permissions = [];
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText('This account does not have access to that page.')).toBeTruthy(),
    );
    expect(getOrderExceptions).not.toHaveBeenCalled();
  });
});
