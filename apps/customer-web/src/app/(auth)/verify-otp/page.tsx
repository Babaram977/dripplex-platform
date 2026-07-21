import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

import { VerifyOtpForm } from '@/components/forms/misc-forms';

export const metadata: Metadata = {
  title: 'Verify OTP',
  description: 'Verify your Dripplex one-time code.',
};

export default function VerifyOtpPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Verify OTP</h1>
        <p className="text-muted-foreground text-sm">Enter the code sent to your email or phone.</p>
      </div>
      <VerifyOtpForm />
      <p className="text-muted-foreground text-center text-sm">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
