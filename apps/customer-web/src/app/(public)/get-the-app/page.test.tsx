import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The page reads NEXT_PUBLIC_APK_URL at module scope, so each case has to
 * set the variable and then import a fresh copy of the module.
 */
async function renderPage(apkUrl?: string): Promise<void> {
  vi.resetModules();
  if (apkUrl === undefined) {
    delete process.env['NEXT_PUBLIC_APK_URL'];
  } else {
    process.env['NEXT_PUBLIC_APK_URL'] = apkUrl;
  }
  const { default: GetTheAppPage } = await import('@/app/(public)/get-the-app/page');
  render(<GetTheAppPage />);
}

afterEach(() => {
  delete process.env['NEXT_PUBLIC_APK_URL'];
});

describe('GetTheAppPage', () => {
  it('always offers a way into the app that needs no install', async () => {
    await renderPage();

    // The Android build is only a shell around the Super App, so the browser
    // link is the one route that works for everyone, on any phone.
    expect(screen.getByRole('link', { name: 'Open the app' })).toHaveAttribute(
      'href',
      'https://app.dripplex.com',
    );
  });

  it('hides the Android download until a public APK URL exists', async () => {
    await renderPage();

    // Builds live behind a GitHub login and expire. Showing the button with
    // nothing real behind it would send people to a sign-in wall.
    expect(screen.queryByRole('link', { name: /download for android/i })).not.toBeInTheDocument();
  });

  it('shows the Android download once one is configured', async () => {
    await renderPage('https://cdn.example.com/dripplex.apk');

    expect(screen.getByRole('link', { name: /download for android/i })).toHaveAttribute(
      'href',
      'https://cdn.example.com/dripplex.apk',
    );
  });
});
