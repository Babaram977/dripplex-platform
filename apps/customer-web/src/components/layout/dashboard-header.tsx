'use client';

import { ThemeToggle } from '@dripplex/hooks';
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
import { Bell, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { SearchBar } from '@/components/layout/search-bar';
import { useUiStore } from '@/stores/ui-store';

export function DashboardHeader(): React.JSX.Element {
  const collapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

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
          <Button type="button" variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="relative h-10 w-10 rounded-full p-0"
                aria-label="Open profile menu"
              >
                <Avatar>
                  <AvatarFallback>DP</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard#profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard#wallet">Wallet</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/login">Sign out</Link>
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
