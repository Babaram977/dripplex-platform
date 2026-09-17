import { configure, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { campaignRatePercent, campaignWindowLength } from './adminConsoleScreen';

/**
 * DPX-COMMISSION-001 — the commission campaigns desk, read-only.
 *
 * Founder ruling 2026-09-17: the LIST is ported; create, update, pause, resume
 * and archive are HELD. The backend bounds a campaign's window only by
 * `endsAt > startsAt` — no maximum — while the rate is valid at 0 and a
 * campaign without `rules` applies platform-wide within its scope, so
 * permanent platform-wide zero commission is expressible in one call. The
 * bound belongs on the server; a client guard is not a boundary.
 *
 * These tests pin that the desk stays a desk:
 *  - no mutating control reaches it while the five are held
 *  - a failed load is not reported as "no campaigns", because an empty desk
 *    asserts that nothing is overriding the standing rates
 *  - the stored FRACTION renders as a percentage
 *  - a zero-rate campaign is named as charging nothing, not left as "0%"
 *  - a long window is legible as a length, not just an end date
 */

const getCommissionCampaigns = vi.fn();
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
      getCommissionCampaigns: (q: unknown) => getCommissionCampaigns(q),
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

const READ = 'admin:commission-campaign:read';

const campaign = (over: Record<string, unknown> = {}) => ({
  id: 'camp-1',
  name: 'Launch week',
  description: null,
  scope: 'MERCHANT_ORDER',
  commissionRate: 0.05,
  status: 'ACTIVE',
  priority: 0,
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-09-08T00:00:00.000Z',
  rules: null,
  announce: true,
  announcedAt: null,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
  ...over,
});

const page = (items: unknown[], total = items.length) => ({
  items,
  meta: { page: 1, limit: 50, total, totalPages: 1 },
});

async function renderPage() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="commissioncampaigns" />);
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
  permissions = [READ];
  getCommissionCampaigns.mockResolvedValue(page([campaign()]));
});

configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('campaignRatePercent — the stored fraction is not a percentage', () => {
  it('renders 0.05 as 5%', () => {
    expect(campaignRatePercent(0.05)).toBe('5%');
  });
  it('keeps two decimals where they matter', () => {
    expect(campaignRatePercent(0.0725)).toBe('7.25%');
  });
  it('renders zero as 0%, not as empty', () => {
    expect(campaignRatePercent(0)).toBe('0%');
  });
});

describe('campaignWindowLength — a long window must read as long', () => {
  it('reads a week as days', () => {
    expect(campaignWindowLength('2026-09-01T00:00:00.000Z', '2026-09-08T00:00:00.000Z')).toBe(
      '7 days',
    );
  });

  it('makes a multi-decade window unmistakable', () => {
    // The point of this helper. "Ends 2099" and "Ends 2027" look alike in a
    // table; a length does not. The backend places no ceiling on this.
    const out = campaignWindowLength('2026-09-01T00:00:00.000Z', '2099-09-01T00:00:00.000Z');
    expect(out).toMatch(/years/);
    expect(out).toMatch(/2666[0-9]/);
  });

  it('refuses to describe an inverted window as a duration', () => {
    expect(campaignWindowLength('2026-09-08T00:00:00.000Z', '2026-09-01T00:00:00.000Z')).toBe(
      'an invalid window',
    );
  });
});

describe('Commission Campaigns — the desk reports what is being charged', () => {
  it('lists a campaign with its rate as a percentage', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Launch week · 5%/)).toBeTruthy());
  });

  it('names the scope in words rather than the enum', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Merchant orders/)).toBeTruthy());
  });

  it('states the precedence the platform actually applies', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Campaign → Negotiated rate → Platform rate/)).toBeTruthy(),
    );
  });

  it('says plainly when a campaign is charging nothing', async () => {
    getCommissionCampaigns.mockResolvedValue(page([campaign({ commissionRate: 0 })]));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Charging no commission at all while this runs/)).toBeTruthy(),
    );
  });

  it('does not cry wolf on an ordinary rate', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Launch week/)).toBeTruthy());
    expect(screen.queryByText(/Charging no commission at all/)).toBeNull();
  });
});

describe('Commission Campaigns — a failed load is not an empty desk', () => {
  it('says the load failed rather than that nothing is overriding the rates', async () => {
    getCommissionCampaigns.mockRejectedValue(new Error('Network request failed'));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Couldn’t load commission campaigns/)).toBeTruthy(),
    );
    expect(screen.queryByText(/No commission campaigns/)).toBeNull();
    expect(screen.queryByText(/Every partner is on their standing rate/)).toBeNull();
    expect(screen.getByText(/not the same as there being none/)).toBeTruthy();
  });

  it('shows a genuinely empty desk as empty', async () => {
    getCommissionCampaigns.mockResolvedValue(page([]));
    await renderPage();
    await waitFor(() => expect(screen.getByText(/No commission campaigns/)).toBeTruthy());
  });
});

describe('Commission Campaigns — the five mutations are held', () => {
  it('offers no control that could create, edit, pause, resume or archive', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Launch week/)).toBeTruthy());

    const forbidden =
      /\b(create|new|edit|update|pause|resume|archive|delete|save|launch|start|stop|end)\b/i;
    const offending = controls()
      .map((el) => `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`.trim())
      .filter((label) => forbidden.test(label));

    // Held until a server-side bound on the campaign window is ruled and
    // shipped. Remove the control; do not relax the pattern.
    expect(offending).toEqual([]);
  });

  it('renders no interactive element at all on this desk', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Launch week/)).toBeTruthy());
    expect(controls()).toEqual([]);
  });

  it('says out loud that the desk is read-only', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText(/This desk is read-only/)).toBeTruthy());
  });
});

describe('Commission Campaigns — permission gating', () => {
  it('refuses the page without admin:commission-campaign:read', async () => {
    permissions = [];
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText('This account does not have access to that page.')).toBeTruthy(),
    );
    expect(getCommissionCampaigns).not.toHaveBeenCalled();
  });
});
