// ─── DrippleX Auth Token Manager ─────────────────────────────────────────────
// Field names match the real PortalLoginResponse from the backend contract.

const ACCESS_KEY = 'dx_access_token';
const REFRESH_KEY = 'dx_refresh_token';
const USER_KEY = 'dx_user';

// Matches AuthUserProfile from /auth/me and PortalLoginResponse.user
export interface DxUser {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  roles: string[];
  permissions: string[];
}

export const auth = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },

  // Backend returns { accessToken, refreshToken } (camelCase)
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },

  setUser(user: DxUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getUser(): DxUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as DxUser) : null;
  },

  /**
   * The name to greet this person by, or null when we genuinely don't know one.
   *
   * Screens used to fall back to the bare word "there" — the tail of "Hi there"
   * with the greeting stripped off — and then render it in the slot reserved for
   * the customer's name, so the app appeared to believe the person was called
   * "there". Callers get null instead and choose a greeting that reads without a
   * name. Empty strings count as unknown: a signed-up-but-unnamed account stores
   * firstName as "", which `??` would have happily rendered as a blank line.
   */
  greetingName(): string | null {
    const u = this.getUser();
    if (!u) return null;
    const first = u.firstName?.trim();
    if (first) return first;
    const last = u.lastName?.trim();
    if (last) return last;
    const local = u.email?.split('@')[0]?.trim();
    return local || null;
  },

  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isLoggedIn(): boolean {
    return !!localStorage.getItem(ACCESS_KEY);
  },

  /** True when the stored session carries the given role (e.g. 'driver'). */
  hasRole(role: string): boolean {
    return this.getUser()?.roles.includes(role) ?? false;
  },

  // Convenience: full display name
  displayName(user: DxUser | null): string {
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`.trim();
  },
};

/**
 * End the session, everywhere, the same way.
 *
 * Every portal had rolled its own — or, for customers and drivers, none at all:
 * the only way out was to refresh the page, which dumped you on the splash
 * screen still signed in. Riders had no exit either until the Account screen
 * shipped. This revokes the session server-side and clears the device
 * regardless, so a network failure can never strand someone signed in.
 *
 * `logout` is passed in rather than imported to keep this module free of a
 * dependency on the API client (which imports auth).
 *
 * The revoke is raced against a timeout. Callers navigate in the `.then` of
 * this promise, so a request that never settles — a dropped connection, a
 * gateway holding the socket open — left the person sitting on the Account
 * screen with nothing happening, which is exactly what "Sign Out does nothing"
 * looks like. Four seconds, then the device is cleared regardless.
 */
const REVOKE_TIMEOUT_MS = 4000;

export async function endSession(logout?: () => Promise<unknown>): Promise<void> {
  try {
    if (logout) {
      await Promise.race([
        logout().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, REVOKE_TIMEOUT_MS)),
      ]);
    }
  } finally {
    // Best effort server-side: the local session is cleared either way.
    auth.clear();
  }
}
