import React, { useState, useRef } from 'react';

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
      className="flex items-center justify-between px-5"
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
        {/* Signal */}
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <rect x="0" y="7" width="3" height="4" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="4.5" y="4.5" width="3" height="6.5" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="9" y="2" width="3" height="9" rx=".5" fill="rgba(255,255,255,.9)" />
          <rect x="13.5" y="0" width="2.5" height="11" rx=".5" fill="rgba(255,255,255,.9)" />
        </svg>
        {/* WiFi */}
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
        {/* Battery */}
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
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 16px 8px 16px',
      }}
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

function Screen({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: 390,
        height: 844,
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: GREEN_GRAD,
        border: 'none',
        borderRadius: 14,
        color: '#fff',
        fontFamily: PP,
        fontWeight: 600,
        fontSize: 16,
        cursor: 'pointer',
        padding: '16px 0',
        width: '100%',
        letterSpacing: '0.01em',
        boxShadow: `0 4px 20px rgba(43,172,82,.35)`,
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

// Icon circle helper
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. WALLET HOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const RECENT_TXS = [
  {
    id: 1,
    type: 'ride',
    title: 'Ride to Victoria Island',
    sub: 'Today, 9:41 AM',
    amount: -2100,
    icon: '🚗',
  },
  {
    id: 2,
    type: 'topup',
    title: 'Wallet Top Up',
    sub: 'Today, 7:15 AM',
    amount: +10000,
    icon: '💳',
  },
  {
    id: 3,
    type: 'transfer',
    title: 'Transfer to Chidi Okeke',
    sub: 'Yesterday, 4:02 PM',
    amount: -3500,
    icon: '↑',
  },
  {
    id: 4,
    type: 'ride',
    title: 'Ride to Lekki Phase 1',
    sub: 'Yesterday, 1:18 PM',
    amount: -1850,
    icon: '🚗',
  },
  {
    id: 5,
    type: 'cashback',
    title: 'Ride Cashback',
    sub: 'Dec 3, 11:00 AM',
    amount: +210,
    icon: '🎁',
  },
];

const TX_COLORS: Record<string, string> = {
  ride: INFO,
  topup: SUCCESS,
  transfer: PURPLE,
  cashback: WARNING,
  refund: SUCCESS,
};

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
  return (
    <Screen>
      <StatusBar />

      {/* Header */}
      <div
        className="flex items-center justify-between px-5"
        style={{ paddingTop: 8, paddingBottom: 4 }}
      >
        <div>
          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, fontWeight: 500 }}>
            Good morning,
          </div>
          <div style={{ fontFamily: PP, fontSize: 17, fontWeight: 700, color: '#fff' }}>
            Amara Obi
          </div>
        </div>
        <button
          onClick={onBack}
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
            <circle cx="7" cy="7" r="5" stroke={MUTED} strokeWidth="1.5" />
            <path d="M11.5 11.5L16 16" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Hero Balance Card */}
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
        {/* Inner glow */}
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
        {/* Card pattern */}
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
          ₦24,500<span style={{ fontSize: 24, fontWeight: 600, opacity: 0.7 }}>.00</span>
        </div>
        <div
          style={{ fontFamily: IT, fontSize: 12, color: 'rgba(255,255,255,.45)', marginBottom: 16 }}
        >
          Last updated: Just now
        </div>

        {/* Frosted badge row */}
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
              🔒 PIN Protected
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
              ✦ Gold Tier
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between px-4" style={{ marginTop: 20 }}>
        {[
          { label: 'Top Up', icon: '↓', color: SUCCESS, onClick: onTopUp },
          { label: 'Withdraw', icon: '↑', color: WARNING, onClick: onWithdraw },
          { label: 'Transfer', icon: '→', color: INFO, onClick: onTransfer },
          { label: 'Pay', icon: '₦', color: PURPLE, onClick: onPay },
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
              <span style={{ color, fontFamily: PP, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
                {icon}
              </span>
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

      {/* Rewards Strip */}
      <div
        onClick={onRewards}
        style={{
          margin: '16px 16px 0',
          borderRadius: 14,
          background: `linear-gradient(135deg,rgba(251,191,36,.12),rgba(251,191,36,.06))`,
          border: `1px solid rgba(251,191,36,.2)`,
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 20 }}>✦</span>
          <div>
            <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: STAR }}>
              ₦1,250 cashback earned
            </div>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
              View your rewards &amp; referral code
            </div>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M6 12l4-4-4-4"
            stroke={STAR}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Recent Transactions */}
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
          {RECENT_TXS.map((tx, i) => (
            <div key={tx.id}>
              {i > 0 && <div style={{ height: 1, background: BORDER, margin: '0 16px' }} />}
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <IconCircle bg={`${TX_COLORS[tx.type]}22`} size={42}>
                    <span style={{ fontSize: 18 }}>{tx.icon}</span>
                  </IconCircle>
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
                      {tx.title}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{tx.sub}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: PP,
                      fontSize: 15,
                      fontWeight: 700,
                      color: tx.amount > 0 ? SUCCESS : '#fff',
                    }}
                  >
                    {tx.amount > 0 ? '+' : ''}₦{Math.abs(tx.amount).toLocaleString()}
                  </div>
                  {tx.amount < 0 && (
                    <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>Debit</div>
                  )}
                  {tx.amount > 0 && (
                    <div style={{ fontFamily: IT, fontSize: 11, color: SUCCESS }}>Credit</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRANSACTION HISTORY SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const ALL_TXS = [
  {
    id: 1,
    date: 'Today',
    type: 'ride',
    title: 'Ride to Victoria Island',
    sub: '9:41 AM',
    amount: -2100,
    icon: '🚗',
  },
  {
    id: 2,
    date: 'Today',
    type: 'topup',
    title: 'Wallet Top Up',
    sub: '7:15 AM',
    amount: +10000,
    icon: '💳',
  },
  {
    id: 3,
    date: 'Yesterday',
    type: 'transfer',
    title: 'Transfer to Chidi Okeke',
    sub: '4:02 PM',
    amount: -3500,
    icon: '↑',
  },
  {
    id: 4,
    date: 'Yesterday',
    type: 'ride',
    title: 'Ride to Lekki Phase 1',
    sub: '1:18 PM',
    amount: -1850,
    icon: '🚗',
  },
  {
    id: 5,
    date: 'Yesterday',
    type: 'refund',
    title: 'Ride Refund',
    sub: '10:05 AM',
    amount: +1850,
    icon: '↩',
  },
  {
    id: 6,
    date: 'Dec 3, 2024',
    type: 'cashback',
    title: 'Ride Cashback Reward',
    sub: '11:00 AM',
    amount: +210,
    icon: '🎁',
  },
  {
    id: 7,
    date: 'Dec 3, 2024',
    type: 'ride',
    title: 'Ride to Surulere',
    sub: '8:33 AM',
    amount: -1200,
    icon: '🚗',
  },
  {
    id: 8,
    date: 'Dec 2, 2024',
    type: 'topup',
    title: 'Wallet Top Up',
    sub: '6:00 PM',
    amount: +5000,
    icon: '💳',
  },
  {
    id: 9,
    date: 'Dec 2, 2024',
    type: 'transfer',
    title: 'Transfer from Kemi Bello',
    sub: '2:30 PM',
    amount: +2000,
    icon: '↓',
  },
  {
    id: 10,
    date: 'Dec 1, 2024',
    type: 'withdraw',
    title: 'Withdrawal to GTBank',
    sub: '9:00 AM',
    amount: -8000,
    icon: '🏦',
  },
];

const FILTER_TABS = ['All', 'Ride', 'Refund', 'Top-up', 'Withdrawal', 'Transfer'];

export function TransactionHistoryScreen({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = ALL_TXS.filter((tx) => {
    const tabMatch =
      activeTab === 'All' ||
      tx.type.toLowerCase().startsWith(activeTab.toLowerCase().replace('-', ''));
    const searchMatch = !search || tx.title.toLowerCase().includes(search.toLowerCase());
    return tabMatch && searchMatch;
  });

  // Group by date
  const groups: Record<string, typeof ALL_TXS> = {};
  filtered.forEach((tx) => {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  });

  return (
    <Screen>
      <StatusBar />

      {/* Header */}
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Transactions
        </span>
      </div>

      {/* Search Bar */}
      <div className="px-4" style={{ marginBottom: 12 }}>
        <div
          className="flex items-center"
          style={{
            background: NAVY_SURFACE,
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            padding: '0 14px',
            height: 44,
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

      {/* Filter Tabs */}
      <div
        style={{
          paddingBottom: 12,
          overflowX: 'auto',
          display: 'flex',
          gap: 8,
          padding: '0 16px 12px',
        }}
      >
        {FILTER_TABS.map((tab) => (
          <Pill key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
            {tab}
          </Pill>
        ))}
      </div>

      {/* Transaction List */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        {Object.keys(groups).length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              paddingTop: 60,
              color: MUTED,
              fontFamily: IT,
              fontSize: 14,
            }}
          >
            No transactions found
          </div>
        ) : (
          Object.entries(groups).map(([date, txs]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="px-5" style={{ paddingTop: 12, paddingBottom: 8 }}>
                <SectionLabel>{date}</SectionLabel>
              </div>
              {txs.map((tx, i) => (
                <div key={tx.id}>
                  {i > 0 && <div style={{ height: 1, background: BORDER, margin: '0 16px' }} />}
                  <div
                    className="flex items-center justify-between px-5"
                    style={{ paddingTop: 12, paddingBottom: 12 }}
                  >
                    <div className="flex items-center gap-3">
                      <IconCircle bg={`${TX_COLORS[tx.type] ?? INFO}22`} size={44}>
                        <span style={{ fontSize: 19 }}>{tx.icon}</span>
                      </IconCircle>
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
                          {tx.title}
                        </div>
                        <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{tx.sub}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontFamily: PP,
                          fontSize: 15,
                          fontWeight: 700,
                          color: tx.amount > 0 ? SUCCESS : ERROR,
                        }}
                      >
                        {tx.amount > 0 ? '+' : '−'}₦{Math.abs(tx.amount).toLocaleString()}
                      </div>
                      <div
                        style={{
                          fontFamily: IT,
                          fontSize: 11,
                          color: MUTED,
                          textTransform: 'capitalize',
                          marginTop: 2,
                        }}
                      >
                        {tx.type}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TOP UP SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const AMOUNT_PRESETS = ['500', '1,000', '2,000', '5,000', '10,000', '20,000'];
const PAYMENT_METHODS_LIST = [
  { id: 'card', label: 'Debit / Credit Card', icon: '💳', sub: 'Instant, no fee' },
  { id: 'bank', label: 'Bank Transfer', icon: '🏦', sub: '1–3 mins' },
  { id: 'ussd', label: 'USSD', icon: '📱', sub: 'All networks' },
];
const SAVED_CARDS = [
  { id: 'c1', brand: 'Visa', last4: '4821', expiry: '09/26', bank: 'GTBank', color: '#1A3A6B' },
  {
    id: 'c2',
    brand: 'Mastercard',
    last4: '0034',
    expiry: '03/25',
    bank: 'First Bank',
    color: '#8B1A1A',
  },
];

export function TopUpScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const [amount, setAmount] = useState('5,000');
  const [method, setMethod] = useState('card');
  const [selectedCard, setSelectedCard] = useState('c1');

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
        {/* Amount Input */}
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
                style={{ fontFamily: PP, fontSize: 32, fontWeight: 700, color: G3, marginRight: 4 }}
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

        {/* Preset Chips */}
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

        {/* Payment Method */}
        <div className="px-4" style={{ marginBottom: 20 }}>
          <SectionLabel>Payment method</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {PAYMENT_METHODS_LIST.map((pm) => (
              <button
                key={pm.id}
                onClick={() => setMethod(pm.id)}
                style={{
                  background: method === pm.id ? `rgba(43,172,82,.08)` : NAVY_SURFACE,
                  border: `1.5px solid ${method === pm.id ? G2 : BORDER}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 22 }}>{pm.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {pm.label}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{pm.sub}</div>
                </div>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    border: `2px solid ${method === pm.id ? G2 : BORDER}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {method === pm.id && (
                    <div style={{ width: 9, height: 9, borderRadius: 4.5, background: G2 }} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Saved Cards */}
        {method === 'card' && (
          <div className="px-4" style={{ marginBottom: 20 }}>
            <SectionLabel>Saved cards</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {SAVED_CARDS.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setSelectedCard(card.id)}
                  style={{
                    background: selectedCard === card.id ? `rgba(43,172,82,.06)` : NAVY_CARD,
                    border: `1.5px solid ${selectedCard === card.id ? G2 : BORDER}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 30,
                      borderRadius: 6,
                      background: card.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: PP,
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,.9)',
                      }}
                    >
                      {card.brand.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {card.brand} •••• {card.last4}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                      {card.bank} · Exp {card.expiry}
                    </div>
                  </div>
                  {selectedCard === card.id && (
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
              <button
                style={{
                  background: 'none',
                  border: `1px dashed rgba(43,172,82,.4)`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `rgba(43,172,82,.12)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: G3, fontSize: 18, lineHeight: 1 }}>+</span>
                </div>
                <span style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: G3 }}>
                  Add new card
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div
        className="px-4"
        style={{
          paddingBottom: 32,
          paddingTop: 8,
          borderTop: `1px solid ${BORDER}`,
          background: NAVY_BASE,
        }}
      >
        <GreenButton onClick={onConfirm}>Top Up ₦{amount}</GreenButton>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WITHDRAW SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const BANK_ACCOUNTS = [
  { id: 'b1', bank: 'GTBank', name: 'Amara Obi', number: '012 345 6789', logo: '🟢' },
  { id: 'b2', bank: 'First Bank', name: 'Amara Obi', number: '302 100 4422', logo: '🔵' },
  { id: 'b3', bank: 'Access Bank', name: 'Amara C. Obi', number: '074 881 2211', logo: '🟠' },
];

export function WithdrawScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [selectedBank, setSelectedBank] = useState('b1');

  const account = BANK_ACCOUNTS.find((b) => b.id === selectedBank)!;

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
        {/* Balance hint */}
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
              ₦24,500.00
            </span>
          </div>
        </div>

        {/* Amount */}
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

        {/* Bank Account Selector */}
        <div className="px-4" style={{ marginBottom: 20 }}>
          <SectionLabel>Destination account</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {BANK_ACCOUNTS.map((bank) => (
              <button
                key={bank.id}
                onClick={() => setSelectedBank(bank.id)}
                style={{
                  background: selectedBank === bank.id ? `rgba(43,172,82,.07)` : NAVY_SURFACE,
                  border: `1.5px solid ${selectedBank === bank.id ? G2 : BORDER}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ fontSize: 26 }}>{bank.logo}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {bank.bank}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                    {bank.name} · {bank.number}
                  </div>
                </div>
                {selectedBank === bank.id && (
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
        </div>

        {/* OTP Hint + ETA */}
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
            <span style={{ fontSize: 20, flexShrink: 0 }}>🔐</span>
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
                OTP Verification Required
              </div>
              <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                A 6-digit code will be sent to +234 801 ••• 5678 to confirm this withdrawal.
              </div>
            </div>
          </div>
        </div>

        <div className="px-4" style={{ marginTop: 12 }}>
          <div
            style={{
              background: NAVY_CARD,
              borderRadius: 14,
              padding: '12px 16px',
              border: `1px solid ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>Estimated arrival</div>
              <div
                style={{
                  fontFamily: PP,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  marginTop: 2,
                }}
              >
                Within 30 minutes
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>Transfer fee</div>
              <div
                style={{
                  fontFamily: PP,
                  fontSize: 14,
                  fontWeight: 700,
                  color: SUCCESS,
                  marginTop: 2,
                }}
              >
                Free
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div
        className="px-4"
        style={{
          paddingBottom: 32,
          paddingTop: 8,
          borderTop: `1px solid ${BORDER}`,
          background: NAVY_BASE,
        }}
      >
        <div
          style={{
            fontFamily: IT,
            fontSize: 12,
            color: MUTED,
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          Withdrawing to {account.bank} · {account.number}
        </div>
        <GreenButton
          onClick={onConfirm}
          style={{ background: `linear-gradient(135deg,#7C3A0A,${WARNING})` }}
        >
          Withdraw {amount ? `₦${amount}` : ''}
        </GreenButton>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRANSFER SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const RECENT_RECIPIENTS = [
  { id: 'r1', name: 'Chidi Okeke', username: '@chidi.ok', avatar: 'CO', color: INFO },
  { id: 'r2', name: 'Kemi Bello', username: '@kemi_b', avatar: 'KB', color: PURPLE },
  { id: 'r3', name: 'Tunde Adeleke', username: '@tunde_a', avatar: 'TA', color: WARNING },
];

export function TransferScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [recipient, setRecipient] = useState<(typeof RECENT_RECIPIENTS)[0] | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

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
        {/* Search */}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Phone number or @username"
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
          </div>
        </div>

        {/* Recent Recipients */}
        {!recipient && (
          <div className="px-4" style={{ marginBottom: 20 }}>
            <SectionLabel>Recent recipients</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {RECENT_RECIPIENTS.filter(
                (r) =>
                  !search ||
                  r.name.toLowerCase().includes(search.toLowerCase()) ||
                  r.username.includes(search),
              ).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRecipient(r)}
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
                      background: `${r.color}33`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: r.color }}>
                      {r.avatar}
                    </span>
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {r.name}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{r.username}</div>
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

        {/* Recipient Card (selected) */}
        {recipient && (
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
                  background: `${recipient.color}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: `0 0 0 2px ${recipient.color}44`,
                }}
              >
                <span
                  style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: recipient.color }}
                >
                  {recipient.avatar}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  {recipient.name}
                </div>
                <div style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>
                  {recipient.username}
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
        )}

        {/* Amount */}
        {recipient && (
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
          </>
        )}
      </div>

      {/* CTA */}
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
          onClick={onConfirm}
          style={{
            opacity: recipient && amount ? 1 : 0.45,
            background: `linear-gradient(135deg,#3B0E6E,${PURPLE})`,
          }}
        >
          Send {amount ? `₦${amount}` : 'Money'}
        </GreenButton>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PAYMENT METHODS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const ALL_CARDS = [
  {
    id: 'c1',
    brand: 'Visa',
    last4: '4821',
    expiry: '09/26',
    bank: 'GTBank',
    isDefault: true,
    color: '#1A3A6B',
  },
  {
    id: 'c2',
    brand: 'Mastercard',
    last4: '0034',
    expiry: '03/25',
    bank: 'First Bank',
    isDefault: false,
    color: '#8B1A1A',
  },
];
const ALL_BANKS = [
  {
    id: 'b1',
    bank: 'GTBank',
    name: 'Amara Obi',
    number: '012 345 6789',
    logo: '🟢',
    isDefault: true,
  },
  {
    id: 'b2',
    bank: 'First Bank',
    name: 'Amara Obi',
    number: '302 100 4422',
    logo: '🔵',
    isDefault: false,
  },
];

export function PaymentMethodsScreen({
  onBack,
  onAddCard,
}: {
  onBack?: () => void;
  onAddCard?: () => void;
}) {
  const [cards, setCards] = useState(ALL_CARDS);

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
        {/* Cards */}
        <div className="px-4" style={{ marginBottom: 24 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <SectionLabel>Saved cards</SectionLabel>
            <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>Swipe left to delete</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cards.map((card) => (
              <div
                key={card.id}
                style={{
                  background: NAVY_CARD,
                  borderRadius: 18,
                  overflow: 'hidden',
                  border: `1px solid ${card.isDefault ? G2 : BORDER}`,
                  boxShadow: card.isDefault ? `0 0 0 1px ${G2}33` : 'none',
                }}
              >
                {/* Card visual */}
                <div
                  style={{
                    background: card.color,
                    padding: '18px 20px 14px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -20,
                      right: -20,
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,.07)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: -30,
                      left: 40,
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,.05)',
                    }}
                  />
                  <div
                    style={{
                      fontFamily: IT,
                      fontSize: 12,
                      color: 'rgba(255,255,255,.6)',
                      marginBottom: 8,
                    }}
                  >
                    {card.bank}
                  </div>
                  <div
                    style={{
                      fontFamily: PP,
                      fontSize: 16,
                      fontWeight: 600,
                      color: '#fff',
                      letterSpacing: '0.12em',
                    }}
                  >
                    •••• •••• •••• {card.last4}
                  </div>
                  <div
                    style={{
                      fontFamily: IT,
                      fontSize: 11,
                      color: 'rgba(255,255,255,.5)',
                      marginTop: 4,
                    }}
                  >
                    Expires {card.expiry}
                  </div>
                  {/* Brand */}
                  <div style={{ position: 'absolute', top: 14, right: 16 }}>
                    <span
                      style={{
                        fontFamily: PP,
                        fontSize: 13,
                        fontWeight: 800,
                        color: 'rgba(255,255,255,.8)',
                      }}
                    >
                      {card.brand.toUpperCase()}
                    </span>
                  </div>
                </div>
                {/* Card actions */}
                <div
                  className="flex items-center justify-between px-4"
                  style={{ padding: '12px 16px' }}
                >
                  {card.isDefault ? (
                    <div
                      style={{
                        background: `rgba(43,172,82,.15)`,
                        borderRadius: 8,
                        padding: '4px 10px',
                        border: `1px solid rgba(43,172,82,.25)`,
                      }}
                    >
                      <span style={{ fontFamily: IT, fontSize: 11, fontWeight: 700, color: G3 }}>
                        ✓ Default
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setCards(cards.map((c) => ({ ...c, isDefault: c.id === card.id })))
                      }
                      style={{
                        background: 'none',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 8,
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontFamily: IT,
                        fontSize: 12,
                        color: MUTED,
                      }}
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => setCards(cards.filter((c) => c.id !== card.id))}
                    style={{
                      background: `rgba(239,68,68,.1)`,
                      border: `1px solid rgba(239,68,68,.2)`,
                      borderRadius: 8,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontFamily: IT,
                      fontSize: 12,
                      color: ERROR,
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {/* Add card */}
            <button
              onClick={onAddCard}
              style={{
                background: 'none',
                border: `1.5px dashed rgba(43,172,82,.35)`,
                borderRadius: 18,
                padding: '18px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: `rgba(43,172,82,.1)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: G3, fontSize: 22, fontWeight: 300 }}>+</span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: G3 }}>
                  Add new card
                </div>
                <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                  Visa, Mastercard, Verve
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Bank Accounts */}
        <div className="px-4">
          <SectionLabel>Linked bank accounts</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {ALL_BANKS.map((bank) => (
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
                <span style={{ fontSize: 26 }}>{bank.logo}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {bank.bank}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                    {bank.name} · {bank.number}
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
            ))}
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. REWARDS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const REWARD_CATEGORIES = [
  {
    id: 'ride',
    label: 'Ride Cashback',
    amount: 780,
    icon: '🚗',
    color: INFO,
    desc: '2% on every ride',
  },
  {
    id: 'referral',
    label: 'Referral Bonus',
    amount: 350,
    icon: '👥',
    color: G2,
    desc: '₦350 per friend',
  },
  {
    id: 'welcome',
    label: 'Welcome Bonus',
    amount: 120,
    icon: '🎁',
    color: WARNING,
    desc: 'One-time signup',
  },
];

export function RewardsScreen({ onBack }: { onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const referralCode = 'DRPX-AMARA9';

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalCashback = REWARD_CATEGORIES.reduce((s, r) => s + r.amount, 0);
  const tierProgress = 0.72; // 72% to Platinum

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
        {/* Cashback Hero */}
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
            Total Cashback Earned
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
            ₦{totalCashback.toLocaleString()}
          </div>
          <div style={{ fontFamily: IT, fontSize: 13, color: 'rgba(255,255,255,.45)' }}>
            Redeemable for rides and transfers
          </div>

          {/* Tier progress */}
          <div
            style={{
              marginTop: 20,
              background: 'rgba(0,0,0,.2)',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <div>
                <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: STAR }}>
                  ✦ Gold
                </span>
                <span style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginLeft: 6 }}>
                  → Platinum
                </span>
              </div>
              <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                {Math.round(tierProgress * 100)}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: 'rgba(255,255,255,.1)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${tierProgress * 100}%`,
                  background: `linear-gradient(90deg,${G0},${G3})`,
                  borderRadius: 3,
                }}
              />
            </div>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 6 }}>
              ₦1,400 more in rides to reach Platinum
            </div>
          </div>
        </div>

        {/* Reward Categories */}
        <div className="px-4" style={{ marginBottom: 20 }}>
          <SectionLabel>Reward breakdown</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {REWARD_CATEGORIES.map((r) => (
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
                  <span style={{ fontSize: 20 }}>{r.icon}</span>
                </IconCircle>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {r.label}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{r.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: SUCCESS }}>
                    +₦{r.amount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Referral Code */}
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
              Share and earn ₦350 per friend who signs up
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

const STATEMENT_DATA: Record<
  string,
  {
    totalIn: number;
    totalOut: number;
    txs: Array<{ title: string; date: string; amount: number; type: string; icon: string }>;
  }
> = {
  Dec: {
    totalIn: 17210,
    totalOut: 7150,
    txs: [
      { title: 'Wallet Top Up', date: 'Dec 5, 7:15 AM', amount: +10000, type: 'topup', icon: '💳' },
      {
        title: 'Ride to Victoria Island',
        date: 'Dec 5, 9:41 AM',
        amount: -2100,
        type: 'ride',
        icon: '🚗',
      },
      {
        title: 'Transfer to Chidi Okeke',
        date: 'Dec 4, 4:02 PM',
        amount: -3500,
        type: 'transfer',
        icon: '↑',
      },
      {
        title: 'Ride to Lekki Phase 1',
        date: 'Dec 4, 1:18 PM',
        amount: -1850,
        type: 'ride',
        icon: '🚗',
      },
      { title: 'Wallet Top Up', date: 'Dec 2, 6:00 PM', amount: +5000, type: 'topup', icon: '💳' },
      {
        title: 'Transfer from Kemi Bello',
        date: 'Dec 2, 2:30 PM',
        amount: +2000,
        type: 'transfer',
        icon: '↓',
      },
      {
        title: 'Withdrawal to GTBank',
        date: 'Dec 1, 9:00 AM',
        amount: -8000,
        type: 'withdraw',
        icon: '🏦',
      },
    ],
  },
  Nov: {
    totalIn: 32000,
    totalOut: 18500,
    txs: [
      {
        title: 'Wallet Top Up',
        date: 'Nov 28, 10:00 AM',
        amount: +20000,
        type: 'topup',
        icon: '💳',
      },
      { title: 'Ride to Ikeja', date: 'Nov 25, 8:10 AM', amount: -1200, type: 'ride', icon: '🚗' },
      {
        title: 'Withdrawal to GTBank',
        date: 'Nov 20, 3:00 PM',
        amount: -15000,
        type: 'withdraw',
        icon: '🏦',
      },
      {
        title: 'Referral Bonus',
        date: 'Nov 15, 12:00 PM',
        amount: +350,
        type: 'cashback',
        icon: '🎁',
      },
      {
        title: 'Wallet Top Up',
        date: 'Nov 10, 9:00 AM',
        amount: +12000,
        type: 'topup',
        icon: '💳',
      },
    ],
  },
};

export function WalletStatementScreen({
  onBack,
  onExport,
}: {
  onBack?: () => void;
  onExport?: () => void;
}) {
  const [activeMonth, setActiveMonth] = useState('Dec');
  const data = STATEMENT_DATA[activeMonth] ?? STATEMENT_DATA['Dec'];

  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center gap-2 px-2" style={{ paddingBottom: 8 }}>
        <BackButton onBack={onBack} />
        <span style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Statement
        </span>
      </div>

      {/* Month selector */}
      <div
        style={{
          paddingBottom: 12,
          overflowX: 'auto',
          display: 'flex',
          gap: 8,
          padding: '0 16px 12px',
        }}
      >
        {MONTHS.map((m) => (
          <Pill key={m} active={activeMonth === m} onClick={() => setActiveMonth(m)}>
            {m}
          </Pill>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="flex gap-3 px-4" style={{ marginBottom: 16 }}>
        <div
          style={{
            flex: 1,
            background: `rgba(16,185,129,.08)`,
            borderRadius: 14,
            padding: '14px 14px',
            border: `1px solid rgba(16,185,129,.18)`,
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
            Money In
          </div>
          <div style={{ fontFamily: PP, fontSize: 18, fontWeight: 800, color: SUCCESS }}>
            ₦{data.totalIn.toLocaleString()}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: `rgba(239,68,68,.08)`,
            borderRadius: 14,
            padding: '14px 14px',
            border: `1px solid rgba(239,68,68,.18)`,
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
            Money Out
          </div>
          <div style={{ fontFamily: PP, fontSize: 18, fontWeight: 800, color: ERROR }}>
            ₦{data.totalOut.toLocaleString()}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: NAVY_CARD,
            borderRadius: 14,
            padding: '14px 14px',
            border: `1px solid ${BORDER}`,
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
            Net
          </div>
          <div
            style={{
              fontFamily: PP,
              fontSize: 18,
              fontWeight: 800,
              color: data.totalIn - data.totalOut >= 0 ? SUCCESS : ERROR,
            }}
          >
            {data.totalIn - data.totalOut >= 0 ? '+' : '−'}₦
            {Math.abs(data.totalIn - data.totalOut).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Statement List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="px-5" style={{ marginBottom: 8 }}>
          <SectionLabel>
            {activeMonth} 2024 — {data.txs.length} transactions
          </SectionLabel>
        </div>
        {data.txs.map((tx, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, background: BORDER, margin: '0 16px' }} />}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <IconCircle bg={`${TX_COLORS[tx.type] ?? INFO}22`} size={40}>
                  <span style={{ fontSize: 17 }}>{tx.icon}</span>
                </IconCircle>
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
                    {tx.title}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{tx.date}</div>
                </div>
              </div>
              <div
                style={{
                  fontFamily: PP,
                  fontSize: 14,
                  fontWeight: 700,
                  color: tx.amount > 0 ? SUCCESS : ERROR,
                }}
              >
                {tx.amount > 0 ? '+' : '−'}₦{Math.abs(tx.amount).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
        <div style={{ height: 80 }} />
      </div>

      {/* Export */}
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
const DEVICES = [
  {
    id: 'd1',
    name: 'iPhone 14 Pro',
    lastSeen: 'Active now',
    location: 'Lagos, Nigeria',
    isCurrent: true,
  },
  {
    id: 'd2',
    name: 'Samsung Galaxy S23',
    lastSeen: 'Dec 3, 2024 2:15 PM',
    location: 'Abuja, Nigeria',
    isCurrent: false,
  },
];

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

export function WalletSecurityScreen({
  onBack,
  onChangePIN,
}: {
  onBack?: () => void;
  onChangePIN?: () => void;
}) {
  const [biometric, setBiometric] = useState(true);
  const [twoFA, setTwoFA] = useState(false);

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
        {/* PIN Section */}
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
              <div className="gap-12px flex items-center" style={{ gap: 12 }}>
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
                  <div style={{ fontFamily: IT, fontSize: 12, color: SUCCESS, marginTop: 2 }}>
                    ✓ PIN is set and active
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
                  Change PIN
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

        {/* Biometric */}
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
              {
                label: 'Face ID',
                sub: 'Use Face ID to approve payments',
                icon: '👤',
                value: biometric,
                toggle: () => setBiometric(!biometric),
              },
              {
                label: 'Two-Factor Auth (2FA)',
                sub: 'SMS code required for large transfers',
                icon: '🔑',
                value: twoFA,
                toggle: () => setTwoFA(!twoFA),
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
                        fontSize: 20,
                      }}
                    >
                      {row.icon}
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

        {/* Devices */}
        <div className="px-4" style={{ marginBottom: 16 }}>
          <SectionLabel>Trusted devices ({DEVICES.length})</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {DEVICES.map((dev) => (
              <div
                key={dev.id}
                style={{
                  background: NAVY_CARD,
                  borderRadius: 14,
                  padding: '14px 16px',
                  border: `1px solid ${dev.isCurrent ? G2 : BORDER}`,
                }}
              >
                <div className="flex items-center justify-between">
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
                        fontSize: 20,
                      }}
                    >
                      📱
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}
                        >
                          {dev.name}
                        </span>
                        {dev.isCurrent && (
                          <span
                            style={{
                              fontFamily: IT,
                              fontSize: 10,
                              fontWeight: 700,
                              color: G3,
                              background: `rgba(43,172,82,.15)`,
                              borderRadius: 6,
                              padding: '2px 7px',
                            }}
                          >
                            This device
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 2 }}>
                        {dev.lastSeen} · {dev.location}
                      </div>
                    </div>
                  </div>
                  {!dev.isCurrent && (
                    <button
                      style={{
                        background: `rgba(239,68,68,.1)`,
                        border: `1px solid rgba(239,68,68,.2)`,
                        borderRadius: 8,
                        padding: '5px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontFamily: IT, fontSize: 12, color: ERROR, fontWeight: 600 }}>
                        Remove
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Last Login */}
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
              Last successful login
            </div>
            <div style={{ fontFamily: IT, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Today, 9:41 AM
            </div>
            <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 2 }}>
              iPhone 14 Pro · Lagos, Nigeria
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
        {/* Auto Top-Up */}
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
                        fontSize: 12,
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
                        fontSize: 12,
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
        </div>

        {/* Notifications */}
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
                toggle: () => setRideAlerts(!rideAlerts),
              },
              {
                label: 'Transfers & top-ups',
                sub: 'Money in and out alerts',
                value: transferAlerts,
                toggle: () => setTransferAlerts(!transferAlerts),
              },
              {
                label: 'Promotions & offers',
                sub: 'Cashback and reward updates',
                value: promoAlerts,
                toggle: () => setPromoAlerts(!promoAlerts),
              },
            ].map((row, i) => (
              <div key={row.label}>
                {i > 0 && <div style={{ height: 1, background: BORDER }} />}
                <SettingRow {...row} />
              </div>
            ))}
          </div>
        </div>

        {/* Currency */}
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

        {/* Spending Limits */}
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
                      fontSize: 12,
                      color: MUTED,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontSize: 11,
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

        {/* Privacy Mode */}
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
                  <span style={{ fontSize: 14 }}>🔒</span>
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
