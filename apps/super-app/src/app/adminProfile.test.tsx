import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * My Profile, in the Operations Console.
 *
 * The page shipped looking finished and doing almost nothing: Save Changes and
 * Change Password carried no onClick at all, three switches were backed by
 * local state and no request, the Active Sessions card was permanently empty,
 * and name/email/phone came from the cached session object — which is why an
 * operator saw three blank fields.
 *
 * These tests pin the parts most worth keeping honest:
 *
 *  - the profile is read from the server, not from whatever login persisted.
 *  - Save Changes and Change Password actually call their endpoints, and a
 *    refusal is surfaced rather than reported as success.
 *  - Active Sessions lists real sessions and can revoke them. The card was
 *    empty because of a comment claiming no endpoint existed; /auth/sessions
 *    exists and the client method was already written against it.
 *  - the page never claims two-factor authentication is enabled. There is no
 *    two-factor endpoint anywhere in the backend, and a switch asserting "OTP
 *    on every login" tells an operator their account is protected when nothing
 *    enforces it.
 */

const me = vi.fn();
const updateMe = vi.fn();
const changePassword = vi.fn();
const listSessions = vi.fn();
const revokeSession = vi.fn();
const revokeOtherSessions = vi.fn();

vi.mock('../lib/api', () => ({
  api: {
    auth: {
      me: () => me(),
      updateMe: (body: unknown) => updateMe(body),
      changePassword: (body: unknown) => changePassword(body),
      listSessions: () => listSessions(),
      revokeSession: (id: string) => revokeSession(id),
      revokeOtherSessions: () => revokeOtherSessions(),
    },
    admin: {},
  },
  MERCHANT_CATEGORY_LABEL: {},
}));

vi.mock('../lib/auth', () => ({
  auth: {
    getUser: () => ({ permissions: [], roles: ['operations_staff'] }),
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

const operator = (over: Record<string, unknown> = {}) => ({
  id: 'u-ops-1',
  email: 'ops@dripplex.test',
  phone: '+2348090000001',
  firstName: 'Dan',
  lastName: 'Operator',
  profilePhotoUrl: null,
  dateOfBirth: null,
  gender: null,
  status: 'ACTIVE',
  roles: ['operations_staff'],
  permissions: [],
  ...over,
});

const session = (over: Record<string, unknown> = {}) => ({
  sessionId: 's1',
  current: false,
  portal: 'OPERATIONS_CONSOLE',
  browser: 'Chrome',
  operatingSystem: 'Android',
  device: 'Pixel',
  deviceType: 'mobile' as const,
  ip: '203.0.113.9',
  location: 'Lagos, NG',
  createdAt: '2026-09-13T00:00:00.000Z',
  lastActiveAt: '2026-09-13T04:00:00.000Z',
  expiresAt: '2026-09-20T00:00:00.000Z',
  ...over,
});

async function renderProfile() {
  const { AdminProfileScreen } = await import('./adminConsoleScreen');
  return render(<AdminProfileScreen />);
}

beforeEach(() => {
  vi.clearAllMocks();
  me.mockResolvedValue(operator());
  listSessions.mockResolvedValue({ items: [session({ current: true, sessionId: 'self' })] });
});

describe('My Profile — the operator is read from the server', () => {
  it('shows the name the server returns, not a blank field', async () => {
    await renderProfile();
    await waitFor(() => expect(me).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeTruthy());
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Dan');
    expect((screen.getByLabelText('Last name') as HTMLInputElement).value).toBe('Operator');
  });

  it('surfaces a failure rather than rendering an empty form', async () => {
    // The console's front door calls /auth/me first, so the first resolution
    // is the gate's and the rejection is the page's own load. A 401 does not
    // arrive here at all — the API client clears the session and the gate
    // drops to sign-in — so the case worth pinning is the server being
    // unreachable or erroring, where the page must say so rather than render
    // a form full of blanks.
    me.mockResolvedValueOnce(operator()).mockRejectedValue({ message: 'Backend unavailable' });
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Backend unavailable')).toBeTruthy());
    expect(screen.queryByLabelText('First name')).toBeNull();
  });

  it('shows email and phone as the record, not as editable fields', async () => {
    // They change through their own confirmation flows; an input here would
    // either do nothing or skip the confirmation.
    await renderProfile();
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeTruthy());
    expect(screen.queryByLabelText('Email Address')).toBeNull();
    expect(screen.queryByLabelText('Phone Number')).toBeNull();
    expect(screen.getByText(/ops@dripplex\.test/)).toBeTruthy();
  });
});

describe('My Profile — Save Changes', () => {
  it('sends the edited name to the server', async () => {
    updateMe.mockResolvedValue(operator({ firstName: 'Daniel' }));
    await renderProfile();
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Daniel' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateMe).toHaveBeenCalledTimes(1));
    expect(updateMe.mock.calls[0][0]).toEqual({ firstName: 'Daniel', lastName: 'Operator' });
    await waitFor(() => expect(screen.getByText('Profile updated.')).toBeTruthy());
  });

  it('refuses to send a blank name', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() =>
      expect(screen.getByText('First and last name are both required.')).toBeTruthy(),
    );
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('reports a refusal instead of claiming the profile saved', async () => {
    updateMe.mockRejectedValue({ message: 'Name contains invalid characters' });
    await renderProfile();
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeTruthy());
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => expect(screen.getByText('Name contains invalid characters')).toBeTruthy());
    expect(screen.queryByText('Profile updated.')).toBeNull();
  });
});

describe('My Profile — Change Password', () => {
  it('sends both passwords to the server', async () => {
    changePassword.mockResolvedValue({ changed: true });
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Change Password')).toBeTruthy());
    fireEvent.click(screen.getByText('Change Password'));

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'oldpass123' },
    });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass456' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'newpass456' },
    });
    fireEvent.click(screen.getByText('Change'));

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    expect(changePassword.mock.calls[0][0]).toEqual({
      currentPassword: 'oldpass123',
      newPassword: 'newpass456',
    });
    await waitFor(() => expect(screen.getByText('Password changed.')).toBeTruthy());
  });

  it('refuses a new password under the server minimum', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Change Password')).toBeTruthy());
    fireEvent.click(screen.getByText('Change Password'));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByText('Change'));
    await waitFor(() =>
      expect(screen.getByText('The new password must be at least 8 characters.')).toBeTruthy(),
    );
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('refuses when the confirmation does not match', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Change Password')).toBeTruthy());
    fireEvent.click(screen.getByText('Change Password'));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass456' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'newpass457' },
    });
    fireEvent.click(screen.getByText('Change'));
    await waitFor(() =>
      expect(screen.getByText('The two new passwords do not match.')).toBeTruthy(),
    );
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('reports a wrong current password rather than claiming success', async () => {
    changePassword.mockRejectedValue({ message: 'Current password is incorrect' });
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Change Password')).toBeTruthy());
    fireEvent.click(screen.getByText('Change Password'));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass456' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'newpass456' },
    });
    fireEvent.click(screen.getByText('Change'));
    await waitFor(() => expect(screen.getByText('Current password is incorrect')).toBeTruthy());
    expect(screen.queryByText('Password changed.')).toBeNull();
  });
});

describe('My Profile — Active Sessions', () => {
  it('lists real sessions instead of an empty card', async () => {
    listSessions.mockResolvedValue({
      items: [session({ current: true, sessionId: 'self' }), session({ sessionId: 's2' })],
    });
    await renderProfile();
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByText(/Chrome · Android/).length).toBe(2));
    expect(screen.getByText('THIS DEVICE')).toBeTruthy();
  });

  it('never offers to sign out the session being used', async () => {
    listSessions.mockResolvedValue({ items: [session({ current: true, sessionId: 'self' })] });
    await renderProfile();
    await waitFor(() => expect(screen.getByText('THIS DEVICE')).toBeTruthy());
    expect(screen.queryByText('Sign out')).toBeNull();
  });

  it('revokes one session through the API', async () => {
    listSessions.mockResolvedValue({
      items: [session({ current: true, sessionId: 'self' }), session({ sessionId: 's2' })],
    });
    revokeSession.mockResolvedValue(undefined);
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Sign out')).toBeTruthy());
    fireEvent.click(screen.getByText('Sign out'));
    await waitFor(() => expect(revokeSession).toHaveBeenCalledWith('s2'));
    await waitFor(() => expect(screen.getByText('Session signed out.')).toBeTruthy());
  });

  it('reports how many other sessions were signed out', async () => {
    listSessions.mockResolvedValue({
      items: [session({ current: true, sessionId: 'self' }), session({ sessionId: 's2' })],
    });
    revokeOtherSessions.mockResolvedValue({ revokedCount: 3 });
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Sign out others')).toBeTruthy());
    fireEvent.click(screen.getByText('Sign out others'));
    await waitFor(() => expect(revokeOtherSessions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('3 other sessions signed out.')).toBeTruthy());
  });

  it('keeps the profile usable when only the session list fails', async () => {
    listSessions.mockRejectedValue({ message: 'Sessions unavailable' });
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Sessions unavailable')).toBeTruthy());
    expect(screen.getByLabelText('First name')).toBeTruthy();
  });
});

describe('My Profile — claims nothing the platform does not enforce', () => {
  it('presents no on/off switch at all', async () => {
    // Structural on purpose. The first version of this test named the exact
    // labels it expected to be absent ("Two-Factor Authentication", "Email
    // Notifications"), so it went on passing when the very same switches were
    // put back under any other spelling — a mutation that reintroduced a
    // two-factor switch as "Two-factor authentication" did not move it.
    //
    // The invariant is not about wording. Nothing this page could switch has
    // anywhere on the server to be stored, so the honest number of switches
    // is zero, whatever they would be called.
    const { container } = await renderProfile();
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeTruthy());

    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(container.querySelectorAll('[role="switch"]').length).toBe(0);
  });

  it('puts two-factor, OTP and notifications in no interactive control', async () => {
    const { container } = await renderProfile();
    await waitFor(() => expect(screen.getByLabelText('First name')).toBeTruthy());

    // The words may appear in prose — the card below says exactly why neither
    // is configurable here. What they may not appear in is anything an
    // operator can operate.
    const controls = [
      ...container.querySelectorAll(
        'button, input, select, textarea, [role="switch"], [role="checkbox"], [role="button"]',
      ),
    ];
    const claiming = controls.filter((el) =>
      /two.?factor|\bOTP\b|notification/i.test(
        `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`,
      ),
    );

    expect(claiming.map((el) => el.getAttribute('aria-label') ?? el.textContent)).toEqual([]);
  });

  it('says plainly that two-factor and operator notifications are not configurable here', async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText('Not configurable here')).toBeTruthy());
    expect(screen.getByText(/no endpoint on the platform yet/)).toBeTruthy();
  });
});
