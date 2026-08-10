import React, { useState } from 'react';
import { G0, G2, G3, MUTED } from '../../tokens/colors';
import { FONT_HEADING, FONT_BODY, TYPE } from '../../tokens/typography';
import { ELEVATION } from '../../tokens/elevation';
import { R_CARD } from '../../tokens/radius';

export interface WalletAction {
  icon: string;
  label: string;
  onPress?: () => void;
}

interface WalletCardProps {
  balance: string;
  currency?: string;
  accountName?: string;
  accountNo?: string;
  income?: string;
  expenses?: string;
  actions?: WalletAction[];
  style?: React.CSSProperties;
}

const DEFAULT_ACTIONS: WalletAction[] = [
  { icon: '↑', label: 'Send' },
  { icon: '↓', label: 'Receive' },
  { icon: '⊕', label: 'Top Up' },
  { icon: '⊠', label: 'Pay' },
];

export function WalletCard({
  balance,
  currency = '₦',
  accountName = 'DrippleX Wallet',
  accountNo,
  income,
  expenses,
  actions = DEFAULT_ACTIONS,
  style,
}: WalletCardProps) {
  const [balanceVisible, setBalanceVisible] = useState(true);

  return (
    <div
      className="mx-5 overflow-hidden rounded-3xl"
      style={{
        background: `linear-gradient(135deg, ${G0} 0%, ${G2} 55%, ${G3} 100%)`,
        boxShadow: ELEVATION.brandLg,
        borderRadius: R_CARD,
        ...style,
      }}
    >
      {/* Glare */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 80% 20%,rgba(255,255,255,.12) 0%,transparent 60%)',
        }}
      />

      <div className="relative z-10 p-5">
        {/* Header row */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p style={{ fontSize: TYPE.xs, color: 'rgba(255,255,255,.65)', fontFamily: FONT_BODY }}>
              {accountName}
            </p>
            {accountNo && (
              <p
                style={{
                  fontSize: TYPE.xs,
                  color: 'rgba(255,255,255,.45)',
                  fontFamily: FONT_BODY,
                  marginTop: 2,
                }}
              >
                •••• {accountNo}
              </p>
            )}
          </div>
          <button
            onClick={() => setBalanceVisible((v) => !v)}
            className="transition-all active:scale-90"
            aria-label={balanceVisible ? 'Hide balance' : 'Show balance'}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.65)"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              {balanceVisible ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Balance */}
        <p
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,.65)',
            fontFamily: FONT_BODY,
            marginBottom: 4,
          }}
        >
          Available Balance
        </p>
        <p
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: '#FFF',
            fontFamily: FONT_HEADING,
            marginBottom: 16,
          }}
        >
          {balanceVisible ? `${currency}${balance}` : '••••••'}
        </p>

        {/* Stats row */}
        {(income || expenses) && (
          <div className="mb-5 flex gap-4">
            {income && (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: 'rgba(255,255,255,.15)' }}
                >
                  <span style={{ fontSize: 12, color: '#FFF' }}>↓</span>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', fontFamily: FONT_BODY }}>
                    Income
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#FFF',
                      fontFamily: FONT_HEADING,
                    }}
                  >
                    {income}
                  </p>
                </div>
              </div>
            )}
            {expenses && (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: 'rgba(255,255,255,.15)' }}
                >
                  <span style={{ fontSize: 12, color: '#FFF' }}>↑</span>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,.6)', fontFamily: FONT_BODY }}>
                    Expenses
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#FFF',
                      fontFamily: FONT_HEADING,
                    }}
                  >
                    {expenses}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-between">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onPress}
              className="flex flex-col items-center gap-1.5 transition-all active:scale-90"
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)' }}
              >
                <span style={{ fontSize: 18, color: '#FFF' }}>{a.icon}</span>
              </div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,.8)',
                  fontFamily: FONT_BODY,
                }}
              >
                {a.label}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
