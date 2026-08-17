import { useCallback, useEffect, useState } from 'react';

import type { PartnerBankAccountDto, PayoutRequestDto, PayoutResultDto } from '../lib/api';

const IT = "'Inter',sans-serif";
const PP = "'Poppins',sans-serif";
const G2 = '#2BAC52';
const G3 = '#47CF72';
const MUTED = 'rgba(255,255,255,.5)';
const BORDER = 'rgba(255,255,255,.08)';
const SURFACE = '#101F35';
const ERROR = '#F87171';

const naira = (n: number): string => `₦${Math.round(n).toLocaleString()}`;

/**
 * The payout surface a partner namespace exposes. `api.riderRides`-style
 * namespaces satisfy this structurally, so the panel does not care which
 * partner it is serving.
 */
export interface PayoutClient {
  listBankAccounts: () => Promise<PartnerBankAccountDto[]>;
  addBankAccount: (body: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    bankCode?: string;
  }) => Promise<PartnerBankAccountDto>;
  hasPin: () => Promise<{ set: boolean }>;
  setPin: (pin: string) => Promise<{ set: true }>;
  requestPayout: (body: {
    amount: number;
    bankAccountId: string;
    pin: string;
  }) => Promise<PayoutResultDto>;
  listPayouts: () => Promise<{ items?: PayoutRequestDto[] }>;
}

/**
 * DPX-PAYOUT-001 — bank linking and payout requests, for a rider or a driver.
 *
 * One component for both, because the flow is the same and the backend routes
 * are the same shape: link an account, set a PIN once, ask for an amount. The
 * money leaves the wallet immediately and Operations pays it by bank transfer
 * on the weekly Monday run, so the copy says exactly that rather than implying
 * an instant transfer that is not happening.
 */
export function PayoutPanel({
  client,
  availableBalance,
  onChanged,
}: {
  client: PayoutClient;
  availableBalance: number | null;
  onChanged?: () => void;
}) {
  const [accounts, setAccounts] = useState<PartnerBankAccountDto[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequestDto[]>([]);
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<'none' | 'bank' | 'pin' | 'payout'>('none');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [pin, setPin] = useState('');
  const [amount, setAmount] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      client
        .listBankAccounts()
        .then(setAccounts)
        .catch(() => {
          /* An empty list is the honest fallback — never a fake account. */
        }),
      client
        .hasPin()
        .then((r) => setPinSet(r.set))
        .catch(() => setPinSet(null)),
      client
        .listPayouts()
        .then((r) => setPayouts(r.items ?? []))
        .catch(() => {
          /* leave empty */
        }),
    ]).finally(() => setLoading(false));
  }, [client]);
  useEffect(() => load(), [load]);

  const reset = () => {
    setForm('none');
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setPin('');
    setAmount('');
  };

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      reset();
      load();
      onChanged?.();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'That did not go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * A payout can come back smaller than it was asked for: cash a rider or
   * driver collected on DrippleX's behalf is settled out of it first. Saying
   * "payout requested" and leaving them to discover a different number in
   * their bank would be the kind of surprise that costs trust, so the exact
   * split is reported back.
   */
  const runPayout = async (fn: () => Promise<PayoutResultDto>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      const settled = result.commissionSettled;
      if (result.payout === null) {
        setNotice(
          `${naira(settled)} went to clearing the cash you owe DrippleX. ` +
            'Nothing is left to transfer this time.',
        );
      } else if (settled > 0) {
        setNotice(
          `${naira(settled)} settled the cash you owe DrippleX. ` +
            `${naira(result.payout.amount)} is queued for Monday's payout.`,
        );
      } else {
        setNotice('Payout requested. Operations pays out on Monday.');
      }
      reset();
      load();
      onChanged?.();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'That did not go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
  const pendingTotal = payouts
    .filter((p) => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);

  const label = (text: string) => (
    <p className="mb-1 text-[11px] font-medium" style={{ fontFamily: IT, color: MUTED }}>
      {text}
    </p>
  );

  const input = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    extra?: { numeric?: boolean; maxLength?: number; ariaLabel?: string },
  ) => (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={extra?.ariaLabel ?? placeholder}
      inputMode={extra?.numeric === true ? 'numeric' : 'text'}
      maxLength={extra?.maxLength}
      className="mb-2 h-11 w-full rounded-xl px-3 text-[13px]"
      style={{
        background: 'rgba(255,255,255,.04)',
        border: `1px solid ${BORDER}`,
        color: '#fff',
        fontFamily: IT,
      }}
    />
  );

  const button = (
    text: string,
    onClick: () => void,
    opts?: { primary?: boolean; disabled?: boolean },
  ) => (
    <button
      onClick={onClick}
      disabled={opts?.disabled === true || busy}
      className="h-11 w-full rounded-xl text-[13px] font-semibold"
      style={{
        background: opts?.primary === true ? G2 : 'rgba(255,255,255,.06)',
        border: opts?.primary === true ? 'none' : `1px solid ${BORDER}`,
        color: opts?.primary === true ? '#fff' : MUTED,
        fontFamily: IT,
        opacity: opts?.disabled === true || busy ? 0.5 : 1,
        cursor: opts?.disabled === true || busy ? 'not-allowed' : 'pointer',
      }}
    >
      {text}
    </button>
  );

  return (
    <div className="mb-5">
      {/* Linked bank */}
      <div
        className="mb-3 flex items-center gap-3 rounded-2xl p-4"
        style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
      >
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-xl"
          style={{ background: 'rgba(255,255,255,.05)' }}
        >
          🏦
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
            {defaultAccount
              ? `${defaultAccount.bankName} ····${defaultAccount.accountNumber.slice(-4)}`
              : 'No bank account linked'}
          </p>
          <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
            {defaultAccount
              ? defaultAccount.accountName
              : 'Add the account your earnings should be paid into.'}
          </p>
        </div>
        <button
          onClick={() => setForm(form === 'bank' ? 'none' : 'bank')}
          className="rounded-xl px-3 py-2 text-[12px] font-semibold"
          style={{
            background: 'rgba(43,172,82,.1)',
            border: '1px solid rgba(43,172,82,.25)',
            color: G3,
            fontFamily: IT,
          }}
        >
          {defaultAccount ? 'Change' : 'Add'}
        </button>
      </div>

      {form === 'bank' && (
        <div
          className="mb-3 rounded-2xl p-4"
          style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
        >
          {label('Bank name')}
          {input(bankName, setBankName, 'e.g. GTBank', { ariaLabel: 'Bank name' })}
          {label('Account name')}
          {input(accountName, setAccountName, 'Name on the account', {
            ariaLabel: 'Account name',
          })}
          {label('Account number')}
          {input(accountNumber, setAccountNumber, '10 digits', {
            numeric: true,
            maxLength: 10,
            ariaLabel: 'Account number',
          })}
          {button(
            busy ? 'Saving…' : 'Save bank account',
            () =>
              void run(
                () =>
                  client.addBankAccount({
                    bankName: bankName.trim(),
                    accountName: accountName.trim(),
                    accountNumber: accountNumber.trim(),
                  }),
                'Bank account linked.',
              ),
            {
              primary: true,
              disabled:
                bankName.trim().length < 2 ||
                accountName.trim().length < 2 ||
                accountNumber.trim().length !== 10,
            },
          )}
        </div>
      )}

      {/* Payout PIN — required before money can leave the wallet. */}
      {pinSet === false && (
        <div
          className="mb-3 rounded-2xl p-4"
          style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p className="mb-1 text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
            Set a payout PIN
          </p>
          <p className="mb-3 text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
            A 4-digit PIN is needed to approve a payout from your own wallet.
          </p>
          {input(pin, setPin, '4-digit PIN', { numeric: true, maxLength: 4, ariaLabel: 'New PIN' })}
          {button(
            busy ? 'Saving…' : 'Save PIN',
            () => void run(() => client.setPin(pin), 'PIN saved.'),
            { primary: true, disabled: pin.length !== 4 },
          )}
        </div>
      )}

      {/* Request a payout */}
      <button
        onClick={() => setForm(form === 'payout' ? 'none' : 'payout')}
        disabled={!defaultAccount || pinSet !== true || (availableBalance ?? 0) <= 0}
        className="mb-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold"
        style={{
          background: !defaultAccount || pinSet !== true ? 'rgba(255,255,255,.06)' : G2,
          border: !defaultAccount || pinSet !== true ? `1px solid ${BORDER}` : 'none',
          color: !defaultAccount || pinSet !== true ? MUTED : '#fff',
          fontFamily: IT,
          cursor: !defaultAccount || pinSet !== true ? 'not-allowed' : 'pointer',
        }}
      >
        💸 Request payout
      </button>

      {form === 'payout' && (
        <div
          className="mb-3 rounded-2xl p-4"
          style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
        >
          {label('Amount')}
          {input(amount, setAmount, `Up to ${naira(availableBalance ?? 0)}`, {
            numeric: true,
            ariaLabel: 'Payout amount',
          })}
          {label('Payout PIN')}
          {input(pin, setPin, '4-digit PIN', {
            numeric: true,
            maxLength: 4,
            ariaLabel: 'Payout PIN',
          })}
          <p className="mb-2 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            Payouts are transferred every Monday. The amount leaves your balance now and is sent to{' '}
            {defaultAccount?.bankName ?? 'your bank'} on the next run. Any cash you owe DrippleX is
            settled out of this first.
          </p>
          {button(
            busy ? 'Requesting…' : 'Request payout',
            () =>
              void runPayout(() =>
                client.requestPayout({
                  amount: Number(amount),
                  bankAccountId: defaultAccount?.id ?? '',
                  pin,
                }),
              ),
            {
              primary: true,
              disabled:
                !defaultAccount ||
                pin.length !== 4 ||
                Number(amount) <= 0 ||
                Number(amount) > (availableBalance ?? 0),
            },
          )}
        </div>
      )}

      {pendingTotal > 0 && (
        <p className="mb-2 text-[12px]" style={{ fontFamily: IT, color: G3 }}>
          {naira(pendingTotal)} awaiting Monday’s payout run.
        </p>
      )}
      {notice && (
        <p className="mb-2 text-[12px]" style={{ fontFamily: IT, color: G3 }}>
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-2 text-[12px]" style={{ fontFamily: IT, color: ERROR }}>
          {error}
        </p>
      )}
      {loading && (
        <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          Loading your payout details…
        </p>
      )}
    </div>
  );
}
