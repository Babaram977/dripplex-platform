import Link from 'next/link';
import * as React from 'react';

import type { Metadata } from 'next';

/**
 * Public privacy policy. This URL is what goes in the Play Console and App
 * Store Connect, and both stores check that it matches the data-safety and
 * nutrition-label answers we give them.
 *
 * What replaced what: this page previously carried three bullet points and the
 * sentence "A complete legal policy will be published before public launch".
 * That is not a privacy policy — it fails Play's policy requirement outright,
 * and for an app that handles payments, precise location and government ID
 * documents it was not a defensible disclosure either.
 *
 * Every statement below is drawn from docs/store/DPX-MOBILE-003-STORE-PRIVACY-
 * DECLARATIONS.md, which is itself derived from the schema and from the
 * production service configuration, and which CI asserts against
 * ios/App/App/PrivacyInfo.xcprivacy on every run. If this page and that
 * document ever disagree, the store declarations become false — change both
 * together.
 *
 * Nothing here invents a retention period, because none has been determined.
 * Same rule the account-deletion page follows.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BEFORE THIS IS PUBLISHED IT NEEDS TWO THINGS THAT ARE NOT CODE:
 *
 *   1. Review by a Nigerian data-protection lawyer. NDPA 2023 governs this and
 *      sets out controller obligations, lawful bases and the right to erasure
 *      with exceptions. Retention periods and the erasure exceptions should be
 *      answered together, in the same review that unblocks account deletion.
 *   2. The controller's registered address. The legal entity is confirmed —
 *      AFNAN HOMES LTD, RC 9387949 — but the address is still a placeholder,
 *      deliberately obvious so this cannot ship half-filled by accident.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * The registered entity behind DrippleX. Confirmed by the founder 2026-08-24.
 *
 * `registeredAddress` is still outstanding — NDPA 2023 expects a data subject to
 * be able to identify and reach the controller, and a company name alone does
 * not do that. Left as an obvious placeholder rather than guessed.
 */
const CONTROLLER = {
  legalName: 'AFNAN HOMES LTD',
  rcNumber: 'RC 9387949',
  registeredAddress: '[REGISTERED ADDRESS]',
  privacyEmail: 'privacy@dripplex.com',
} as const;

const LAST_UPDATED = '24 August 2026';

const COLLECTED: { what: string; why: string }[] = [
  {
    what: 'Your name, email address and phone number',
    why: 'To create and secure your account, and to reach you about an order, a trip or a payment. Your phone number is your primary identity on DrippleX — there are no usernames.',
  },
  {
    what: 'Your delivery and business addresses, including their precise coordinates',
    why: 'To deliver orders to the right place, to set a pickup point for a ride, and to match you with nearby merchants, drivers and riders.',
  },
  {
    what: 'Photos you upload — profile picture, store and product images',
    why: 'To display your profile and, for merchants, your storefront and listings.',
  },
  {
    what: 'Identity documents and a verification selfie, where you complete identity checks',
    why: 'To verify who you are. Required of drivers, riders and merchants before they can be approved, and of customers who choose to raise their wallet limits.',
  },
  {
    what: 'Your government identification number and date of birth',
    why: 'To complete those same identity checks.',
  },
  {
    what: 'Your bank account details, if you are a merchant, driver or rider',
    why: 'To pay you. This is a payout destination — see below on card details, which are different and which we do not hold.',
  },
  {
    what: 'Your order, trip and wallet history',
    why: 'To show you what you bought, where you travelled and what you were charged, to settle payouts, and to resolve disputes and refunds.',
  },
  {
    what: 'A push notification token for your device',
    why: 'To send you order, delivery and trip notifications. It identifies the device, not you personally, and it is used for nothing else.',
  },
];

const NOT_COLLECTED = [
  'Your card number, CVV or expiry date. When you pay by card, our payment providers collect those details directly and we never receive or store them. What we keep is a record that a payment succeeded or failed, and for how much.',
  'Any advertising or attribution data. DrippleX carries no advertising SDK, no attribution SDK and no third-party analytics.',
  'Your location in the background. Location is read only while the app is open and in use — the app has no background-location capability and does not ask for one.',
  'Crash or performance telemetry. No crash-reporting service is enabled on the production apps.',
];

const PERMISSIONS: { permission: string; purpose: string }[] = [
  {
    permission: 'Location',
    purpose:
      'Setting a delivery address, choosing a pickup point, and — for drivers and riders who are online — sharing position with dispatch so trips can be assigned and tracked. Only while the app is open.',
  },
  {
    permission: 'Camera',
    purpose:
      'Photographing an identity document, a vehicle or a product listing, when you choose to take a new photo rather than pick an existing one.',
  },
  {
    permission: 'Photo library',
    purpose: 'Choosing an existing photo for your profile, your store, or an identity document.',
  },
  {
    permission: 'Notifications',
    purpose:
      'Order updates, trip updates, payment confirmations and — for partners — job offers. You can turn these off in your device settings at any time.',
  },
];

const PROCESSORS: { name: string; role: string }[] = [
  { name: 'Paystack, Flutterwave and Peyflex', role: 'Processing payments and payouts' },
  { name: 'Termii', role: 'Sending one-time verification codes by SMS' },
  { name: 'Resend', role: 'Sending transactional email' },
  { name: 'Firebase Cloud Messaging', role: 'Delivering push notifications' },
  {
    name: 'Cloudflare R2',
    role: 'Storing uploaded files, including identity documents and product images',
  },
  { name: 'Google Maps', role: 'Converting addresses into coordinates' },
];

const RIGHTS = [
  'Ask what personal data we hold about you, and get a copy of it',
  'Have inaccurate data corrected',
  'Ask us to erase your data, subject to the exceptions described below',
  'Object to or ask us to restrict a particular use of your data',
  'Withdraw a consent you previously gave, without affecting what was done before you withdrew it',
  'Complain to the Nigeria Data Protection Commission',
];

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What personal data DrippleX collects, why, who it is shared with, how long it is kept, and your rights under the Nigeria Data Protection Act 2023.',
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage(): React.JSX.Element {
  return (
    <div className="container max-w-3xl py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground mt-3 text-sm">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 leading-relaxed">
        This policy explains what personal data DrippleX collects, why we collect it, who we share
        it with and what you can do about it. It covers the DrippleX app and website, whether you
        use them as a customer, a driver, a delivery rider or a merchant.
      </p>

      <Section title="Who is responsible for your data">
        <p>
          DrippleX is operated by <strong>{CONTROLLER.legalName}</strong> ({CONTROLLER.rcNumber}), a
          company registered in Nigeria. {CONTROLLER.legalName} (&ldquo;DrippleX&rdquo;,
          &ldquo;we&rdquo;) is the data controller for the personal data described in this policy.
        </p>
        {/* Rendered only once a real address exists. Publishing the literal
            placeholder onto a legal page would read as broken, and an address
            is not something to guess at — so the page states what is known and
            stays silent on what is not. */}
        {!CONTROLLER.registeredAddress.startsWith('[') && (
          <p>Registered address: {CONTROLLER.registeredAddress}.</p>
        )}
        <p>
          For any question about this policy, or to exercise any of the rights described below,
          contact{' '}
          <a className="underline" href={`mailto:${CONTROLLER.privacyEmail}`}>
            {CONTROLLER.privacyEmail}
          </a>
          .
        </p>
      </Section>

      <Section title="What we collect, and why">
        <p>
          DrippleX is a single app serving customers, drivers, riders and merchants. Not all of the
          below applies to you — a customer who never becomes a partner never provides bank details
          or a guarantor&rsquo;s identification. What is listed is everything the app can collect,
          across all of those roles.
        </p>
        <dl className="mt-6 space-y-5">
          {COLLECTED.map((row) => (
            <div key={row.what}>
              <dt className="font-semibold">{row.what}</dt>
              <dd className="text-muted-foreground mt-1">{row.why}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="What we do not collect">
        <ul className="list-disc space-y-3 pl-5">
          {NOT_COLLECTED.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Section>

      <Section title="Device permissions">
        <p>
          The app asks for these only when the feature that needs them is used, and it works without
          them wherever that is possible.
        </p>
        <dl className="mt-6 space-y-5">
          {PERMISSIONS.map((row) => (
            <div key={row.permission}>
              <dt className="font-semibold">{row.permission}</dt>
              <dd className="text-muted-foreground mt-1">{row.purpose}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Who else sees your data">
        <p>
          <strong>
            We do not sell your personal data, and we do not share it for advertising.
          </strong>
        </p>
        <p>
          We use the service providers below to operate DrippleX. They act on our instructions,
          under contract, and may use your data only to provide their service to us.
        </p>
        <dl className="mt-6 space-y-4">
          {PROCESSORS.map((row) => (
            <div key={row.name}>
              <dt className="font-semibold">{row.name}</dt>
              <dd className="text-muted-foreground mt-1">{row.role}</dd>
            </div>
          ))}
        </dl>
        <p>
          Some of these providers process data outside Nigeria. Where that happens we rely on the
          transfer safeguards required by the Nigeria Data Protection Act 2023.
        </p>
        <p>
          Other people on the platform see only what a transaction requires. A driver sees your
          first name, your pickup and your destination. A merchant sees your name, your delivery
          address and what you ordered. Neither sees your identity documents, your wallet balance or
          your payment details.
        </p>
        <p>
          We may also disclose data where the law requires it, or to investigate fraud, abuse or a
          threat to someone&rsquo;s safety.
        </p>
      </Section>

      <Section title="How your data is protected">
        <p>
          All traffic between the app and our servers is encrypted in transit. The app will not load
          unencrypted content. Access to identity documents is restricted to the Operations staff
          who review them, and administrative actions on your account are recorded in an audit log.
        </p>
        <p>
          Your wallet and other sensitive actions are protected by a PIN that you set. Never share
          it, and never share a one-time verification code — no member of DrippleX staff will ever
          ask you for either.
        </p>
      </Section>

      <Section title="How long we keep it, and deleting your account">
        <p>
          We keep your personal data for as long as your account is open, and after that only for as
          long as we are required to. Financial and transaction records in particular must be
          retained under Nigerian law even after an account is closed.
        </p>
        <p>
          You can ask us to delete your account at any time.{' '}
          <Link className="underline" href="/account-deletion">
            The account deletion page
          </Link>{' '}
          sets out exactly what is erased, what we must keep and why, and what has to be settled
          first — an outstanding wallet balance, an order or trip still in progress, or a payout
          still owed to you all have to be resolved before an account can be closed.
        </p>
      </Section>

      <Section title="Children">
        <p>
          DrippleX is not intended for children, and we do not knowingly collect data from anyone
          under 18. If you believe a child has given us personal data, contact{' '}
          <a className="underline" href={`mailto:${CONTROLLER.privacyEmail}`}>
            {CONTROLLER.privacyEmail}
          </a>{' '}
          and we will remove it.
        </p>
      </Section>

      <Section title="Your rights">
        <p>Under the Nigeria Data Protection Act 2023 you have the right to:</p>
        <ul className="list-disc space-y-2 pl-5">
          {RIGHTS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p>
          To exercise any of these, email{' '}
          <a className="underline" href={`mailto:${CONTROLLER.privacyEmail}`}>
            {CONTROLLER.privacyEmail}
          </a>
          . We will respond within the time the law allows.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we change how we use your data we will update this page and change the date at the top.
          Where a change is significant we will tell you in the app before it takes effect.
        </p>
      </Section>
    </div>
  );
}
