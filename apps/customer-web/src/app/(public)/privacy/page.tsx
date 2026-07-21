import * as React from 'react';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Dripplex privacy policy overview for the customer platform.',
};

export default function PrivacyPage(): React.JSX.Element {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-4">
        Dripplex collects and processes personal data only as needed to operate the Super Platform,
        protect accounts, and improve service reliability. We never sell personal data.
      </p>
      <ul className="mt-8 list-disc space-y-3 pl-5 text-sm leading-relaxed">
        <li>Account identifiers such as email, phone, and profile details</li>
        <li>Transactional metadata required for orders, rides, and wallet activity</li>
        <li>Device and security signals used for fraud prevention</li>
      </ul>
      <p className="text-muted-foreground mt-8 text-sm">
        A complete legal policy will be published before public launch. Contact privacy@dripplex.com
        for data requests.
      </p>
    </div>
  );
}
