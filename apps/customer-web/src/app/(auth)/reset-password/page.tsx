import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/forms/misc-forms';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Choose a new Dripplex password.',
};

export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-muted-foreground text-sm">Choose a strong password for your account.</p>
      </div>
      <ResetPasswordForm />
      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
