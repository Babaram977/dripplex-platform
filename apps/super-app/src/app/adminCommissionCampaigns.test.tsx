import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  campaignAppliesPlatformWide,
  campaignRateFromPercent,
  campaignRatePercent,
  campaignWindowLength,
  campaignWindowValid,
  canPauseCampaign,
  canResumeCampaign,
} from './adminConsoleScreen';

/**
 * DPX-COMMISSION-001 — the commission campaigns desk, full capability.
 *
 * Founder ruling 2026-09-18: campaign duration is an OPS-CONTROLLED PARAMETER
 * with no maximum, and the five mutations held on 2026-09-17 are RELEASED. See
 * docs/DPX-COMMISSION-002-CAMPAIGN-DURATION.md.
 *
 * With no duration ceiling, a permanent platform-wide zero-commission campaign
 * is creatable from this screen. That is deliberate. The controls are
 * permission, audit and reversibility — and this console's contribution is the
 * fourth: VISIBILITY. These tests pin the visibility, because it is the part a
 * restyle could quietly cost:
 *
 *  - THE RATE IS SENT AS A FRACTION, not the percentage the operator typed.
 *    Getting this wrong charges a hundred times the intended rate. Asserted on
 *    the request body, not on the form.
 *  - A PLATFORM-WIDE CAMPAIGN CANNOT BE CREATED UNACKNOWLEDGED.
 *  - A ZERO RATE IS NAMED as charging nothing at all.
 *  - AN UNCAPPED WINDOW IS STATED AS A LENGTH before the campaign exists.
 *  - PAUSE AND RESUME ARE OFFERED ONLY WHERE THE SERVER ACCEPTS THEM.
 *  - THERE IS NO DELETE, and archiving says the record is kept.
 *  - A READ-ONLY OPERATOR GETS NO MUTATING CONTROL and is told why.
 *  - A failed load is still not reported as "no campaigns".
 */

const getCommissionCampaigns = vi.fn();
const createCommissionCampaign = vi.fn();
const updateCommissionCampaign = vi.fn();
const pauseCommissionCampaign = vi.fn();
const resumeCommissionCampaign = vi.fn();
const archiveCommissionCampaign = vi.fn();
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
      createCommissionCampaign: (b: unknown) => createCommissionCampaign(b),
      updateCommissionCampaign: (id: string, b: unknown) => updateCommissionCampaign(id, b),
      pauseCommissionCampaign: (id: string) => pauseCommissionCampaign(id),
      resumeCommissionCampaign: (id: string) => resumeCommissionCampaign(id),
      archiveCommissionCampaign: (id: string) => archiveCommissionCampaign(id),
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
const MANAGE = 'admin:commission-campaign:manage';

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
  // Default: a full operator. Read-only is asserted explicitly where it matters.
  permissions = [READ, MANAGE];
  getCommissionCampaigns.mockResolvedValue(page([campaign()]));
  createCommissionCampaign.mockResolvedValue(campaign());
  updateCommissionCampaign.mockResolvedValue(campaign());
  pauseCommissionCampaign.mockResolvedValue(campaign({ status: 'PAUSED' }));
  resumeCommissionCampaign.mockResolvedValue(campaign({ status: 'SCHEDULED' }));
  archiveCommissionCampaign.mockResolvedValue(campaign({ status: 'ARCHIVED' }));
});

/** Fill the create form with a valid campaign, leaving the caller to vary one thing. */
async function openCreateForm(): Promise<void> {
  fireEvent.click(screen.getByText('+ New campaign'));
  await waitFor(() => expect(screen.getByLabelText('Campaign name')).toBeTruthy());
}

function fillValid(over: { percent?: string; starts?: string; ends?: string } = {}): void {
  fireEvent.change(screen.getByLabelText('Campaign name'), { target: { value: 'Launch week' } });
  fireEvent.change(screen.getByLabelText('Commission rate percent'), {
    target: { value: over.percent ?? '7' },
  });
  fireEvent.change(screen.getByLabelText('Starts at'), {
    target: { value: over.starts ?? '2026-10-01T00:00' },
  });
  fireEvent.change(screen.getByLabelText('Ends at'), {
    target: { value: over.ends ?? '2026-10-08T00:00' },
  });
}

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

describe('campaignRateFromPercent — the conversion that could charge 100x', () => {
  it('reads 7 as the fraction 0.07', () => {
    expect(campaignRateFromPercent('7')).toBe(0.07);
  });

  it('reads 0 as 0, not as "nothing entered"', () => {
    // A zero rate is a legitimate instrument. Conflating it with a blank field
    // would make the one campaign that charges nothing the hardest to create.
    expect(campaignRateFromPercent('0')).toBe(0);
  });

  it('tolerates a typed percent sign and whitespace', () => {
    expect(campaignRateFromPercent(' 12.5 % ')).toBe(0.125);
  });

  it('rounds to the four decimals the column stores', () => {
    // Decimal(5,4). An unrounded divide leaves 0.07000000000000001, which the
    // server rejects on @Max for reasons no operator could diagnose.
    const rate = campaignRateFromPercent('7');
    expect(rate).not.toBeNull();
    expect(String(rate)).toBe('0.07');
  });

  it('refuses anything it cannot read, rather than guessing', () => {
    expect(campaignRateFromPercent('')).toBeNull();
    expect(campaignRateFromPercent('abc')).toBeNull();
    expect(campaignRateFromPercent('-1')).toBeNull();
  });

  it('refuses a rate at or above the server ceiling of 99.99%', () => {
    expect(campaignRateFromPercent('99.99')).toBe(0.9999);
    expect(campaignRateFromPercent('100')).toBeNull();
  });
});

describe('the lifecycle helpers mirror what the server accepts', () => {
  it('offers pause only for a scheduled or active campaign', () => {
    expect(canPauseCampaign('ACTIVE')).toBe(true);
    expect(canPauseCampaign('SCHEDULED')).toBe(true);
    for (const s of ['PAUSED', 'EXPIRED', 'ARCHIVED', 'DRAFT'] as const) {
      expect([s, canPauseCampaign(s)]).toEqual([s, false]);
    }
  });

  it('offers resume only for a paused campaign', () => {
    expect(canResumeCampaign('PAUSED')).toBe(true);
    for (const s of ['ACTIVE', 'SCHEDULED', 'EXPIRED', 'ARCHIVED', 'DRAFT'] as const) {
      expect([s, canResumeCampaign(s)]).toEqual([s, false]);
    }
  });

  it('treats a campaign with no rules as platform-wide', () => {
    expect(campaignAppliesPlatformWide(null)).toBe(true);
    expect(campaignAppliesPlatformWide({ weekdays: [0, 6] })).toBe(false);
  });

  it('mirrors the server rule that a window must end after it starts', () => {
    expect(campaignWindowValid('2026-10-01T00:00', '2026-10-08T00:00')).toBe(true);
    expect(campaignWindowValid('2026-10-08T00:00', '2026-10-01T00:00')).toBe(false);
    expect(campaignWindowValid('2026-10-01T00:00', '2026-10-01T00:00')).toBe(false);
  });
});

describe('Commission Campaigns — creating one', () => {
  it('SENDS THE RATE AS A FRACTION, not the percentage typed', async () => {
    // The single most consequential assertion on this page. 7 typed must reach
    // the server as 0.07; sending 7 would be a 700% rate request.
    await renderPage();
    await waitFor(() => expect(screen.getByText('+ New campaign')).toBeTruthy());
    await openCreateForm();
    fillValid({ percent: '7' });
    fireEvent.click(screen.getByLabelText('Acknowledge platform-wide scope'));
    fireEvent.click(screen.getByText('Create campaign'));

    await waitFor(() => expect(createCommissionCampaign).toHaveBeenCalled());
    expect(createCommissionCampaign.mock.calls[0]?.[0]).toMatchObject({
      name: 'Launch week',
      scope: 'MERCHANT_ORDER',
      commissionRate: 0.07,
    });
  });

  it('sends the window as ISO instants', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('+ New campaign')).toBeTruthy());
    await openCreateForm();
    fillValid();
    fireEvent.click(screen.getByLabelText('Acknowledge platform-wide scope'));
    fireEvent.click(screen.getByText('Create campaign'));

    await waitFor(() => expect(createCommissionCampaign).toHaveBeenCalled());
    const body = createCommissionCampaign.mock.calls[0]?.[0] as Record<string, string>;
    expect(body['startsAt']).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(new Date(body['endsAt']).getTime()).toBeGreaterThan(
      new Date(body['startsAt']).getTime(),
    );
  });

  it('WILL NOT CREATE until the platform-wide scope is acknowledged', async () => {
    // Eligibility rules cannot be set here, so every campaign created from this
    // console applies to every partner in its scope. That must be a decision,
    // not a default someone clicked past.
    await renderPage();
    await waitFor(() => expect(screen.getByText('+ New campaign')).toBeTruthy());
    await openCreateForm();
    fillValid();

    const create = screen.getByText('Create campaign').closest('button');
    expect((create as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Acknowledge platform-wide scope'));
    expect((create as HTMLButtonElement).disabled).toBe(false);
  });

  it('states the window length in words before the campaign exists', async () => {
    // Duration is uncapped, so its length is the thing the operator must see.
    await renderPage();
    await waitFor(() => expect(screen.getByText('+ New campaign')).toBeTruthy());
    await openCreateForm();
    fillValid({ starts: '2026-10-01T00:00', ends: '2099-10-01T00:00' });

    await waitFor(() =>
      expect(screen.getByText(/This campaign will run for .*years/)).toBeTruthy(),
    );
  });

  it('names a zero rate as charging nothing at all', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('+ New campaign')).toBeTruthy());
    await openCreateForm();
    fillValid({ percent: '0' });

    await waitFor(() => expect(screen.getByText(/charges no commission at all/)).toBeTruthy());
  });

  it('refuses an inverted window and says the rule', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('+ New campaign')).toBeTruthy());
    await openCreateForm();
    fillValid({ starts: '2026-10-08T00:00', ends: '2026-10-01T00:00' });
    fireEvent.click(screen.getByLabelText('Acknowledge platform-wide scope'));

    await waitFor(() =>
      expect(screen.getByText(/A campaign must end after it starts/)).toBeTruthy(),
    );
    const create = screen.getByText('Create campaign').closest('button');
    expect((create as HTMLButtonElement).disabled).toBe(true);
  });

  it('re-reads the list afterwards rather than trusting its own guess', async () => {
    await renderPage();
    await waitFor(() => expect(getCommissionCampaigns).toHaveBeenCalledTimes(1));
    await openCreateForm();
    fillValid();
    fireEvent.click(screen.getByLabelText('Acknowledge platform-wide scope'));
    fireEvent.click(screen.getByText('Create campaign'));

    await waitFor(() => expect(getCommissionCampaigns).toHaveBeenCalledTimes(2));
  });

  it('reports a rejected create instead of implying it worked', async () => {
    createCommissionCampaign.mockRejectedValue(new Error('commissionRate must not exceed 0.9999'));
    await renderPage();
    await waitFor(() => expect(screen.getByText('+ New campaign')).toBeTruthy());
    await openCreateForm();
    fillValid();
    fireEvent.click(screen.getByLabelText('Acknowledge platform-wide scope'));
    fireEvent.click(screen.getByText('Create campaign'));

    await waitFor(() =>
      expect(screen.getByText('commissionRate must not exceed 0.9999')).toBeTruthy(),
    );
  });
});

describe('Commission Campaigns — the lifecycle controls', () => {
  it('pauses an active campaign and says the effect is not retroactive', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Pause')).toBeTruthy());
    fireEvent.click(screen.getByText('Pause'));

    await waitFor(() => expect(pauseCommissionCampaign).toHaveBeenCalledWith('camp-1'));
    await waitFor(() =>
      expect(screen.getByText(/already-settled transactions keep the rate they were charged/)),
    );
  });

  it('offers resume, and not pause, for a paused campaign', async () => {
    getCommissionCampaigns.mockResolvedValue(page([campaign({ status: 'PAUSED' })]));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Resume')).toBeTruthy());
    expect(screen.queryByText('Pause')).toBeNull();

    fireEvent.click(screen.getByText('Resume'));
    await waitFor(() => expect(resumeCommissionCampaign).toHaveBeenCalledWith('camp-1'));
  });

  it('offers neither pause nor resume on an expired campaign', async () => {
    // The server refuses both. Offering a control that can only 400 is worse
    // than offering none.
    getCommissionCampaigns.mockResolvedValue(page([campaign({ status: 'EXPIRED' })]));
    await renderPage();
    await waitFor(() => expect(screen.getByText('EXPIRED')).toBeTruthy());

    expect(screen.queryByText('Pause')).toBeNull();
    expect(screen.queryByText('Resume')).toBeNull();
  });

  it('ENDS A RUNNING CAMPAIGN NOW by shortening its window', async () => {
    // With no duration ceiling this is the control that carries the weight:
    // the answer to a campaign running too long is that Ops can stop it.
    await renderPage();
    await waitFor(() => expect(screen.getByText('End now')).toBeTruthy());
    fireEvent.click(screen.getByText('End now'));

    await waitFor(() => expect(updateCommissionCampaign).toHaveBeenCalled());
    const [id, body] = updateCommissionCampaign.mock.calls[0] as [string, Record<string, string>];
    expect(id).toBe('camp-1');
    expect(new Date(body['endsAt']).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('archives, and says the record is kept', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Archive')).toBeTruthy());
    fireEvent.click(screen.getByText('Archive'));

    await waitFor(() => expect(archiveCommissionCampaign).toHaveBeenCalledWith('camp-1'));
    await waitFor(() => expect(screen.getByText(/The record is kept/)).toBeTruthy());
  });

  it('OFFERS NO DELETE — checked against the controls, not the prose', async () => {
    getCommissionCampaigns.mockResolvedValue(
      page([campaign(), campaign({ id: 'camp-2', name: 'Weekend', status: 'PAUSED' })]),
    );
    await renderPage();
    await waitFor(() => expect(screen.getByText('Weekend · 5%')).toBeTruthy());

    for (const label of controls().map((el) => (el.textContent ?? '').toLowerCase())) {
      expect(label).not.toMatch(/delete|remove|destroy/);
    }
  });

  it('warns that a running campaign with no rules covers every partner', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Applies to every partner in this scope/)).toBeTruthy(),
    );
  });

  it('reports a rejected mutation instead of showing the new state', async () => {
    pauseCommissionCampaign.mockRejectedValue(new Error('Insufficient permissions'));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Pause')).toBeTruthy());
    fireEvent.click(screen.getByText('Pause'));

    await waitFor(() => expect(screen.getByText('Insufficient permissions')).toBeTruthy());
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });
});

describe('Commission Campaigns — a read-only operator', () => {
  it('gets no mutating control at all', async () => {
    permissions = [READ];
    await renderPage();
    await waitFor(() => expect(screen.getByText('Launch week · 5%')).toBeTruthy());

    for (const label of controls().map((el) => (el.textContent ?? '').toLowerCase())) {
      expect(label).not.toMatch(/new campaign|pause|resume|archive|end now|create/);
    }
  });

  it('is told why, rather than left to wonder', async () => {
    permissions = [READ];
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/need the commission-campaign manage permission/)).toBeTruthy(),
    );
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
