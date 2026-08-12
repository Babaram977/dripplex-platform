import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { auth } from '../lib/auth';
import type {
  MerchantBusinessDto,
  MerchantProductDto,
  MerchantOrderDto,
  MerchantSettlementDto,
  WalletDto,
  MerchantKycDto,
  WalletLedgerEntryDto,
} from '../lib/api';

// ─── Design tokens ────────────────────────────────────────────────────────────
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
type MxStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function apiStatusToMx(s: string): MxStatus {
  switch (s) {
    case 'CONFIRMED':
      return 'new';
    case 'PREPARING':
      return 'preparing';
    case 'READY':
    case 'DRIVER_ASSIGNED':
      return 'ready';
    case 'PICKED_UP':
    case 'IN_TRANSIT':
    case 'DELIVERED':
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'new';
  }
}
function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

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

function OrderStatusChip({ status }: { status: MxStatus | string }) {
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
  options: (string | { value: string; label: string })[];
}) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>{label}</div>
      )}
      <select className="mx-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {items.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
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
const NAV_PRIMARY: { page: MerchantPage; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '⬛', label: 'Dashboard' },
  { page: 'orders', icon: '📦', label: 'Orders' },
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
  businessName,
  newOrderCount,
  onLogout,
}: {
  page: MerchantPage;
  onNav: (p: MerchantPage) => void;
  storeOpen: boolean;
  businessName?: string;
  newOrderCount?: number;
  onLogout?: () => void;
}) {
  const initials = (businessName ?? 'MX').slice(0, 2).toUpperCase();
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
          const badge =
            item.page === 'orders' && (newOrderCount ?? 0) > 0 ? newOrderCount : undefined;
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
              {badge && (
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
                  {badge}
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
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: IT,
                fontSize: 11,
                color: WHITE,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {businessName ?? 'Merchant'}
            </div>
            <div style={{ fontFamily: IT, fontSize: 10, color: MUTED }}>Pilot · Lagos</div>
          </div>
          {onLogout && (
            <button
              className="mx-btn"
              onClick={onLogout}
              title="Sign out"
              style={{
                background: 'none',
                border: 'none',
                color: MUTED,
                fontSize: 14,
                cursor: 'pointer',
                padding: 2,
                flexShrink: 0,
              }}
            >
              ⎋
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
function MxHeader({
  page,
  orderBadge,
  initials,
}: {
  page: MerchantPage;
  orderBadge: number;
  initials?: string;
}) {
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
        {initials ?? 'MX'}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DashboardPage({
  onNav,
  business,
  wallet,
  storeOpen,
  onToggleStore,
}: {
  onNav: (p: MerchantPage) => void;
  business: MerchantBusinessDto | null;
  wallet: WalletDto | null;
  storeOpen: boolean;
  onToggleStore: (open: boolean) => void;
}) {
  const [recentOrders, setRecentOrders] = useState<MerchantOrderDto[]>([]);
  const [products, setProducts] = useState<MerchantProductDto[]>([]);

  useEffect(() => {
    api.merchant
      .getOrders({ pageSize: 20 })
      .then((r) => {
        const res = r as { items?: MerchantOrderDto[] };
        setRecentOrders(res.items ?? []);
      })
      .catch(() => {});
    api.merchant
      .getProducts()
      .then((r) => setProducts(r.items ?? []))
      .catch(() => {});
  }, []);

  const newCount = recentOrders.filter((o) => o.status === 'CONFIRMED').length;
  const balance = wallet?.availableBalance ?? 0;
  const liveProd = products.filter((p) => p.published && p.inStock).length;
  const outStock = products.filter((p) => !p.inStock).length;

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
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
          onChange={(e) => onToggleStore(e.target.checked)}
        />
      </div>

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
            value: String(recentOrders.length),
            sub: `${newCount} new`,
            color: '#3B82F6',
          },
          {
            label: 'Wallet Balance',
            value: `₦${balance.toLocaleString()}`,
            sub: 'available',
            color: G3,
          },
          {
            label: 'Pending Balance',
            value: `₦${(wallet?.pendingBalance ?? 0).toLocaleString()}`,
            sub: 'processing',
            color: G2,
          },
          {
            label: 'Products Live',
            value: String(liveProd),
            sub: outStock > 0 ? `${outStock} out of stock` : 'all in stock',
            color: C_WARN,
          },
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
          {recentOrders.length === 0 ? (
            <div
              style={{
                fontFamily: IT,
                fontSize: 12,
                color: MUTED,
                padding: '16px 0',
                textAlign: 'center',
              }}
            >
              No recent orders
            </div>
          ) : (
            recentOrders.slice(0, 4).map((o) => (
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
                    {o.orderNumber}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                    {o.items.length} item{o.items.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: PP, fontSize: 12, fontWeight: 700, color: WHITE }}>
                    ₦{o.total.toLocaleString()}
                  </div>
                  <OrderStatusChip status={apiStatusToMx(o.status)} />
                </div>
              </div>
            ))
          )}
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
          {products.length === 0 ? (
            <div
              style={{
                fontFamily: IT,
                fontSize: 12,
                color: MUTED,
                padding: '16px 0',
                textAlign: 'center',
              }}
            >
              No products yet
            </div>
          ) : (
            products.slice(0, 5).map((p) => (
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
            ))
          )}
        </MxCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — ORDERS
// ─────────────────────────────────────────────────────────────────────────────
const TAB_STATUS: Record<string, string | undefined> = {
  new: 'CONFIRMED',
  preparing: 'PREPARING',
  ready: 'READY',
  completed: 'COMPLETED',
  all: undefined,
};

function OrdersPage({ onDetail }: { onDetail: (id: string) => void }) {
  const tabs: { key: MxStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready' },
    { key: 'completed', label: 'Completed' },
  ];
  const [activeTab, setActiveTab] = useState<MxStatus | 'all'>('new');
  const [orders, setOrders] = useState<MerchantOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showRejectId, setShowRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async (tab: MxStatus | 'all') => {
    try {
      const res = await api.merchant.getOrders({ status: TAB_STATUS[tab], pageSize: 30 });
      setOrders((res as { items?: MerchantOrderDto[] }).items ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchOrders(activeTab);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchOrders(activeTab), 6000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeTab, fetchOrders]);

  const doAccept = async (id: string) => {
    setActionId(id);
    try {
      await api.merchant.acceptOrder(id);
      fetchOrders(activeTab);
    } catch {}
    setActionId(null);
  };
  const doReject = async () => {
    if (!showRejectId) return;
    setActionId(showRejectId);
    try {
      await api.merchant.rejectOrder(showRejectId, rejectReason || 'Order rejected');
      fetchOrders(activeTab);
    } catch {}
    setActionId(null);
    setShowRejectId(null);
    setRejectReason('');
  };
  const doMarkReady = async (id: string) => {
    setActionId(id);
    try {
      await api.merchant.markReady(id);
      fetchOrders(activeTab);
    } catch {}
    setActionId(null);
  };

  return (
    <div
      className="mx-scroll"
      style={{ flex: 1, overflowY: 'auto', padding: 20, position: 'relative' }}
    >
      <SectionHead title="Incoming Orders" sub="Accept and process customer orders" />

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
        {tabs.map((t) => (
          <button
            key={t.key}
            className="mx-btn"
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === t.key ? NAVY_CARD : 'transparent',
              fontFamily: IT,
              fontSize: 12,
              fontWeight: activeTab === t.key ? 600 : 400,
              color: activeTab === t.key ? WHITE : MUTED,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            color: MUTED,
            fontFamily: IT,
            fontSize: 13,
          }}
        >
          Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontFamily: PP, fontSize: 14, color: MUTED }}>
            No {activeTab === 'all' ? '' : activeTab} orders
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map((o) => {
            const mxStatus = apiStatusToMx(o.status);
            const busy = actionId === o.id;
            const payLabel =
              o.paymentMethod === 'CASH' ? 'CASH' : o.paymentStatus === 'PAID' ? 'PAID' : 'CARD';
            const payColor =
              o.paymentMethod === 'CASH' ? C_WARN : o.paymentStatus === 'PAID' ? C_OK : '#3B82F6';
            return (
              <MxCard key={o.id} style={{ padding: 0, overflow: 'hidden' }}>
                {mxStatus === 'new' && (
                  <div style={{ height: 3, background: `linear-gradient(90deg,${G0},${C_ERR})` }} />
                )}
                <div
                  style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}
                    >
                      <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
                        {o.orderNumber}
                      </span>
                      <OrderStatusChip status={mxStatus} />
                      <MxChip label={payLabel} color={payColor} />
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 2 }}>
                      {o.items.map((i) => `${i.snapshotName} ×${i.quantity}`).join(', ')}
                    </div>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                        🕐 {fmtTime(o.createdAt)}
                      </span>
                      <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                        {o.items.length} item{o.items.length !== 1 ? 's' : ''}
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
                      {mxStatus === 'new' && (
                        <>
                          <MxBtn
                            label="Reject"
                            variant="danger"
                            small
                            disabled={busy}
                            onClick={() => {
                              setShowRejectId(o.id);
                              setRejectReason('');
                            }}
                          />
                          <MxBtn
                            label={busy ? '…' : 'Accept'}
                            variant="primary"
                            small
                            disabled={busy}
                            onClick={() => doAccept(o.id)}
                          />
                        </>
                      )}
                      {mxStatus === 'preparing' && (
                        <MxBtn
                          label={busy ? '…' : 'Mark Ready'}
                          variant="primary"
                          small
                          disabled={busy}
                          onClick={() => doMarkReady(o.id)}
                        />
                      )}
                      <MxBtn label="View" variant="ghost" small onClick={() => onDetail(o.id)} />
                    </div>
                  </div>
                </div>
              </MxCard>
            );
          })}
        </div>
      )}

      {showRejectId && (
        <Modal title="Reject this order?" onClose={() => setShowRejectId(null)}>
          <MxInput
            label="Reason (optional)"
            placeholder="e.g. Item unavailable, store closed"
            value={rejectReason}
            onChange={setRejectReason}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Cancel" variant="outline" onClick={() => setShowRejectId(null)} />
            <MxBtn
              label={actionId === showRejectId ? 'Rejecting…' : 'Yes, Reject'}
              variant="danger"
              disabled={!!actionId}
              onClick={doReject}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 — ORDER DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function OrderDetailPage({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<MerchantOrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState<'reject' | 'ready' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [delayModal, setDelayModal] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState('30');
  const [actionError, setActionError] = useState('');

  const fetchOrder = useCallback(async () => {
    try {
      setOrder((await api.merchant.getOrder(orderId)) as MerchantOrderDto);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const doAction = async (fn: () => Promise<unknown>) => {
    setActionLoading(true);
    setActionError('');
    try {
      await fn();
      await fetchOrder();
      setShowConfirm(null);
      setDelayModal(false);
    } catch (e: unknown) {
      setActionError((e as { message?: string }).message ?? 'Action failed. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading)
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: MUTED,
          fontFamily: IT,
        }}
      >
        Loading order…
      </div>
    );
  if (!order)
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontFamily: PP, fontSize: 14, color: MUTED }}>Could not load order</div>
        <MxBtn label="Retry" variant="outline" onClick={fetchOrder} />
      </div>
    );

  const mxStatus = apiStatusToMx(order.status);
  const subtotal = order.items.reduce((s, i) => s + i.subtotal, 0);
  const payLabel =
    order.paymentMethod === 'CASH'
      ? 'Cash on Delivery'
      : order.paymentStatus === 'PAID'
        ? 'Paid (Card)'
        : 'Card (Pending)';

  const timeline: { label: string; done: boolean; time?: string }[] = [
    { label: 'Order placed', done: true, time: fmtTime(order.createdAt) },
    {
      label: 'Accepted → Preparing',
      done: !!order.confirmedAt,
      time: order.confirmedAt ? fmtTime(order.confirmedAt) : undefined,
    },
    { label: 'Preparing', done: mxStatus === 'ready' || mxStatus === 'completed' },
    {
      label: 'Ready for pickup',
      done: !!order.readyAt,
      time: order.readyAt ? fmtTime(order.readyAt) : undefined,
    },
    {
      label: 'Driver pickup & delivery',
      done: !!order.deliveredAt,
      time: order.deliveredAt ? fmtTime(order.deliveredAt) : undefined,
    },
  ];

  return (
    <div
      className="mx-scroll"
      style={{ flex: 1, overflowY: 'auto', padding: 20, position: 'relative' }}
    >
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
            {order.orderNumber}
          </span>
          <span style={{ marginLeft: 10 }}>
            <OrderStatusChip status={mxStatus} />
          </span>
          <span style={{ marginLeft: 6 }}>
            <MxChip
              label={order.paymentMethod === 'CASH' ? 'CASH' : 'CARD'}
              color={order.paymentMethod === 'CASH' ? C_WARN : '#3B82F6'}
            />
          </span>
        </div>
        {(mxStatus === 'new' || mxStatus === 'preparing') && (
          <MxBtn
            label="Cancel Order"
            variant="danger"
            onClick={() => {
              setShowConfirm('cancel');
              setReason('');
            }}
          />
        )}
      </div>

      {actionError && (
        <div
          style={{
            padding: '9px 14px',
            borderRadius: 8,
            background: 'rgba(239,68,68,.07)',
            border: '1px solid rgba(239,68,68,.2)',
            marginBottom: 14,
          }}
        >
          <span style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{actionError}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        <div>
          <MxCard style={{ marginBottom: 14 }}>
            <SectionHead title="Order Items" />
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <div>
                  <div style={{ fontFamily: IT, fontSize: 13, color: WHITE, fontWeight: 600 }}>
                    {item.snapshotName}
                  </div>
                  <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                    × {item.quantity}
                  </div>
                </div>
                <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
                  ₦{item.subtotal.toLocaleString()}
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
                ₦{order.deliveryFee.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontFamily: IT, fontSize: 12, color: WHITE, fontWeight: 600 }}>
                Total
              </span>
              <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: G3 }}>
                ₦{order.total.toLocaleString()}
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

        <div>
          <MxCard style={{ marginBottom: 14 }}>
            <SectionHead title="Order Actions" />
            {mxStatus === 'new' && (
              <>
                <InfoBanner
                  icon="⏰"
                  text="Accept or reject this order quickly. Unresponded orders may be auto-cancelled."
                  color={C_ERR}
                />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <MxBtn
                    label="Reject"
                    variant="danger"
                    fullWidth
                    disabled={actionLoading}
                    onClick={() => {
                      setShowConfirm('reject');
                      setReason('');
                    }}
                  />
                  <MxBtn
                    label={actionLoading ? '…' : '✓ Accept'}
                    variant="primary"
                    fullWidth
                    disabled={actionLoading}
                    onClick={() => doAction(() => api.merchant.acceptOrder(orderId))}
                  />
                </div>
                <MxBtn
                  label="Delay (need more time)"
                  variant="outline"
                  fullWidth
                  onClick={() => setDelayModal(true)}
                />
              </>
            )}
            {mxStatus === 'preparing' && (
              <>
                <InfoBanner
                  icon="📢"
                  text="Tap 'Mark Ready' when the order is packed and ready for driver pickup."
                  color={G2}
                />
                <MxBtn
                  label={actionLoading ? '…' : 'Mark as Ready ✓'}
                  variant="primary"
                  fullWidth
                  disabled={actionLoading}
                  onClick={() => setShowConfirm('ready')}
                />
                <div style={{ marginTop: 8 }}>
                  <MxBtn
                    label="Delay (need more time)"
                    variant="outline"
                    fullWidth
                    onClick={() => setDelayModal(true)}
                  />
                </div>
              </>
            )}
            {mxStatus === 'ready' && (
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
                  A rider has been notified and is on the way to your store.
                </div>
              </div>
            )}
            {mxStatus === 'completed' && (
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
            {mxStatus === 'cancelled' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>❌</div>
                <div
                  style={{
                    fontFamily: PP,
                    fontSize: 13,
                    fontWeight: 600,
                    color: C_ERR,
                    marginBottom: 4,
                  }}
                >
                  Order cancelled
                </div>
                {order.cancellationReason && (
                  <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                    {order.cancellationReason}
                  </div>
                )}
              </div>
            )}
          </MxCard>

          <MxCard>
            <SectionHead title="Delivery Info" />
            {[
              ['Payment', payLabel],
              ['Order time', fmtDate(order.createdAt)],
              ['Items', `${order.items.length} item${order.items.length !== 1 ? 's' : ''}`],
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

      {showConfirm === 'reject' && (
        <Modal title="Reject this order?" onClose={() => setShowConfirm(null)}>
          <MxInput
            label="Reason (optional)"
            placeholder="e.g. Item unavailable"
            value={reason}
            onChange={setReason}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Cancel" variant="outline" onClick={() => setShowConfirm(null)} />
            <MxBtn
              label={actionLoading ? 'Rejecting…' : 'Yes, Reject'}
              variant="danger"
              disabled={actionLoading}
              onClick={() =>
                doAction(() => api.merchant.rejectOrder(orderId, reason || 'Order rejected'))
              }
            />
          </div>
        </Modal>
      )}
      {showConfirm === 'ready' && (
        <Modal title="Mark order as ready?" onClose={() => setShowConfirm(null)}>
          <p
            style={{
              fontFamily: IT,
              fontSize: 13,
              color: MUTED,
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            This will notify the assigned rider to pick up the order. Make sure it is fully packed.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Cancel" variant="outline" onClick={() => setShowConfirm(null)} />
            <MxBtn
              label={actionLoading ? '…' : 'Yes, Mark Ready'}
              variant="primary"
              disabled={actionLoading}
              onClick={() => doAction(() => api.merchant.markReady(orderId))}
            />
          </div>
        </Modal>
      )}
      {showConfirm === 'cancel' && (
        <Modal title="Cancel this order?" onClose={() => setShowConfirm(null)}>
          <MxInput
            label="Reason (optional)"
            placeholder="e.g. Out of stock, store closing"
            value={reason}
            onChange={setReason}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Back" variant="outline" onClick={() => setShowConfirm(null)} />
            <MxBtn
              label={actionLoading ? 'Cancelling…' : 'Yes, Cancel Order'}
              variant="danger"
              disabled={actionLoading}
              onClick={() => doAction(() => api.merchant.cancelOrder(orderId, reason || undefined))}
            />
          </div>
        </Modal>
      )}
      {delayModal && (
        <Modal title="Delay — need more time?" onClose={() => setDelayModal(false)}>
          <p
            style={{
              fontFamily: IT,
              fontSize: 12,
              color: MUTED,
              marginBottom: 14,
              lineHeight: 1.55,
            }}
          >
            Enter how many more minutes you need. The customer will be informed.
          </p>
          <MxInput
            label="Additional minutes"
            placeholder="e.g. 30"
            value={delayMinutes}
            onChange={setDelayMinutes}
            type="number"
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Cancel" variant="outline" onClick={() => setDelayModal(false)} />
            <MxBtn
              label={actionLoading ? '…' : 'Confirm Delay'}
              variant="primary"
              disabled={actionLoading || !delayMinutes}
              onClick={() => {
                const mins = parseInt(delayMinutes, 10) || 30;
                const at = new Date(Date.now() + mins * 60000).toISOString();
                doAction(() => api.merchant.delayOrder(orderId, { estimatedReadyAt: at }));
              }}
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
function ProductsPage() {
  const [products, setProducts] = useState<MerchantProductDto[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    basePrice: '',
    sku: '',
    description: '',
  });
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);
  // Variant editor (only meaningful once a product exists).
  const [variantDraft, setVariantDraft] = useState({ name: '', priceOverride: '', sku: '' });
  const [variantBusy, setVariantBusy] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      setProducts((await api.merchant.getProducts()).items ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    api.marketplace
      .getCategories()
      .then((cs) => setCategories(cs.map((c) => ({ value: c.id, label: c.name }))))
      .catch(() => setCategories([]));
  }, [fetchProducts]);

  const catName = (id: string | null) =>
    categories.find((c) => c.value === id)?.label ?? (id ? 'Uncategorized' : 'Uncategorized');

  // The product currently open in the editor (for its live variant list).
  const editing = editId ? (products.find((p) => p.id === editId) ?? null) : null;

  const openAdd = () => {
    setForm({ name: '', categoryId: '', basePrice: '', sku: '', description: '' });
    setVariantDraft({ name: '', priceOverride: '', sku: '' });
    setSaveErr('');
    setEditId(null);
    setShowAdd(true);
  };
  const openEdit = (p: MerchantProductDto) => {
    setForm({
      name: p.name,
      categoryId: p.categoryId ?? '',
      basePrice: String(p.basePrice),
      sku: p.sku ?? '',
      description: p.description ?? '',
    });
    setVariantDraft({ name: '', priceOverride: '', sku: '' });
    setSaveErr('');
    setEditId(p.id);
    setShowAdd(true);
  };

  const saveProduct = async () => {
    if (!form.name || !form.basePrice) return;
    setSaving(true);
    setSaveErr('');
    try {
      if (editId) {
        await api.merchant.updateProduct(editId, {
          name: form.name,
          categoryId: form.categoryId || undefined,
          basePrice: Number(form.basePrice),
          sku: form.sku || undefined,
          description: form.description || undefined,
        });
      } else {
        await api.merchant.createProduct({
          name: form.name,
          categoryId: form.categoryId || undefined,
          basePrice: Number(form.basePrice),
          sku: form.sku || undefined,
          description: form.description || undefined,
        });
      }
      await fetchProducts();
      // Close on success. Variants are managed by re-opening Edit (they persist
      // immediately via their own Add/Remove), so there's no half-saved state.
      setShowAdd(false);
      setEditId(null);
    } catch (e: unknown) {
      setSaveErr((e as { message?: string }).message ?? 'Could not save the product. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Publish state is a status transition; stock is inventory.manuallyDisabled.
  const toggle = async (p: MerchantProductDto, field: 'inStock' | 'published') => {
    const next = !p[field];
    setProducts((ps) => ps.map((x) => (x.id === p.id ? { ...x, [field]: next } : x)));
    try {
      if (field === 'published') {
        await (next ? api.merchant.publishProduct(p.id) : api.merchant.unpublishProduct(p.id));
      } else {
        // next=true means "in stock" → not out of stock.
        await api.merchant.setProductStock(p.id, !next);
      }
    } catch {
      fetchProducts();
    }
  };

  const addVariant = async () => {
    if (!editId || !variantDraft.name) return;
    setVariantBusy(true);
    try {
      await api.merchant.createVariant(editId, {
        name: variantDraft.name,
        sku: variantDraft.sku || undefined,
        priceOverride: variantDraft.priceOverride ? Number(variantDraft.priceOverride) : undefined,
      });
      setVariantDraft({ name: '', priceOverride: '', sku: '' });
      await fetchProducts();
    } catch {
    } finally {
      setVariantBusy(false);
    }
  };

  const removeVariant = async (variantId: string) => {
    if (!editId) return;
    setVariantBusy(true);
    try {
      await api.merchant.deleteVariant(editId, variantId);
      await fetchProducts();
    } catch {
    } finally {
      setVariantBusy(false);
    }
  };

  const deleteProduct = async (id: string) => {
    setShowDeleteId(null);
    setProducts((ps) => ps.filter((p) => p.id !== id));
    try {
      await api.merchant.deleteProduct(id);
    } catch {
      fetchProducts();
    }
  };

  return (
    <div
      className="mx-scroll"
      style={{ flex: 1, overflowY: 'auto', padding: 20, position: 'relative' }}
    >
      <SectionHead
        title="Products & Catalogue"
        sub={
          loading
            ? 'Loading…'
            : `${products.filter((p) => p.published).length} published · ${products.filter((p) => !p.inStock).length} out of stock`
        }
        action={<MxBtn label="+ Add Product" variant="primary" onClick={openAdd} />}
      />

      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 0',
            color: MUTED,
            fontFamily: IT,
            fontSize: 13,
          }}
        >
          Loading products…
        </div>
      ) : products.length === 0 ? (
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
                  background: p.imageUrl ? 'transparent' : NAVY_SURFACE,
                  backgroundImage: p.imageUrl ? `url(${p.imageUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                }}
              >
                {!p.imageUrl && '🍛'}
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
                    <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                      {catName(p.categoryId)}
                      {p.variants.length > 0
                        ? ` · ${p.variants.length} variant${p.variants.length > 1 ? 's' : ''}`
                        : ''}
                    </div>
                  </div>
                  <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: G3 }}>
                    ₦{p.basePrice.toLocaleString()}
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
                      onChange={() => toggle(p, 'inStock')}
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
                      onChange={() => toggle(p, 'published')}
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
            value={form.categoryId}
            onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
            options={categories}
          />
          <MxInput
            label="Base price (₦) *"
            placeholder="e.g. 1800"
            value={form.basePrice}
            onChange={(v) => setForm((f) => ({ ...f, basePrice: v }))}
            type="number"
          />
          <MxInput
            label="SKU (optional)"
            placeholder="e.g. JOL-001"
            value={form.sku}
            onChange={(v) => setForm((f) => ({ ...f, sku: v }))}
          />
          <MxInput
            label="Description (optional)"
            placeholder="Brief description"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          />

          {/* Variants — base price + per-variant price overrides. Only available
              once the product exists (variants attach to a product id). */}
          {editId ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                marginBottom: 16,
              }}
            >
              <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
                Variants
              </div>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginBottom: 10 }}>
                Add sizes or options. Leave price blank to use the base price.
              </div>
              {editing && editing.variants.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {editing.variants.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '7px 10px',
                        borderRadius: 7,
                        background: NAVY_CARD,
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <span style={{ fontFamily: IT, fontSize: 12, color: WHITE }}>
                        {v.name}
                        {v.sku ? ` · ${v.sku}` : ''}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 600, color: G3 }}>
                          {v.priceOverride != null
                            ? `₦${v.priceOverride.toLocaleString()}`
                            : 'Base price'}
                        </span>
                        <button
                          onClick={() => removeVariant(v.id)}
                          disabled={variantBusy}
                          style={{
                            fontFamily: IT,
                            fontSize: 11,
                            color: C_ERR,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginBottom: 10 }}>
                  No variants yet.
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <div style={{ flex: 2 }}>
                  <MxInput
                    label="Name"
                    placeholder="e.g. Large"
                    value={variantDraft.name}
                    onChange={(v) => setVariantDraft((d) => ({ ...d, name: v }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <MxInput
                    label="Price ₦"
                    placeholder="opt."
                    value={variantDraft.priceOverride}
                    onChange={(v) => setVariantDraft((d) => ({ ...d, priceOverride: v }))}
                    type="number"
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <MxBtn
                    label={variantBusy ? '…' : 'Add'}
                    variant="outline"
                    small
                    disabled={!variantDraft.name || variantBusy}
                    onClick={addVariant}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                marginBottom: 16,
              }}
            >
              <div style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                Save the product first to add size/price variants and manage images.
              </div>
            </div>
          )}
          {saveErr && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 7,
                background: 'rgba(239,68,68,.07)',
                border: '1px solid rgba(239,68,68,.2)',
                marginBottom: 12,
              }}
            >
              <span style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{saveErr}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <MxBtn label="Cancel" variant="outline" onClick={() => setShowAdd(false)} />
            <MxBtn
              label={saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Product'}
              variant="primary"
              disabled={!form.name || !form.basePrice || saving}
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
            This product will be permanently removed from your catalogue.
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
  onToggleStore,
  business,
}: {
  storeOpen: boolean;
  onToggleStore: (v: boolean) => void;
  business: MerchantBusinessDto | null;
}) {
  const [storeName, setStoreName] = useState(business?.businessName ?? '');
  const [category, setCategory] = useState(business?.businessType ?? 'Local Food');
  const [description, setDescription] = useState(business?.description ?? '');
  const [address, setAddress] = useState(business?.address ?? '');
  const [openTime, setOpenTime] = useState(business?.openingTime ?? '08:00');
  const [closeTime, setCloseTime] = useState(business?.closingTime ?? '21:00');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const CATS = [
    'Local Food',
    'Fast Food',
    'Pastry & Bakery',
    'Drinks & Beverages',
    'Groceries',
    'Pharmacy',
    'Other',
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.merchant.updateBusiness({
        businessName: storeName,
        description: description || undefined,
        address: address || undefined,
        openingTime: openTime,
        closingTime: closeTime,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
    } finally {
      setSaving(false);
    }
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
                Map pin
              </div>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                {address || 'No address set'}
              </div>
            </div>
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
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 20 }}>🖼️</span>
                <span style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                  Cover image — not available in pilot
                </span>
              </div>
            </div>
          </div>
        </MxCard>

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
              onChange={(e) => onToggleStore(e.target.checked)}
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
            <MxBtn
              label={saving ? 'Saving…' : 'Save Changes'}
              variant="primary"
              disabled={saving}
              onClick={handleSave}
            />
          </div>
        </MxCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 6 — MERCHANT KYC
// ─────────────────────────────────────────────────────────────────────────────
const KYC_META: Record<string, { label: string; desc: string; icon: string; required: boolean }> = {
  CAC_CERTIFICATE: {
    label: 'CAC Certificate',
    desc: 'Business registration certificate',
    icon: '📋',
    required: true,
  },
  DIRECTOR_NIN: {
    label: 'Director NIN / ID',
    desc: 'National Identity Number or valid government ID',
    icon: '🪪',
    required: true,
  },
  UTILITY_BILL: {
    label: 'Utility Bill',
    desc: 'Recent utility bill showing business address',
    icon: '📄',
    required: true,
  },
  BUSINESS_PHOTO: {
    label: 'Business Premises Photo',
    desc: 'Photo of your store/premises exterior',
    icon: '🖼️',
    required: false,
  },
};
const KYC_FALLBACK = [
  { type: 'CAC_CERTIFICATE', status: 'NOT_SUBMITTED', uploadedAt: null, rejectionReason: null },
  { type: 'DIRECTOR_NIN', status: 'NOT_SUBMITTED', uploadedAt: null, rejectionReason: null },
  { type: 'UTILITY_BILL', status: 'NOT_SUBMITTED', uploadedAt: null, rejectionReason: null },
  { type: 'BUSINESS_PHOTO', status: 'NOT_SUBMITTED', uploadedAt: null, rejectionReason: null },
];

function MerchantKYCPage() {
  const [kyc, setKyc] = useState<MerchantKycDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const fetchKyc = useCallback(async () => {
    try {
      setKyc((await api.merchant.getKyc()) as MerchantKycDto);
    } catch {
      setKyc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKyc();
  }, [fetchKyc]);

  const handleUpload = async (documentType: string) => {
    setUploadingType(documentType);
    try {
      await api.merchant.submitKycDoc({
        documentType,
        frontImageUrl: 'https://placehold.co/800x600/0A1628/2BAC52?text=Document',
      });
      await fetchKyc();
    } catch {}
    setUploadingType(null);
  };

  const docs = kyc?.documents ?? KYC_FALLBACK;
  const required = docs.filter((d) => KYC_META[d.type]?.required);
  const done = required.filter((d) => d.status === 'VERIFIED').length;
  const total = required.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const overallStatus = kyc?.overallStatus?.toLowerCase() ?? 'pending';

  const uiStatus = (s: string) => {
    switch (s.toUpperCase()) {
      case 'VERIFIED':
        return 'verified';
      case 'PENDING_REVIEW':
        return 'review';
      case 'REJECTED':
        return 'rejected';
      case 'SUBMITTED':
        return 'uploaded';
      default:
        return 'pending';
    }
  };

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Merchant KYC" sub="Submit required documents to verify your business" />

      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            color: MUTED,
            fontFamily: IT,
            fontSize: 13,
          }}
        >
          Loading KYC status…
        </div>
      ) : (
        <>
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
            text="Your documents are encrypted and stored securely. DrippleX does not share your KYC documents with third parties."
            color={G2}
          />

          {docs.map((doc) => {
            const meta = KYC_META[doc.type] ?? {
              label: doc.type,
              desc: '',
              icon: '📄',
              required: false,
            };
            const st = uiStatus(doc.status);
            const busy = uploadingType === doc.type;
            return (
              <MxCard key={doc.type} style={{ marginBottom: 10 }}>
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
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: WHITE }}>
                        {meta.label}
                      </span>
                      {meta.required && (
                        <span style={{ fontFamily: IT, fontSize: 10, color: C_ERR }}>Required</span>
                      )}
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{meta.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <OrderStatusChip status={st} />
                    {st !== 'verified' && (
                      <MxBtn
                        label={
                          busy
                            ? 'Uploading…'
                            : st === 'uploaded' || st === 'review'
                              ? 'Replace'
                              : 'Upload'
                        }
                        variant={st === 'rejected' ? 'danger' : 'primary'}
                        small
                        disabled={busy}
                        onClick={() => handleUpload(doc.type)}
                      />
                    )}
                  </div>
                </div>
                {doc.rejectionReason && (
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
                      ⚠️ Rejected: {doc.rejectionReason}
                    </span>
                  </div>
                )}
              </MxCard>
            );
          })}
        </>
      )}
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
            text="During the V1 pilot, all merchant payouts are administered by the DrippleX Operations team."
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
    { label: 'Business Setup', sub: 'Store name, address, category', status: 'done' },
    { label: 'KYC Documents', sub: 'Identity & business verification', status: 'done' },
    { label: 'Bank Account', sub: 'Settlement destination account', status: 'done' },
    {
      label: 'Operations Approval',
      sub: 'DrippleX team reviews your application',
      status: 'review',
    },
    { label: 'Store Activation', sub: 'Begin accepting orders', status: 'locked' },
  ];
  const STATUS_MAP: Record<string, [string, string]> = {
    done: [C_OK, '✓'],
    review: [C_WARN, '⏳'],
    action: [C_ERR, '!'],
    locked: [MUTED, '○'],
    rejected: [C_ERR, '✕'],
  };

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Onboarding & Approval Status" />
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
            Pending Approval
          </div>
          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
            Your application is under review by the DrippleX Operations team. This typically takes
            1–2 business days.
          </div>
        </div>
      </div>
      <MxCard>
        <SectionHead title="Application Progress" />
        {steps.map((step, i) => {
          const [color, symbol] = STATUS_MAP[step.status] ?? [MUTED, '○'];
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
  const [settlements, setSettlements] = useState<MerchantSettlementDto[]>([]);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [txns, setTxns] = useState<WalletLedgerEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'settlements' | 'wallet'>('settlements');

  useEffect(() => {
    Promise.all([
      api.merchant
        .getSettlements()
        .then((r) => setSettlements(r.items ?? []))
        .catch(() => {}),
      api.merchant
        .getWallet()
        .then((r) => setWallet(r as WalletDto))
        .catch(() => {}),
      api.merchant
        .getWalletTransactions({ pageSize: 20 })
        .then((r) => {
          setTxns((r as { items?: WalletLedgerEntryDto[] }).items ?? []);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const totalGross = settlements.reduce((s, r) => s + r.grossAmount, 0);
  const totalNet = settlements.reduce((s, r) => s + r.netAmount, 0);
  const pending = settlements
    .filter((r) => r.status === 'PENDING')
    .reduce((s, r) => s + r.netAmount, 0);

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Earnings & Settlements" sub="Financial summary for your store" />

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
            label: 'Wallet Balance',
            value: wallet ? `₦${wallet.availableBalance.toLocaleString()}` : '—',
            color: G3,
            sub: 'available now',
          },
          {
            label: 'Pending',
            value: wallet ? `₦${wallet.pendingBalance.toLocaleString()}` : '—',
            color: C_WARN,
            sub: 'being processed',
          },
          {
            label: 'Total Gross (Orders)',
            value: loading ? '…' : `₦${totalGross.toLocaleString()}`,
            color: WHITE,
            sub: 'all settlements',
          },
          {
            label: 'Total Net (after 10%)',
            value: loading ? '…' : `₦${totalNet.toLocaleString()}`,
            color: G2,
            sub: 'your share',
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
        text="Commission is 10% per order. Payouts are administered by Operations during the V1 pilot."
        color={'#3B82F6'}
      />

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
        {(['settlements', 'wallet'] as const).map((t) => (
          <button
            key={t}
            className="mx-btn"
            onClick={() => setTab(t)}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: tab === t ? NAVY_CARD : 'transparent',
              fontFamily: IT,
              fontSize: 12,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? WHITE : MUTED,
            }}
          >
            {t === 'settlements' ? 'Settlement History' : 'Wallet Transactions'}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            color: MUTED,
            fontFamily: IT,
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      ) : tab === 'settlements' ? (
        settlements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
            <div style={{ fontFamily: PP, fontSize: 14, color: MUTED }}>No settlements yet</div>
          </div>
        ) : (
          <MxCard style={{ padding: 0, overflow: 'hidden' }}>
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
            {settlements.map((row, i) => (
              <div
                key={row.id}
                className="mx-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 100px',
                  gap: 0,
                  padding: '11px 16px',
                  borderBottom: i < settlements.length - 1 ? `1px solid ${BORDER}` : 'none',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                  {fmtDate(row.createdAt)}
                </span>
                <span style={{ fontFamily: IT, fontSize: 12, color: WHITE, fontWeight: 500 }}>
                  {row.orderId.slice(0, 8).toUpperCase()}
                </span>
                <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 600, color: WHITE }}>
                  ₦{row.grossAmount.toLocaleString()}
                </span>
                <span style={{ fontFamily: IT, fontSize: 12, color: C_WARN }}>
                  −₦{row.commissionAmount.toLocaleString()}
                </span>
                <span style={{ fontFamily: PP, fontSize: 12, fontWeight: 700, color: G3 }}>
                  ₦{row.netAmount.toLocaleString()}
                </span>
                <MxChip
                  label={row.status === 'SETTLED' ? 'Settled' : 'Pending'}
                  color={row.status === 'SETTLED' ? C_OK : C_WARN}
                />
              </div>
            ))}
          </MxCard>
        )
      ) : txns.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontFamily: PP, fontSize: 14, color: MUTED }}>
            No wallet transactions yet
          </div>
        </div>
      ) : (
        <MxCard style={{ padding: 0, overflow: 'hidden' }}>
          {txns.map((t, i) => (
            <div
              key={t.id}
              className="mx-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderBottom: i < txns.length - 1 ? `1px solid ${BORDER}` : 'none',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background:
                    t.direction === 'CREDIT' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {t.direction === 'CREDIT' ? '↓' : '↑'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: IT, fontSize: 12, fontWeight: 600, color: WHITE }}>
                  {t.description ?? t.type}
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                  {fmtDate(t.createdAt)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: PP,
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.direction === 'CREDIT' ? C_OK : C_ERR,
                  }}
                >
                  {t.direction === 'CREDIT' ? '+' : '−'}₦{t.amount.toLocaleString()}
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                  Bal: ₦{t.balanceAfter.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </MxCard>
      )}

      {!loading && pending > 0 && (
        <div style={{ marginTop: 14 }}>
          <InfoBanner
            icon="⏳"
            text={`₦${pending.toLocaleString()} in settlements are being processed by the DrippleX Operations team.`}
            color={C_WARN}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 10 — SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
function SettingsPage() {
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifSettlements, setNotifSettlements] = useState(true);
  const user = auth.getUser();

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
            <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 2 }}>Email</div>
            <div style={{ fontFamily: IT, fontSize: 13, color: WHITE }}>{user?.email ?? '—'}</div>
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
// LOGIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function MerchantLoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('dxresto@dripplex.demo');
  const [password, setPassword] = useState('Dripplex#Demo1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.loginMerchant({ email, password });
      const r = res as {
        accessToken?: string;
        refreshToken?: string;
        user?: Record<string, unknown>;
      };
      if (r.accessToken && r.refreshToken) auth.setTokens(r.accessToken, r.refreshToken);
      if (r.user) auth.setUser(r.user as Parameters<typeof auth.setUser>[0]);
      onLogin();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: NAVY_BASE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: `linear-gradient(135deg,${G0},${G3})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              color: NAVY_DEEP,
              margin: '0 auto 12px',
              fontFamily: PP,
            }}
          >
            D
          </div>
          <div style={{ fontFamily: PP, fontWeight: 700, fontSize: 20, color: WHITE }}>
            DrippleX Merchant Portal
          </div>
          <div style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginTop: 6 }}>
            Sign in to manage your store
          </div>
        </div>
        <MxCard style={{ padding: 24 }}>
          <MxInput
            label="Email address"
            placeholder="merchant@example.com"
            value={email}
            onChange={setEmail}
            type="email"
          />
          <MxInput
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={setPassword}
            type="password"
          />
          {error && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 7,
                background: 'rgba(239,68,68,.07)',
                border: '1px solid rgba(239,68,68,.2)',
                marginBottom: 14,
              }}
            >
              <span style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{error}</span>
            </div>
          )}
          <MxBtn
            label={loading ? 'Signing in…' : 'Sign In'}
            variant="primary"
            fullWidth
            disabled={loading || !email || !password}
            onClick={handleLogin}
          />
          <div
            style={{
              fontFamily: IT,
              fontSize: 11,
              color: MUTED,
              textAlign: 'center',
              marginTop: 14,
            }}
          >
            Demo: dxresto@dripplex.demo · Dripplex#Demo1
          </div>
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
  // Only treat the session as "signed in" when it's actually a MERCHANT. A
  // leftover customer/other session would otherwise skip the merchant login and
  // render an empty dashboard whose merchant API calls all 403.
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const u = auth.getUser();
    return !!u && u.roles.includes('merchant');
  });
  const [page, setPage] = useState<MerchantPage>(initialPage);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [business, setBusiness] = useState<MerchantBusinessDto | null>(null);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const badgePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPortalData = useCallback(async () => {
    try {
      const b = (await api.merchant.getBusiness()) as MerchantBusinessDto;
      setBusiness(b);
      setStoreOpen(b.isOpen);
    } catch {}
    try {
      setWallet((await api.merchant.getWallet()) as WalletDto);
    } catch {}
  }, []);

  const pollNewOrders = useCallback(async () => {
    try {
      const r = await api.merchant.getOrders({ status: 'CONFIRMED', pageSize: 1 });
      const res = r as { total?: number; items?: unknown[] };
      setNewOrderCount(res.total ?? res.items?.length ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadPortalData();
    pollNewOrders();
    badgePollRef.current = setInterval(pollNewOrders, 8000);
    return () => {
      if (badgePollRef.current) clearInterval(badgePollRef.current);
    };
  }, [isLoggedIn, loadPortalData, pollNewOrders]);

  const handleToggleStore = async (open: boolean) => {
    try {
      if (open) await api.merchant.resumeStore();
      else await api.merchant.pauseStore();
      setStoreOpen(open);
      if (business) setBusiness({ ...business, isOpen: open });
    } catch {}
  };

  const handleLogout = () => {
    if (badgePollRef.current) clearInterval(badgePollRef.current);
    auth.clear();
    setIsLoggedIn(false);
    setBusiness(null);
    setWallet(null);
  };

  if (!isLoggedIn) return <MerchantLoginScreen onLogin={() => setIsLoggedIn(true)} />;

  const businessName = business?.businessName ?? 'Merchant';
  const initials = businessName.slice(0, 2).toUpperCase();
  const onDetail = (id: string) => {
    setDetailId(id);
    setPage('orders');
  };

  const renderPage = () => {
    if (page === 'orders' && detailId) {
      return <OrderDetailPage orderId={detailId} onBack={() => setDetailId(null)} />;
    }
    switch (page) {
      case 'dashboard':
        return (
          <DashboardPage
            onNav={setPage}
            business={business}
            wallet={wallet}
            storeOpen={storeOpen}
            onToggleStore={handleToggleStore}
          />
        );
      case 'orders':
        return <OrdersPage onDetail={onDetail} />;
      case 'products':
        return <ProductsPage />;
      case 'store':
        return (
          <StoreSetupPage
            storeOpen={storeOpen}
            onToggleStore={handleToggleStore}
            business={business}
          />
        );
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
        businessName={businessName}
        newOrderCount={newOrderCount}
        onLogout={handleLogout}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <MxHeader page={page} orderBadge={newOrderCount} initials={initials} />
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
