import React, { useState } from 'react';

// ─── Design tokens (matches DrippleX system exactly) ─────────────────────────
const G0 = '#176B30';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const NAVY_DEEP = '#060E1C';
const NAVY_BASE = '#0A1628';
const NAVY_CARD = '#0D1B2E';
const NAVY_SURFACE = '#112238';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.38)';
const C_ERR = '#EF4444';
const C_WARN = '#F59E0B';
const C_OK = '#10B981';
const WHITE = '#FFFFFF';
const PP = 'Poppins, sans-serif';
const IT = 'Inter, sans-serif';

// ─── Styles injected once ─────────────────────────────────────────────────────
const STYLE_ID = 'dripplex-merchant-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
    .mx-scroll::-webkit-scrollbar { width: 4px; }
    .mx-scroll::-webkit-scrollbar-track { background: transparent; }
    .mx-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 4px; }
    .mx-nav:hover { background: rgba(71,207,114,.06) !important; }
    .mx-btn { transition: opacity .15s, transform .08s; cursor: pointer; }
    .mx-btn:hover { opacity: .85; }
    .mx-btn:active { transform: scale(.97); }
    .mx-row:hover { background: rgba(255,255,255,.02) !important; }
    .mx-card { transition: box-shadow .2s; }
    .mx-card:hover { box-shadow: 0 0 0 1px rgba(71,207,114,.15) !important; }
    .mx-input { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 8px; color: #fff; font-family: Inter, sans-serif; font-size: 13px; padding: 9px 12px; outline: none; width: 100%; box-sizing: border-box; transition: border-color .15s; }
    .mx-input:focus { border-color: rgba(43,172,82,.5); }
    .mx-input::placeholder { color: rgba(255,255,255,.28); }
    .mx-select { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 8px; color: #fff; font-family: Inter, sans-serif; font-size: 13px; padding: 9px 12px; outline: none; cursor: pointer; width: 100%; box-sizing: border-box; }
    .mx-toggle { appearance: none; width: 38px; height: 22px; background: rgba(255,255,255,.12); border-radius: 11px; cursor: pointer; position: relative; transition: background .2s; flex-shrink: 0; }
    .mx-toggle:checked { background: #2BAC52; }
    .mx-toggle::after { content:''; position:absolute; top:4px; left:4px; width:14px; height:14px; border-radius:50%; background:#fff; transition: left .2s; }
    .mx-toggle:checked::after { left:20px; }
    @keyframes mx-spin { to { transform: rotate(360deg); } }
    @keyframes mx-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .mx-spin { animation: mx-spin 1s linear infinite; }
    .mx-pulse { animation: mx-pulse 1.6s ease-in-out infinite; }
    @keyframes mx-ping { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
    .mx-ping { animation: mx-ping 1.4s ease-out infinite; }
  `;
  document.head.appendChild(s);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type MerchantPage =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'store'
  | 'earnings'
  | 'kyc'
  | 'bank'
  | 'approval'
  | 'settings';
// "accepted" removed — accept goes directly to PREPARING per real backend contract
type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_ORDERS = [
  {
    id: 'ORD-0041',
    time: '9:41 AM',
    customer: 'Tunde B.',
    items: 3,
    total: 4800,
    status: 'new' as OrderStatus,
    summary: 'Jollof Rice × 2, Chicken × 1',
  },
  {
    id: 'ORD-0040',
    time: '9:28 AM',
    customer: 'Amaka O.',
    items: 2,
    total: 2600,
    status: 'preparing' as OrderStatus,
    summary: 'Fried Rice × 1, Plantain × 1',
  },
  {
    id: 'ORD-0039',
    time: '9:12 AM',
    customer: 'Kola A.',
    items: 4,
    total: 6200,
    status: 'ready' as OrderStatus,
    summary: 'Egusi Soup, Pounded Yam × 2…',
  },
  {
    id: 'ORD-0038',
    time: '8:55 AM',
    customer: 'Bisi D.',
    items: 1,
    total: 1500,
    status: 'completed' as OrderStatus,
    summary: 'Pepper Soup × 1',
  },
  {
    id: 'ORD-0037',
    time: '8:30 AM',
    customer: 'Nkechi E.',
    items: 2,
    total: 3100,
    status: 'completed' as OrderStatus,
    summary: 'Ofada Rice × 1, Stew × 1',
  },
];

const MOCK_PRODUCTS = [
  { id: 'P01', name: 'Jollof Rice', category: 'Rice', price: 1800, inStock: true, published: true },
  { id: 'P02', name: 'Fried Rice', category: 'Rice', price: 2000, inStock: true, published: true },
  { id: 'P03', name: 'Egusi Soup', category: 'Soup', price: 2200, inStock: true, published: true },
  {
    id: 'P04',
    name: 'Pepper Soup',
    category: 'Soup',
    price: 1500,
    inStock: false,
    published: true,
  },
  {
    id: 'P05',
    name: 'Pounded Yam',
    category: 'Swallow',
    price: 800,
    inStock: true,
    published: false,
  },
  {
    id: 'P06',
    name: 'Grilled Chicken',
    category: 'Protein',
    price: 2500,
    inStock: true,
    published: true,
  },
];

const MOCK_SETTLEMENTS = [
  {
    date: 'Today, 9:41 AM',
    ref: 'ORD-0038',
    gross: 1500,
    commission: 150,
    net: 1350,
    settled: true,
  },
  {
    date: 'Today, 8:30 AM',
    ref: 'ORD-0037',
    gross: 3100,
    commission: 310,
    net: 2790,
    settled: true,
  },
  {
    date: 'Yesterday, 7:12 PM',
    ref: 'ORD-0036',
    gross: 5600,
    commission: 560,
    net: 5040,
    settled: true,
  },
  {
    date: 'Yesterday, 1:05 PM',
    ref: 'ORD-0035',
    gross: 2400,
    commission: 240,
    net: 2160,
    settled: false,
  },
  {
    date: 'Aug 6, 11:30 AM',
    ref: 'ORD-0034',
    gross: 4200,
    commission: 420,
    net: 3780,
    settled: true,
  },
];

const NIGERIAN_BANKS = [
  'GTBank',
  'Access Bank',
  'First Bank',
  'Zenith Bank',
  'UBA',
  'Fidelity Bank',
  'Sterling Bank',
  'Polaris Bank',
  'Wema Bank',
];

// ─── Shared primitives ────────────────────────────────────────────────────────
function MxBtn({
  label,
  variant = 'primary',
  small = false,
  disabled = false,
  onClick,
  fullWidth = false,
}: {
  label: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  small?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  fullWidth?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: disabled ? 'rgba(255,255,255,.08)' : `linear-gradient(135deg,${G0},${G2})`,
      color: disabled ? MUTED : WHITE,
      border: 'none',
      boxShadow: disabled ? 'none' : `0 4px 16px rgba(43,172,82,.3)`,
    },
    outline: {
      background: 'transparent',
      color: disabled ? MUTED : G3,
      border: `1px solid ${disabled ? BORDER : 'rgba(71,207,114,.4)'}`,
    },
    ghost: { background: 'transparent', color: disabled ? MUTED : MUTED, border: 'none' },
    danger: {
      background: disabled ? 'rgba(255,255,255,.08)' : 'rgba(239,68,68,.12)',
      color: disabled ? MUTED : C_ERR,
      border: `1px solid ${disabled ? BORDER : 'rgba(239,68,68,.25)'}`,
    },
  };
  return (
    <button
      className="mx-btn"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles[variant],
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: IT,
        fontWeight: 600,
        fontSize: small ? 11 : 13,
        padding: small ? '5px 12px' : '9px 18px',
        width: fullWidth ? '100%' : undefined,
        opacity: disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function MxChip({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: IT,
        letterSpacing: 0.3,
        color,
        background: bg ?? `${color}1a`,
      }}
    >
      {label}
    </span>
  );
}

function OrderStatusChip({ status }: { status: OrderStatus | string }) {
  const map: Record<string, [string, string]> = {
    new: [C_ERR, 'New Order'],
    preparing: [C_WARN, 'Preparing'],
    ready: [G3, 'Ready'],
    completed: [C_OK, 'Completed'],
    cancelled: [MUTED, 'Cancelled'],
    pending: [C_WARN, 'Pending'],
    verified: [C_OK, 'Verified'],
    rejected: [C_ERR, 'Rejected'],
    review: ['#3B82F6', 'Under Review'],
    uploaded: [G3, 'Uploaded'],
    approved: [C_OK, 'Approved'],
    action: [C_ERR, 'Action Required'],
    suspended: [C_ERR, 'Suspended'],
  };
  const [c, l] = map[status] ?? [MUTED, status];
  return <MxChip label={l} color={c} />;
}

function MxCard({
  children,
  style,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      className="mx-card"
      onClick={onClick}
      style={{
        background: NAVY_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: 16,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MxInput({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>{label}</div>
      )}
      <input
        className="mx-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function MxSelect({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>{label}</div>
      )}
      <select className="mx-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}
    >
      <div>
        <div style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: WHITE }}>{title}</div>
        {sub && (
          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 3 }}>{sub}</div>
        )}
      </div>
      {action}
    </div>
  );
}

function InfoBanner({
  icon,
  text,
  color = C_WARN,
}: {
  icon: string;
  text: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 8,
        background: `${color}0d`,
        border: `1px solid ${color}25`,
        marginBottom: 16,
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontFamily: IT, fontSize: 12, color: MUTED, lineHeight: 1.55 }}>{text}</span>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          width: 440,
          maxHeight: '85%',
          overflow: 'auto',
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <span style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: WHITE }}>
            {title}
          </span>
          <button
            className="mx-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: MUTED,
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV_PRIMARY: { page: MerchantPage; icon: string; label: string; badge?: number }[] = [
  { page: 'dashboard', icon: '⬛', label: 'Dashboard' },
  { page: 'orders', icon: '📦', label: 'Orders', badge: 1 },
  { page: 'products', icon: '🏪', label: 'Products' },
  { page: 'store', icon: '🏬', label: 'Store' },
  { page: 'earnings', icon: '💰', label: 'Earnings' },
];
const NAV_SECONDARY: { page: MerchantPage; icon: string; label: string }[] = [
  { page: 'approval', icon: '✅', label: 'Approval Status' },
  { page: 'kyc', icon: '🪪', label: 'KYC' },
  { page: 'bank', icon: '🏦', label: 'Bank Account' },
  { page: 'settings', icon: '⚙️', label: 'Settings' },
];

function MxSidebar({
  page,
  onNav,
  storeOpen,
}: {
  page: MerchantPage;
  onNav: (p: MerchantPage) => void;
  storeOpen: boolean;
}) {
  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        height: '100%',
        background: NAVY_DEEP,
        borderRight: `1px solid ${BORDER}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: `linear-gradient(135deg,${G0},${G3})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: NAVY_DEEP,
            }}
          >
            D
          </div>
          <div>
            <div
              style={{
                fontFamily: PP,
                fontWeight: 700,
                fontSize: 12,
                color: WHITE,
                lineHeight: 1.2,
              }}
            >
              DrippleX
            </div>
            <div style={{ fontFamily: IT, fontSize: 9, color: MUTED, letterSpacing: 0.5 }}>
              MERCHANT PORTAL
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: storeOpen ? G2 : MUTED,
              boxShadow: storeOpen ? `0 0 6px ${G2}` : 'none',
            }}
          />
          <span
            style={{ fontFamily: IT, fontSize: 10, color: storeOpen ? G3 : MUTED, fontWeight: 600 }}
          >
            {storeOpen ? 'Store Open' : 'Store Closed'}
          </span>
        </div>
      </div>

      <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <div
          style={{
            fontFamily: IT,
            fontSize: 10,
            color: MUTED,
            padding: '6px 14px 4px',
            letterSpacing: 0.6,
          }}
        >
          MAIN
        </div>
        {NAV_PRIMARY.map((item) => {
          const active = item.page === page;
          return (
            <div
              key={item.page}
              className="mx-nav"
              onClick={() => onNav(item.page)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 12px',
                margin: '1px 6px',
                borderRadius: 7,
                cursor: 'pointer',
                borderLeft: `3px solid ${active ? G3 : 'transparent'}`,
                background: active ? 'rgba(71,207,114,.09)' : 'transparent',
                color: active ? G3 : MUTED,
                fontFamily: IT,
                fontSize: 12.5,
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1, minWidth: 16 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    background: C_ERR,
                    color: WHITE,
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    lineHeight: 1.6,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
        <div style={{ height: 1, background: BORDER, margin: '8px 12px' }} />
        <div
          style={{
            fontFamily: IT,
            fontSize: 10,
            color: MUTED,
            padding: '4px 14px',
            letterSpacing: 0.6,
          }}
        >
          ACCOUNT
        </div>
        {NAV_SECONDARY.map((item) => {
          const active = item.page === page;
          return (
            <div
              key={item.page}
              className="mx-nav"
              onClick={() => onNav(item.page)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '7px 12px',
                margin: '1px 6px',
                borderRadius: 7,
                cursor: 'pointer',
                borderLeft: `3px solid ${active ? G3 : 'transparent'}`,
                background: active ? 'rgba(71,207,114,.09)' : 'transparent',
                color: active ? G3 : MUTED,
                fontFamily: IT,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1, minWidth: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: `linear-gradient(135deg,${G0},${G2})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: WHITE,
            }}
          >
            CH
          </div>
          <div>
            <div style={{ fontFamily: IT, fontSize: 11, color: WHITE, fontWeight: 600 }}>
              Chidi's Kitchen
            </div>
            <div style={{ fontFamily: IT, fontSize: 10, color: MUTED }}>Pilot · Lagos</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function MxHeader({ page, orderBadge }: { page: MerchantPage; orderBadge: number }) {
  const labels: Record<MerchantPage, string> = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    products: 'Products & Catalogue',
    store: 'Store Setup',
    earnings: 'Earnings & Settlements',
    kyc: 'Merchant KYC',
    bank: 'Bank Account',
    approval: 'Approval Status',
    settings: 'Settings',
  };
  return (
    <div
      style={{
        height: 52,
        flexShrink: 0,
        background: NAVY_BASE,
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, fontFamily: PP, fontWeight: 600, fontSize: 14, color: WHITE }}>
        {labels[page]}
      </div>
      {orderBadge > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 8,
            background: 'rgba(239,68,68,.1)',
            border: '1px solid rgba(239,68,68,.2)',
          }}
        >
          <div style={{ position: 'relative', width: 8, height: 8 }}>
            <div
              className="mx-ping"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C_ERR,
                opacity: 0.7,
              }}
            />
            <div
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C_ERR }}
            />
          </div>
          <span style={{ fontFamily: IT, fontSize: 12, color: C_ERR, fontWeight: 600 }}>
            {orderBadge} new order{orderBadge > 1 ? 's' : ''}
          </span>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 8,
          background: NAVY_SURFACE,
          border: `1px solid ${BORDER}`,
        }}
      >
        <span style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>🔔</span>
      </div>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: `linear-gradient(135deg,${G0},${G2})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: WHITE,
        }}
      >
        CH
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DashboardPage({
  onNav,
  orders,
  storeOpen,
  setStoreOpen,
}: {
  onNav: (p: MerchantPage) => void;
  orders: typeof MOCK_ORDERS;
  storeOpen: boolean;
  setStoreOpen: (v: boolean) => void;
}) {
  const newCount = orders.filter((o) => o.status === 'new').length;
  const todayTotal = orders
    .filter((o) => o.status === 'completed')
    .reduce((s, o) => s + o.total, 0);
  const grossToday = 17050;
  const netToday = Math.round(grossToday * 0.9);

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      {/* Store status banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 10,
          background: storeOpen ? 'rgba(43,172,82,.07)' : 'rgba(255,255,255,.04)',
          border: `1px solid ${storeOpen ? 'rgba(43,172,82,.2)' : BORDER}`,
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: storeOpen ? G2 : MUTED,
              boxShadow: storeOpen ? `0 0 8px ${G2}` : 'none',
            }}
          />
          <div>
            <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: WHITE }}>
              {storeOpen ? 'Your store is open' : 'Your store is closed'}
            </div>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
              {storeOpen ? 'Customers can place orders now' : 'Toggle to start accepting orders'}
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          className="mx-toggle"
          checked={storeOpen}
          onChange={(e) => setStoreOpen(e.target.checked)}
        />
      </div>

      {/* New order alert */}
      {newCount > 0 && (
        <div
          onClick={() => onNav('orders')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(239,68,68,.07)',
            border: '1.5px solid rgba(239,68,68,.3)',
            marginBottom: 18,
            cursor: 'pointer',
          }}
        >
          <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
            <div
              className="mx-ping"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: C_ERR,
                opacity: 0.7,
              }}
            />
            <div
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C_ERR }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
              {newCount} new order{newCount > 1 ? 's' : ''} waiting
            </div>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
              Tap to review and accept
            </div>
          </div>
          <span style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>View →</span>
        </div>
      )}

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          {
            label: "Today's Orders",
            value: String(orders.length),
            sub: `${newCount} new`,
            color: '#3B82F6',
          },
          {
            label: 'Gross Earnings',
            value: `₦${grossToday.toLocaleString()}`,
            sub: 'today',
            color: G3,
          },
          {
            label: 'Net (after 10%)',
            value: `₦${netToday.toLocaleString()}`,
            sub: 'settled by Ops',
            color: G2,
          },
          { label: 'Products Live', value: '5', sub: '1 out of stock', color: C_WARN },
        ].map((k) => (
          <MxCard key={k.label} style={{ padding: '14px 16px' }}>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginBottom: 6 }}>
              {k.label}
            </div>
            <div style={{ fontFamily: PP, fontWeight: 700, fontSize: 20, color: k.color }}>
              {k.value}
            </div>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 3 }}>{k.sub}</div>
          </MxCard>
        ))}
      </div>

      {/* Recent orders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <MxCard>
          <SectionHead
            title="Recent Orders"
            action={
              <span
                onClick={() => onNav('orders')}
                style={{ fontFamily: IT, fontSize: 12, color: G3, cursor: 'pointer' }}
              >
                See all →
              </span>
            }
          />
          {orders.slice(0, 4).map((o) => (
            <div
              key={o.id}
              className="mx-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: IT, fontSize: 12, fontWeight: 600, color: WHITE }}>
                  {o.id}
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{o.summary}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: PP, fontSize: 12, fontWeight: 700, color: WHITE }}>
                  ₦{o.total.toLocaleString()}
                </div>
                <OrderStatusChip status={o.status} />
              </div>
            </div>
          ))}
        </MxCard>

        <MxCard>
          <SectionHead
            title="Products"
            action={
              <span
                onClick={() => onNav('products')}
                style={{ fontFamily: IT, fontSize: 12, color: G3, cursor: 'pointer' }}
              >
                Manage →
              </span>
            }
          />
          {MOCK_PRODUCTS.slice(0, 5).map((p) => (
            <div
              key={p.id}
              className="mx-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 0',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 7,
                  background: NAVY_SURFACE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                🍛
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: IT,
                    fontSize: 12,
                    fontWeight: 600,
                    color: p.inStock ? WHITE : MUTED,
                  }}
                >
                  {p.name}
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                  ₦{p.price.toLocaleString()}
                </div>
              </div>
              {!p.inStock && <MxChip label="Out of stock" color={C_WARN} />}
              {!p.published && <MxChip label="Hidden" color={MUTED} />}
            </div>
          ))}
        </MxCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — ORDERS
// ─────────────────────────────────────────────────────────────────────────────
function OrdersPage({
  orders,
  setOrders,
  onDetail,
}: {
  orders: typeof MOCK_ORDERS;
  setOrders: (o: typeof MOCK_ORDERS) => void;
  onDetail: (id: string) => void;
}) {
  const tabs: { key: OrderStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready' },
    { key: 'completed', label: 'Completed' },
  ];
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('new');

  const visible = activeTab === 'all' ? orders : orders.filter((o) => o.status === activeTab);

  const updateStatus = (id: string, s: OrderStatus) => {
    setOrders(orders.map((o) => (o.id === id ? { ...o, status: s } : o)));
  };

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Incoming Orders" sub="Accept and process customer orders" />

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          background: NAVY_SURFACE,
          padding: 4,
          borderRadius: 8,
          width: 'fit-content',
        }}
      >
        {tabs.map((t) => {
          const count =
            t.key === 'all' ? orders.length : orders.filter((o) => o.status === t.key).length;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              className="mx-btn"
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: active ? NAVY_CARD : 'transparent',
                fontFamily: IT,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? WHITE : MUTED,
              }}
            >
              {t.label}{' '}
              {count > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    background: t.key === 'new' && count > 0 ? C_ERR : NAVY_SURFACE,
                    color: WHITE,
                    borderRadius: 99,
                    fontSize: 10,
                    padding: '1px 5px',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontFamily: PP, fontSize: 14, color: MUTED }}>
            No {activeTab === 'all' ? '' : activeTab} orders
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((o) => (
            <MxCard key={o.id} style={{ padding: 0, overflow: 'hidden' }}>
              {o.status === 'new' && (
                <div style={{ height: 3, background: `linear-gradient(90deg,${G0},${C_ERR})` }} />
              )}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Order info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
                      {o.id}
                    </span>
                    <OrderStatusChip status={o.status} />
                    <MxChip label="CASH" color={C_WARN} />
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 2 }}>
                    {o.summary}
                  </div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                      👤 {o.customer}
                    </span>
                    <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>🕐 {o.time}</span>
                    <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                      {o.items} item{o.items > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: PP,
                      fontSize: 15,
                      fontWeight: 700,
                      color: WHITE,
                      marginBottom: 8,
                    }}
                  >
                    ₦{o.total.toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {o.status === 'new' && (
                      <>
                        <MxBtn
                          label="Reject"
                          variant="danger"
                          small
                          onClick={() => updateStatus(o.id, 'cancelled')}
                        />
                        {/* accept → PREPARING (no separate preparing step per backend contract) */}
                        <MxBtn
                          label="Accept"
                          variant="primary"
                          small
                          onClick={() => updateStatus(o.id, 'preparing')}
                        />
                      </>
                    )}
                    {o.status === 'preparing' && (
                      <MxBtn
                        label="Mark Ready"
                        variant="primary"
                        small
                        onClick={() => updateStatus(o.id, 'ready')}
                      />
                    )}
                    <MxBtn label="View" variant="ghost" small onClick={() => onDetail(o.id)} />
                  </div>
                </div>
              </div>
            </MxCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 — ORDER DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function OrderDetailPage({
  orderId,
  orders,
  setOrders,
  onBack,
}: {
  orderId: string;
  orders: typeof MOCK_ORDERS;
  setOrders: (o: typeof MOCK_ORDERS) => void;
  onBack: () => void;
}) {
  const order = orders.find((o) => o.id === orderId) ?? orders[0];
  const [showConfirm, setShowConfirm] = useState<'reject' | 'ready' | null>(null);

  const updateStatus = (s: OrderStatus) => {
    setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: s } : o)));
    setShowConfirm(null);
  };

  const timeline: { label: string; done: boolean; time?: string }[] = [
    { label: 'Order placed', done: true, time: order.time },
    {
      label: 'Accepted → Preparing',
      done: ['preparing', 'ready', 'completed'].includes(order.status),
      time: order.status !== 'new' ? '9:43 AM' : undefined,
    },
    {
      label: 'Preparing',
      done: ['ready', 'completed'].includes(order.status),
      time:
        order.status === 'preparing'
          ? 'Now'
          : order.status === 'ready' || order.status === 'completed'
            ? '9:48 AM'
            : undefined,
    },
    { label: 'Ready for pickup', done: ['ready', 'completed'].includes(order.status) },
    { label: 'Driver pickup & delivery', done: order.status === 'completed' },
  ];

  const items = [
    { name: 'Jollof Rice', qty: 2, price: 1800 },
    { name: 'Grilled Chicken', qty: 1, price: 2500 },
  ];
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div
      className="mx-scroll"
      style={{ flex: 1, overflowY: 'auto', padding: 20, position: 'relative' }}
    >
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          className="mx-btn"
          onClick={onBack}
          style={{
            background: NAVY_SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 7,
            padding: '6px 12px',
            color: MUTED,
            fontFamily: IT,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: WHITE }}>
            {order.id}
          </span>
          <span style={{ marginLeft: 10 }}>
            <OrderStatusChip status={order.status} />
          </span>
          <span style={{ marginLeft: 6 }}>
            <MxChip label="CASH" color={C_WARN} />
          </span>
        </div>
        {order.status === 'new' && (
          <MxBtn label="Reject Order" variant="danger" onClick={() => setShowConfirm('reject')} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Left: items + summary */}
        <div>
          <MxCard style={{ marginBottom: 14 }}>
            <SectionHead title="Order Items" />
            {items.map((item) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <div>
                  <div style={{ fontFamily: IT, fontSize: 13, color: WHITE, fontWeight: 600 }}>
                    {item.name}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>× {item.qty}</div>
                </div>
                <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
                  ₦{(item.price * item.qty).toLocaleString()}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0' }}>
              <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>Subtotal</span>
              <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
                ₦{subtotal.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>Delivery fee</span>
              <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                Handled by platform
              </span>
            </div>
          </MxCard>

          <MxCard>
            <SectionHead title="Order Timeline" />
            {timeline.map((t, i) => (
              <div
                key={t.label}
                style={{
                  display: 'flex',
                  gap: 12,
                  paddingBottom: i < timeline.length - 1 ? 14 : 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: t.done ? G2 : NAVY_SURFACE,
                      border: `2px solid ${t.done ? G2 : BORDER}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {t.done && (
                      <div
                        style={{ width: 6, height: 6, borderRadius: '50%', background: WHITE }}
                      />
                    )}
                  </div>
                  {i < timeline.length - 1 && (
                    <div
                      style={{ width: 2, flex: 1, background: t.done ? G2 : BORDER, marginTop: 4 }}
                    />
                  )}
                </div>
                <div style={{ paddingBottom: 4 }}>
                  <div
                    style={{
                      fontFamily: IT,
                      fontSize: 12,
                      color: t.done ? WHITE : MUTED,
                      fontWeight: t.done ? 500 : 400,
                    }}
                  >
                    {t.label}
                  </div>
                  {t.time && (
                    <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{t.time}</div>
                  )}
                </div>
              </div>
            ))}
          </MxCard>
        </div>

        {/* Right: actions + delivery info */}
        <div>
          <MxCard style={{ marginBottom: 14 }}>
            <SectionHead title="Order Actions" />
            {order.status === 'new' && (
              <>
                <InfoBanner
                  icon="⏰"
                  text="This order expires in 3 minutes if not accepted."
                  color={C_ERR}
                />
                {/* accept → PREPARING immediately per backend contract (no separate preparing step) */}
                <MxBtn
                  label="✓ Accept Order"
                  variant="primary"
                  fullWidth
                  onClick={() => updateStatus('preparing')}
                />
              </>
            )}
            {order.status === 'preparing' && (
              <>
                <InfoBanner
                  icon="📢"
                  text="Tap 'Mark Ready' when the order is packed and ready for driver pickup."
                  color={G2}
                />
                <MxBtn
                  label="Mark as Ready ✓"
                  variant="primary"
                  fullWidth
                  onClick={() => setShowConfirm('ready')}
                />
              </>
            )}
            {order.status === 'ready' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏍️</div>
                <div
                  style={{
                    fontFamily: PP,
                    fontSize: 13,
                    fontWeight: 600,
                    color: WHITE,
                    marginBottom: 4,
                  }}
                >
                  Awaiting driver pickup
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                  A driver has been assigned and is on the way to your store.
                </div>
              </div>
            )}
            {order.status === 'completed' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                <div
                  style={{
                    fontFamily: PP,
                    fontSize: 13,
                    fontWeight: 600,
                    color: G3,
                    marginBottom: 4,
                  }}
                >
                  Order delivered
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                  Settlement will be processed by Operations.
                </div>
              </div>
            )}
          </MxCard>

          <MxCard>
            <SectionHead title="Delivery Info" />
            {[
              ['Payment', 'Cash on Delivery'],
              ['Order time', order.time],
              ['Items', `${order.items} item${order.items > 1 ? 's' : ''}`],
              ['Total', `₦${order.total.toLocaleString()}`],
            ].map(([l, v]) => (
              <div
                key={l}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '7px 0',
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{l}</span>
                <span style={{ fontFamily: IT, fontSize: 12, color: WHITE, fontWeight: 500 }}>
                  {v}
                </span>
              </div>
            ))}
          </MxCard>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <Modal
          title={showConfirm === 'reject' ? 'Reject this order?' : 'Mark order as ready?'}
          onClose={() => setShowConfirm(null)}
        >
          <p
            style={{
              fontFamily: IT,
              fontSize: 13,
              color: MUTED,
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            {showConfirm === 'reject'
              ? 'This order will be cancelled and the customer will be notified. This action cannot be undone.'
              : 'Marking this order as ready will notify the assigned driver to come pick it up. Make sure the order is fully packed.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Cancel" variant="outline" onClick={() => setShowConfirm(null)} />
            <MxBtn
              label={showConfirm === 'reject' ? 'Yes, Reject' : 'Yes, Mark Ready'}
              variant={showConfirm === 'reject' ? 'danger' : 'primary'}
              onClick={() => updateStatus(showConfirm === 'reject' ? 'cancelled' : 'ready')}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 4 — PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
function ProductsPage({
  products,
  setProducts,
}: {
  products: typeof MOCK_PRODUCTS;
  setProducts: (p: typeof MOCK_PRODUCTS) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: '', price: '', description: '' });
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

  const openAdd = () => {
    setForm({ name: '', category: '', price: '', description: '' });
    setEditId(null);
    setShowAdd(true);
  };
  const openEdit = (p: (typeof products)[0]) => {
    setForm({ name: p.name, category: p.category, price: String(p.price), description: '' });
    setEditId(p.id);
    setShowAdd(true);
  };

  const saveProduct = () => {
    if (!form.name || !form.price) return;
    if (editId) {
      setProducts(
        products.map((p) =>
          p.id === editId
            ? { ...p, name: form.name, category: form.category, price: Number(form.price) }
            : p,
        ),
      );
    } else {
      setProducts([
        ...products,
        {
          id: `P0${products.length + 1}`,
          name: form.name,
          category: form.category,
          price: Number(form.price),
          inStock: true,
          published: false,
        },
      ]);
    }
    setShowAdd(false);
  };

  const toggle = (id: string, field: 'inStock' | 'published') => {
    setProducts(products.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p)));
  };

  const deleteProduct = (id: string) => {
    setProducts(products.filter((p) => p.id !== id));
    setShowDeleteId(null);
  };

  const CATEGORIES = ['Rice', 'Soup', 'Swallow', 'Protein', 'Drinks', 'Snacks', 'Other'];

  return (
    <div
      className="mx-scroll"
      style={{ flex: 1, overflowY: 'auto', padding: 20, position: 'relative' }}
    >
      <SectionHead
        title="Products & Catalogue"
        sub={`${products.filter((p) => p.published).length} published · ${products.filter((p) => !p.inStock).length} out of stock`}
        action={<MxBtn label="+ Add Product" variant="primary" onClick={openAdd} />}
      />

      {products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
          <div
            style={{ fontFamily: PP, fontSize: 16, color: WHITE, fontWeight: 700, marginBottom: 8 }}
          >
            No products yet
          </div>
          <div style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginBottom: 20 }}>
            Add your first product to start receiving orders.
          </div>
          <MxBtn label="+ Add your first product" variant="primary" onClick={openAdd} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {products.map((p) => (
            <MxCard
              key={p.id}
              style={{ padding: 0, overflow: 'hidden', opacity: p.published ? 1 : 0.7 }}
            >
              <div
                style={{
                  height: 80,
                  background: NAVY_SURFACE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                }}
              >
                🍛
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <div>
                    <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
                      {p.name}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{p.category}</div>
                  </div>
                  <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: G3 }}>
                    ₦{p.price.toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {!p.inStock && <MxChip label="Out of stock" color={C_WARN} />}
                  {!p.published && <MxChip label="Hidden" color={MUTED} />}
                  {p.published && p.inStock && <MxChip label="Live" color={G3} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>In stock</span>
                    <input
                      type="checkbox"
                      className="mx-toggle"
                      checked={p.inStock}
                      onChange={() => toggle(p.id, 'inStock')}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>Published</span>
                    <input
                      type="checkbox"
                      className="mx-toggle"
                      checked={p.published}
                      onChange={() => toggle(p.id, 'published')}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <MxBtn label="Edit" variant="outline" small onClick={() => openEdit(p)} />
                  <MxBtn
                    label="Delete"
                    variant="danger"
                    small
                    onClick={() => setShowDeleteId(p.id)}
                  />
                </div>
              </div>
            </MxCard>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal
          title={editId ? 'Edit Product' : 'Add New Product'}
          onClose={() => setShowAdd(false)}
        >
          <MxInput
            label="Product Name *"
            placeholder="e.g. Jollof Rice"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          />
          <MxSelect
            label="Category"
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={CATEGORIES}
          />
          <MxInput
            label="Price (₦) *"
            placeholder="e.g. 1800"
            value={form.price}
            onChange={(v) => setForm((f) => ({ ...f, price: v }))}
            type="number"
          />
          <MxInput
            label="Description (optional)"
            placeholder="Brief description of this product"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 8,
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: NAVY_CARD,
                border: `1.5px dashed ${BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              🖼️
            </div>
            <div>
              <div style={{ fontFamily: IT, fontSize: 12, color: WHITE, fontWeight: 600 }}>
                Product image
              </div>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                Tap to upload (optional)
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Cancel" variant="outline" onClick={() => setShowAdd(false)} />
            <MxBtn
              label={editId ? 'Save Changes' : 'Add Product'}
              variant="primary"
              disabled={!form.name || !form.price}
              onClick={saveProduct}
            />
          </div>
        </Modal>
      )}

      {showDeleteId && (
        <Modal title="Delete product?" onClose={() => setShowDeleteId(null)}>
          <p
            style={{
              fontFamily: IT,
              fontSize: 13,
              color: MUTED,
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            This product will be permanently removed from your catalogue. Ongoing orders won't be
            affected.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Cancel" variant="outline" onClick={() => setShowDeleteId(null)} />
            <MxBtn label="Delete" variant="danger" onClick={() => deleteProduct(showDeleteId)} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 5 — STORE SETUP
// ─────────────────────────────────────────────────────────────────────────────
function StoreSetupPage({
  storeOpen,
  setStoreOpen,
}: {
  storeOpen: boolean;
  setStoreOpen: (v: boolean) => void;
}) {
  const [storeName, setStoreName] = useState("Chidi's Kitchen");
  const [category, setCategory] = useState('Local Food');
  const [description, setDescription] = useState(
    'Authentic Nigerian home-cooked meals, delivered fresh.',
  );
  const [address, setAddress] = useState('12 Allen Avenue, Ikeja, Lagos');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('21:00');
  const [saved, setSaved] = useState(false);

  const CATS = [
    'Local Food',
    'Fast Food',
    'Pastry & Bakery',
    'Drinks & Beverages',
    'Groceries',
    'Pharmacy',
    'Other',
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Store Setup" sub="Configure your business profile and store details" />

      {saved && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 8,
            background: 'rgba(16,185,129,.08)',
            border: '1px solid rgba(16,185,129,.2)',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14 }}>✅</span>
          <span style={{ fontFamily: IT, fontSize: 13, color: C_OK, fontWeight: 600 }}>
            Store details saved successfully.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Business info */}
        <MxCard>
          <SectionHead title="Business Information" />
          <MxInput
            label="Store / Business Name *"
            placeholder="e.g. Chidi's Kitchen"
            value={storeName}
            onChange={setStoreName}
          />
          <MxSelect label="Category *" value={category} onChange={setCategory} options={CATS} />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>
              Description
            </div>
            <textarea
              className="mx-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your store…"
              rows={3}
              style={{ resize: 'none', lineHeight: 1.5 }}
            />
          </div>
        </MxCard>

        {/* Store details */}
        <MxCard>
          <SectionHead title="Store Location & Hours" />
          <MxInput
            label="Store Address *"
            placeholder="Full address"
            value={address}
            onChange={setAddress}
          />
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>📍</span>
            <div>
              <div style={{ fontFamily: IT, fontSize: 12, color: WHITE, fontWeight: 600 }}>
                Map pin confirmed
              </div>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                Location set to {address}
              </div>
            </div>
            <span
              style={{
                marginLeft: 'auto',
                fontFamily: IT,
                fontSize: 12,
                color: G3,
                cursor: 'pointer',
              }}
            >
              Change
            </span>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}
          >
            <div>
              <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>
                Opening time
              </div>
              <input
                className="mx-input"
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
              />
            </div>
            <div>
              <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>
                Closing time
              </div>
              <input
                className="mx-input"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
            </div>
          </div>
        </MxCard>

        {/* Store logo */}
        <MxCard>
          <SectionHead title="Store Logo & Cover" />
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 14,
                  background: NAVY_SURFACE,
                  border: `2px dashed ${BORDER}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  cursor: 'pointer',
                  marginBottom: 6,
                }}
              >
                🏪
              </div>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>Logo</div>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 72,
                  borderRadius: 10,
                  background: NAVY_SURFACE,
                  border: `2px dashed ${BORDER}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 20 }}>🖼️</span>
                <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>Cover image</span>
              </div>
            </div>
          </div>
        </MxCard>

        {/* Store operations */}
        <MxCard>
          <SectionHead title="Store Operations" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div>
              <div style={{ fontFamily: IT, fontSize: 13, fontWeight: 600, color: WHITE }}>
                Store status
              </div>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                {storeOpen
                  ? 'Currently open — accepting orders'
                  : 'Currently closed — not accepting orders'}
              </div>
            </div>
            <input
              type="checkbox"
              className="mx-toggle"
              checked={storeOpen}
              onChange={(e) => setStoreOpen(e.target.checked)}
            />
          </div>
          <div style={{ padding: '10px 0' }}>
            <InfoBanner
              icon="ℹ️"
              text="Pausing your store hides it from customers temporarily. Your products and settings are preserved."
              color={'#3B82F6'}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <MxBtn label="Save & Exit" variant="outline" onClick={handleSave} />
            <MxBtn label="Save Changes" variant="primary" onClick={handleSave} />
          </div>
        </MxCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 6 — MERCHANT KYC
// ─────────────────────────────────────────────────────────────────────────────
function MerchantKYCPage() {
  const [docs, setDocs] = useState([
    {
      id: 'cac',
      label: 'CAC Certificate',
      desc: 'Business registration certificate',
      icon: '📋',
      status: 'verified',
      required: true,
    },
    {
      id: 'nin',
      label: 'Director NIN / ID',
      desc: 'National Identity Number or valid government ID',
      icon: '🪪',
      status: 'verified',
      required: true,
    },
    {
      id: 'utility',
      label: 'Utility Bill',
      desc: 'Recent utility bill showing business address',
      icon: '📄',
      status: 'review',
      required: true,
    },
    {
      id: 'photo',
      label: 'Business Premises Photo',
      desc: 'Photo of your store/premises exterior',
      icon: '🖼️',
      status: 'uploaded',
      required: false,
    },
  ]);

  const total = docs.filter((d) => d.required).length;
  const done = docs.filter((d) => d.required && d.status === 'verified').length;
  const pct = Math.round((done / total) * 100);
  const overallStatus =
    done === total ? 'approved' : docs.some((d) => d.status === 'review') ? 'review' : 'pending';

  const simulateUpload = (id: string) => {
    setDocs(docs.map((d) => (d.id === id ? { ...d, status: 'uploaded' } : d)));
  };

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Merchant KYC" sub="Submit required documents to verify your business" />

      {/* Progress */}
      <MxCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: WHITE }}>
            Verification progress
          </span>
          <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: G3 }}>
            {done}/{total} verified
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: NAVY_SURFACE, marginBottom: 10 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: `linear-gradient(90deg,${G0},${G3})`,
              width: `${pct}%`,
              transition: 'width .4s',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>Overall status</span>
          <OrderStatusChip status={overallStatus} />
        </div>
      </MxCard>

      <InfoBanner
        icon="🔒"
        text="Your documents are encrypted and stored securely. They are only used to verify your business identity. DrippleX does not share your KYC documents with third parties."
        color={G2}
      />

      {docs.map((doc) => (
        <MxCard key={doc.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: NAVY_SURFACE,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {doc.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: WHITE }}>
                  {doc.label}
                </span>
                {doc.required && (
                  <span style={{ fontFamily: IT, fontSize: 10, color: C_ERR }}>Required</span>
                )}
              </div>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{doc.desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <OrderStatusChip status={doc.status} />
              {(doc.status === 'uploaded' || doc.status === 'review') && (
                <MxBtn
                  label="Replace"
                  variant="outline"
                  small
                  onClick={() => simulateUpload(doc.id)}
                />
              )}
              {doc.status !== 'verified' &&
                doc.status !== 'review' &&
                doc.status !== 'uploaded' && (
                  <MxBtn
                    label="Upload"
                    variant="primary"
                    small
                    onClick={() => simulateUpload(doc.id)}
                  />
                )}
            </div>
          </div>
          {doc.status === 'rejected' && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 7,
                background: 'rgba(239,68,68,.07)',
                border: '1px solid rgba(239,68,68,.2)',
              }}
            >
              <span style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>
                ⚠️ Document rejected — please upload a clearer version of this document.
              </span>
            </div>
          )}
        </MxCard>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 7 — BANK ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────
function BankAccountPage() {
  const [bank, setBank] = useState('GTBank');
  const [accNo, setAccNo] = useState('0123456789');
  const [accName, setAccName] = useState('CHIDI RESTAURANTS LTD');
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(true);

  const handleResolve = () => {
    if (accNo.length < 10) return;
    setResolving(true);
    setTimeout(() => {
      setAccName('CHIDI RESTAURANTS LTD');
      setResolved(true);
      setResolving(false);
    }, 1400);
  };

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Bank Account" sub="Your payout destination account" />

      <div style={{ maxWidth: 520 }}>
        <InfoBanner
          icon="💰"
          text="This account receives your settlement payments. Payouts are processed by the DrippleX Operations team during the pilot period."
          color={G2}
        />

        <MxCard style={{ marginBottom: 14 }}>
          <SectionHead
            title={editing ? 'Edit Bank Account' : 'Settlement Account'}
            action={
              !editing ? (
                <MxBtn
                  label="Edit"
                  variant="outline"
                  small
                  onClick={() => {
                    setEditing(true);
                    setResolved(false);
                  }}
                />
              ) : undefined
            }
          />

          {!editing ? (
            <div>
              {[
                ['Bank', bank],
                ['Account Number', accNo.replace(/\d(?=\d{4})/g, '•')],
                ['Account Name', accName],
              ].map(([l, v]) => (
                <div
                  key={l}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{l}</span>
                  <span style={{ fontFamily: IT, fontSize: 12, color: WHITE, fontWeight: 500 }}>
                    {v}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: C_OK }} />
                <span style={{ fontFamily: IT, fontSize: 12, color: C_OK }}>Account verified</span>
              </div>
            </div>
          ) : (
            <div>
              <MxSelect
                label="Bank *"
                value={bank}
                onChange={(v) => {
                  setBank(v);
                  setResolved(false);
                  setAccName('');
                }}
                options={NIGERIAN_BANKS}
              />
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>
                  Account Number *
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="mx-input"
                    value={accNo}
                    onChange={(e) => {
                      setAccNo(e.target.value);
                      setResolved(false);
                      setAccName('');
                    }}
                    placeholder="10-digit account number"
                    maxLength={10}
                    style={{ flex: 1 }}
                  />
                  <MxBtn
                    label={resolving ? '…' : 'Verify'}
                    variant="primary"
                    disabled={accNo.length < 10 || resolving}
                    onClick={handleResolve}
                  />
                </div>
              </div>
              {resolved && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(16,185,129,.08)',
                    border: '1px solid rgba(16,185,129,.2)',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginBottom: 2 }}>
                    Account name (verified)
                  </div>
                  <div style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: C_OK }}>
                    {accName}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <MxBtn label="Cancel" variant="outline" onClick={() => setEditing(false)} />
                <MxBtn
                  label="Save Account"
                  variant="primary"
                  disabled={!resolved}
                  onClick={() => setEditing(false)}
                />
              </div>
            </div>
          )}
        </MxCard>

        <MxCard>
          <SectionHead title="Payout Information" />
          <InfoBanner
            icon="ℹ️"
            text="During the V1 pilot, all merchant payouts are administered by the DrippleX Operations team. You will be notified when a settlement is processed to this account."
            color={'#3B82F6'}
          />
          {[
            ['Settlement cycle', 'After each completed order'],
            ['Commission', '10% (set by Operations)'],
            ['Net to merchant', '90% of order value'],
          ].map(([l, v]) => (
            <div
              key={l}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{l}</span>
              <span style={{ fontFamily: IT, fontSize: 12, color: WHITE }}>{v}</span>
            </div>
          ))}
        </MxCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 8 — APPROVAL STATUS
// ─────────────────────────────────────────────────────────────────────────────
function ApprovalStatusPage({ onNav }: { onNav: (p: MerchantPage) => void }) {
  const steps = [
    { label: 'Business Setup', sub: 'Store name, address, category', status: 'done', action: null },
    {
      label: 'KYC Documents',
      sub: 'Identity & business verification',
      status: 'done',
      action: null,
    },
    { label: 'Bank Account', sub: 'Settlement destination account', status: 'done', action: null },
    {
      label: 'Operations Approval',
      sub: 'DrippleX team reviews your application',
      status: 'review',
      action: null,
    },
    { label: 'Store Activation', sub: 'Begin accepting orders', status: 'locked', action: null },
  ];

  const STATUS_MAP: Record<string, [string, string, string]> = {
    done: [C_OK, '✓', 'Completed'],
    review: [C_WARN, '⏳', 'Under Review'],
    action: [C_ERR, '!', 'Action Required'],
    locked: [MUTED, '○', 'Waiting'],
    rejected: [C_ERR, '✕', 'Rejected'],
  };

  const overallStatus = 'Pending Approval';

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Onboarding & Approval Status" />

      {/* Overall banner */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          padding: '14px 18px',
          borderRadius: 10,
          background: 'rgba(245,158,11,.07)',
          border: '1px solid rgba(245,158,11,.2)',
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 22 }}>⏳</span>
        <div>
          <div
            style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: WHITE, marginBottom: 3 }}
          >
            {overallStatus}
          </div>
          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
            Your application is under review by the DrippleX Operations team. This typically takes
            1–2 business days. You will receive a notification when approved.
          </div>
        </div>
      </div>

      {/* Stepper */}
      <MxCard>
        <SectionHead title="Application Progress" />
        {steps.map((step, i) => {
          const [color, symbol] = STATUS_MAP[step.status];
          const isLast = i === steps.length - 1;
          return (
            <div
              key={step.label}
              style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 20 }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: `${color}18`,
                    border: `2px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: IT,
                    fontSize: 13,
                    fontWeight: 700,
                    color,
                  }}
                >
                  {symbol}
                </div>
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      background: step.status === 'done' ? G2 : BORDER,
                      marginTop: 6,
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, paddingTop: 4, paddingBottom: isLast ? 0 : 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span
                    style={{
                      fontFamily: PP,
                      fontSize: 13,
                      fontWeight: 600,
                      color: step.status === 'locked' ? MUTED : WHITE,
                    }}
                  >
                    {step.label}
                  </span>
                  <OrderStatusChip
                    status={
                      step.status === 'done'
                        ? 'completed'
                        : step.status === 'review'
                          ? 'review'
                          : step.status === 'action'
                            ? 'action'
                            : step.status
                    }
                  />
                </div>
                <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{step.sub}</div>
                {step.status === 'action' && (
                  <MxBtn label="Fix now →" variant="outline" small onClick={() => onNav('kyc')} />
                )}
              </div>
            </div>
          );
        })}
      </MxCard>

      <div style={{ marginTop: 16 }}>
        <InfoBanner
          icon="📞"
          text="Need help? Contact the DrippleX merchant support team at merchants@dripplexapp.com or call +234 800 DRIPPLEX."
          color={'#3B82F6'}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 9 — EARNINGS
// ─────────────────────────────────────────────────────────────────────────────
function EarningsPage() {
  const totalGross = MOCK_SETTLEMENTS.reduce((s, r) => s + r.gross, 0);
  const totalNet = MOCK_SETTLEMENTS.reduce((s, r) => s + r.net, 0);
  const pending = MOCK_SETTLEMENTS.filter((r) => !r.settled).reduce((s, r) => s + r.net, 0);

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Earnings & Settlements" sub="Financial summary for your store" />

      {/* Balance cards */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}
      >
        {[
          {
            label: 'Total Earned (Gross)',
            value: `₦${totalGross.toLocaleString()}`,
            color: WHITE,
            sub: 'all orders',
          },
          {
            label: 'Net Earnings (after 10%)',
            value: `₦${totalNet.toLocaleString()}`,
            color: G3,
            sub: 'your share',
          },
          {
            label: 'Pending Settlement',
            value: `₦${pending.toLocaleString()}`,
            color: C_WARN,
            sub: 'processing by Ops',
          },
        ].map((k) => (
          <MxCard key={k.label} style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginBottom: 8 }}>
              {k.label}
            </div>
            <div style={{ fontFamily: PP, fontWeight: 800, fontSize: 22, color: k.color }}>
              {k.value}
            </div>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 4 }}>{k.sub}</div>
          </MxCard>
        ))}
      </div>

      <InfoBanner
        icon="ℹ️"
        text="Commission is 10% per order, configured by DrippleX Operations. Payouts are administered by Operations during the V1 pilot — you will be notified when each settlement is processed."
        color={'#3B82F6'}
      />

      {/* Settlement table */}
      <MxCard style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontFamily: PP, fontWeight: 600, fontSize: 14, color: WHITE }}>
            Settlement History
          </span>
        </div>
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 100px',
            gap: 0,
            padding: '8px 16px',
            background: NAVY_SURFACE,
          }}
        >
          {['Date', 'Order Ref', 'Gross (₦)', 'Commission', 'Net (₦)', 'Status'].map((h) => (
            <span
              key={h}
              style={{
                fontFamily: IT,
                fontSize: 11,
                color: MUTED,
                fontWeight: 600,
                letterSpacing: 0.4,
              }}
            >
              {h}
            </span>
          ))}
        </div>
        {MOCK_SETTLEMENTS.map((row, i) => (
          <div
            key={row.ref}
            className="mx-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 100px',
              gap: 0,
              padding: '11px 16px',
              borderBottom: i < MOCK_SETTLEMENTS.length - 1 ? `1px solid ${BORDER}` : 'none',
              alignItems: 'center',
            }}
          >
            <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>{row.date}</span>
            <span style={{ fontFamily: IT, fontSize: 12, color: WHITE, fontWeight: 500 }}>
              {row.ref}
            </span>
            <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 600, color: WHITE }}>
              ₦{row.gross.toLocaleString()}
            </span>
            <span style={{ fontFamily: IT, fontSize: 12, color: C_WARN }}>
              −₦{row.commission.toLocaleString()}
            </span>
            <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 700, color: G3 }}>
              ₦{row.net.toLocaleString()}
            </span>
            <MxChip
              label={row.settled ? 'Settled' : 'Pending'}
              color={row.settled ? C_OK : C_WARN}
            />
          </div>
        ))}
      </MxCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 10 — SETTINGS (minimal pilot)
// ─────────────────────────────────────────────────────────────────────────────
function SettingsPage() {
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifSettlements, setNotifSettlements] = useState(true);

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Settings" sub="Account and notification preferences" />
      <div style={{ maxWidth: 480 }}>
        <MxCard style={{ marginBottom: 14 }}>
          <SectionHead title="Notifications" />
          {[
            {
              label: 'New order alerts',
              sub: 'Get notified when a customer places an order',
              val: notifOrders,
              set: setNotifOrders,
            },
            {
              label: 'Settlement alerts',
              sub: 'Get notified when a payout is processed',
              val: notifSettlements,
              set: setNotifSettlements,
            },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <div>
                <div style={{ fontFamily: IT, fontSize: 13, fontWeight: 600, color: WHITE }}>
                  {row.label}
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{row.sub}</div>
              </div>
              <input
                type="checkbox"
                className="mx-toggle"
                checked={row.val}
                onChange={(e) => row.set(e.target.checked)}
              />
            </div>
          ))}
        </MxCard>

        <MxCard>
          <SectionHead title="Account" />
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 2 }}>
              Registered phone
            </div>
            <div style={{ fontFamily: IT, fontSize: 13, color: WHITE }}>+234 803 XXX XXXX</div>
          </div>
          <div style={{ padding: '10px 0', marginBottom: 12 }}>
            <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 2 }}>
              Portal version
            </div>
            <div style={{ fontFamily: IT, fontSize: 13, color: WHITE }}>Merchant Pilot V1</div>
          </div>
          <InfoBanner
            icon="🔒"
            text="To update your account details or close your merchant account, contact the DrippleX Operations team."
            color={'#3B82F6'}
          />
        </MxCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — MERCHANT PORTAL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function MerchantPortalScreen({
  initialPage = 'dashboard',
}: {
  initialPage?: MerchantPage;
}) {
  const [page, setPage] = useState<MerchantPage>(initialPage);
  const [storeOpen, setStoreOpen] = useState(true);
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [detailId, setDetailId] = useState<string | null>(null);

  const newOrderCount = orders.filter((o) => o.status === 'new').length;

  const onDetail = (id: string) => {
    setDetailId(id);
    setPage('orders');
  };

  const renderPage = () => {
    if (page === 'orders' && detailId) {
      return (
        <OrderDetailPage
          orderId={detailId}
          orders={orders}
          setOrders={setOrders}
          onBack={() => setDetailId(null)}
        />
      );
    }
    switch (page) {
      case 'dashboard':
        return (
          <DashboardPage
            onNav={setPage}
            orders={orders}
            storeOpen={storeOpen}
            setStoreOpen={setStoreOpen}
          />
        );
      case 'orders':
        return <OrdersPage orders={orders} setOrders={setOrders} onDetail={onDetail} />;
      case 'products':
        return <ProductsPage products={products} setProducts={setProducts} />;
      case 'store':
        return <StoreSetupPage storeOpen={storeOpen} setStoreOpen={setStoreOpen} />;
      case 'earnings':
        return <EarningsPage />;
      case 'kyc':
        return <MerchantKYCPage />;
      case 'bank':
        return <BankAccountPage />;
      case 'approval':
        return <ApprovalStatusPage onNav={setPage} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: NAVY_BASE,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <MxSidebar
        page={page}
        onNav={(p) => {
          setPage(p);
          setDetailId(null);
        }}
        storeOpen={storeOpen}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <MxHeader page={page} orderBadge={newOrderCount} />
        {renderPage()}
      </div>
    </div>
  );
}

// ─── Thin exports for App.tsx nav ─────────────────────────────────────────────
export const MerchantDashboardScreen = () => <MerchantPortalScreen initialPage="dashboard" />;
export const MerchantOrdersScreen = () => <MerchantPortalScreen initialPage="orders" />;
export const MerchantProductsScreen = () => <MerchantPortalScreen initialPage="products" />;
export const MerchantStoreScreen = () => <MerchantPortalScreen initialPage="store" />;
export const MerchantEarningsScreen = () => <MerchantPortalScreen initialPage="earnings" />;
export const MerchantKYCScreen = () => <MerchantPortalScreen initialPage="kyc" />;
export const MerchantBankScreen = () => <MerchantPortalScreen initialPage="bank" />;
export const MerchantApprovalScreen = () => <MerchantPortalScreen initialPage="approval" />;
