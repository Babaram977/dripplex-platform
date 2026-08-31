'use client';

import {
  SuperAppWalletAmountCard,
  SuperAppWalletButton,
  SuperAppWalletRecipientRow,
  SuperAppWalletScreenHeader,
  SuperAppWalletSearchInput,
  SuperAppWalletSectionLabel,
  SuperAppWalletStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import type { WalletRecipientDto, WalletTransferReceiptDto } from '@dripplex/types';

import {
  useRecentTransferRecipients,
  useLookupTransferRecipient,
  useTransferWallet,
  useWallet,
} from '@/hooks/wallet';
import { describeSdkError } from '@/lib/sdk';

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A recipient can be named by phone number or email address. Anything
 *  containing an `@` is treated as an address; the SDK sends whichever field
 *  the backend should match on. */
function isLookupable(search: string): boolean {
  const trimmed = search.trim();
  return trimmed.includes('@') ? EMAIL_PATTERN.test(trimmed) : PHONE_PATTERN.test(trimmed);
}

/** Phone where there is one, masked email otherwise — `maskedPhone` is null for
 *  an account registered without a phone number. */
function recipientSubtitle(recipient: WalletRecipientDto): string {
  return recipient.maskedPhone ?? recipient.maskedEmail;
}

/**
 * DPX-100 Wallet Slice 2. The Figma source's "Phone number or @username"
 * search plus a mocked "Recent recipients" list has no real backend
 * counterpart — there's no customer-facing user directory and no username
 * concept. Adapted to what's real: exact phone-number or email lookup (a
 * narrowly-scoped `GET /customer/wallet/transfer/recipients` endpoint —
 * never a listing/enumeration of users) and recent recipients derived from
 * the caller's own past TRANSFER ledger entries (also new this slice).
 * No PIN step here (unlike Withdraw) — the Figma source doesn't gate
 * Transfer on one either, and no PIN infrastructure exists yet. Per
 * DPX-UX-001 (money movement always confirms before it moves), tapping
 * Send doesn't fire the transfer immediately — it flips the CTA into an
 * explicit "Confirm sending ₦X to Name?" step first, a lightweight inline
 * confirm rather than a whole extra screen.
 */
export function TransferScreen({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: () => void;
}): React.JSX.Element {
  const [search, setSearch] = React.useState('');
  const [recipient, setRecipient] = React.useState<WalletRecipientDto | null>(null);
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [confirming, setConfirming] = React.useState(false);
  const wallet = useWallet();
  // Held so the sender can see what happened. Navigating away on success left
  // them with a changed balance and nothing to quote in a dispute.
  const [receipt, setReceipt] = React.useState<WalletTransferReceiptDto | null>(null);
  const recentRecipients = useRecentTransferRecipients();
  const lookupRecipient = useLookupTransferRecipient();
  const transferWallet = useTransferWallet();
  const { body } = useSuperAppFonts();

  React.useEffect(() => {
    if (!isLookupable(search)) return;
    const timer = setTimeout(() => {
      lookupRecipient.mutate(search.trim());
    }, 400);
    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce keyed only on the search text
  }, [search]);

  const numericAmount = Number(amount);
  const validAmount =
    numericAmount > 0 && (!wallet.data || numericAmount <= wallet.data.availableBalance);

  const filteredRecent = (recentRecipients.data ?? []).filter(
    (candidate) =>
      !search ||
      `${candidate.firstName} ${candidate.lastName}`.toLowerCase().includes(search.toLowerCase()),
  );
  const lookupResults = isLookupable(search) ? (lookupRecipient.data ?? []) : [];

  // The transfer went through: show the evidence instead of navigating away.
  // The reference is on both ledger legs, so it is what support searches on
  // when the two parties disagree about what happened.
  if (receipt) {
    return (
      <div
        className="absolute inset-0 flex flex-col overflow-hidden"
        style={{ background: '#0A1628' }}
      >
        <SuperAppWalletStatusBar />
        {/* Back leaves the receipt the same way Done does: the transfer is
            finished, so there is nothing to return to. */}
        <SuperAppWalletScreenHeader title="Transfer" onBack={onSent} />

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="pb-2 pt-6 text-center">
            <p className={`text-[17px] font-semibold text-white ${body}`}>Transfer successful</p>
            <p className={`mt-2 text-[30px] font-bold text-white ${body}`}>
              ₦{receipt.amount.toLocaleString()}
            </p>
            {recipient ? (
              <p className={`mt-1 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                to {recipient.firstName} {recipient.lastName} · {recipientSubtitle(recipient)}
              </p>
            ) : null}
          </div>

          <dl
            className="mt-4 rounded-2xl px-4 py-1"
            style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
          >
            {(
              [
                ['Status', 'Completed', false],
                ['Date', new Date(receipt.createdAt).toLocaleString(), false],
                ...(receipt.description !== null
                  ? ([['Note', receipt.description, false]] as [string, string, boolean][])
                  : []),
                ['New balance', `₦${receipt.balanceAfter.toLocaleString()}`, false],
                ['Reference', receipt.reference, true],
                ['Transaction ID', receipt.entryId, true],
              ] as [string, string, boolean][]
            ).map(([label, value, mono]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-4 py-2.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}
              >
                <dt className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                  {label}
                </dt>
                <dd
                  className={`select-text break-all text-right text-white ${mono ? 'font-mono text-[11px]' : `text-[13px] ${body}`}`}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <p className={`mt-3 text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            Keep the reference. It identifies this transfer on both sides and is what support needs
            to resolve a dispute.
          </p>
        </div>

        <div className="px-4 pb-8 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <SuperAppWalletButton onClick={onSent}>Done</SuperAppWalletButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppWalletStatusBar />
      <SuperAppWalletScreenHeader title="Transfer" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-4">
        {!recipient ? (
          <>
            <div className="px-4 pb-4">
              <SuperAppWalletSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Recipient's phone number or email"
              />
            </div>

            {isLookupable(search) ? (
              <div className="px-4 pb-4">
                {lookupRecipient.isPending ? (
                  <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                    Looking up recipient…
                  </p>
                ) : null}
                {lookupRecipient.isSuccess && lookupResults.length === 0 ? (
                  <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                    No DrippleX customer found with that{' '}
                    {search.includes('@') ? 'email' : 'phone number'}.
                  </p>
                ) : null}
                {lookupResults.map((found) => (
                  <SuperAppWalletRecipientRow
                    key={found.id}
                    name={`${found.firstName} ${found.lastName}`}
                    subtitle={recipientSubtitle(found)}
                    onClick={() => {
                      setRecipient(found);
                    }}
                  />
                ))}
              </div>
            ) : null}

            {filteredRecent.length > 0 ? (
              <div className="px-4 pb-4">
                <SuperAppWalletSectionLabel>Recent recipients</SuperAppWalletSectionLabel>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {filteredRecent.map((candidate) => (
                    <SuperAppWalletRecipientRow
                      key={candidate.id}
                      name={`${candidate.firstName} ${candidate.lastName}`}
                      subtitle={recipientSubtitle(candidate)}
                      onClick={() => {
                        setRecipient(candidate);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="px-4 pb-4">
              <div
                className="flex items-center gap-3.5 rounded-2xl p-4"
                style={{ background: 'rgba(43,172,82,.07)', border: '1.5px solid #2BAC52' }}
              >
                <span
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
                  style={{ background: 'rgba(43,172,82,.2)', color: '#2BAC52' }}
                >
                  {recipient.firstName[0]}
                  {recipient.lastName[0]}
                </span>
                <div className="flex-1">
                  <p className={`text-[15px] font-bold text-white ${body}`}>
                    {recipient.firstName} {recipient.lastName}
                  </p>
                  <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
                    {recipientSubtitle(recipient)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRecipient(null);
                    setConfirming(false);
                  }}
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
                  style={{ background: 'rgba(255,255,255,.08)' }}
                  aria-label="Change recipient"
                >
                  <span style={{ color: 'rgba(255,255,255,.5)' }}>✕</span>
                </button>
              </div>
            </div>

            <div className="px-4 pb-4">
              <SuperAppWalletAmountCard
                value={amount}
                onChange={(next) => {
                  setAmount(next);
                  setConfirming(false);
                }}
              />
              {wallet.data ? (
                <p
                  className={`mt-1.5 text-[12px] ${body}`}
                  style={{ color: 'rgba(255,255,255,.5)' }}
                >
                  Balance: ₦{wallet.data.availableBalance.toLocaleString()}
                </p>
              ) : null}
            </div>

            <div className="px-4 pb-2">
              <SuperAppWalletSectionLabel>Note (optional)</SuperAppWalletSectionLabel>
              <input
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                }}
                placeholder="What's this for?"
                maxLength={500}
                className={`mt-2.5 h-[48px] w-full rounded-xl px-4 text-[14px] text-white outline-none ${body}`}
                style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
              />
            </div>

            {transferWallet.isError ? (
              <p className={`px-4 pt-2 text-[13px] ${body}`} style={{ color: '#EF4444' }}>
                {describeSdkError(transferWallet.error).description}
              </p>
            ) : null}
          </>
        )}
      </div>

      {recipient ? (
        <div className="px-4 pb-8 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
          {confirming ? (
            <>
              <p
                className={`mb-3 text-center text-[13px] ${body}`}
                style={{ color: 'rgba(255,255,255,.7)' }}
              >
                Send ₦{amount || '0'} to {recipient.firstName} {recipient.lastName}?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                  }}
                  className={`h-14 flex-1 rounded-2xl text-[15px] font-semibold ${body}`}
                  style={{
                    background: '#112238',
                    color: 'rgba(255,255,255,.7)',
                    border: '1px solid rgba(255,255,255,.08)',
                  }}
                >
                  Cancel
                </button>
                <div className="flex-[2]">
                  <SuperAppWalletButton
                    loading={transferWallet.isPending}
                    onClick={() => {
                      transferWallet.mutate(
                        {
                          toUserId: recipient.id,
                          amount: numericAmount,
                          ...(note ? { description: note } : {}),
                        },
                        {
                          onSuccess: (result) => {
                            setReceipt(result.receipt);
                          },
                        },
                      );
                    }}
                  >
                    Confirm
                  </SuperAppWalletButton>
                </div>
              </div>
            </>
          ) : (
            <SuperAppWalletButton
              disabled={!validAmount}
              onClick={() => {
                setConfirming(true);
              }}
            >
              Send ₦{amount || '0'}
            </SuperAppWalletButton>
          )}
        </div>
      ) : null}
    </div>
  );
}
