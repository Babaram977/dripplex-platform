import { AuthProvider } from '@dripplex/hooks';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import DashboardShellLayout from '@/app/(dashboard)/layout';

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
  it('renders header chrome, sidebar, mobile nav, and content area', () => {
    render(
      <AuthProvider>
        <DashboardShellLayout>
          <div>Dashboard child content</div>
        </DashboardShellLayout>
      </AuthProvider>,
    );

    expect(screen.getAllByLabelText('Search Dripplex').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Open profile menu')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard sidebar')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard child content')).toBeInTheDocument();
  });
});
