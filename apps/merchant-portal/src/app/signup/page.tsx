import * as React from 'react';

import { SignupForm } from '@/components/signup-form';

export default function SignupPage(): React.JSX.Element {
  return (
    <main className="container flex min-h-dvh flex-col justify-center py-10">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Create your merchant account
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Sign up and verify your email, then set up your business for Operations review.
        </p>
      </div>
      <SignupForm />
    </main>
  );
}
