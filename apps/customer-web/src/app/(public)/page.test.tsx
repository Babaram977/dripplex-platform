import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import LandingPage from '@/app/(public)/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
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

describe('LandingPage', () => {
  it('renders brand, tagline, CTAs, and feature modules', () => {
    render(<LandingPage />);

    // The splash intro and hero section each render their own logo/wordmark.
    expect(screen.getAllByText('Dripplex').length).toBeGreaterThan(0);
    expect(screen.getByText('life, Simplified')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute(
      'href',
      '/get-started',
    );
    expect(screen.getByRole('link', { name: 'I already have an account' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('heading', { name: /Everything you need/i })).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Food Delivery')).toBeInTheDocument();
    expect(screen.getByText('Ride')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();
  });
});
