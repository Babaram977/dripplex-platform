import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/forms/misc-forms';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description: 'Reset your Dripplex password.',
};

export default function ForgotPasswordPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and we&rsquo;ll send you a link to reset your password.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
