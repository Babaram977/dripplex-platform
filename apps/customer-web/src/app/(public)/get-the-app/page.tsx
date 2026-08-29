import { Smartphone, Download } from 'lucide-react';
import * as React from 'react';

import type { Metadata } from 'next';

import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Get the app',
  description: 'Open DrippleX on your phone to order, ride, send parcels, and pay.',
};

/**
 * Where the website hands every signed-in person over to the product.
 *
 * dripplex.com is marketing only: the website sells DrippleX and lets a
 * customer create an account, and everything you actually *do* happens in the
 * app. Signing in, and every app route that used to live on this domain,
 * lands here.
 *
 * Two ways in, deliberately in this order:
 *
 * 1. Open the app in the phone browser. This always works and needs no
 *    install, which matters because the Android build is only a shell around
 *    app.dripplex.com — the same product, same account, same screens. For
 *    someone on a cheap phone with little storage, this is the shorter path.
 * 2. Download the Android app, shown only when APK_URL is configured.
 *
 * The download stays behind an env var because there is no public APK URL
 * yet. Builds are GitHub Actions artifacts, which need a GitHub login and
 * expire, so linking one would hand most visitors a sign-in wall instead of
 * an app. Set NEXT_PUBLIC_APK_URL once the file is hosted somewhere public
 * and the button appears on its own — no code change.
 *
 * Written for Kano: few words, short ones, and the action is a button you
 * cannot miss rather than a sentence you have to read.
 */
const APK_URL = process.env['NEXT_PUBLIC_APK_URL'];

export default function GetTheAppPage(): React.JSX.Element {
  return (
    <div className="container flex max-w-xl flex-col items-center py-16 text-center">
      <span
        aria-hidden="true"
        className="bg-primary/10 text-primary flex h-20 w-20 items-center justify-center rounded-2xl"
      >
        <Smartphone className="h-10 w-10" />
      </span>

      <h1 className="font-display mt-8 text-4xl font-semibold tracking-tight">
        Your account is ready
      </h1>
      <p className="text-muted-foreground mt-4 text-lg">
        Use the DrippleX app to order food, book a ride, send a parcel, and pay.
      </p>

      <a
        href={siteConfig.appUrl}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-10 inline-flex w-full items-center justify-center rounded-xl px-8 py-5 text-xl font-semibold shadow-sm transition-colors"
      >
        Open the app
      </a>

      {APK_URL ? (
        <a
          href={APK_URL}
          className="border-border hover:bg-muted mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-8 py-5 text-lg font-medium transition-colors"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          Download for Android
        </a>
      ) : null}

      <p className="text-muted-foreground mt-8 text-base">
        Sign in with the same phone number you registered with.
      </p>
    </div>
  );
}
