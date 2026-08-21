import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import AccountDeletionPage from '@/app/(public)/account-deletion/page';

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

describe('AccountDeletionPage', () => {
  it('gives a working way to request deletion without the app installed', () => {
    render(<AccountDeletionPage />);

    // This is the whole point of the page as far as Google Play is concerned:
    // a reachable request route for someone who does not have the app.
    expect(screen.getAllByRole('link', { name: 'privacy@dripplex.com' })[0]).toHaveAttribute(
      'href',
      'mailto:privacy@dripplex.com',
    );
    expect(screen.getByRole('link', { name: 'contact page' })).toHaveAttribute('href', '/contact');
  });

  it('states what is erased and what is retained, not just that deletion exists', () => {
    render(<AccountDeletionPage />);

    expect(screen.getByRole('heading', { name: 'What we erase or anonymise' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'What we are required to keep' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Order and delivery records/)).toBeInTheDocument();
  });

  it('names the obligations that pause a deletion request', () => {
    render(<AccountDeletionPage />);

    // Founder policy: a request is never refused outright, only deferred while
    // something is outstanding — see docs/DPX-ACCOUNT-DELETION-001.md §2.
    expect(screen.getByText(/Money in your Dripplex wallet/)).toBeInTheDocument();
    expect(screen.getByText(/Cash you are holding as a rider or driver/)).toBeInTheDocument();
  });

  it('promises no indefinite block on an unwithdrawable balance', () => {
    render(<AccountDeletionPage />);

    // The one commitment on this page that is a locked founder decision rather
    // than a description of behaviour (DPX-ACCOUNT-DELETION-001 §2, §10a). If
    // this wording is ever removed, the page contradicts the policy.
    expect(
      screen.getByText(/never be used as a reason to refuse to close your account/),
    ).toBeInTheDocument();
  });

  it('does not invent a retention period', () => {
    const { container } = render(<AccountDeletionPage />);

    // §10b is unresolved pending legal review. Publishing a number we have not
    // been advised on would be a false statement to users.
    expect(container.textContent).not.toMatch(/\b\d+\s*(years?|months?|days?)\b/i);
    expect(screen.getByText(/confirming\s+the exact retention periods/)).toBeInTheDocument();
  });
});
