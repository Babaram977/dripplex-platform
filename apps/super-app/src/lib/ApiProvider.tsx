// ─── DrippleX ApiProvider ─────────────────────────────────────────────────────
// Wrap your App root with this once. It:
//   1. Exposes the current user via useDxAuth()
//   2. Opens the WebSocket when a user is logged in
//   3. Handles session-expiry events globally
//
// Usage:
//   <ApiProvider>
//     <App />
//   </ApiProvider>
//
//   const { user, login, logout, loading } = useDxAuth();

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, DxUser } from './auth';
import { api, ApiError, PortalLoginResponse } from './api';
import { ws } from './ws';

interface AuthCtx {
  user: DxUser | null;
  loading: boolean;
  // Login with persona — call api.auth.loginCustomer / loginDriver / etc. externally,
  // then pass the result to loginWithResponse to store tokens and update state.
  loginWithResponse: (resp: PortalLoginResponse) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  error: string | null;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  loginWithResponse: () => {},
  logout: () => {},
  refreshUser: async () => {},
  error: null,
});

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DxUser | null>(auth.getUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verify stored token on mount and sync current user from server
  useEffect(() => {
    if (!auth.isLoggedIn()) {
      setLoading(false);
      return;
    }
    api.auth
      .me()
      .then((u) => {
        auth.setUser(u);
        setUser(u);
      })
      .catch(() => {
        auth.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Open / close WS with auth state (only for ride-capable personas)
  useEffect(() => {
    if (user) {
      ws.connect();
    } else {
      ws.disconnect();
    }
    return () => {
      ws.disconnect();
    };
  }, [user]);

  // Global session-expired handler
  useEffect(() => {
    const handler = () => {
      auth.clear();
      setUser(null);
    };
    window.addEventListener('dx:session-expired', handler);
    return () => window.removeEventListener('dx:session-expired', handler);
  }, []);

  const loginWithResponse = (resp: PortalLoginResponse) => {
    setError(null);
    try {
      auth.setTokens(resp.accessToken, resp.refreshToken);
      auth.setUser(resp.user);
      setUser(resp.user);
      ws.updateAuth();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      setError(msg);
      throw err;
    }
  };

  const refreshUser = async () => {
    try {
      const u = await api.auth.me();
      auth.setUser(u);
      setUser(u);
    } catch {
      // silently swallow — caller can handle
    }
  };

  const logout = () => {
    api.auth.logout().catch(() => {});
    ws.disconnect();
    auth.clear();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, loginWithResponse, logout, refreshUser, error }}>
      {children}
    </Ctx.Provider>
  );
}

export const useDxAuth = () => useContext(Ctx);
