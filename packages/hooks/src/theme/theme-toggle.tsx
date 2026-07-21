'use client';

import { Button } from '@dripplex/ui';
import { Monitor, Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { applyThemeClass, useThemeStore, type ThemeMode } from './theme-store';

const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" aria-hidden="true" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" aria-hidden="true" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" aria-hidden="true" /> },
];

export function ThemeToggle(): React.JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  React.useEffect(() => {
    applyThemeClass(theme);
    if (theme !== 'system') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      applyThemeClass('system');
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, [theme]);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="border-border bg-background/70 inline-flex items-center gap-1 rounded-md border p-1"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="icon"
          variant={theme === option.value ? 'secondary' : 'ghost'}
          aria-label={`${option.label} theme`}
          aria-pressed={theme === option.value}
          onClick={() => {
            setTheme(option.value);
          }}
        >
          {option.icon}
        </Button>
      ))}
    </div>
  );
}
