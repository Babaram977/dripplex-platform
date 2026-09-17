import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DPX-ORDER-8D-RECOVERY — Automatic Recovery in the Operations Console.
 *
 * The capability moved here from the standalone operations-console on the
 * founder ruling of 2026-09-16 (ops.dripplex.com is the one operator surface).
 * These tests pin what the page is FOR, not how it looks, so a later restyle
 * cannot quietly cost the guarantees:
 *
 *  - AN ERROR IS NOT "OFF". A failed read must never render the safe-looking
 *    state. "We could not ask" and "the backstop is disarmed" are different
 *    facts, and showing the second when the first is true is how an operator
 *    ends up reassured about something nobody checked. This is the reason the
 *    page exists in this shape and it is asserted twice below: on first load,
 *    and on a refresh that fails after a good answer — where a stale "OFF"
 *    left on screen is the same lie with a longer fuse.
 *
 *  - VISIBILITY ONLY. The activation boundary is a code constant changed by
 *    reviewed deployment. No control here may arm, disarm, run, cancel, refund
 *    or reverse anything. That is asserted against the page's INTERACTIVE
 *    elements, not its text: an earlier version of this check read the body
 *    copy and failed on the page's own sentence explaining that DrippleX can
 *    cancel a stalled order.
 *
 *  - The exact instant is shown verbatim. An operator comparing the boundary
 *    against the deployed constant needs the same characters, not a friendly
 *    rendering of them.
 */

const getRecoveryActivationState = vi.fn();
let permissions: string[] = [];

vi.mock('../lib/api', () => ({
  api: {
    // The console verifies the stored session against the server before it
    // renders a single page; without a live /auth/me the gate correctly
    // refuses and the suite sees the sign-in screen instead.
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
      getRecoveryActivationState: () => getRecoveryActivationState(),
      // Sidebar badge sources. Each is independently try/caught by the shell,
      // so these only keep the console from reading properties of undefined.
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

async function renderPage() {
  const { AdminConsoleScreen } = await import('./adminConsoleScreen');
  return render(<AdminConsoleScreen initialPage="recovery" />);
}

/** The scrolling page region — the sidebar and header are not this page. */
function pageBody(): HTMLElement {
  const body = document.querySelector('.dx-console-body');
  if (!(body instanceof HTMLElement)) throw new Error('console body not rendered');
  return body;
}

/** Everything on this page a person can actually operate. */
function controls(): HTMLElement[] {
  return [...pageBody().querySelectorAll('button, input, select, textarea, a[href]')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  permissions = [READ];
  getRecoveryActivationState.mockResolvedValue({ activated: false, activationAt: null });
});

// See the note in adminCampaigns.test.tsx: the console is ~14,000 lines and its
// first mount runs inside waitFor's own clock. This widens a timing budget; it
// weakens no assertion.
configure({ asyncUtilTimeout: 5_000 });

beforeAll(async () => {
  await import('./adminConsoleScreen');
});

describe('Automatic Recovery — the operator can see whether the backstop is armed', () => {
  it('reports OFF and no boundary when the server says it is not activated', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('OFF')).toBeTruthy());
    expect(screen.getByText('Not set')).toBeTruthy();
    expect(screen.queryByText('ON')).toBeNull();
  });

  it('reports ON and the exact boundary instant, verbatim, when it is armed', async () => {
    getRecoveryActivationState.mockResolvedValue({
      activated: true,
      activationAt: '2026-09-16T18:00:00.000Z',
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('ON')).toBeTruthy());
    // The ISO the server resolved, character for character — not a localised
    // rendering of it. An operator checks this against the deployed constant.
    expect(screen.getByText('2026-09-16T18:00:00.000Z')).toBeTruthy();
    expect(screen.queryByText('OFF')).toBeNull();
  });

  it('calls the real endpoint through the console API client', async () => {
    await renderPage();
    await waitFor(() => expect(getRecoveryActivationState).toHaveBeenCalled());
  });
});

describe('Automatic Recovery — a failed read is never reported as OFF', () => {
  it('says the state is unknown, and does not render the safe-looking state', async () => {
    getRecoveryActivationState.mockRejectedValue(new Error('Network request failed'));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Couldn’t read the activation state/)).toBeTruthy(),
    );

    // The whole point. OFF would be a claim nobody verified.
    expect(screen.queryByText('OFF')).toBeNull();
    expect(screen.queryByText('ON')).toBeNull();
    expect(screen.getByText('UNKNOWN')).toBeTruthy();
    expect(screen.getByText(/not the same as the backstop being off/)).toBeTruthy();
  });

  it('surfaces the underlying failure rather than swallowing it', async () => {
    getRecoveryActivationState.mockRejectedValue(new Error('Session expired'));
    await renderPage();
    await waitFor(() => expect(screen.getByText('Session expired')).toBeTruthy());
  });

  it('clears a previously good answer when a refresh fails', async () => {
    // A stale OFF sitting beside an error is the same false reassurance, just
    // harder to notice: the operator reads the badge, not the banner. The page
    // holds ONE union-typed variable precisely so this cannot be represented;
    // this test is what would catch it going back to two independent ones.
    getRecoveryActivationState.mockResolvedValueOnce({ activated: false, activationAt: null });
    await renderPage();
    await waitFor(() => expect(screen.getByText('OFF')).toBeTruthy());

    getRecoveryActivationState.mockRejectedValueOnce(new Error('Network request failed'));
    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => expect(screen.getByText('UNKNOWN')).toBeTruthy());
    expect(screen.queryByText('OFF')).toBeNull();
  });
});

describe('Automatic Recovery — visibility only', () => {
  it('offers no control that could arm, disarm, run or reverse anything', async () => {
    getRecoveryActivationState.mockResolvedValue({
      activated: true,
      activationAt: '2026-09-16T18:00:00.000Z',
    });
    await renderPage();
    await waitFor(() => expect(screen.getByText('ON')).toBeTruthy());

    const forbidden =
      /\b(arm|disarm|activate|deactivate|enable|disable|run|sweep|cancel|refund|reverse|recognise|recognize|save|apply|update)\b/i;
    const offending = controls()
      .map((el) => `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`.trim())
      .filter((label) => forbidden.test(label));

    // If this fails, a mutating control reached a page whose entire purpose is
    // that the financial safety boundary can only be moved by a reviewed
    // deployment. Remove the control; do not relax the pattern.
    expect(offending).toEqual([]);
  });

  it('offers only a refresh', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('OFF')).toBeTruthy());
    expect(controls().map((el) => el.textContent)).toEqual(['Refresh']);
  });
});

describe('Automatic Recovery — permission gating', () => {
  it('refuses the page to a session without admin:orders:read', async () => {
    permissions = [];
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText('This account does not have access to that page.')).toBeTruthy(),
    );
    // Not merely hidden from the menu: the page itself must not render, and it
    // must not have asked the server either.
    expect(getRecoveryActivationState).not.toHaveBeenCalled();
    expect(screen.queryByText('OFF')).toBeNull();
  });

  it('shows it in the navigation to a session that holds the permission', async () => {
    await renderPage();
    await waitFor(() =>
      expect(screen.getAllByText('Automatic Recovery').length).toBeGreaterThan(0),
    );
  });
});
