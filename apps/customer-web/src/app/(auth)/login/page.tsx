import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

import { LoginForm } from '@/components/forms/login-form';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to your Dripplex account.',
};

export default function LoginPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center lg:text-left">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">
          Login to continue to your Dripplex dashboard.
        </p>
      </div>
      <LoginForm />
      <p className="text-muted-foreground text-center text-sm">
        New here?{' '}
        <Link href="/register" className="text-primary font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
