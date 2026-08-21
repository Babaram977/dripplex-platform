import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import ContactPage from '@/app/(public)/contact/page';

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

describe('ContactPage', () => {
  it('offers contact routes that actually reach someone', () => {
    render(<ContactPage />);

    for (const address of ['support@dripplex.com', 'privacy@dripplex.com', 'legal@dripplex.com']) {
      expect(screen.getByRole('link', { name: address })).toHaveAttribute(
        'href',
        `mailto:${address}`,
      );
    }
  });

  it('never claims a message was received', () => {
    const { container } = render(<ContactPage />);

    // The page this replaced told users "Message captured" and then threw the
    // message away. Nothing here may imply receipt until something can receive.
    expect(container.textContent).not.toMatch(/captured|received|we'?ll get back/i);
  });

  it('points account closure at the deletion page', () => {
    render(<ContactPage />);

    expect(screen.getByRole('link', { name: 'account deletion page' })).toHaveAttribute(
      'href',
      '/account-deletion',
    );
  });
});
