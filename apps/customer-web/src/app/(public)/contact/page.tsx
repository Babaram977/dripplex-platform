import * as React from 'react';

import type { Metadata } from 'next';

import { ContactForm } from '@/components/forms/misc-forms';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact the Dripplex team.',
};

export default function ContactPage(): React.JSX.Element {
  return (
    <div className="container max-w-xl py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Contact</h1>
      <p className="text-muted-foreground mt-3">
        Tell us how we can help. Support routing will connect to operations in a later release.
      </p>
      <div className="border-border/80 bg-card/80 shadow-elevation-1 mt-8 rounded-lg border p-6">
        <ContactForm />
      </div>
    </div>
  );
}
