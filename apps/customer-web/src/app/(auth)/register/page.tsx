import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

import { RegisterForm } from '@/components/forms/register-form';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your Dripplex customer account.',
};

export default function RegisterPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Create Account</h1>
        <p className="text-muted-foreground text-sm">
          Join Dripplex — <span className="font-display text-foreground">life,Simplified</span>.
        </p>
      </div>
      <RegisterForm />
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
