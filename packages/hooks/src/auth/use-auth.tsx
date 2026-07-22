'use client';

import * as React from 'react';

import { useAuthStore, type AuthPortal, type AuthSessionSnapshot } from './auth-store';

import type { AuthUserProfile } from '@dripplex/types';

export interface AuthContextValue {
  hydrated: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUserProfile | null;
  portal: AuthPortal | null;
  setSession: (session: AuthSessionSnapshot) => void;
  setUser: (user: AuthUserProfile | null) => void;
  clearSession: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const user = useAuthStore((s) => s.user);
  const portal = useAuthStore((s) => s.portal);
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const clearSession = useAuthStore((s) => s.clearSession);

  React.useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      if (!hydrated) {
        useAuthStore.getState().setHydrated(true);
      }
      return;
    }

    void Promise.resolve(useAuthStore.persist.rehydrate()).finally(() => {
      useAuthStore.getState().setHydrated(true);
    });
  }, [hydrated]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      hydrated,
      isAuthenticated: Boolean(accessToken),
      accessToken,
      refreshToken,
      user,
      portal,
      setSession,
      setUser,
      clearSession,
      hasPermission: (permission: string) => Boolean(user?.permissions.includes(permission)),
      hasRole: (role: string) => Boolean(user?.roles.includes(role)),
    }),
    [hydrated, accessToken, refreshToken, user, portal, setSession, setUser, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
