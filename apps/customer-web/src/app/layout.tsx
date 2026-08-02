import { AppProviders } from '@dripplex/hooks';
import { Manrope, Sora } from 'next/font/google';
import * as React from 'react';

import type { Metadata, Viewport } from 'next';

import { PushRegistration } from '@/components/pwa/push-registration';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { siteConfig } from '@/lib/site';

import './globals.css';

const display = Sora({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    'Dripplex',
    'Nigeria',
    'Super Platform',
    'marketplace',
    'food delivery',
    'ride hailing',
    'wallet',
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/app-icon.svg' }],
  },
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F6F8' },
    { media: '(prefers-color-scheme: dark)', color: '#0A2540' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('dripplex-theme');var m=t?JSON.parse(t).state.theme:'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.dataset.theme=d?'dark':'light';e.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
        <AppProviders>
          <ServiceWorkerRegister />
          <PushRegistration />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
