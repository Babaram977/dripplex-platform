import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

/**
 * Public account-deletion information page.
 *
 * Google Play requires a deletion route reachable WITHOUT installing the app,
 * and this URL is what goes in the Play Console. Apple requires in-app deletion
 * separately (5.1.1(v)) — that flow does not exist yet.
 *
 * Deliberately an information page, not a request form. The backend deletion
 * endpoint, the obligation checks and the anonymisation job are specified in
 * docs/DPX-ACCOUNT-DELETION-001.md and gated on a legal review of Nigerian
 * retention periods. Shipping a form that files a request nothing can act on
 * would be worse than sending people to a channel a human actually reads.
 *
 * Everything stated below is drawn from that specification. Nothing here
 * invents a retention period, because none has been determined.
 */
export const metadata: Metadata = {
  title: 'Delete your account',
  description:
    'How to request deletion of your Dripplex account, what is erased, and what we are required to keep.',
};

const ERASED = [
  'Your name, email address and phone number',
  'Your profile photo',
  'Your saved delivery addresses',
  'Your date of birth',
  'Your sign-in credentials and active sessions',
  'Your device tokens, so notifications stop immediately',
];

const RETAINED = [
  'Order and delivery records, and the amounts involved',
  'Wallet and payment transaction history',
  'Merchant payout and settlement records',
  'Identity-verification records where you completed KYC',
  'Security and fraud-prevention records',
];

const BLOCKERS = [
  'Money in your Dripplex wallet that has not been withdrawn',
  'A withdrawal that is still being processed',
  'An order or ride in progress',
  'A refund that has not been resolved',
  'A merchant payout still owing to you',
  'Cash you are holding as a rider or driver on the platform’s behalf',
];

function Section({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: Readonly<{ items: readonly string[] }>): React.JSX.Element {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function AccountDeletionPage(): React.JSX.Element {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Delete your account</h1>
      <p className="text-muted-foreground mt-4">
        You can ask us to close your Dripplex account at any time. This page explains how to make
        that request, what we erase, and what the law requires us to keep.
      </p>

      <Section title="How to request deletion">
        <p className="mt-4 text-sm leading-relaxed">
          Email{' '}
          <a className="underline underline-offset-4" href="mailto:privacy@dripplex.com">
            privacy@dripplex.com
          </a>{' '}
          from the email address on your account, or send us a message through our{' '}
          <Link className="underline underline-offset-4" href="/contact">
            contact page
          </Link>
          . Tell us you want your account deleted. You do not need the app installed.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          We will confirm we have received your request, tell you whether anything needs settling
          first, and email you again once the deletion is complete.
        </p>
      </Section>

      <Section title="What deleting your account does not mean">
        <p className="mt-4 text-sm leading-relaxed">
          Closing your account is not the same as erasing every record of it. Three different things
          happen, and it is fairer to say so plainly than to imply everything disappears.
        </p>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed">
          <li>
            <strong>Your account closes.</strong> You can no longer sign in, and we stop contacting
            you.
          </li>
          <li>
            <strong>Your personal details are erased or anonymised</strong> wherever nothing
            requires us to keep them.
          </li>
          <li>
            <strong>Some records survive</strong> because financial, tax and anti-money-laundering
            rules require it. Those records are kept for as long as the law requires and no longer,
            and they are no longer linked to a usable account.
          </li>
        </ul>
      </Section>

      <Section title="What we erase or anonymise">
        <Bullets items={ERASED} />
      </Section>

      <Section title="What we are required to keep">
        <Bullets items={RETAINED} />
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          These are kept because Nigerian financial, tax and anti-money-laundering regulations
          require records of transactions and verified identities to be retained. We are confirming
          the exact retention periods with legal counsel and will publish them here once they are
          settled.
        </p>
      </Section>

      <Section title="Things that have to be settled first">
        <p className="mt-4 text-sm leading-relaxed">
          We will not quietly close an account while money or an obligation is outstanding, in
          either direction. Your request still stands — we will tell you what is pending and
          complete the deletion once it clears:
        </p>
        <Bullets items={BLOCKERS} />
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          If you have a balance you are unable to withdraw, tell us and we will find another way to
          get it to you. A balance you cannot move will never be used as a reason to refuse to close
          your account.
        </p>
      </Section>

      <Section title="How long it takes">
        <p className="mt-4 text-sm leading-relaxed">
          We aim to acknowledge every request within a few working days. If nothing is outstanding
          on your account, deletion follows shortly after. If something needs settling, the clock
          starts once it is resolved.
        </p>
      </Section>

      <p className="text-muted-foreground mt-12 text-sm leading-relaxed">
        Questions about your data more generally are covered in our{' '}
        <Link className="underline underline-offset-4" href="/privacy">
          privacy policy
        </Link>
        , or email{' '}
        <a className="underline underline-offset-4" href="mailto:privacy@dripplex.com">
          privacy@dripplex.com
        </a>
        .
      </p>
    </div>
  );
}
