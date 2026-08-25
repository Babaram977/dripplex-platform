import * as React from 'react';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'DrippleX terms of use for the customer platform.',
};

export default function TermsPage(): React.JSX.Element {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Terms of Use</h1>
      <p className="text-muted-foreground mt-4">
        By using DrippleX, you agree to use the platform lawfully, keep your credentials secure, and
        respect merchants, riders, drivers, and other customers.
      </p>
      <ul className="mt-8 list-disc space-y-3 pl-5 text-sm leading-relaxed">
        <li>Provide accurate account information</li>
        <li>Do not attempt unauthorized access to systems or data</li>
        <li>Follow local laws while using marketplace, delivery, and mobility services</li>
      </ul>
      <p className="text-muted-foreground mt-8 text-sm">
        Final contractual terms will accompany production launch. Questions: legal@dripplex.com.
      </p>
    </div>
  );
}
