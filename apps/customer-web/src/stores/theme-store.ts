import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function applyThemeClass(theme: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.dataset['theme'] = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
    }),
    {
      name: 'dripplex-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeClass(state.theme);
        }
      },
    },
  ),
);
