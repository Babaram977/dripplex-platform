import React, { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';
import { DRIPPLEX_SUPPORT_WHATSAPP } from './shared';

import type { CmsPageDto, DriverSupportCategory } from '../lib/api';

/**
 * The four rows that sat on the driver and rider settings screens doing
 * nothing — Change PIN, Privacy Policy, Terms of Service, Help & Support.
 *
 * Shared rather than written twice: a rider and a driver need the same four
 * things, and two copies of a privacy screen is two places for the wording to
 * drift. Both partner apps render these.
 */

// Local palette — these screens live inside both partner apps, which each
// define their own constants; duplicating the four tokens is cheaper than
// coupling this file to either app's theme module.
const NAVY_BASE = '#050D1A';
const NAVY_CARD = '#0C1829';
const NAVY_SURFACE = '#0A1524';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.45)';
const WHITE = '#FFFFFF';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const C_ERR = '#EF4444';
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";

export type PartnerAudience = 'driver' | 'rider';

// ── Shared chrome ───────────────────────────────────────────────────────────

function PageShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <div className="flex items-center gap-3 px-5 pb-3 pt-[56px]">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-95"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={WHITE}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p style={{ fontFamily: PP, fontSize: 19, fontWeight: 700, color: WHITE }}>{title}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-10">{children}</div>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'ok' | 'warn'; children: React.ReactNode }) {
  const colour = tone === 'error' ? C_ERR : tone === 'ok' ? G3 : '#F59E0B';
  return (
    <div
      style={{
        borderRadius: 14,
        padding: '12px 14px',
        marginBottom: 14,
        background: `${colour}12`,
        border: `1px solid ${colour}33`,
      }}
    >
      <p style={{ fontFamily: IT, fontSize: 12.5, color: 'rgba(255,255,255,.8)', lineHeight: 1.6 }}>
        {children}
      </p>
    </div>
  );
}

// ── Legal documents (CMS-backed) ────────────────────────────────────────────

/**
 * Renders a CMS page body.
 *
 * The CMS stores arbitrary JSON, so this handles the two shapes legal pages
 * actually use — a plain string, or `{ sections: [{ heading, body }] }` — and
 * says so plainly for anything else rather than rendering `[object Object]`.
 * An unreadable policy is worse than an honest "we cannot show this".
 */
function renderCmsBody(body: unknown): React.ReactNode {
  const paragraph = (text: string, key: React.Key): React.JSX.Element => (
    <p
      key={key}
      style={{
        fontFamily: IT,
        fontSize: 13.5,
        lineHeight: 1.75,
        color: 'rgba(255,255,255,.78)',
        marginBottom: 12,
        whiteSpace: 'pre-wrap',
      }}
    >
      {text}
    </p>
  );

  if (typeof body === 'string') {
    return body.split('\n\n').map((block, i) => paragraph(block, i));
  }

  if (body && typeof body === 'object' && 'sections' in body) {
    const sections = (body as { sections?: unknown }).sections;
    if (Array.isArray(sections)) {
      return sections.map((raw, i) => {
        const section = raw as { heading?: unknown; body?: unknown };
        const heading = typeof section.heading === 'string' ? section.heading : null;
        const text = typeof section.body === 'string' ? section.body : '';
        return (
          <div key={i} style={{ marginBottom: 18 }}>
            {heading ? (
              <p
                style={{
                  fontFamily: PP,
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: WHITE,
                  marginBottom: 8,
                }}
              >
                {heading}
              </p>
            ) : null}
            {text.split('\n\n').map((block, j) => paragraph(block, j))}
          </div>
        );
      });
    }
  }

  return (
    <Notice tone="warn">
      This page is published but in a format the app cannot display. Ops can correct it in the
      content console; in the meantime, contact support on WhatsApp {DRIPPLEX_SUPPORT_WHATSAPP}.
    </Notice>
  );
}

export function LegalDocumentScreen({
  slug,
  title,
  onBack,
}: {
  slug: string;
  title: string;
  onBack: () => void;
}) {
  const [page, setPage] = useState<CmsPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.cms
      .getPage(slug)
      .then((result) => {
        setPage(result);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not load this document.');
        setLoading(false);
      });
  }, [slug]);

  useEffect(load, [load]);

  return (
    <PageShell title={title} onBack={onBack}>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: i === 1 ? 22 : 14,
                width: i === 1 ? '60%' : '100%',
                borderRadius: 8,
                background: 'rgba(255,255,255,.055)',
              }}
            />
          ))}
        </div>
      ) : error ? (
        <>
          {/* Named honestly: the document may simply not be published yet,
              which is a different problem from the network being down, and
              the partner should not be told it is their fault either way. */}
          <Notice tone="error">{error}</Notice>
          <button
            onClick={load}
            className="active:scale-97"
            style={{
              height: 44,
              padding: '0 18px',
              borderRadius: 12,
              background: 'rgba(43,172,82,.1)',
              border: '1px solid rgba(43,172,82,.25)',
              color: G3,
              fontFamily: IT,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </>
      ) : page ? (
        <>
          {page.publishedAt ? (
            <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED, marginBottom: 16 }}>
              Last updated {new Date(page.updatedAt).toLocaleDateString()}
            </p>
          ) : null}
          {renderCmsBody(page.body)}
        </>
      ) : null}
    </PageShell>
  );
}

// ── Change PIN ──────────────────────────────────────────────────────────────

const PIN_LENGTH = 4;

/**
 * Sets or replaces the payout PIN.
 *
 * The backend exposes one endpoint for both, with no old-PIN challenge — so
 * this screen cannot ask for the current PIN and does not pretend to. That is
 * a real gap for a money control and is recorded in the diff register; the
 * copy below says plainly what the PIN protects so nobody assumes more.
 */
export function ChangePinScreen({
  audience,
  onBack,
}: {
  audience: PartnerAudience;
  onBack: () => void;
}) {
  const client = audience === 'driver' ? api.driverRides : api.rider;
  const [existing, setExisting] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    client
      .hasPin()
      .then((r) => setExisting(r.set))
      // Not knowing whether a PIN exists only changes the wording, so this
      // falls back to the neutral phrasing rather than blocking the screen.
      .catch(() => setExisting(null));
  }, [client]);

  const digitsOnly = (value: string): string => value.replace(/\D/g, '').slice(0, PIN_LENGTH);

  const onSubmit = (): void => {
    setError('');
    if (pin.length !== PIN_LENGTH) {
      setError(`Your PIN must be ${PIN_LENGTH} digits.`);
      return;
    }
    if (pin !== confirm) {
      setError('The two PINs do not match.');
      return;
    }
    // A repeated or sequential PIN is the first thing anybody tries.
    if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
      setError('Choose a less predictable PIN — not four of the same digit, and not in sequence.');
      return;
    }

    setSaving(true);
    client
      .setPin(pin)
      .then(() => {
        setDone(true);
        setSaving(false);
        setPin('');
        setConfirm('');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not save your PIN.');
        setSaving(false);
      });
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ): React.JSX.Element => (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span
        style={{ fontFamily: IT, fontSize: 12, color: MUTED, display: 'block', marginBottom: 6 }}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(digitsOnly(e.target.value))}
        inputMode="numeric"
        autoComplete="off"
        type="password"
        placeholder="••••"
        style={{
          width: '100%',
          height: 52,
          borderRadius: 14,
          background: NAVY_SURFACE,
          border: `1px solid ${BORDER}`,
          color: WHITE,
          fontFamily: PP,
          fontSize: 20,
          letterSpacing: '0.4em',
          textAlign: 'center',
          outline: 'none',
        }}
      />
    </label>
  );

  return (
    <PageShell title={existing === true ? 'Change PIN' : 'Set PIN'} onBack={onBack}>
      <Notice tone="warn">
        This PIN authorises payouts from your DrippleX wallet to your bank account. It is not your
        sign-in password, and DrippleX staff will never ask you for it.
      </Notice>

      {done ? (
        <Notice tone="ok">Your PIN is saved. Use it the next time you request a payout.</Notice>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {field(existing === true ? 'New PIN' : 'Choose a PIN', pin, setPin)}
      {field('Confirm PIN', confirm, setConfirm)}

      <button
        onClick={onSubmit}
        disabled={saving}
        className="active:scale-97"
        style={{
          width: '100%',
          height: 52,
          borderRadius: 14,
          background: saving ? 'rgba(255,255,255,.06)' : `linear-gradient(135deg,${G2},${G3})`,
          color: saving ? 'rgba(255,255,255,.3)' : WHITE,
          fontFamily: PP,
          fontSize: 15,
          fontWeight: 600,
          border: 'none',
          marginTop: 6,
        }}
      >
        {saving ? 'Saving…' : existing === true ? 'Change PIN' : 'Set PIN'}
      </button>
    </PageShell>
  );
}

// ── Help & Support ──────────────────────────────────────────────────────────

const SUPPORT_CATEGORIES: { value: DriverSupportCategory; label: string }[] = [
  { value: 'PAYOUT', label: 'Payouts and earnings' },
  { value: 'ACCOUNT', label: 'My account' },
  { value: 'KYC', label: 'Documents and verification' },
  { value: 'APP_BUG', label: 'Something is broken' },
  { value: 'OTHER', label: 'Something else' },
];

/**
 * Two ways to reach us: WhatsApp for anything urgent, and a ticket that lands
 * in the Ops queue for anything that needs a record.
 *
 * Ticketing is a driver-side endpoint only. Riders get the WhatsApp line and
 * are told so — offering them a form that posts nowhere would be worse than
 * offering them one route that works.
 */
export function HelpSupportScreen({
  audience,
  onBack,
}: {
  audience: PartnerAudience;
  onBack: () => void;
}) {
  const canRaiseTicket = audience === 'driver';
  const [category, setCategory] = useState<DriverSupportCategory>('OTHER');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const whatsappHref = `https://wa.me/${DRIPPLEX_SUPPORT_WHATSAPP.replace(/[^0-9]/g, '')}`;

  const onSubmit = (): void => {
    setError('');
    // Mirrors the server's own bounds so a partner is told immediately rather
    // than after a round trip.
    if (subject.trim().length < 3) {
      setError('Give your message a short subject (at least 3 characters).');
      return;
    }
    if (description.trim().length < 10) {
      setError('Tell us a little more — at least 10 characters.');
      return;
    }

    setSending(true);
    api.driverSupport
      .create({ category, subject: subject.trim(), description: description.trim() })
      .then(() => {
        setSent(true);
        setSending(false);
        setSubject('');
        setDescription('');
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Could not send your message.');
        setSending(false);
      });
  };

  return (
    <PageShell title="Help & Support" onBack={onBack}>
      <div
        style={{
          borderRadius: 16,
          padding: 18,
          marginBottom: 18,
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
        }}
      >
        <p style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: WHITE }}>
          Talk to us on WhatsApp
        </p>
        <p style={{ fontFamily: IT, fontSize: 12.5, color: MUTED, margin: '6px 0 14px' }}>
          Fastest for anything urgent — a trip in progress, a payment that has not landed, a safety
          concern.
        </p>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="active:scale-97"
          style={{
            display: 'flex',
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            background: `linear-gradient(135deg,${G2},${G3})`,
            color: WHITE,
            fontFamily: PP,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Message {DRIPPLEX_SUPPORT_WHATSAPP}
        </a>
      </div>

      {canRaiseTicket ? (
        <div
          style={{
            borderRadius: 16,
            padding: 18,
            background: NAVY_CARD,
            border: `1px solid ${BORDER}`,
          }}
        >
          <p style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: WHITE }}>
            Raise a support ticket
          </p>
          <p style={{ fontFamily: IT, fontSize: 12.5, color: MUTED, margin: '6px 0 14px' }}>
            Goes to the DrippleX operations queue with a record you can refer back to.
          </p>

          {sent ? <Notice tone="ok">Sent. We will come back to you.</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {SUPPORT_CATEGORIES.map((option) => {
              const on = option.value === category;
              return (
                <button
                  key={option.value}
                  onClick={() => setCategory(option.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: on ? 'rgba(43,172,82,.16)' : NAVY_SURFACE,
                    border: `1px solid ${on ? G2 : BORDER}`,
                    color: on ? WHITE : MUTED,
                    fontFamily: IT,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            maxLength={200}
            style={{
              width: '100%',
              height: 46,
              borderRadius: 12,
              padding: '0 14px',
              marginBottom: 10,
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              color: WHITE,
              fontFamily: IT,
              fontSize: 13.5,
              outline: 'none',
            }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened?"
            maxLength={2000}
            rows={5}
            style={{
              width: '100%',
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              color: WHITE,
              fontFamily: IT,
              fontSize: 13.5,
              outline: 'none',
              resize: 'vertical',
            }}
          />
          <button
            onClick={onSubmit}
            disabled={sending}
            className="active:scale-97"
            style={{
              width: '100%',
              height: 48,
              borderRadius: 14,
              background: sending ? 'rgba(255,255,255,.06)' : 'rgba(43,172,82,.12)',
              border: `1px solid ${sending ? BORDER : 'rgba(43,172,82,.3)'}`,
              color: sending ? 'rgba(255,255,255,.3)' : G3,
              fontFamily: PP,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {sending ? 'Sending…' : 'Send to support'}
          </button>
        </div>
      ) : (
        // Said rather than hidden: a rider who cannot find a form should know
        // WhatsApp is the route, not assume support is missing.
        <Notice tone="warn">
          In-app tickets are not open to riders yet — WhatsApp is the way to reach us for now.
        </Notice>
      )}
    </PageShell>
  );
}

// ── The row list itself ─────────────────────────────────────────────────────

export type AccountPage = 'pin' | 'privacy' | 'terms' | 'help';

export const LEGAL_SLUGS = {
  privacy: 'privacy-policy',
  terms: 'terms-of-service',
} as const;

/**
 * The ACCOUNT rows, with handlers. These were four `<button>`s with no
 * `onClick` on both partner settings screens — they looked tappable and
 * swallowed every tap.
 */
export function AccountRows({ onOpen }: { onOpen: (page: AccountPage) => void }) {
  const rows: { page: AccountPage; label: string }[] = [
    { page: 'pin', label: 'Change PIN' },
    { page: 'privacy', label: 'Privacy Policy' },
    { page: 'terms', label: 'Terms of Service' },
    { page: 'help', label: 'Help & Support' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
      {rows.map((row, i) => (
        <button
          key={row.page}
          onClick={() => onOpen(row.page)}
          className="flex w-full items-center gap-3 px-4 py-4 active:scale-[.98]"
          style={{
            background: NAVY_SURFACE,
            borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : 'none',
          }}
        >
          <p className="flex-1 text-left text-[14px]" style={{ fontFamily: IT, color: WHITE }}>
            {row.label}
          </p>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={MUTED}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** Renders whichever account page is open, or nothing. Keeps the routing for
 * these four in one place so driver and rider cannot drift apart. */
export function AccountPageHost({
  page,
  audience,
  onClose,
}: {
  page: AccountPage | null;
  audience: PartnerAudience;
  onClose: () => void;
}) {
  if (page === null) return null;
  if (page === 'pin') return <ChangePinScreen audience={audience} onBack={onClose} />;
  if (page === 'help') return <HelpSupportScreen audience={audience} onBack={onClose} />;
  return (
    <LegalDocumentScreen
      slug={page === 'privacy' ? LEGAL_SLUGS.privacy : LEGAL_SLUGS.terms}
      title={page === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
      onBack={onClose}
    />
  );
}
