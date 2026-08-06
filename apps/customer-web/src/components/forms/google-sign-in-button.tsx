'use client';

import { Button } from '@dripplex/ui';
import * as React from 'react';

import { sdk } from '@/lib/sdk';

/**
 * Starts the Google OAuth flow with a full-page browser redirect to the
 * backend's /auth/google route — this is deliberately a navigation, not an
 * SDK request, since the backend needs to redirect the browser to Google's
 * consent screen and back.
 */
export function GoogleSignInButton(): React.JSX.Element {
  const handleClick = React.useCallback(() => {
    window.location.href = sdk.auth.googleSignInUrl();
  }, []);

  return (
    <Button type="button" variant="outline" className="w-full gap-2" onClick={handleClick}>
      <GoogleIcon className="h-4 w-4" />
      Continue with Google
    </Button>
  );
}

function GoogleIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.4 19 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3c-7.5 0-14 3.9-17.7 9.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.5-5.5C29.6 36 26.9 37 24 37c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.8 40.9 16.3 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.5 5.5C40.9 36.6 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
