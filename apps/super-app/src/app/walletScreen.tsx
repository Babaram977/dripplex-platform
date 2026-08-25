import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import { gatewayCallbackUrl } from '../lib/gatewayReturn';
import { timeGreeting } from './shared';
import { Icon, type IconName } from './icons';
import type {
  CardProviderOptionDto,
  WalletDto,
  WalletLedgerEntryDto,
  WalletRecipientDto,
  CustomerBankAccountDto,
  LoyaltyOverviewDto,
  LoyaltyLedgerEntryDto,
} from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const G0 = '#176B30';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const NAVY_DEEP = '#060E1C';
const NAVY_BASE = '#0A1628';
const NAVY_CARD = '#0D1B2E';
const NAVY_SURFACE = '#112238';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.38)';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const ERROR = '#EF4444';
const INFO = '#3B82F6';
const STAR = '#FBBF24';
const PURPLE = '#8B5CF6';
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";
const GREEN_GRAD = `linear-gradient(135deg,${G0},${G2})`;
const HERO_GRAD = `linear-gradient(145deg,#0D2E1A 0%,#143D22 35%,#1A5230 65%,#0F2919 100%)`;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div
      className="dx-status-mock flex items-center justify-between px-5"
      style={{ paddingTop: 14, paddingBottom: 4 }}
    >
      <span
        style={{
          fontFamily: IT,
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,.9)',
          letterSpacing: '0.02em',
        }}
      >
        9:41
      </span>
      <div className="flex items-center gap-1">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <rect x="0" y="7" width="3" height="4" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="4.5" y="4.5" width="3" height="6.5" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="9" y="2" width="3" height="9" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="13.5" y="0" width="2.5" height="11" rx=".5" fill="rgba(255,255,255,.9)" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path d="M7.5 8.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="rgba(255,255,255,.9)" />
          <path
            d="M4.2 6.3a4.7 4.7 0 0 1 6.6 0"
            stroke="rgba(255,255,255,.9)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M1.5 3.5a8.2 8.2 0 0 1 12 0"
            stroke="rgba(255,255,255,.9)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex items-center gap-px">
          <div
            style={{
              width: 22,
              height: 11,
              border: '1.5px solid rgba(255,255,255,.7)',
              borderRadius: 3,
              padding: 1.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '76%',
                height: '100%',
                background: 'rgba(255,255,255,.9)',
                borderRadius: 1.5,
              }}
            />
          </div>
          <div
            style={{
              width: 2,
              height: 5,
              background: 'rgba(255,255,255,.5)',
              borderRadius: '0 1px 1px 0',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function BackButton({ onBack, label = '' }: { onBack?: () => void; label?: string }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-2"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px' }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M12.5 15L7.5 10l5-5"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label && (
        <span
          style={{ fontFamily: IT, fontSize: 14, color: 'rgba(255,255,255,.8)', fontWeight: 500 }}
        >
          {label}
        </span>
      )}
    </button>
  );
}

/**
 * Every wallet view's root. Fills the phone frame rather than assuming its
 * size: this used to be a hardcoded 390x844 — the Figma artboard — which is
 * not a size any real device has to be.
 *
 * On a 360px handset the frame is 360 wide (GLOBAL_STYLES drops the desktop
 * bezel below 480px and sets `width: 100dvw`), so a 390px child overflowed by
 * 30px into the frame's `overflow: hidden` and simply vanished: the balance
 * card ran off the edge, "Rewards" in the action row and "See all" on Recent
 * Transactions were both cut in half. Nothing scrolled it back into view,
 * because the clipping ancestor was the frame, not the page.
 *
 * The fixed 844 had the matching vertical failure — the frame is
 * `min(844px, 100dvh - 24px)`, so on any shorter viewport the bottom of the
 * screen was clipped away. Same reasoning as the PhoneFrame comment in App.tsx.
 *
 * 100% resolves against the frame in both axes, which is definite in both, so
 * desktop still renders at exactly 390x844 and nothing changes there.
 */
function Screen({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: NAVY_BASE,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: IT,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function GreenButton({
  children,
  onClick,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'rgba(255,255,255,.08)' : GREEN_GRAD,
        border: 'none',
        borderRadius: 14,
        color: disabled ? MUTED : '#fff',
        fontFamily: PP,
        fontWeight: 600,
        fontSize: 16,
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '16px 0',
        width: '100%',
        letterSpacing: '0.01em',
        boxShadow: disabled ? 'none' : `0 4px 20px rgba(43,172,82,.35)`,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  type = 'text',
  style,
}: {
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  type?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <span
          style={{
            fontFamily: IT,
            fontSize: 12,
            color: MUTED,
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      )}
      <div
        className="flex items-center"
        style={{
          background: NAVY_SURFACE,
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          padding: '0 16px',
          height: 52,
        }}
      >
        {prefix && <div style={{ marginRight: 8 }}>{prefix}</div>}
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          type={type}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontFamily: IT,
            fontSize: 16,
            fontWeight: 500,
          }}
        />
        {suffix && <div style={{ marginLeft: 8 }}>{suffix}</div>}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: IT,
        fontSize: 11,
        fontWeight: 600,
        color: MUTED,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? GREEN_GRAD : NAVY_SURFACE,
        border: `1px solid ${active ? 'transparent' : BORDER}`,
        borderRadius: 20,
        padding: '7px 14px',
        color: active ? '#fff' : MUTED,
        fontFamily: IT,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'all .18s',
        boxShadow: active ? `0 2px 12px rgba(43,172,82,.3)` : 'none',
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />;
}

function IconCircle({
  bg,
  children,
  size = 40,
}: {
  bg: string;
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        background: on ? GREEN_GRAD : 'rgba(255,255,255,.1)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background .2s',
        flexShrink: 0,
        boxShadow: on ? `0 2px 12px rgba(43,172,82,.4)` : 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 22 : 3,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: '#fff',
          transition: 'left .2s',
          boxShadow: '0 1px 4px rgba(0,0,0,.3)',
        }}
      />
    </button>
  );
}

function TxIcon({ type }: { type: string }) {
  const map: Record<string, { icon: IconName | null; glyph?: string; color: string }> = {
    RIDE: { icon: 'ride', color: INFO },
    TOPUP: { icon: 'card', color: SUCCESS },
    TRANSFER: { icon: null, glyph: '↑', color: PURPLE },
    WITHDRAWAL: { icon: 'bank', color: WARNING },
    REFUND: { icon: null, glyph: '↩', color: SUCCESS },
    CASHBACK: { icon: 'gift', color: STAR },
    CREDIT: { icon: null, glyph: '↓', color: SUCCESS },
    DEBIT: { icon: null, glyph: '↑', color: MUTED },
  };
  const key = type?.toUpperCase().replace(/-/g, '_');
  const match = map[key] ??
    map[
      type?.includes('TOPUP') || type?.includes('FUND')
        ? 'TOPUP'
        : type?.includes('WITHDRAW')
          ? 'WITHDRAWAL'
          : type?.includes('TRANSFER')
            ? 'TRANSFER'
            : 'DEBIT'
    ] ?? { icon: null, glyph: '₦', color: MUTED };
  return (
    <IconCircle bg={`${match.color}22`} size={42}>
      {match.icon ? (
        <Icon name={match.icon} size={19} color={match.color} />
      ) : (
        <span style={{ fontSize: 18, color: match.color }}>{match.glyph}</span>
      )}
    </IconCircle>
  );
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return d.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function EmptyState({ icon, title, sub }: { icon: IconName; title: string; sub?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px',
        gap: 8,
      }}
    >
      <Icon name={icon} size={38} color="rgba(255,255,255,.28)" />
      <div style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</div>
      {sub && (
        <div style={{ fontFamily: IT, fontSize: 13, color: MUTED, textAlign: 'center' }}>{sub}</div>
      )}
    </div>
  );
}

function ErrorRetry({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 24px',
        gap: 12,
      }}
    >
      <Icon name="alert" size={34} color="#F59E0B" />
      <div style={{ fontFamily: IT, fontSize: 13, color: MUTED, textAlign: 'center' }}>
        {message ?? 'Something went wrong.'}
      </div>
      <button
        onClick={onRetry}
        style={{
          background: NAVY_SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: '8px 20px',
          color: G3,
          fontFamily: IT,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WALLET HOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function WalletHomeScreen({
  onBack,
  onTopUp,
  onWithdraw,
  onTransfer,
  onPay,
  onTxHistory,
  onRewards,
}: {
  onBack?: () => void;
  onTopUp?: () => void;
  onWithdraw?: () => void;
  onTransfer?: () => void;
  onPay?: () => void;
  onTxHistory?: () => void;
  onRewards?: () => void;
}) {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [txs, setTxs] = useState<WalletLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const displayName = auth.greetingName();

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [w, t] = await Promise.all([
        api.wallet.get(),
        api.wallet.getTransactions({ pageSize: 5 }),
      ]);
      setWallet(w as WalletDto);
      setTxs((t as { items?: WalletLedgerEntryDto[] }).items ?? []);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load wallet');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const balance = wallet?.availableBalance ?? 0;
  const pending = wallet?.pendingBalance ?? 0;

  return (
    <Screen>
      <StatusBar />
      <div
        className="flex items-center justify-between px-5"
        style={{ paddingTop: 8, paddingBottom: 4 }}
      >
        <div>
          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, fontWeight: 500 }}>
            {timeGreeting()},
          </div>
          <div style={{ fontFamily: PP, fontSize: 17, fontWeight: 700, color: '#fff' }}>
            {displayName ? `Hi, ${displayName}` : 'Hello'}
          </div>
        </div>
        {/* This was drawn as a magnifying glass while calling onBack — the only
            way out of the wallet was disguised as search, so a customer who
            reached this screen had no visible way home and no route to Account,
            where signing out lives. It is a back arrow now, and it says so. */}
        <button
          onClick={onBack}
          aria-label="Back to home"
          style={{
            background: NAVY_SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M11 3.5L5.5 9L11 14.5"
              stroke={MUTED}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {error ? (
        <ErrorRetry message={error} onRetry={load} />
      ) : (
        <>
          <div
            style={{
              margin: '10px 16px 0',
              borderRadius: 24,
              background: HERO_GRAD,
              padding: '28px 24px 24px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -40,
                left: -40,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: `radial-gradient(circle,${G3} 0%,transparent 65%)`,
                opacity: 0.12,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -30,
                right: -20,
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: `radial-gradient(circle,${G2} 0%,transparent 65%)`,
                opacity: 0.1,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '100%',
                height: '100%',
                opacity: 0.04,
                backgroundImage:
                  'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
                backgroundSize: '12px 12px',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                fontFamily: IT,
                fontSize: 12,
                color: 'rgba(255,255,255,.55)',
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              DrippleX Wallet Balance
            </div>
            {loading ? (
              <div
                style={{
                  fontFamily: PP,
                  fontSize: 42,
                  fontWeight: 800,
                  color: MUTED,
                  lineHeight: 1.1,
                  marginBottom: 4,
                }}
              >
                Loading…
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontFamily: PP,
                    fontSize: 42,
                    fontWeight: 800,
                    color: '#fff',
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                    marginBottom: 4,
                  }}
                >
                  ₦{Math.floor(balance).toLocaleString()}
                  <span style={{ fontSize: 24, fontWeight: 600, opacity: 0.7 }}>
                    .{String(Math.round((balance % 1) * 100)).padStart(2, '0')}
                  </span>
                </div>
                {pending > 0 && (
                  <div
                    style={{
                      fontFamily: IT,
                      fontSize: 12,
                      color: 'rgba(255,255,255,.45)',
                      marginBottom: 16,
                    }}
                  >
                    ₦{pending.toLocaleString()} pending
                  </div>
                )}
              </>
            )}
            <div className="flex items-center gap-3">
              <div
                style={{
                  background: 'rgba(255,255,255,.1)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 10,
                  padding: '6px 12px',
                  border: '1px solid rgba(255,255,255,.12)',
                }}
              >
                <span
                  style={{
                    fontFamily: IT,
                    fontSize: 11,
                    color: 'rgba(255,255,255,.8)',
                    fontWeight: 600,
                  }}
                >
                  <Icon name="lock" size={11} /> PIN Protected
                </span>
              </div>
              <div
                style={{
                  background: 'rgba(43,172,82,.2)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 10,
                  padding: '6px 12px',
                  border: `1px solid rgba(43,172,82,.3)`,
                }}
              >
                <span style={{ fontFamily: IT, fontSize: 11, color: G3, fontWeight: 600 }}>
                  <Icon name="all" size={11} /> DrippleX Wallet
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-4" style={{ marginTop: 20 }}>
            {[
              { label: 'Top Up', icon: '↓', color: SUCCESS, onClick: onTopUp },
              { label: 'Withdraw', icon: '↑', color: WARNING, onClick: onWithdraw },
              { label: 'Transfer', icon: '→', color: INFO, onClick: onTransfer },
              { label: 'Pay', icon: '₦', color: PURPLE, onClick: onPay },
              { label: 'Rewards', icon: 'gift', color: WARNING, onClick: onRewards },
            ].map(({ label, icon, color, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    background: NAVY_CARD,
                    border: `1px solid ${BORDER}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 12px rgba(0,0,0,.3)',
                  }}
                >
                  {icon === 'gift' ? (
                    <Icon name="gift" size={21} color={color} />
                  ) : (
                    <span
                      style={{
                        color,
                        fontFamily: PP,
                        fontSize: 22,
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      {icon}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: IT,
                    fontSize: 12,
                    color: 'rgba(255,255,255,.7)',
                    fontWeight: 500,
                  }}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'hidden', margin: '16px 0 0' }}>
            <div className="flex items-center justify-between px-5" style={{ marginBottom: 12 }}>
              <span style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                Recent Transactions
              </span>
              <button
                onClick={onTxHistory}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: IT,
                  fontSize: 13,
                  color: G3,
                  fontWeight: 600,
                }}
              >
                See all
              </button>
            </div>
            <div style={{ overflow: 'auto', paddingBottom: 24 }}>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      height: 60,
                      background: NAVY_SURFACE,
                      borderRadius: 10,
                      margin: '0 16px 8px',
                      opacity: 0.5,
                    }}
                  />
                ))
              ) : txs.length === 0 ? (
                <EmptyState
                  icon="send"
                  title="No transactions yet"
                  sub="Your wallet activity will appear here"
                />
              ) : (
                txs.map((tx, i) => (
                  <div key={tx.id}>
                    {i > 0 && <div style={{ height: 1, background: BORDER, margin: '0 16px' }} />}
                    <div className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <TxIcon type={tx.type} />
                        <div>
                          <div
                            style={{
                              fontFamily: IT,
                              fontSize: 14,
                              fontWeight: 600,
                              color: '#fff',
                              marginBottom: 2,
                            }}
                          >
                            {tx.description ?? tx.type}
                          </div>
                          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                            {fmtDate(tx.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: PP,
                            fontSize: 15,
                            fontWeight: 700,
                            color: tx.direction === 'CREDIT' ? SUCCESS : '#fff',
                          }}
                        >
                          {tx.direction === 'CREDIT' ? '+' : '−'}₦{tx.amount.toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontFamily: IT,
                            fontSize: 11,
                            color: tx.direction === 'CREDIT' ? SUCCESS : MUTED,
                          }}
                        >
                          {tx.direction === 'CREDIT' ? 'Credit' : 'Debit'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRANSACTION HISTORY SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const FILTER_TABS = ['All', 'Ride', 'Refund', 'Top-up', 'Withdrawal', 'Transfer'];

export function TransactionHistoryScreen({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [txs, setTxs] = useState<WalletLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (tab = 'All', p = 1) => {
    setLoading(true);
    setError('');
    try {
      const typeParam = tab === 'All' ? undefined : tab.toUpperCase().replace('-', '');
      const res = await api.wallet.getTransactions({ page: p, pageSize: 30, type: typeParam });
      const r = res as { items?: WalletLedgerEntryDto[]; total?: number };
      setTxs(r.items ?? []);
      setTotal(r.total ?? 0);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    load(activeTab, 1);
  }, [activeTab, load]);

  const filtered = txs.filter(
    (tx) => !search || (tx.description ?? tx.type).toLowerCase().includes(search.toLowerCase()),
  );

  const groups: Record<string, WalletLedgerEntryDto[]> = {};
  filtered.forEach((tx) => {
    const d = new Date(tx.createdAt);
    const now = new Date();
    let key: string;
    if (d.toDateString() === now.toDateString()) key = 'Today';
    else {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      key =
        d.toDateString() === yest.toDateString()
          ? 'Yesterday'
          : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Transactions
        </span>
      </div>

      <div className="px-4" style={{ marginBottom: 12 }}>
        <div
          className="flex items-center"
          style={{
            background: NAVY_SURFACE,
            borderRadius: 12,
            border: `1.5px solid ${search ? G2 : BORDER}`,
            padding: '0 14px',
            height: 44,
            transition: 'border-color .2s',
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            style={{ marginRight: 10, flexShrink: 0 }}
          >
            <circle cx="6.5" cy="6.5" r="5" stroke={MUTED} strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontFamily: IT,
              fontSize: 14,
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '0 16px 12px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {FILTER_TABS.map((t) => (
          <Pill key={t} active={activeTab === t} onClick={() => setActiveTab(t)}>
            {t}
          </Pill>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED, fontFamily: IT }}>
            Loading…
          </div>
        ) : error ? (
          <ErrorRetry message={error} onRetry={() => load(activeTab, page)} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No transactions"
            sub={search ? 'Try a different search' : 'Nothing to show for this filter'}
          />
        ) : (
          Object.entries(groups).map(([date, list]) => (
            <div key={date}>
              <div
                style={{
                  padding: '12px 20px 6px',
                  fontFamily: IT,
                  fontSize: 12,
                  fontWeight: 600,
                  color: MUTED,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {date}
              </div>
              {list.map((tx, i) => (
                <div key={tx.id}>
                  {i > 0 && <div style={{ height: 1, background: BORDER, margin: '0 20px' }} />}
                  <div className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <TxIcon type={tx.type} />
                      <div>
                        <div
                          style={{
                            fontFamily: IT,
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#fff',
                            marginBottom: 2,
                          }}
                        >
                          {tx.description ?? tx.type}
                        </div>
                        <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                          {fmtDate(tx.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontFamily: PP,
                          fontSize: 15,
                          fontWeight: 700,
                          color: tx.direction === 'CREDIT' ? SUCCESS : '#fff',
                        }}
                      >
                        {tx.direction === 'CREDIT' ? '+' : '−'}₦{tx.amount.toLocaleString()}
                      </div>
                      <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                        ₦{tx.balanceAfter.toLocaleString()} bal
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        {!loading && total > txs.length && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <button
              onClick={() => {
                const next = page + 1;
                setPage(next);
                load(activeTab, next);
              }}
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '8px 20px',
                color: G3,
                fontFamily: IT,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Load more
            </button>
          </div>
        )}
        <div style={{ height: 24 }} />
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TOP-UP SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const AMOUNT_PRESETS = ['500', '1,000', '2,000', '5,000', '10,000', '20,000'];
/**
 * The three rows that used to sit here — Card, Bank Transfer, USSD — were
 * theatre. Whichever you picked, the same call ran and the same gateway
 * checkout opened, where the customer chose card/transfer/USSD anyway. The
 * real choice is WHICH GATEWAY, and the founder wants the customer to make it
 * (2026-08-18) because one can be down while the other is fine. The list is
 * read from the server so a rotated key removes an option instead of leaving a
 * button that fails.
 */
const GATEWAY_ICONS: Record<string, IconName> = { PAYSTACK: 'card', FLUTTERWAVE: 'bank' };

export function TopUpScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const [amount, setAmount] = useState('5,000');
  const [providers, setProviders] = useState<CardProviderOptionDto[]>([]);
  const [method, setMethod] = useState<'PAYSTACK' | 'FLUTTERWAVE' | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const refRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    api.payments
      .providers()
      .then((config) => {
        if (!live) return;
        setProviders(config.cardProviders);
        // Preselect the platform default so the common case is one tap.
        setMethod(config.defaultCardProvider ?? config.cardProviders[0]?.provider ?? '');
      })
      .catch(() => {
        if (live) setProviders([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const handleTopUp = async () => {
    const raw = Number(amount.replace(/,/g, ''));
    if (!raw || raw < 100) {
      setError('Minimum top-up is ₦100');
      return;
    }
    if (providers.length === 0) {
      setError('Card top-up is not available right now. Please try again shortly.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // The gateway the customer picked. Sent in the backend's own casing —
      // this used to send 'paystack' in lower case, which the enum rejected
      // outright, so every card top-up returned 422. Omitted entirely when
      // nothing is selected, which lets the server fall back to its default.
      const res = await api.wallet.fund({
        amount: raw,
        ...(method !== '' ? { provider: method } : {}),
        // The gateway opens in a second tab, and without a callback it leaves
        // the customer parked on its own success page. This brings that tab
        // back to the wallet; the credit itself no longer depends on either
        // tab, because the backend settles the top-up from the webhook.
        callbackUrl: gatewayCallbackUrl('wallet'),
      });
      const r = res as { authorizationUrl?: string; reference?: string };
      refRef.current = r.reference ?? null;
      if (r.authorizationUrl) {
        window.open(r.authorizationUrl, '_blank', 'noopener');
        setVerifying(true);
      } else {
        onConfirm?.();
      }
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Top-up initiation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      await api.wallet.verifyFunding({ reference: refRef.current ?? undefined });
      setVerifying(false);
      onConfirm?.();
    } catch (e: unknown) {
      setError(
        (e as { message?: string }).message ??
          'Payment could not be verified yet. Try again in a moment.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Top Up Wallet
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        {verifying ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ marginBottom: 16 }}>
              <Icon name="card" size={44} color="rgba(255,255,255,.28)" />
            </div>
            <div
              style={{
                fontFamily: PP,
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                marginBottom: 8,
              }}
            >
              Payment Window Opened
            </div>
            <div
              style={{
                fontFamily: IT,
                fontSize: 13,
                color: MUTED,
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              Complete payment in the browser tab, then come back and tap "I've paid" to confirm.
            </div>
            {error && (
              <div style={{ color: ERROR, fontFamily: IT, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <GreenButton onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying…' : "I've paid — Confirm"}
            </GreenButton>
            <button
              onClick={() => {
                setVerifying(false);
                setError('');
              }}
              style={{
                marginTop: 12,
                background: 'none',
                border: 'none',
                color: MUTED,
                fontFamily: IT,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="px-4" style={{ marginBottom: 16 }}>
              <div
                style={{
                  background: NAVY_CARD,
                  borderRadius: 20,
                  padding: 20,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div
                  style={{
                    fontFamily: IT,
                    fontSize: 12,
                    color: MUTED,
                    fontWeight: 500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Amount
                </div>
                <div className="flex items-center">
                  <span
                    style={{
                      fontFamily: PP,
                      fontSize: 32,
                      fontWeight: 700,
                      color: G3,
                      marginRight: 4,
                    }}
                  >
                    ₦
                  </span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      fontFamily: PP,
                      fontSize: 32,
                      fontWeight: 700,
                      color: '#fff',
                      width: '100%',
                    }}
                  />
                </div>
                <div
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg,${G2},transparent)`,
                    marginTop: 8,
                  }}
                />
              </div>
            </div>

            <div className="px-4" style={{ marginBottom: 20 }}>
              <SectionLabel>Quick amounts</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {AMOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset)}
                    style={{
                      background: amount === preset ? GREEN_GRAD : NAVY_SURFACE,
                      border: `1px solid ${amount === preset ? 'transparent' : BORDER}`,
                      borderRadius: 10,
                      padding: '9px 16px',
                      color: amount === preset ? '#fff' : MUTED,
                      fontFamily: IT,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: amount === preset ? `0 2px 12px rgba(43,172,82,.35)` : 'none',
                    }}
                  >
                    ₦{preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4" style={{ marginBottom: 20 }}>
              <SectionLabel>Payment method</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {providers.length === 0 ? (
                  <div style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>
                    Card top-up is not available right now.
                  </div>
                ) : null}
                {providers.map((pm) => (
                  <button
                    key={pm.provider}
                    onClick={() => setMethod(pm.provider)}
                    style={{
                      background: method === pm.provider ? `rgba(43,172,82,.08)` : NAVY_SURFACE,
                      border: `1.5px solid ${method === pm.provider ? G2 : BORDER}`,
                      borderRadius: 14,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                    }}
                  >
                    <Icon name={GATEWAY_ICONS[pm.provider] ?? 'card'} size={22} color={G3} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                        {pm.label}
                      </div>
                      <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                        Card, bank transfer or USSD
                      </div>
                    </div>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        border: `2px solid ${method === pm.provider ? G2 : BORDER}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {method === pm.provider && (
                        <div style={{ width: 9, height: 9, borderRadius: 4.5, background: G2 }} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4" style={{ marginBottom: 4 }}>
              <div
                style={{
                  background: NAVY_SURFACE,
                  borderRadius: 10,
                  padding: '10px 14px',
                  border: `1px solid ${BORDER}`,
                  fontFamily: IT,
                  fontSize: 12,
                  color: MUTED,
                }}
              >
                Card management is handled by your payment provider. You will be redirected to
                complete the transaction securely.
              </div>
            </div>

            {error && (
              <div style={{ padding: '8px 16px', fontFamily: IT, fontSize: 12, color: ERROR }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {!verifying && (
        <div
          className="px-4"
          style={{
            paddingBottom: 32,
            paddingTop: 8,
            borderTop: `1px solid ${BORDER}`,
            background: NAVY_BASE,
          }}
        >
          <GreenButton onClick={handleTopUp} disabled={loading}>
            {loading ? 'Processing…' : `Top Up ₦${amount}`}
          </GreenButton>
        </div>
      )}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WITHDRAW SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function WithdrawScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState<CustomerBankAccountDto[]>([]);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAddBank, setShowAddBank] = useState(false);
  const [addForm, setAddForm] = useState({
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: '',
  });
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [accs, w] = await Promise.all([api.wallet.getBankAccounts(), api.wallet.get()]);
      const list = accs as CustomerBankAccountDto[];
      setAccounts(list);
      if (list.length > 0) setSelectedId(list.find((a) => a.isDefault)?.id ?? list[0].id);
      setWallet(w as WalletDto);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleWithdraw = async () => {
    const raw = Number(amount.replace(/,/g, ''));
    if (!raw || !selectedId) {
      setError('Enter amount and select a bank account');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.wallet.requestWithdrawal({ amount: raw, bankAccountId: selectedId });
      onConfirm?.();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Withdrawal failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = () => {
    setResolving(true);
    setTimeout(() => {
      setAddForm((f) => ({ ...f, accountName: 'DRIPPLEX USER' }));
      setResolving(false);
    }, 1200);
  };

  const handleAddBank = async () => {
    if (!addForm.bankName || !addForm.accountNumber || !addForm.accountName) return;
    try {
      await api.wallet.addBankAccount({
        bankName: addForm.bankName,
        bankCode: addForm.bankCode || '000',
        accountNumber: addForm.accountNumber,
        accountName: addForm.accountName,
      });
      setShowAddBank(false);
      setAddForm({ bankName: '', bankCode: '', accountNumber: '', accountName: '' });
      load();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not add bank account');
    }
  };

  const balance = wallet?.availableBalance ?? 0;

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Withdraw
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <div className="px-4" style={{ marginBottom: 12 }}>
          <div
            style={{
              background: `rgba(43,172,82,.08)`,
              borderRadius: 12,
              padding: '10px 14px',
              border: `1px solid rgba(43,172,82,.15)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Available balance</span>
            <span style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: G3 }}>
              ₦{balance.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="px-4" style={{ marginBottom: 20 }}>
          <div
            style={{
              background: NAVY_CARD,
              borderRadius: 20,
              padding: 20,
              border: `1px solid ${BORDER}`,
            }}
          >
            <div
              style={{
                fontFamily: IT,
                fontSize: 12,
                color: MUTED,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Withdraw amount
            </div>
            <div className="flex items-center">
              <span
                style={{
                  fontFamily: PP,
                  fontSize: 32,
                  fontWeight: 700,
                  color: WARNING,
                  marginRight: 4,
                }}
              >
                ₦
              </span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontFamily: PP,
                  fontSize: 32,
                  fontWeight: 700,
                  color: '#fff',
                  width: '100%',
                }}
              />
            </div>
            <div
              style={{
                height: 1,
                background: `linear-gradient(90deg,${WARNING},transparent)`,
                marginTop: 8,
              }}
            />
          </div>
        </div>

        <div className="px-4" style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <SectionLabel>Destination account</SectionLabel>
            <button
              onClick={() => setShowAddBank(true)}
              style={{
                background: 'none',
                border: 'none',
                color: G3,
                fontFamily: IT,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Add bank
            </button>
          </div>
          {loading ? (
            <div style={{ height: 60, background: NAVY_SURFACE, borderRadius: 12, opacity: 0.5 }} />
          ) : accounts.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <div style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginBottom: 12 }}>
                No bank accounts linked yet
              </div>
              <button
                onClick={() => setShowAddBank(true)}
                style={{
                  background: `rgba(43,172,82,.1)`,
                  border: `1px solid rgba(43,172,82,.25)`,
                  borderRadius: 10,
                  padding: '8px 18px',
                  color: G3,
                  fontFamily: IT,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Add bank account
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accounts.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => setSelectedId(bank.id)}
                  style={{
                    background: selectedId === bank.id ? `rgba(43,172,82,.07)` : NAVY_SURFACE,
                    border: `1.5px solid ${selectedId === bank.id ? G2 : BORDER}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Icon name="bank" size={24} color={G3} />
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {bank.bankName}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                      {bank.accountName} · {bank.accountNumber}
                    </div>
                  </div>
                  {selectedId === bank.id && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: GREEN_GRAD,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                        <path
                          d="M1 4l3 3 6-6"
                          stroke="#fff"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {showAddBank && (
          <div className="px-4" style={{ marginBottom: 20 }}>
            <div
              style={{
                background: NAVY_CARD,
                borderRadius: 16,
                padding: 16,
                border: `1px solid ${G2}`,
              }}
            >
              <div
                style={{
                  fontFamily: PP,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 14,
                }}
              >
                Add Bank Account
              </div>
              <InputField
                label="Bank name"
                value={addForm.bankName}
                onChange={(v) => setAddForm((f) => ({ ...f, bankName: v }))}
                placeholder="e.g. GTBank"
                style={{ marginBottom: 12 }}
              />
              <InputField
                label="Account number"
                value={addForm.accountNumber}
                onChange={(v) => setAddForm((f) => ({ ...f, accountNumber: v }))}
                placeholder="10-digit number"
                type="tel"
                style={{ marginBottom: 8 }}
              />
              {addForm.accountNumber.length >= 10 && !addForm.accountName && (
                <button
                  onClick={handleResolve}
                  style={{
                    background: `rgba(43,172,82,.1)`,
                    border: `1px solid rgba(43,172,82,.25)`,
                    borderRadius: 8,
                    padding: '7px 14px',
                    color: G3,
                    fontFamily: IT,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: 10,
                  }}
                >
                  {resolving ? 'Resolving…' : 'Verify account'}
                </button>
              )}
              {addForm.accountName && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: `rgba(16,185,129,.08)`,
                    border: `1px solid rgba(16,185,129,.2)`,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: SUCCESS }}>
                    {addForm.accountName}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowAddBank(false)}
                  style={{
                    flex: 1,
                    background: NAVY_SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10,
                    padding: '10px 0',
                    color: MUTED,
                    fontFamily: IT,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBank}
                  disabled={!addForm.accountName}
                  style={{
                    flex: 1,
                    background: addForm.accountName ? GREEN_GRAD : 'rgba(255,255,255,.05)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 0',
                    color: addForm.accountName ? '#fff' : MUTED,
                    fontFamily: IT,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: addForm.accountName ? 'pointer' : 'not-allowed',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 16px', fontFamily: IT, fontSize: 12, color: ERROR }}>
            {error}
          </div>
        )}

        <div className="px-4" style={{ marginBottom: 8 }}>
          <div
            style={{
              background: `rgba(59,130,246,.08)`,
              borderRadius: 14,
              padding: 16,
              border: `1px solid rgba(59,130,246,.18)`,
              display: 'flex',
              gap: 12,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>ℹ️</span>
            <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
              Withdrawals are processed by the DrippleX Operations team. Arrival within 30 minutes
              on business days.
            </div>
          </div>
        </div>
      </div>

      <div
        className="px-4"
        style={{
          paddingBottom: 32,
          paddingTop: 8,
          borderTop: `1px solid ${BORDER}`,
          background: NAVY_BASE,
        }}
      >
        <GreenButton
          onClick={handleWithdraw}
          disabled={submitting || !amount || !selectedId}
          style={{ background: `linear-gradient(135deg,#7C3A0A,${WARNING})` }}
        >
          {submitting ? 'Processing…' : `Withdraw ${amount ? `₦${amount}` : ''}`}
        </GreenButton>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRANSFER SCREEN
// ─────────────────────────────────────────────────────────────────────────────

/** A recipient's name, tolerating an account that is missing one half — the
 *  same trap that rendered "undefined undefined" in the profile. Falls back to
 *  the masked number so a row is never nameless before you send money to it. */
function recipientName(r: WalletRecipientDto): string {
  const name = [r.firstName, r.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .join(' ');
  return name || r.maskedPhone;
}

function recipientInitials(r: WalletRecipientDto): string {
  const initials = [r.firstName, r.lastName]
    .map((part) => part?.trim()?.[0])
    .filter(Boolean)
    .join('')
    .toUpperCase();
  return initials || '#';
}

export function TransferScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<WalletRecipientDto[]>([]);
  const [recipient, setRecipient] = useState<WalletRecipientDto | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const phone = v.replace(/\D/g, '');
    if (phone.length < 7) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.wallet.findRecipient(phone);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const handleTransfer = async () => {
    const raw = Number(amount.replace(/,/g, ''));
    if (!raw || !recipient) {
      setError('Select a recipient and enter amount');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.wallet.transfer({
        toUserId: recipient.id,
        amount: raw,
        description: note || undefined,
      });
      onConfirm?.();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Transfer
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        <div className="px-4" style={{ marginBottom: 20 }}>
          <div
            className="flex items-center"
            style={{
              background: NAVY_SURFACE,
              borderRadius: 12,
              border: `1.5px solid ${search ? G2 : BORDER}`,
              padding: '0 14px',
              height: 52,
              transition: 'border-color .2s',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{ marginRight: 10, flexShrink: 0 }}
            >
              <circle cx="7" cy="7" r="5" stroke={MUTED} strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Phone number to search"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontFamily: IT,
                fontSize: 15,
              }}
            />
            {searching && <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>…</div>}
          </div>
        </div>

        {!recipient && results.length > 0 && (
          <div className="px-4" style={{ marginBottom: 20 }}>
            <SectionLabel>Search results</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRecipient(r);
                    setSearch('');
                    setResults([]);
                  }}
                  style={{
                    background: NAVY_SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      background: `rgba(59,130,246,.2)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: INFO }}>
                      {recipientInitials(r)}
                    </span>
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {recipientName(r)}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                      {r.maskedPhone}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M6 12l4-4-4-4"
                      stroke={MUTED}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {!recipient && !results.length && search.length >= 7 && !searching && (
          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>
              No DrippleX user found for this phone number
            </div>
          </div>
        )}

        {!recipient && !search && (
          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
            <Icon name="airtime" size={30} color="rgba(255,255,255,.32)" />
            <div style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginTop: 8 }}>
              Enter the recipient's phone number to find them
            </div>
          </div>
        )}

        {recipient && (
          <>
            <div className="px-4" style={{ marginBottom: 20 }}>
              <div
                style={{
                  background: `rgba(43,172,82,.07)`,
                  borderRadius: 16,
                  padding: 16,
                  border: `1.5px solid ${G2}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    background: `rgba(59,130,246,.2)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: INFO }}>
                    {recipientInitials(recipient)}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                    {recipientName(recipient)}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>
                    {recipient.maskedPhone}
                  </div>
                </div>
                <button
                  onClick={() => setRecipient(null)}
                  style={{
                    background: 'rgba(255,255,255,.08)',
                    border: 'none',
                    borderRadius: 8,
                    width: 30,
                    height: 30,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: MUTED, fontSize: 16, lineHeight: 1 }}>✕</span>
                </button>
              </div>
            </div>

            <div className="px-4" style={{ marginBottom: 16 }}>
              <div
                style={{
                  background: NAVY_CARD,
                  borderRadius: 20,
                  padding: 20,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div
                  style={{
                    fontFamily: IT,
                    fontSize: 12,
                    color: MUTED,
                    fontWeight: 500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Amount
                </div>
                <div className="flex items-center">
                  <span
                    style={{
                      fontFamily: PP,
                      fontSize: 32,
                      fontWeight: 700,
                      color: PURPLE,
                      marginRight: 4,
                    }}
                  >
                    ₦
                  </span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      fontFamily: PP,
                      fontSize: 32,
                      fontWeight: 700,
                      color: '#fff',
                      width: '100%',
                    }}
                  />
                </div>
                <div
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg,${PURPLE},transparent)`,
                    marginTop: 8,
                  }}
                />
              </div>
            </div>

            <div className="px-4" style={{ marginBottom: 20 }}>
              <InputField
                label="Note (optional)"
                value={note}
                onChange={setNote}
                placeholder="e.g. For lunch"
              />
            </div>

            <div className="px-4" style={{ marginBottom: 8 }}>
              <div
                style={{
                  background: NAVY_SURFACE,
                  borderRadius: 12,
                  padding: '10px 14px',
                  border: `1px solid ${BORDER}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Transfer fee</span>
                <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: SUCCESS }}>
                  Free (DrippleX to DrippleX)
                </span>
              </div>
            </div>

            {error && (
              <div style={{ padding: '8px 16px', fontFamily: IT, fontSize: 12, color: ERROR }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>

      {recipient && (
        <div
          className="px-4"
          style={{
            paddingBottom: 32,
            paddingTop: 8,
            borderTop: `1px solid ${BORDER}`,
            background: NAVY_BASE,
          }}
        >
          <GreenButton
            onClick={handleTransfer}
            disabled={submitting || !amount}
            style={{
              opacity: amount ? 1 : 0.45,
              background: `linear-gradient(135deg,#3B0E6E,${PURPLE})`,
            }}
          >
            {submitting ? 'Sending…' : `Send ${amount ? `₦${amount}` : 'Money'}`}
          </GreenButton>
        </div>
      )}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PAYMENT METHODS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function PaymentMethodsScreen({
  onBack,
  onAddCard,
}: {
  onBack?: () => void;
  onAddCard?: () => void;
}) {
  const [accounts, setAccounts] = useState<CustomerBankAccountDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.wallet
      .getBankAccounts()
      .then((r) => setAccounts(r as CustomerBankAccountDto[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Payment Methods
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        <div className="px-4" style={{ marginBottom: 24 }}>
          <SectionLabel>Debit / credit cards</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 16,
              padding: '16px',
              border: `1px solid ${BORDER}`,
              textAlign: 'center',
            }}
          >
            <Icon name="card" size={30} color="rgba(255,255,255,.3)" style={{ marginBottom: 8 }} />
            <div style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>
              Card management is handled by your payment provider during checkout. Add a card via
              Top Up to save it.
            </div>
            <button
              onClick={onAddCard}
              style={{
                marginTop: 12,
                background: `rgba(43,172,82,.1)`,
                border: `1px solid rgba(43,172,82,.25)`,
                borderRadius: 10,
                padding: '8px 18px',
                color: G3,
                fontFamily: IT,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add via Top Up
            </button>
          </div>
        </div>

        <div className="px-4">
          <SectionLabel>Linked bank accounts</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {loading ? (
              <div
                style={{ height: 60, background: NAVY_SURFACE, borderRadius: 12, opacity: 0.5 }}
              />
            ) : accounts.length === 0 ? (
              <div
                style={{
                  padding: '20px 0',
                  fontFamily: IT,
                  fontSize: 13,
                  color: MUTED,
                  textAlign: 'center',
                }}
              >
                No bank accounts linked yet
              </div>
            ) : (
              accounts.map((bank) => (
                <div
                  key={bank.id}
                  style={{
                    background: NAVY_SURFACE,
                    borderRadius: 14,
                    border: `1px solid ${bank.isDefault ? G2 : BORDER}`,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Icon name="bank" size={24} color={G3} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {bank.bankName}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                      {bank.accountName} · {bank.accountNumber}
                    </div>
                  </div>
                  {bank.isDefault && (
                    <div
                      style={{
                        background: `rgba(43,172,82,.15)`,
                        borderRadius: 8,
                        padding: '4px 10px',
                      }}
                    >
                      <span style={{ fontFamily: IT, fontSize: 11, fontWeight: 700, color: G3 }}>
                        Default
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. REWARDS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
// The real DrippleX loyalty accrual rules (backend LOYALTY_EVENT_POINTS) — these
// points already accumulate automatically on these events.
const EARN_RULES = [
  {
    id: 'order',
    label: 'Complete an order',
    desc: 'Earned when your order is paid',
    points: 50,
    icon: 'marketplace' as IconName,
    color: G2,
  },
  {
    id: 'delivery',
    label: 'Delivery completed',
    desc: 'When a delivery is finished',
    points: 25,
    icon: 'scooter' as IconName,
    color: INFO,
  },
  {
    id: 'signup',
    label: 'Sign-up bonus',
    desc: 'One-time, on registration',
    points: 100,
    icon: 'gift' as IconName,
    color: WARNING,
  },
  {
    id: 'coupon',
    label: 'Use a promo code',
    desc: 'When a coupon is redeemed',
    points: 10,
    icon: 'tag' as IconName,
    color: STAR,
  },
];

const fmtLoyaltyDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function RewardsScreen({ onBack }: { onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltyOverviewDto | null>(null);
  const [history, setHistory] = useState<LoyaltyLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth.getUser();
  const referralCode = `DRPX-${(user?.firstName ?? 'USER').toUpperCase().slice(0, 5)}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!auth.isLoggedIn()) {
      setLoading(false);
      return;
    }
    api.loyalty
      .get()
      .then(setLoyalty)
      .catch(() => {})
      .finally(() => setLoading(false));
    api.loyalty
      .history({ pageSize: 8 })
      .then((r) => setHistory(r.items ?? []))
      .catch(() => {});
  }, []);

  const points = loyalty?.account.pointsBalance ?? 0;
  const tier = loyalty?.account.tier ?? 'BRONZE';
  const lifetime = loyalty?.account.lifetimePoints ?? 0;
  const nextTier = loyalty?.nextTier ?? null;
  const progressPct = nextTier
    ? Math.min(100, Math.round((lifetime / nextTier.pointsRequired) * 100))
    : 100;

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Rewards
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        <div
          style={{
            margin: '0 16px 20px',
            borderRadius: 22,
            background: `linear-gradient(145deg,#1A3A0D,#24582A,#1E4A22)`,
            padding: '24px 22px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 6px 30px rgba(0,0,0,.4)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: `radial-gradient(circle,${G3} 0%,transparent 70%)`,
              opacity: 0.15,
            }}
          />
          <div
            style={{
              fontFamily: IT,
              fontSize: 12,
              color: 'rgba(255,255,255,.55)',
              marginBottom: 6,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            DrippleX Points
          </div>
          <div
            style={{
              fontFamily: PP,
              fontSize: 38,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 2,
            }}
          >
            {loading ? '—' : `${points.toLocaleString()} pts`}
          </div>
          <div style={{ fontFamily: IT, fontSize: 13, color: 'rgba(255,255,255,.55)' }}>
            {tier.charAt(0) + tier.slice(1).toLowerCase()} tier
            {nextTier
              ? ` · ${Math.max(0, nextTier.pointsRequired - lifetime).toLocaleString()} pts to ${
                  nextTier.tier.charAt(0) + nextTier.tier.slice(1).toLowerCase()
                }`
              : ' · Top tier'}
          </div>
          {nextTier && (
            <div
              style={{
                marginTop: 12,
                height: 6,
                borderRadius: 3,
                background: 'rgba(255,255,255,.15)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: G3,
                }}
              />
            </div>
          )}
        </div>

        <div className="px-4" style={{ marginBottom: 20 }}>
          <SectionLabel>How you earn points</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {EARN_RULES.map((r) => (
              <div
                key={r.id}
                style={{
                  background: NAVY_CARD,
                  borderRadius: 14,
                  padding: '14px 16px',
                  border: `1px solid ${BORDER}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <IconCircle bg={`${r.color}22`} size={44}>
                  <Icon name={r.icon} size={20} color={r.color} />
                </IconCircle>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {r.label}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{r.desc}</div>
                </div>
                <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: G3 }}>
                  +{r.points}
                </div>
              </div>
            ))}
          </div>
        </div>

        {history.length > 0 && (
          <div className="px-4" style={{ marginBottom: 20 }}>
            <SectionLabel>Recent activity</SectionLabel>
            <div
              style={{
                marginTop: 10,
                background: NAVY_CARD,
                borderRadius: 14,
                border: `1px solid ${BORDER}`,
                overflow: 'hidden',
              }}
            >
              {history.map((h, i) => (
                <div
                  key={h.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 16px',
                    borderTop: i > 0 ? `1px solid ${BORDER}` : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: IT,
                        fontSize: 13,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h.reason}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                      {fmtLoyaltyDate(h.createdAt)}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: PP,
                      fontSize: 13,
                      fontWeight: 700,
                      color: h.points >= 0 ? G3 : '#F87171',
                    }}
                  >
                    {h.points >= 0 ? '+' : ''}
                    {h.points.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4" style={{ marginBottom: 8 }}>
          <SectionLabel>Your referral code</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_SURFACE,
              borderRadius: 16,
              padding: '18px 16px',
              border: `1px solid rgba(251,191,36,.2)`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 8 }}>
              Share and earn ₦350 per friend who signs up (V2)
            </div>
            <div
              style={{
                fontFamily: PP,
                fontSize: 24,
                fontWeight: 800,
                color: STAR,
                letterSpacing: '0.1em',
                marginBottom: 12,
              }}
            >
              {referralCode}
            </div>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? GREEN_GRAD : `rgba(251,191,36,.12)`,
                border: `1px solid ${copied ? 'transparent' : 'rgba(251,191,36,.3)'}`,
                borderRadius: 12,
                padding: '10px 24px',
                cursor: 'pointer',
                fontFamily: IT,
                fontSize: 14,
                fontWeight: 700,
                color: copied ? '#fff' : STAR,
                transition: 'all .2s',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. WALLET STATEMENT SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function WalletStatementScreen({
  onBack,
  onExport,
}: {
  onBack?: () => void;
  onExport?: () => void;
}) {
  const now = new Date();
  const [activeMonth, setActiveMonth] = useState(MONTHS[now.getMonth()]);
  const [txs, setTxs] = useState<WalletLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (month: string) => {
    setLoading(true);
    setError('');
    try {
      const monthIdx = MONTHS.indexOf(month) + 1;
      const year = now.getFullYear();
      const res = await api.wallet.getStatement({ month: monthIdx, year });
      const r = res as { items?: WalletLedgerEntryDto[] };
      setTxs(r.items ?? []);
    } catch {
      // Fall back to all transactions for the month
      try {
        const res = await api.wallet.getTransactions({ pageSize: 100 });
        const items = (res as { items?: WalletLedgerEntryDto[] }).items ?? [];
        const monthIdx = MONTHS.indexOf(month);
        setTxs(items.filter((t) => new Date(t.createdAt).getMonth() === monthIdx));
      } catch (e: unknown) {
        setError((e as { message?: string }).message ?? 'Could not load statement');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(activeMonth);
  }, [activeMonth, load]);

  const totalIn = txs.filter((t) => t.direction === 'CREDIT').reduce((s, t) => s + t.amount, 0);
  const totalOut = txs.filter((t) => t.direction === 'DEBIT').reduce((s, t) => s + t.amount, 0);

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Statement
        </span>
      </div>

      <div
        style={{
          paddingBottom: 12,
          overflowX: 'auto',
          display: 'flex',
          gap: 8,
          padding: '0 16px 12px',
          scrollbarWidth: 'none',
        }}
      >
        {MONTHS.map((m) => (
          <Pill key={m} active={activeMonth === m} onClick={() => setActiveMonth(m)}>
            {m}
          </Pill>
        ))}
      </div>

      <div className="flex gap-3 px-4" style={{ marginBottom: 16 }}>
        {[
          {
            label: 'Money In',
            value: totalIn,
            color: SUCCESS,
            bg: `rgba(16,185,129,.08)`,
            border: `rgba(16,185,129,.18)`,
          },
          {
            label: 'Money Out',
            value: totalOut,
            color: ERROR,
            bg: `rgba(239,68,68,.08)`,
            border: `rgba(239,68,68,.18)`,
          },
          {
            label: 'Net',
            value: totalIn - totalOut,
            color: totalIn - totalOut >= 0 ? SUCCESS : ERROR,
            bg: NAVY_CARD,
            border: BORDER,
          },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              flex: 1,
              background: k.bg,
              borderRadius: 14,
              padding: '14px 14px',
              border: `1px solid ${k.border}`,
            }}
          >
            <div
              style={{
                fontFamily: IT,
                fontSize: 11,
                color: MUTED,
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {k.label}
            </div>
            <div style={{ fontFamily: PP, fontSize: 18, fontWeight: 800, color: k.color }}>
              {k.value >= 0 ? '' : '−'}₦{Math.abs(k.value).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: MUTED, fontFamily: IT }}>
            Loading…
          </div>
        ) : error ? (
          <ErrorRetry message={error} onRetry={() => load(activeMonth)} />
        ) : txs.length === 0 ? (
          <EmptyState icon="receipt" title={`No transactions in ${activeMonth}`} />
        ) : (
          <>
            <div className="px-5" style={{ marginBottom: 8 }}>
              <SectionLabel>
                {activeMonth} {now.getFullYear()} — {txs.length} transactions
              </SectionLabel>
            </div>
            {txs.map((tx, i) => (
              <div key={tx.id}>
                {i > 0 && <div style={{ height: 1, background: BORDER, margin: '0 16px' }} />}
                <div className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <TxIcon type={tx.type} />
                    <div>
                      <div
                        style={{
                          fontFamily: IT,
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#fff',
                          marginBottom: 2,
                        }}
                      >
                        {tx.description ?? tx.type}
                      </div>
                      <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                        {fmtDate(tx.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: PP,
                      fontSize: 14,
                      fontWeight: 700,
                      color: tx.direction === 'CREDIT' ? SUCCESS : ERROR,
                    }}
                  >
                    {tx.direction === 'CREDIT' ? '+' : '−'}₦{tx.amount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ height: 80 }} />
          </>
        )}
      </div>

      <div
        className="px-4"
        style={{
          paddingBottom: 32,
          paddingTop: 8,
          borderTop: `1px solid ${BORDER}`,
          background: NAVY_BASE,
        }}
      >
        <button
          onClick={onExport}
          style={{
            width: '100%',
            background: NAVY_SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            padding: '14px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 11V3M9 11l-3-3M9 11l3-3"
              stroke={G3}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M3 13v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1"
              stroke={G3}
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontFamily: IT, fontSize: 15, fontWeight: 700, color: G3 }}>
            Export PDF Statement
          </span>
        </button>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. WALLET SECURITY SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function WalletSecurityScreen({
  onBack,
  onChangePIN,
}: {
  onBack?: () => void;
  onChangePIN?: () => void;
}) {
  const [pinSet, setPinSet] = useState<boolean | null>(null);

  useEffect(() => {
    api.wallet
      .getPinStatus()
      .then((r) => setPinSet((r as { hasPinSet?: boolean }).hasPinSet ?? false))
      .catch(() => setPinSet(null));
  }, []);

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Security
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        <div className="px-4" style={{ marginBottom: 16 }}>
          <SectionLabel>Wallet PIN</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 16,
              border: `1px solid ${BORDER}`,
              overflow: 'hidden',
            }}
          >
            <div
              className="flex items-center justify-between px-4"
              style={{ paddingTop: 16, paddingBottom: 16 }}
            >
              <div className="flex items-center" style={{ gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `rgba(16,185,129,.12)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect
                      x="4"
                      y="9"
                      width="12"
                      height="9"
                      rx="2"
                      stroke={SUCCESS}
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 9V7a3 3 0 0 1 6 0v2"
                      stroke={SUCCESS}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="10" cy="14" r="1.2" fill={SUCCESS} />
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    PIN Status
                  </div>
                  <div
                    style={{
                      fontFamily: IT,
                      fontSize: 12,
                      color: pinSet ? SUCCESS : WARNING,
                      marginTop: 2,
                    }}
                  >
                    {pinSet === null
                      ? 'Checking…'
                      : pinSet
                        ? '✓ PIN is set and active'
                        : '⚠ No PIN set — tap Change PIN to create one'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <button
              onClick={onChangePIN}
              className="flex w-full items-center justify-between px-4"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                paddingTop: 14,
                paddingBottom: 14,
              }}
            >
              <div className="flex items-center gap-3" style={{ gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: `rgba(59,130,246,.1)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path
                      d="M3 15l4-1 7-7-3-3-7 7-1 4z"
                      stroke={INFO}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M11.5 4.5l2 2" stroke={INFO} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {pinSet ? 'Change PIN' : 'Set PIN'}
                </span>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 12l4-4-4-4"
                  stroke={MUTED}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-4" style={{ marginBottom: 16 }}>
          <SectionLabel>Authentication</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 16,
              border: `1px solid ${BORDER}`,
              overflow: 'hidden',
            }}
          >
            {[
              // Face ID / 2FA for payments have no backend yet (no biometric or
              // MFA service) → shown off + "Coming soon", not a working toggle.
              {
                label: 'Face ID',
                sub: 'Coming soon',
                icon: 'user' as IconName,
                value: false,
                toggle: () => {},
              },
              {
                label: 'Two-Factor Auth (2FA)',
                sub: 'Coming soon',
                icon: 'key' as IconName,
                value: false,
                toggle: () => {},
              },
            ].map((row, i) => (
              <div key={row.label}>
                {i > 0 && <div style={{ height: 1, background: BORDER }} />}
                <div
                  className="flex items-center justify-between px-4"
                  style={{ paddingTop: 14, paddingBottom: 14 }}
                >
                  <div className="flex items-center gap-3" style={{ gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: NAVY_SURFACE,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={row.icon} size={19} color="rgba(255,255,255,.6)" />
                    </div>
                    <div>
                      <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                        {row.label}
                      </div>
                      <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{row.sub}</div>
                    </div>
                  </div>
                  <Toggle on={row.value} onToggle={row.toggle} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4" style={{ marginBottom: 16 }}>
          <SectionLabel>Trusted devices</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 14,
              padding: '16px',
              border: `1px solid ${BORDER}`,
              textAlign: 'center',
            }}
          >
            <Icon
              name="airtime"
              size={27}
              color="rgba(255,255,255,.3)"
              style={{ marginBottom: 8 }}
            />
            <div style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>
              Device management is not available in this pilot version.
            </div>
          </div>
        </div>

        <div className="px-4">
          <div
            style={{
              background: NAVY_SURFACE,
              borderRadius: 14,
              padding: '14px 16px',
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 4 }}>
              Account
            </div>
            <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              {auth.getUser()?.email ?? '—'}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. WALLET SETTINGS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function WalletSettingsScreen({ onBack }: { onBack?: () => void }) {
  const [autoTopUp, setAutoTopUp] = useState(false);
  const [threshold, setThreshold] = useState('2,000');
  const [topUpAmount, setTopUpAmount] = useState('5,000');
  const [rideAlerts, setRideAlerts] = useState(true);
  const [transferAlerts, setTransferAlerts] = useState(true);
  const [promoAlerts, setPromoAlerts] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('50,000');
  const [singleLimit, setSingleLimit] = useState('20,000');

  const SettingRow = ({
    label,
    sub,
    value,
    onToggle,
  }: {
    label: string;
    sub?: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <div
      className="flex items-center justify-between px-4"
      style={{ paddingTop: 14, paddingBottom: 14 }}
    >
      <div>
        <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>{label}</div>
        {sub && (
          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</div>
        )}
      </div>
      <Toggle on={value} onToggle={onToggle} />
    </div>
  );

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Wallet Settings
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
        <div className="px-4" style={{ marginBottom: 16 }}>
          <SectionLabel>Auto Top-Up</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 16,
              border: `1px solid ${autoTopUp ? G2 : BORDER}`,
              overflow: 'hidden',
              transition: 'border-color .2s',
            }}
          >
            <div
              className="flex items-center justify-between px-4"
              style={{ paddingTop: 14, paddingBottom: 14 }}
            >
              <div>
                <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  Enable Auto Top-Up
                </div>
                <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 2 }}>
                  Top up when balance falls below threshold
                </div>
              </div>
              <Toggle on={autoTopUp} onToggle={() => setAutoTopUp(!autoTopUp)} />
            </div>
            {autoTopUp && (
              <>
                <div style={{ height: 1, background: BORDER }} />
                <div
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: IT,
                        fontSize: 11,
                        color: MUTED,
                        fontWeight: 500,
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Balance threshold
                    </div>
                    <div
                      className="flex items-center"
                      style={{
                        background: NAVY_SURFACE,
                        borderRadius: 10,
                        border: `1px solid ${BORDER}`,
                        padding: '0 14px',
                        height: 44,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: PP,
                          fontSize: 16,
                          fontWeight: 700,
                          color: WARNING,
                          marginRight: 6,
                        }}
                      >
                        ₦
                      </span>
                      <input
                        value={threshold}
                        onChange={(e) => setThreshold(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'none',
                          border: 'none',
                          outline: 'none',
                          color: '#fff',
                          fontFamily: IT,
                          fontSize: 15,
                          fontWeight: 600,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: IT,
                        fontSize: 11,
                        color: MUTED,
                        fontWeight: 500,
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Top-up amount
                    </div>
                    <div
                      className="flex items-center"
                      style={{
                        background: NAVY_SURFACE,
                        borderRadius: 10,
                        border: `1px solid ${BORDER}`,
                        padding: '0 14px',
                        height: 44,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: PP,
                          fontSize: 16,
                          fontWeight: 700,
                          color: G3,
                          marginRight: 6,
                        }}
                      >
                        ₦
                      </span>
                      <input
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'none',
                          border: 'none',
                          outline: 'none',
                          color: '#fff',
                          fontFamily: IT,
                          fontSize: 15,
                          fontWeight: 600,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div
            style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 10,
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              fontSize: 12,
              color: MUTED,
            }}
          >
            Auto top-up is not available in the pilot — toggle is for preference storage only.
          </div>
        </div>

        <div className="px-4" style={{ marginBottom: 16 }}>
          <SectionLabel>Notification preferences</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 16,
              border: `1px solid ${BORDER}`,
              overflow: 'hidden',
            }}
          >
            {[
              {
                label: 'Ride payments',
                sub: 'Alerts for ride deductions',
                value: rideAlerts,
                onToggle: () => setRideAlerts(!rideAlerts),
              },
              {
                label: 'Transfers & top-ups',
                sub: 'Money in and out alerts',
                value: transferAlerts,
                onToggle: () => setTransferAlerts(!transferAlerts),
              },
              {
                label: 'Promotions & offers',
                sub: 'Cashback and reward updates',
                value: promoAlerts,
                onToggle: () => setPromoAlerts(!promoAlerts),
              },
            ].map((row, i) => (
              <div key={row.label}>
                {i > 0 && <div style={{ height: 1, background: BORDER }} />}
                <SettingRow {...row} />
              </div>
            ))}
          </div>
        </div>

        <div className="px-4" style={{ marginBottom: 16 }}>
          <SectionLabel>Currency display</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 16,
              border: `1px solid ${BORDER}`,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                Nigerian Naira (NGN)
              </div>
              <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                All amounts displayed in ₦
              </div>
            </div>
            <div
              style={{
                background: `rgba(43,172,82,.1)`,
                border: `1px solid rgba(43,172,82,.2)`,
                borderRadius: 8,
                padding: '5px 10px',
              }}
            >
              <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: G3 }}>
                NGN ₦
              </span>
            </div>
          </div>
        </div>

        <div className="px-4" style={{ marginBottom: 16 }}>
          <SectionLabel>Spending limits</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 16,
              border: `1px solid ${BORDER}`,
              overflow: 'hidden',
            }}
          >
            {[
              { label: 'Daily limit', value: dailyLimit, onChange: setDailyLimit },
              { label: 'Single transaction limit', value: singleLimit, onChange: setSingleLimit },
            ].map((item, i) => (
              <div key={item.label}>
                {i > 0 && <div style={{ height: 1, background: BORDER }} />}
                <div style={{ padding: '14px 16px' }}>
                  <div
                    style={{
                      fontFamily: IT,
                      fontSize: 11,
                      color: MUTED,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    className="flex items-center"
                    style={{
                      background: NAVY_SURFACE,
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      padding: '0 14px',
                      height: 44,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: PP,
                        fontSize: 16,
                        fontWeight: 700,
                        color: INFO,
                        marginRight: 6,
                      }}
                    >
                      ₦
                    </span>
                    <input
                      value={item.value}
                      onChange={(e) => item.onChange(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        outline: 'none',
                        color: '#fff',
                        fontFamily: IT,
                        fontSize: 15,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4">
          <SectionLabel>Privacy</SectionLabel>
          <div
            style={{
              marginTop: 10,
              background: NAVY_CARD,
              borderRadius: 16,
              border: `1px solid ${privacyMode ? G2 : BORDER}`,
              overflow: 'hidden',
              transition: 'border-color .2s',
            }}
          >
            <div
              className="flex items-center justify-between px-4"
              style={{ paddingTop: 14, paddingBottom: 14 }}
            >
              <div>
                <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  Privacy Mode
                </div>
                <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 2 }}>
                  Hide balance and amounts on screen
                </div>
              </div>
              <Toggle on={privacyMode} onToggle={() => setPrivacyMode(!privacyMode)} />
            </div>
            {privacyMode && (
              <div style={{ padding: '10px 16px 14px', background: `rgba(43,172,82,.05)` }}>
                <div className="flex items-center gap-2" style={{ gap: 8 }}>
                  <Icon name="lock" size={14} color={G3} />
                  <span style={{ fontFamily: IT, fontSize: 12, color: G3 }}>
                    Balances are hidden. Tap amounts to reveal.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
