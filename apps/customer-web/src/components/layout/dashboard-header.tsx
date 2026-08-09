'use client';

import { ThemeToggle, useAuth } from '@dripplex/hooks';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dripplex/ui';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { NotificationBell } from '@/components/layout/notification-bell';
import { SearchBar } from '@/components/layout/search-bar';
import { sdk } from '@/lib/sdk';
import { siteConfig } from '@/lib/site';
import { useUiStore } from '@/stores/ui-store';

export function DashboardHeader(): React.JSX.Element {
  const router = useRouter();
  const { user, clearSession } = useAuth();
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'DP';

  const onLogout = async (): Promise<void> => {
    try {
      await sdk.auth.logout();
    } catch {
      // Local clear still required.
    } finally {
      clearSession();
      router.push(siteConfig.links.login);
    }
  };

  return (
    <header className="border-border/70 bg-background/85 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={() => {
            setMobileNavOpen(true);
          }}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleSidebarCollapsed}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>
        <SearchBar className="hidden sm:block" />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="relative h-10 w-10 rounded-full p-0"
                aria-label="Open profile menu"
              >
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                {user ? `${user.firstName} ${user.lastName}` : 'My account'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/wallet">Wallet</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void onLogout();
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="border-border/60 border-t px-4 py-2 sm:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
