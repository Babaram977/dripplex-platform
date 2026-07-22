import * as React from 'react';

import { LoginForm } from '@/components/login-form';

export default function LoginPage(): React.JSX.Element {
  return (
    <main className="container flex min-h-dvh flex-col justify-center py-10">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Authenticate against live Backend Core.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
