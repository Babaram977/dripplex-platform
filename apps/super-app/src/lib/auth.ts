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

  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isLoggedIn(): boolean {
    return !!localStorage.getItem(ACCESS_KEY);
  },

  // Convenience: full display name
  displayName(user: DxUser | null): string {
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`.trim();
  },
};
