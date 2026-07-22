import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AuthTokensUpdate, SdkConfig } from '@dripplex/sdk';
import type { AuthUserProfile, PortalLoginType } from '@dripplex/types';

export type AuthPortal = PortalLoginType | 'admin' | 'operations';

export interface AuthSessionSnapshot {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  user: AuthUserProfile | null;
  portal: AuthPortal;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: string | null;
  user: AuthUserProfile | null;
  portal: AuthPortal | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setSession: (session: AuthSessionSnapshot) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string; expiresIn?: string }) => void;
  setUser: (user: AuthUserProfile | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      user: null,
      portal: null,
      hydrated: false,
      setHydrated: (value) => {
        set({ hydrated: value });
      },
      setSession: (session) => {
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn ?? null,
          user: session.user,
          portal: session.portal,
        });
      },
      setTokens: (tokens) => {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn ?? null,
        });
      },
      setUser: (user) => {
        set({ user });
      },
      clearSession: () => {
        set({
          accessToken: null,
          refreshToken: null,
          expiresIn: null,
          user: null,
          portal: null,
        });
      },
    }),
    {
      name: 'dripplex-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresIn: state.expiresIn,
        user: state.user,
        portal: state.portal,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

/** Bind Zustand auth storage to SDK token callbacks (safe outside React). */
export function bindSdkAuth(): Pick<
  SdkConfig,
  'getAccessToken' | 'getRefreshToken' | 'onTokensUpdated' | 'onUnauthorized'
> {
  return {
    getAccessToken: () => useAuthStore.getState().accessToken,
    getRefreshToken: () => useAuthStore.getState().refreshToken,
    onTokensUpdated: (tokens: AuthTokensUpdate) => {
      useAuthStore.getState().setTokens(tokens);
    },
    onUnauthorized: () => {
      useAuthStore.getState().clearSession();
    },
  };
}
