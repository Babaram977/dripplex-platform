import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Operations Console's front door.
 *
 * ops.dripplex.com opened straight onto the dashboard with no sign-in. The
 * gate was `isOpsAuthed()`, and every word of its answer came out of
 * localStorage: a token string nobody had checked, and a `dx_user` object this
 * device wrote down at some past login. A token that had expired, been
 * revoked, or been signed out of somewhere else reads back exactly like a live
 * one — and a `dx_user` entry typed into devtools with `roles: ["admin"]`
 * reads like one too. So the console rendered the full operations surface for
 * anything at all in those three keys.
 *
 * The gate now asks the server. /auth/me reads roles and permissions from the
 * database on each call rather than from the token's claims, so it also
 * catches access withdrawn after the token was issued.
 *
 * What these tests hold down is the direction of trust: the browser proposes,
 * the server decides, and nothing of the console renders in between.
 */

const me = vi.fn();
const setUser = vi.fn();
const clear = vi.fn();

let storedUser: { roles: string[]; permissions: string[] } | null = null;
let storedToken: string | null = null;

vi.mock('../lib/api', () => ({
  api: {
    auth: { me: () => me() },
    // Everything the dashboard behind the gate would load. It answers with a
    // promise that never settles, so each panel sits in its loading state:
    // what is under test is which of the two screens renders, and a page
    // fetch resolving or throwing is only noise that can knock the tree over.
    admin: new Proxy({}, { get: () => () => new Promise(() => undefined) }),
  },
  MERCHANT_CATEGORY_LABEL: {},
}));

vi.mock('../lib/auth', () => ({
  auth: {
    getUser: () => storedUser,
    getAccessToken: () => storedToken,
    setUser: (u: unknown) => setUser(u),
    clear: () => clear(),
  },
}));

vi.mock('../lib/maps', () => ({
  addressPredictions: () => Promise.resolve([]),
  geocodeAddress: () => Promise.resolve(null),
  mapsEnabled: () => false,
  mapsLibrary: () => Promise.resolve(null),
}));

const serverUser = (over: Record<string, unknown> = {}) => ({
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
  permissions: ['operations:finance:read'],
  ...over,
});

async function renderConsole() {
  const { AdminDashboardScreen } = await import('./adminConsoleScreen');
  return render(<AdminDashboardScreen />);
}

const signInShowing = () => screen.queryByText('Sign in to the Operations Console');
/** Sidebar heading, present only once the console shell itself has rendered. */
const consoleShowing = () => screen.queryByText('Live Map');

beforeEach(() => {
  vi.clearAllMocks();
  storedUser = { roles: ['operations_staff'], permissions: [] };
  storedToken = 'stored-token';
  me.mockResolvedValue(serverUser());
});

describe('Operations Console session gate', () => {
  it('opens the console when the server confirms the stored session', async () => {
    await renderConsole();
    await waitFor(() => expect(consoleShowing()).toBeTruthy());
    expect(signInShowing()).toBeNull();
    expect(me).toHaveBeenCalled();
  });

  it('asks for a sign-in when the server rejects the stored token', async () => {
    // The whole reported defect: this is a token that reads fine locally and
    // is not a session any more.
    me.mockRejectedValue({ statusCode: 401, message: 'Session expired' });
    await renderConsole();
    await waitFor(() => expect(signInShowing()).toBeTruthy());
    expect(consoleShowing()).toBeNull();
    expect(clear).toHaveBeenCalled();
  });

  it('renders no part of the console while the check is outstanding', async () => {
    let release: (v: unknown) => void = () => undefined;
    me.mockReturnValue(new Promise((r) => (release = r)));
    await renderConsole();

    // Not the dashboard behind a spinner. Whether this person may see the
    // dashboard is precisely what is not yet known.
    expect(screen.getByText('Checking your session…')).toBeTruthy();
    expect(consoleShowing()).toBeNull();
    expect(signInShowing()).toBeNull();

    release(serverUser());
    await waitFor(() => expect(consoleShowing()).toBeTruthy());
  });

  it('does not honour a stored user the server does not confirm', async () => {
    // roles: ["admin"] pasted into devtools. Locally that is an operations
    // session; the server says this is a customer.
    storedUser = { roles: ['admin'], permissions: [] };
    me.mockResolvedValue(serverUser({ roles: ['customer'], permissions: [] }));

    await renderConsole();
    await waitFor(() => expect(signInShowing()).toBeTruthy());
    expect(consoleShowing()).toBeNull();
    expect(clear).toHaveBeenCalled();
  });

  it('rejects a session whose operations role the server has since withdrawn', async () => {
    // The stored user is what login wrote down; /auth/me re-reads RBAC from
    // the database, so a revoked role is caught before the console renders
    // rather than at the first 403.
    me.mockResolvedValue(
      serverUser({ roles: ['customer'], permissions: ['customer:profile:read'] }),
    );
    await renderConsole();
    await waitFor(() => expect(signInShowing()).toBeTruthy());
    expect(clear).toHaveBeenCalled();
  });

  it('stores the access the server states, not the access login remembered', async () => {
    const current = serverUser({ permissions: ['operations:promotions:manage'] });
    me.mockResolvedValue(current);
    await renderConsole();
    await waitFor(() => expect(consoleShowing()).toBeTruthy());

    // Otherwise every hasPerm() in the console answers from a snapshot taken
    // whenever this device last signed in.
    expect(setUser).toHaveBeenCalledWith(current);
  });

  it('goes to sign-in without asking the server when nothing is stored', async () => {
    storedUser = null;
    storedToken = null;
    await renderConsole();
    await waitFor(() => expect(signInShowing()).toBeTruthy());
    expect(me).not.toHaveBeenCalled();
  });

  it('goes to sign-in when a token is stored without a user', async () => {
    storedUser = null;
    await renderConsole();
    await waitFor(() => expect(signInShowing()).toBeTruthy());
    expect(me).not.toHaveBeenCalled();
  });

  it('returns to sign-in when the session expires while the console is open', async () => {
    await renderConsole();
    await waitFor(() => expect(consoleShowing()).toBeTruthy());

    // The API client fires this after a 401 outlives a refresh. The console
    // kept its own flag and never listened, so an expired session left the
    // shell standing with every panel failing underneath it.
    window.dispatchEvent(new Event('dx:session-expired'));

    await waitFor(() => expect(signInShowing()).toBeTruthy());
    expect(consoleShowing()).toBeNull();
  });
});
