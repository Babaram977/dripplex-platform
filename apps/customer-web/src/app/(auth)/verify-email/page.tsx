import Link from 'next/link';
import * as React from 'react';
import { Suspense } from 'react';

import type { Metadata } from 'next';

import { VerifyEmailForm } from '@/components/forms/misc-forms';

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Confirm your Dripplex email address.',
};

export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Verify your email</h1>
        <p className="text-muted-foreground text-sm">
          Confirm your email address to finish setting up your account.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <VerifyEmailForm />
      </Suspense>
      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
