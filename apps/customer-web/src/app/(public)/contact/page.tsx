import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

/**
 * Contact routes.
 *
 * This page used to render a ContactForm that made no network call at all: it
 * showed the user "Message captured" and then discarded what they had typed.
 * Both store listings point here as the support URL, so a reviewer — and any
 * real customer — was being told their message had been received when nothing
 * had been sent anywhere.
 *
 * Until operations intake is productized, addresses that a human actually reads
 * are the honest thing to show. The form comes back when there is somewhere for
 * it to post; ContactForm is left in misc-forms.tsx for that.
 */
export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach the DrippleX team.',
};

const ROUTES = [
  {
    address: 'support@dripplex.com',
    label: 'Support',
    detail: 'Orders, deliveries, rides, payments and anything not working as it should.',
  },
  {
    address: 'privacy@dripplex.com',
    label: 'Privacy and data',
    detail: 'Access to your data, corrections, and account deletion requests.',
  },
  {
    address: 'legal@dripplex.com',
    label: 'Legal',
    detail: 'Terms, compliance and merchant agreements.',
  },
] as const;

export default function ContactPage(): React.JSX.Element {
  return (
    <div className="container max-w-2xl py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Contact</h1>
      <p className="text-muted-foreground mt-3">
        Email the address that fits and a person will pick it up. Include your phone number or order
        reference if it relates to something specific — it saves a round trip.
      </p>

      <div className="mt-8 space-y-4">
        {ROUTES.map((route) => (
          <div
            key={route.address}
            className="border-border/80 bg-card/80 shadow-elevation-1 rounded-lg border p-5"
          >
            <p className="text-sm font-semibold">{route.label}</p>
            <a
              className="mt-1 inline-block text-base underline underline-offset-4"
              href={`mailto:${route.address}`}
            >
              {route.address}
            </a>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{route.detail}</p>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground mt-8 text-sm leading-relaxed">
        Looking to close your account? The{' '}
        <Link className="underline underline-offset-4" href="/account-deletion">
          account deletion page
        </Link>{' '}
        explains what happens and how to ask.
      </p>
    </div>
  );
}
