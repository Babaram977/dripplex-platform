import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import AuthLayout from '@/app/(auth)/layout';

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

describe('AuthenticationLayout', () => {
  it('renders brand framing and auth content slot', () => {
    render(
      <AuthLayout>
        <div>Auth child content</div>
      </AuthLayout>,
    );

    expect(screen.getAllByLabelText('Dripplex home').length).toBeGreaterThan(0);
    expect(screen.getAllByText('life,Simplified').length).toBeGreaterThan(0);
    expect(screen.getByText('Auth child content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to site' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
  });
});
