'use client';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@dripplex/ui';
import { Navigation } from 'lucide-react';
import * as React from 'react';

import { buildNavAppOptions, type NavDestination } from '@/lib/maps';

/**
 * DPX-DRIVER Slice 2 — navigation handoff (founder-approved 2026-08-04):
 * a 3-option picker (Google Maps / Apple Maps / Waze) instead of a single
 * hardcoded link, so the driver can hand off to whichever app they actually
 * have installed. Each option is a plain universal link opened in a new
 * tab/window — the OS resolves it to the native app if installed, else a
 * web fallback. No in-app voice navigation, per the founder's decision.
 */
export function NavigateButton({
  destination,
  label,
}: {
  destination: NavDestination;
  label: string;
}): React.JSX.Element {
  const options = buildNavAppOptions(destination);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          <Navigation className="mr-2 h-4 w-4" aria-hidden="true" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {options.map((option) => (
          <DropdownMenuItem key={option.label} asChild>
            <a href={option.url} target="_blank" rel="noreferrer">
              {option.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
