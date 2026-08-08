import { AuthProvider, useAuthStore } from '@dripplex/hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardShellLayout from '@/app/(dashboard)/layout';

vi.mock('@/lib/sdk', () => ({
  sdk: {
    notifications: {
      list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }),
    },
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<{ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('DashboardLayout', () => {
  beforeEach(() => {
    useAuthStore.setState({
      hydrated: true,
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      user: {
        id: 'u1',
        email: 'a@b.com',
        phone: null,
        firstName: 'Ada',
        lastName: 'Okafor',
        profilePhotoUrl: null,
        dateOfBirth: null,
        gender: null,
        status: 'ACTIVE',
        roles: ['CUSTOMER'],
        permissions: [],
      },
      portal: 'customer',
    });
  });

  it('renders header chrome, sidebar, mobile nav, and content area', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DashboardShellLayout>
            <div>Dashboard child content</div>
          </DashboardShellLayout>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(screen.getAllByLabelText('Search Dripplex').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Open profile menu')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard sidebar')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard child content')).toBeInTheDocument();
  });
});
