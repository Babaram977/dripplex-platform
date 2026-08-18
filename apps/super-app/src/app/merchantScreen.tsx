import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, uploadFile } from '../lib/api';
import { auth } from '../lib/auth';
import { addressPredictions, geocodeAddress, getCurrentPosition } from '../lib/maps';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import { playNotificationSound } from '../lib/sound';
import { SoundSettings } from './soundSettings';
import type {
  MerchantBusinessDto,
  MerchantProductDto,
  MerchantOrderDto,
  MerchantSettlementDto,
  WalletDto,
  MerchantKycDto,
  MerchantKycStatusDto,
  MerchantBankAccountDto,
  OrderPaymentProofDto,
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
    /* Poppins and Inter come from the <link> in index.html. Re-importing them
       from a <style> injected at mount cost a third round trip for faces the
       page already had, and this copy asked for a narrower weight range than
       the app uses — so merchant screens re-fetched fonts only to end up with
       fewer weights than the customer app. */
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
    .mx-select { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 8px; color: #fff; font-family: Inter, sans-serif; font-size: 13px; padding: 9px 12px; outline: none; cursor: pointer; width: 100%; box-sizing: border-box; color-scheme: dark; }
    .mx-select option { background: #0F1A2E; color: #fff; }
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
    // Green: an incoming order is work arriving, not an error.
    new: [G3, 'New Order'],
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

// A read-only labelled value — used for fields that come from registration and
// must not be re-entered (Business Name, Business Type).
function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>{label}</div>
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: NAVY_SURFACE,
          border: `1px solid ${BORDER}`,
          fontFamily: IT,
          fontSize: 13,
          color: WHITE,
          fontWeight: 500,
        }}
      >
        {value || '—'}
      </div>
      {hint && (
        <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

function businessTypeLabel(bt: string | undefined | null): string {
  switch (bt) {
    case 'SOLE_PROPRIETORSHIP':
      return 'Sole Proprietorship';
    case 'PARTNERSHIP':
      return 'Partnership';
    case 'LIMITED_LIABILITY':
      return 'Limited Liability';
    case 'CORPORATION':
      return 'Corporation';
    case 'OTHER':
      return 'Other';
    default:
      return bt ?? '—';
  }
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
                    background: G2,
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
                background: G3,
                opacity: 0.7,
              }}
            />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: G3 }} />
          </div>
          {/* A new order is good news, not a fault. This pulsed red — the same
              colour the portal uses for rejected, suspended and action-required
              — so a busy shop looked like a shop in trouble. */}
          <span style={{ fontFamily: IT, fontSize: 12, color: G3, fontWeight: 600 }}>
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
  const [kyc, setKyc] = useState<MerchantKycStatusDto | null>(null);

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
    api.merchant
      .getKyc()
      .then((r) => setKyc(r))
      .catch(() => {});
  }, []);

  const newCount = recentOrders.filter((o) => o.status === 'CONFIRMED').length;
  const balance = wallet?.availableBalance ?? 0;
  const liveProd = products.filter((p) => p.published && p.inStock).length;
  const outStock = products.filter((p) => !p.inStock).length;

  // Verification nudge: a merchant can't go live until Ops verifies the business,
  // which needs KYC documents submitted first. Surface exactly what's outstanding
  // right on the dashboard so a freshly-registered merchant knows to act. Hidden
  // once the business is VERIFIED.
  const kycLatest = kyc?.latest ?? null;
  const hasKyc = (kyc?.items?.length ?? 0) > 0;
  const kycRejected = kycLatest?.verificationStatus === 'REJECTED';
  const businessVerified = business?.verificationStatus === 'VERIFIED';
  const verifyNudge = businessVerified
    ? null
    : !hasKyc || kycRejected
      ? {
          bg: 'rgba(239,68,68,.08)',
          bd: 'rgba(239,68,68,.25)',
          icon: '🪪',
          title: kycRejected ? 'Re-submit your KYC documents' : 'Submit your KYC to go live',
          body: kycRejected
            ? 'A document was rejected during review. Please check the notes and submit again.'
            : 'Your store stays offline until DrippleX verifies your business. Upload your identity & business documents to enter the review queue.',
          cta: kycRejected ? 'Re-submit documents →' : 'Submit KYC documents →',
        }
      : {
          bg: 'rgba(245,158,11,.08)',
          bd: 'rgba(245,158,11,.25)',
          icon: '⏳',
          title: 'KYC under review',
          body: 'Your documents are with the DrippleX Operations team. This typically takes 1–2 business days.',
          cta: 'View approval status →',
        };

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      {verifyNudge && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 10,
            background: verifyNudge.bg,
            border: `1px solid ${verifyNudge.bd}`,
            marginBottom: 18,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{verifyNudge.icon}</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: PP,
                fontSize: 13,
                fontWeight: 700,
                color: WHITE,
                marginBottom: 3,
              }}
            >
              {verifyNudge.title}
            </div>
            <div
              style={{
                fontFamily: IT,
                fontSize: 12,
                color: MUTED,
                lineHeight: 1.55,
                marginBottom: 8,
              }}
            >
              {verifyNudge.body}
            </div>
            <MxBtn
              label={verifyNudge.cta}
              variant="outline"
              small
              onClick={() => onNav(verifyNudge.cta.startsWith('View') ? 'approval' : 'kyc')}
            />
          </div>
        </div>
      )}
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
            background: 'rgba(43,172,82,.07)',
            border: '1.5px solid rgba(43,172,82,.3)',
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
                background: G3,
                opacity: 0.7,
              }}
            />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: G3 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
              {newCount} new order{newCount > 1 ? 's' : ''} waiting
            </div>
            <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
              Tap to review and accept
            </div>
          </div>
          <span style={{ fontFamily: IT, fontSize: 12, color: G3 }}>View →</span>
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
/**
 * Which backend order statuses belong under each tab.
 *
 * This used to be a single status per tab passed to the server as a filter,
 * while the status CHIP was rendered from apiStatusToMx() — two different
 * opinions about the same thing, and they disagreed. The moment dispatch
 * assigned a rider, a READY order became DRIVER_ASSIGNED: the Ready tab asked
 * the server for READY and no longer matched it, and Completed asked for
 * COMPLETED and did not match it either, so an order the merchant had just
 * marked ready vanished from every tab except All. Same for DELIVERED, which
 * sat in no tab until the completion sweep moved it to COMPLETED.
 *
 * So the tabs now filter on exactly the statuses they claim, and this map is
 * the only place that decides. Nothing is filtered server-side, which is what
 * let the two views drift apart in the first place.
 */
const TAB_STATUSES: Record<string, readonly string[]> = {
  new: ['CONFIRMED'],
  preparing: ['PREPARING'],
  ready: ['READY', 'DRIVER_ASSIGNED'],
  completed: ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'],
  all: [],
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
  // DPX-ORDER-PROOF-001 — which order's receipts are open, and what they are.
  // `null` proofs with an id set means "still loading".
  const [proofsOrderId, setProofsOrderId] = useState<string | null>(null);
  const [proofs, setProofs] = useState<OrderPaymentProofDto[] | null>(null);
  const [proofsErr, setProofsErr] = useState('');
  const [showRejectId, setShowRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async (tab: MxStatus | 'all') => {
    try {
      // One unfiltered read, filtered here. The list query takes a single
      // status (max pageSize 100), and a tab like Ready spans two — asking the
      // server for one of them is exactly how orders went missing.
      const res = await api.merchant.getOrders({ pageSize: 100 });
      const items = (res as { items?: MerchantOrderDto[] }).items ?? [];
      const wanted = TAB_STATUSES[tab] ?? [];
      setOrders(wanted.length === 0 ? items : items.filter((o) => wanted.includes(o.status)));
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
  // DPX-ORDER-B — bank-transfer money arrives in the merchant's OWN account, so
  // DrippleX never sees it and only the merchant can confirm it landed. Until
  // they do the order stays unpaid, and an unpaid non-cash order is never
  // dispatched to a rider — which is exactly how an order sat at "Pending
  // rider" while three riders were online.
  const doConfirmPayment = async (id: string) => {
    setActionId(id);
    try {
      await api.merchant.confirmPaymentReceived(id);
      fetchOrders(activeTab);
    } catch {}
    setActionId(null);
  };

  // DPX-ORDER-PROOF-001 — the receipts the customer filed for this transfer.
  // The merchant's confirmation is still their own judgement; this just means
  // they are no longer making it with nothing in front of them.
  const openProofs = async (id: string) => {
    setProofsOrderId(id);
    setProofs(null);
    setProofsErr('');
    try {
      setProofs(await api.merchant.getOrderPaymentProofs(id));
    } catch (e: unknown) {
      setProofsErr(e instanceof Error ? e.message : 'Could not load the receipts.');
    }
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
            // Every non-cash unpaid order used to read "CARD", including a bank
            // transfer to the merchant's own account — misleading on the very
            // card where they decide whether that transfer arrived.
            const payLabel =
              o.paymentMethod === 'CASH'
                ? 'CASH'
                : o.paymentStatus === 'PAID'
                  ? 'PAID'
                  : o.paymentMethod === 'MERCHANT_DIRECT'
                    ? 'BANK TRANSFER'
                    : 'CARD';
            const payColor =
              o.paymentMethod === 'CASH' ? C_WARN : o.paymentStatus === 'PAID' ? C_OK : '#3B82F6';
            return (
              <MxCard key={o.id} style={{ padding: 0, overflow: 'hidden' }}>
                {mxStatus === 'new' && (
                  <div style={{ height: 3, background: `linear-gradient(90deg,${G0},${G3})` }} />
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
                      {o.paymentMethod === 'MERCHANT_DIRECT' &&
                        o.paymentStatus !== 'PAID' &&
                        o.status !== 'CANCELLED' && (
                          <>
                            {/* Look before you confirm. */}
                            <MxBtn
                              label="Customer receipt"
                              variant="outline"
                              small
                              onClick={() => void openProofs(o.id)}
                            />
                            <MxBtn
                              label={busy ? '…' : 'Confirm payment received'}
                              variant="primary"
                              small
                              disabled={busy}
                              onClick={() => doConfirmPayment(o.id)}
                            />
                          </>
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

      {proofsOrderId !== null && (
        <Modal
          title="Customer's payment receipt"
          onClose={() => {
            setProofsOrderId(null);
            setProofs(null);
            setProofsErr('');
          }}
        >
          {proofsErr !== '' && <p style={{ fontSize: 13, color: '#F87171' }}>{proofsErr}</p>}
          {proofsErr === '' && proofs === null && (
            <p style={{ fontSize: 13, color: MUTED }}>Loading…</p>
          )}
          {proofs !== null && proofs.length === 0 && (
            <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
              The customer has not attached a receipt. That is not proof they did not pay —
              attaching one is optional. Check your own account before confirming.
            </p>
          )}
          {(proofs ?? []).map((proof) => (
            <div
              key={proof.id}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 12, color: MUTED }}>Sent</span>
                <span style={{ fontSize: 12, color: '#fff' }}>
                  {new Date(proof.createdAt).toLocaleString()}
                </span>
              </div>
              {proof.reference !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12, color: MUTED }}>Reference</span>
                  <span style={{ fontSize: 12, color: '#fff' }}>{proof.reference}</span>
                </div>
              )}
              {proof.amount !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 12, color: MUTED }}>Amount stated</span>
                  <span style={{ fontSize: 12, color: '#fff' }}>
                    ₦{proof.amount.toLocaleString()}
                  </span>
                </div>
              )}
              {proof.note !== null && (
                <p style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{proof.note}</p>
              )}
              {/* Receipts are private objects — this is a short-lived signed URL,
                  so open it now rather than bookmarking it. */}
              <a
                href={proof.receiptUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  fontSize: 12.5,
                  color: G3,
                  textDecoration: 'underline',
                }}
              >
                Open receipt
              </a>
            </div>
          ))}
        </Modal>
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
              label={
                order.paymentMethod === 'CASH'
                  ? 'CASH'
                  : order.paymentMethod === 'MERCHANT_DIRECT'
                    ? 'BANK TRANSFER'
                    : 'CARD'
              }
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
  const [savedMsg, setSavedMsg] = useState('');
  const [imgBusy, setImgBusy] = useState(false);
  const flash = (msg: string) => {
    setSavedMsg(msg);
    window.setTimeout(() => setSavedMsg(''), 2600);
  };

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
      flash(editId ? 'Product updated' : `“${form.name}” added to your catalogue`);
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

  // Upload a product photo: file → signed R2 upload → attach its URL, then make
  // it the product's ONLY image so it becomes the primary (displayed) photo.
  // The catalogue's primary image is the lowest-`position` one, but addImage
  // appends at the end — so without this cleanup a freshly uploaded photo sits
  // *behind* any older (often broken) image and never shows. This slot is a
  // single-photo slot, so replace rather than append: keep the new image, drop
  // the rest. Best-effort deletes — a failed delete just leaves an extra image.
  const uploadImage = async (file: File | undefined) => {
    if (!editId || !file) return;
    setSaveErr('');
    setImgBusy(true);
    try {
      const url = await uploadFile(file, 'product-images');
      const updated = await api.merchant.addProductImage(editId, url);
      const imgs = updated.images ?? [];
      const keep = imgs.find((i) => i.url === url) ?? imgs[imgs.length - 1];
      await Promise.all(
        imgs
          .filter((i) => keep && i.id !== keep.id)
          .map((i) => api.merchant.removeProductImage(editId, i.id).catch(() => undefined)),
      );
      await fetchProducts();
      flash('Photo updated');
    } catch (e: unknown) {
      setSaveErr((e as { message?: string }).message ?? 'Image upload failed. Try again.');
    } finally {
      setImgBusy(false);
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
      {savedMsg && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(43,172,82,.12)',
            border: `1px solid rgba(71,207,114,.4)`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14 }}>✓</span>
          <span style={{ fontFamily: IT, fontSize: 13, color: G3, fontWeight: 600 }}>
            {savedMsg}
          </span>
        </div>
      )}
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
              <ImageWithFallback
                src={p.imageUrl ?? undefined}
                alt={p.name}
                style={{
                  height: 80,
                  width: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
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

          {/* Product photo — upload once the product exists. */}
          {editId ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <ImageWithFallback
                src={editing?.imageUrl ?? undefined}
                alt="Product photo"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  flexShrink: 0,
                  objectFit: 'cover',
                  border: `1px solid ${BORDER}`,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: PP, fontSize: 13, fontWeight: 700, color: WHITE }}>
                  Product photo
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                  JPG, PNG or WebP. Shown to customers in the store.
                </div>
              </div>
              <label style={{ marginBottom: 0 }}>
                <span
                  className="transition-transform active:scale-95"
                  style={{
                    display: 'inline-block',
                    padding: '7px 14px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: `1px solid rgba(71,207,114,.4)`,
                    color: imgBusy ? MUTED : G3,
                    fontFamily: IT,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: imgBusy ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {imgBusy ? 'Uploading…' : editing?.imageUrl ? 'Change photo' : 'Upload photo'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={imgBusy}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    void uploadImage(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          ) : null}

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
  onExit,
}: {
  storeOpen: boolean;
  onToggleStore: (v: boolean) => void;
  business: MerchantBusinessDto | null;
  onExit?: () => void;
}) {
  // Business Name + type are captured at registration and shown read-only here —
  // the merchant never re-enters their identity, only operational details.
  const firstDayHours = business?.operatingHours
    ? Object.values(business.operatingHours).find((d): d is { open: string; close: string } => !!d)
    : null;

  const [description, setDescription] = useState(business?.description ?? '');
  const [address, setAddress] = useState(business?.address ?? '');
  // Real pickup coordinates. Dispatch measures every delivery from here, so an
  // address typed as free text is not enough — a business saved without
  // coordinates falls back to a default city point and quotes the wrong
  // distance, fee and ETA for every order.
  const [city, setCity] = useState(business?.city ?? '');
  const [stateName, setStateName] = useState(business?.state ?? '');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    business &&
      business.latitude !== null &&
      business.longitude !== null &&
      business.latitude !== 0 &&
      business.longitude !== 0
      ? { latitude: business.latitude, longitude: business.longitude }
      : null,
  );
  const [suggestions, setSuggestions] = useState<{ placeId: string; description: string }[]>([]);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState('');
  const [openTime, setOpenTime] = useState(firstDayHours?.open ?? '08:00');
  const [closeTime, setCloseTime] = useState(firstDayHours?.close ?? '21:00');
  const [logoUrl, setLogoUrl] = useState(business?.logoUrl ?? '');
  const [coverUrl, setCoverUrl] = useState(business?.coverPhotoUrl ?? '');
  const [uploading, setUploading] = useState<null | 'logo' | 'cover'>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  // Store Setup edits operational details only. Business Name + type come from
  // registration and are never re-sent. The single open/close pair is applied to
  // every day, matching the per-day operatingHours shape the marketplace reads.
  const handleSave = async (): Promise<boolean> => {
    setSaving(true);
    setSaveErr('');
    try {
      const operatingHours = Object.fromEntries(
        WEEK.map((d) => [d, { open: openTime, close: closeTime }]),
      );
      await api.merchant.updateBusiness({
        description: description || undefined,
        address: address || undefined,
        city: city || undefined,
        state: stateName || undefined,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        logoUrl: logoUrl || undefined,
        coverPhotoUrl: coverUrl || undefined,
        operatingHours,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (e: unknown) {
      setSaveErr((e as { message?: string }).message ?? 'Could not save. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExit = async () => {
    if (await handleSave()) onExit?.();
  };

  const uploadBranding = async (kind: 'logo' | 'cover', file: File | undefined) => {
    if (!file) return;
    setUploading(kind);
    setSaveErr('');
    try {
      const url = await uploadFile(file, 'product-images');
      if (kind === 'logo') {
        setLogoUrl(url);
        await api.merchant.updateBusiness({ logoUrl: url });
      } else {
        setCoverUrl(url);
        await api.merchant.updateBusiness({ coverPhotoUrl: url });
      }
    } catch (e: unknown) {
      setSaveErr((e as { message?: string }).message ?? 'Image upload failed. Try again.');
    } finally {
      setUploading(null);
    }
  };

  // No business record yet (registration not completed) — show a clear next step
  // instead of a broken form that 404s ("Business not found") on save.
  if (!business) {
    return (
      <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <SectionHead title="Store Setup" sub="Configure your business profile and store details" />
        <MxCard style={{ maxWidth: 520 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22 }}>🏪</span>
            <div>
              <div
                style={{
                  fontFamily: PP,
                  fontSize: 14,
                  fontWeight: 700,
                  color: WHITE,
                  marginBottom: 4,
                }}
              >
                Finish your business registration first
              </div>
              <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                We couldn&apos;t find a business on your account yet. Complete Business Setup during
                registration to create your store — then your name and business type appear here and
                you can add hours, logo and cover image.
              </div>
            </div>
          </div>
        </MxCard>
      </div>
    );
  }

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
          <ReadOnlyField label="Store / Business Name" value={business.businessName} />
          <ReadOnlyField
            label="Category / Business Type"
            value={businessTypeLabel(business.businessType)}
            hint="Set during registration"
          />
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
            placeholder="Start typing your address…"
            value={address}
            onChange={(v) => {
              setAddress(v);
              // Typing invalidates a previously pinned point — the text and the
              // coordinates must not drift apart.
              setCoords(null);
              setLocationNote('');
              void addressPredictions(v).then(setSuggestions);
            }}
          />
          {suggestions.length > 0 && (
            <div
              style={{
                marginTop: -8,
                marginBottom: 14,
                borderRadius: 8,
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                overflow: 'hidden',
              }}
            >
              {suggestions.slice(0, 5).map((sug) => (
                <button
                  key={sug.placeId}
                  onClick={() => {
                    setSuggestions([]);
                    setLocating(true);
                    setLocationNote('');
                    void geocodeAddress({ placeId: sug.placeId })
                      .then((res) => {
                        if (!res) {
                          setLocationNote('Could not pin that address. Try another one.');
                          return;
                        }
                        setAddress(sug.description);
                        setCity(res.city);
                        setStateName(res.state);
                        setCoords({ latitude: res.latitude, longitude: res.longitude });
                      })
                      .finally(() => setLocating(false));
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${BORDER}`,
                    color: WHITE,
                    fontFamily: IT,
                    fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >
                  {sug.description}
                </button>
              ))}
            </div>
          )}
          {/* The pickup point every delivery is measured from. Saved without it,
              the store falls back to a default city point and every order is
              quoted the wrong distance, fee and ETA. */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: NAVY_SURFACE,
              border: `1px solid ${coords ? 'rgba(43,172,82,.35)' : 'rgba(245,158,11,.35)'}`,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 20 }}>📍</span>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontFamily: IT, fontSize: 12, color: WHITE, fontWeight: 600 }}>
                {coords ? 'Pickup point set' : 'Pickup point not set'}
              </div>
              <div style={{ fontFamily: IT, fontSize: 11, color: coords ? MUTED : C_WARN }}>
                {locating
                  ? 'Finding your location…'
                  : coords
                    ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}${city ? ` · ${city}` : ''}`
                    : 'Riders and delivery fees are measured from your store. Pick a suggestion above or use your current location.'}
              </div>
            </div>
            <MxBtn
              label={locating ? 'Locating…' : 'Use my location'}
              variant="outline"
              small
              disabled={locating}
              onClick={() => {
                setLocating(true);
                setLocationNote('');
                void getCurrentPosition()
                  .then(async (pos) => {
                    if (!pos) {
                      setLocationNote(
                        'We could not read your location. Allow location access, or pick your address from the suggestions.',
                      );
                      return;
                    }
                    setCoords(pos);
                    // Fill the address text from the pin when it is still empty,
                    // so the saved address and the pin describe the same place.
                    if (!address.trim()) {
                      const res = await geocodeAddress({
                        query: `${String(pos.latitude)},${String(pos.longitude)}`,
                      });
                      if (res) {
                        setAddress(res.addressLine1);
                        setCity(res.city);
                        setStateName(res.state);
                      }
                    }
                  })
                  .finally(() => setLocating(false));
              }}
            />
          </div>
          {locationNote && (
            <div
              style={{
                marginTop: -6,
                marginBottom: 14,
                padding: '8px 12px',
                borderRadius: 7,
                background: 'rgba(245,158,11,.07)',
                border: '1px solid rgba(245,158,11,.25)',
              }}
            >
              <span style={{ fontFamily: IT, fontSize: 12, color: C_WARN }}>{locationNote}</span>
            </div>
          )}
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
              <label style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 14,
                    background: logoUrl ? 'transparent' : NAVY_SURFACE,
                    backgroundImage: logoUrl ? `url(${logoUrl})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: `2px dashed ${BORDER}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    marginBottom: 6,
                  }}
                >
                  {!logoUrl && (uploading === 'logo' ? '…' : '🏪')}
                </div>
                <div style={{ fontFamily: IT, fontSize: 11, color: G3 }}>
                  {uploading === 'logo' ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading !== null}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    void uploadBranding('logo', e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
                <div
                  style={{
                    height: 72,
                    borderRadius: 10,
                    background: coverUrl ? 'transparent' : NAVY_SURFACE,
                    backgroundImage: coverUrl ? `url(${coverUrl})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: `2px dashed ${BORDER}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    marginBottom: 6,
                  }}
                >
                  {!coverUrl && (
                    <>
                      <span style={{ fontSize: 20 }}>🖼️</span>
                      <span style={{ fontFamily: IT, fontSize: 11, color: G3 }}>
                        {uploading === 'cover' ? 'Uploading…' : 'Upload cover image'}
                      </span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading !== null}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    void uploadBranding('cover', e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
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
          {saveErr && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 7,
                background: 'rgba(239,68,68,.07)',
                border: '1px solid rgba(239,68,68,.2)',
                marginTop: 10,
              }}
            >
              <span style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{saveErr}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <MxBtn
              label="Save & Exit"
              variant="outline"
              disabled={saving}
              onClick={handleSaveExit}
            />
            <MxBtn
              label={saving ? 'Saving…' : 'Save Changes'}
              variant="primary"
              disabled={saving}
              onClick={() => void handleSave()}
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
// Merchant KYC documents. documentType MUST be a real backend KycDocumentType
// (see prisma KycDocumentType) — the previous DIRECTOR_NIN / UTILITY_BILL /
// BUSINESS_PHOTO values are not in the enum and were silently rejected. Each of
// these has a natural document number, which the backend requires (min 3 chars).
// Proof-of-address (utility bill) and a premises photo are a documented gap:
// they have no KycDocumentType yet and need a founder decision before wiring.
const KYC_DOCS: {
  type: string;
  label: string;
  desc: string;
  icon: string;
  numberLabel: string;
  numberPlaceholder: string;
}[] = [
  {
    type: 'CAC_CERTIFICATE',
    label: 'CAC Certificate',
    desc: 'Corporate Affairs Commission registration certificate',
    icon: '📋',
    numberLabel: 'RC / registration number',
    numberPlaceholder: 'e.g. RC 1234567',
  },
  {
    type: 'NATIONAL_ID',
    label: "Director's National ID (NIN)",
    desc: 'Government-issued ID or National Identity Number of a director',
    icon: '🪪',
    numberLabel: 'NIN / ID number',
    numberPlaceholder: 'e.g. 12345678901',
  },
];

// Backend KycVerificationStatus (PENDING | VERIFIED | REJECTED) → OrderStatusChip key.
function kycStatusUi(s: string | undefined): string {
  switch ((s ?? '').toUpperCase()) {
    case 'VERIFIED':
      return 'verified';
    case 'REJECTED':
      return 'rejected';
    case 'PENDING':
      return 'review';
    default:
      return 'pending';
  }
}

function MerchantKYCPage() {
  const [status, setStatus] = useState<MerchantKycStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  // Inline upload form state (one document at a time).
  const [openType, setOpenType] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fetchKyc = useCallback(async () => {
    try {
      setStatus(await api.merchant.getKyc());
    } catch {
      // Not a merchant / no business yet → nothing submitted.
      setStatus({ latest: null, items: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKyc();
  }, [fetchKyc]);

  // Newest submission for a given document type (items come newest-first).
  const latestFor = (type: string): MerchantKycDto | undefined =>
    (status?.items ?? []).find((it) => it.documentType === type);

  // Documents waiting on Operations. Each document type has its own review
  // slot, so a pending CAC certificate does not block the director's NIN.
  const pendingCount = KYC_DOCS.filter(
    (d) => latestFor(d.type)?.verificationStatus === 'PENDING',
  ).length;
  const outstandingCount = KYC_DOCS.filter((d) => {
    const st = latestFor(d.type)?.verificationStatus;
    return st !== 'PENDING' && st !== 'VERIFIED';
  }).length;

  const openForm = (type: string) => {
    setOpenType(type);
    setDocNumber('');
    setFile(null);
    setFormErr('');
  };

  const submit = async (type: string) => {
    setFormErr('');
    if (docNumber.trim().length < 3) {
      setFormErr('Enter the document number (at least 3 characters).');
      return;
    }
    if (!file) {
      setFormErr('Choose a clear photo or scan of the document.');
      return;
    }
    setSubmitting(true);
    try {
      // Upload to the merchant-owned kyc-documents folder, then submit the record.
      const frontImage = await uploadFile(file, 'kyc-documents');
      await api.merchant.submitKyc({
        documentType: type,
        documentNumber: docNumber.trim(),
        frontImage,
      });
      setOpenType(null);
      setDocNumber('');
      setFile(null);
      await fetchKyc();
    } catch (e: unknown) {
      setFormErr(
        (e as { message?: string }).message ?? 'Could not submit the document. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const verified = KYC_DOCS.filter(
    (d) => latestFor(d.type)?.verificationStatus === 'VERIFIED',
  ).length;
  const total = KYC_DOCS.length;
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

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
                {verified}/{total} verified
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: NAVY_SURFACE }}>
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
          </MxCard>

          {pendingCount > 0 && (
            <InfoBanner
              icon="⏳"
              text={
                outstandingCount > 0
                  ? `${pendingCount} document${pendingCount === 1 ? ' is' : 's are'} with the Operations team. You can submit the remaining ${outstandingCount === 1 ? 'document' : `${outstandingCount} documents`} now — you do not have to wait.`
                  : `${pendingCount === 1 ? 'Your document is' : 'Your documents are'} with the Operations team. We will let you know as soon as ${pendingCount === 1 ? 'it has' : 'they have'} been reviewed.`
              }
              color="#3B82F6"
            />
          )}
          <InfoBanner
            icon="🔒"
            text="Your documents are encrypted and stored securely. DrippleX does not share your KYC documents with third parties."
            color={G2}
          />

          {KYC_DOCS.map((doc) => {
            const latest = latestFor(doc.type);
            const st = latest ? kycStatusUi(latest.verificationStatus) : 'pending';
            const isOpen = openType === doc.type;
            const verifiedDoc = latest?.verificationStatus === 'VERIFIED';
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
                    {doc.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: WHITE }}>
                        {doc.label}
                      </span>
                      <span style={{ fontFamily: IT, fontSize: 10, color: C_ERR }}>Required</span>
                    </div>
                    <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{doc.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {latest && <OrderStatusChip status={st} />}
                    {!verifiedDoc && !isOpen && (
                      <MxBtn
                        label={latest ? 'Replace' : 'Upload'}
                        variant={st === 'rejected' ? 'danger' : 'primary'}
                        small
                        onClick={() => openForm(doc.type)}
                      />
                    )}
                  </div>
                </div>

                {latest?.remarks && st === 'rejected' && (
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
                      ⚠️ Rejected: {latest.remarks}
                    </span>
                  </div>
                )}

                {isOpen && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid rgba(255,255,255,.07)',
                    }}
                  >
                    <MxInput
                      label={doc.numberLabel}
                      placeholder={doc.numberPlaceholder}
                      value={docNumber}
                      onChange={setDocNumber}
                    />
                    <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 6 }}>
                      Document image
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}
                    >
                      <MxBtn
                        label={file ? 'Change file' : 'Choose file'}
                        variant="outline"
                        small
                        onClick={() => fileRef.current?.click()}
                      />
                      <span
                        style={{
                          fontFamily: IT,
                          fontSize: 12,
                          color: file ? WHITE : MUTED,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {file ? file.name : 'No file selected'}
                      </span>
                    </div>
                    {formErr && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: '8px 12px',
                          borderRadius: 7,
                          background: 'rgba(239,68,68,.07)',
                          border: '1px solid rgba(239,68,68,.2)',
                        }}
                      >
                        <span style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>
                          {formErr}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <MxBtn
                        label={submitting ? 'Submitting…' : 'Submit for review'}
                        variant="primary"
                        small
                        disabled={submitting}
                        onClick={() => submit(doc.type)}
                      />
                      <MxBtn
                        label="Cancel"
                        variant="ghost"
                        small
                        disabled={submitting}
                        onClick={() => setOpenType(null)}
                      />
                    </div>
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
  const [account, setAccount] = useState<MerchantBankAccountDto | null>(null);
  const [loading, setLoading] = useState(true);
  // `editing` is null when viewing; true when the form is open (add or replace).
  const [editing, setEditing] = useState(false);
  const [bank, setBank] = useState('');
  const [accNo, setAccNo] = useState('');
  const [accName, setAccName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.merchant.listBankAccounts();
      const primary = list.find((a) => a.isDefault) ?? list[0] ?? null;
      setAccount(primary);
      // If none exists yet, open the form straight away so the merchant can add one.
      setEditing(!primary);
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Could not load your bank account.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openForm = () => {
    setBank('');
    setAccNo('');
    setAccName('');
    setErr('');
    setEditing(true);
  };

  const canSave =
    bank.trim().length >= 2 &&
    accName.trim().length >= 2 &&
    accNo.length >= 8 &&
    accNo.length <= 20;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErr('');
    try {
      const created = await api.merchant.createBankAccount({
        bankName: bank.trim(),
        accountName: accName.trim(),
        accountNumber: accNo,
        isDefault: true,
      });
      setAccount(created);
      setEditing(false);
    } catch (e: unknown) {
      setErr(
        (e as { message?: string }).message ?? 'Could not save the account. Please try again.',
      );
    } finally {
      setSaving(false);
    }
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
            title={
              editing
                ? account
                  ? 'Replace Bank Account'
                  : 'Add Bank Account'
                : 'Settlement Account'
            }
            action={
              !editing && account ? (
                <MxBtn label="Change" variant="outline" small onClick={openForm} />
              ) : undefined
            }
          />
          {loading ? (
            <div style={{ fontFamily: IT, fontSize: 13, color: MUTED, padding: '8px 0' }}>
              Loading…
            </div>
          ) : !editing && account ? (
            <div>
              {[
                ['Bank', account.bankName],
                ['Account Number', account.accountNumber.replace(/\d(?=\d{4})/g, '•')],
                ['Account Name', account.accountName],
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
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: account.verifiedAt ? C_OK : C_WARN,
                  }}
                />
                <span
                  style={{
                    fontFamily: IT,
                    fontSize: 12,
                    color: account.verifiedAt ? C_OK : C_WARN,
                  }}
                >
                  {account.verifiedAt ? 'Account verified' : 'Pending verification by Operations'}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <MxInput
                label="Bank *"
                value={bank}
                onChange={setBank}
                placeholder="Type your bank name (e.g. GTBank, Opay, Kuda)"
              />
              <MxInput
                label="Account Number *"
                value={accNo}
                onChange={(v) => setAccNo(v.replace(/\D/g, '').slice(0, 20))}
                placeholder="Account number (8–20 digits)"
              />
              <MxInput
                label="Account Name *"
                value={accName}
                onChange={setAccName}
                placeholder="Account holder name, exactly as at the bank"
              />
              {err && (
                <div style={{ fontFamily: IT, fontSize: 12, color: C_ERR, marginBottom: 12 }}>
                  {err}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                {account && (
                  <MxBtn
                    label="Cancel"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setEditing(false)}
                  />
                )}
                <MxBtn
                  label={saving ? 'Saving…' : 'Save Account'}
                  variant="primary"
                  disabled={!canSave || saving}
                  onClick={() => void handleSave()}
                />
              </div>
            </div>
          )}
          {err && !editing && (
            <div style={{ fontFamily: IT, fontSize: 12, color: C_ERR, marginTop: 10 }}>{err}</div>
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
  // Onboarding/approval state is derived from real backend records — the
  // business profile, the KYC submission history, the settlement bank account —
  // so the checklist reflects what the merchant has actually done (and, most
  // importantly, tells them when KYC documents still need to be submitted).
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<MerchantBusinessDto | null>(null);
  const [kyc, setKyc] = useState<MerchantKycStatusDto | null>(null);
  const [banks, setBanks] = useState<MerchantBankAccountDto[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    // Each fetch is independent and a missing record is a valid "not done yet"
    // state, so tolerate per-call failure instead of blanking the whole page.
    const [b, k, acc] = await Promise.all([
      api.merchant.getBusiness().catch(() => null),
      api.merchant.getKyc().catch(() => null),
      api.merchant.listBankAccounts().catch(() => [] as MerchantBankAccountDto[]),
    ]);
    setBusiness(b);
    setKyc(k);
    setBanks(acc ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kycLatest = kyc?.latest ?? null;
  const kycVerified = kycLatest?.verificationStatus === 'VERIFIED';
  const kycPending = kycLatest?.verificationStatus === 'PENDING';
  const kycRejected = kycLatest?.verificationStatus === 'REJECTED';
  const hasKyc = (kyc?.items?.length ?? 0) > 0;
  const businessSet = !!business;
  const businessVerified = business?.verificationStatus === 'VERIFIED';
  const hasBank = banks.length > 0;

  const kycStepStatus = kycVerified
    ? 'done'
    : kycPending
      ? 'review'
      : kycRejected || !hasKyc
        ? 'action'
        : 'action';

  const steps: { label: string; sub: string; status: string; nav?: MerchantPage }[] = [
    {
      label: 'Business Setup',
      sub: 'Store name, address, category',
      status: businessSet ? 'done' : 'action',
      nav: 'store',
    },
    {
      label: 'KYC Documents',
      sub: kycRejected
        ? 'A document was rejected — please re-submit'
        : hasKyc
          ? 'Identity & business verification'
          : 'Upload your identity & business documents',
      status: kycStepStatus,
      nav: 'kyc',
    },
    {
      label: 'Bank Account',
      sub: 'Settlement destination account',
      status: hasBank ? 'done' : 'action',
      nav: 'bank',
    },
    {
      label: 'Operations Approval',
      sub: 'DrippleX team reviews your application',
      status: businessVerified ? 'done' : businessSet && kycPending ? 'review' : 'locked',
    },
    {
      label: 'Store Activation',
      sub: 'Begin accepting orders',
      status: businessVerified ? 'done' : 'locked',
    },
  ];
  const STATUS_MAP: Record<string, [string, string]> = {
    done: [C_OK, '✓'],
    review: [C_WARN, '⏳'],
    action: [C_ERR, '!'],
    locked: [MUTED, '○'],
    rejected: [C_ERR, '✕'],
  };

  // Banner reflects the merchant's real position in the funnel.
  const banner = businessVerified
    ? {
        icon: '✅',
        title: 'Approved',
        body: 'Your business is verified. You can activate your store and start accepting orders.',
        bg: 'rgba(16,185,129,.07)',
        bd: 'rgba(16,185,129,.2)',
      }
    : !hasKyc
      ? {
          icon: '🪪',
          title: 'Action required — submit KYC',
          body: 'Your business must be verified before you can go live. Upload your KYC documents to enter the review queue.',
          bg: 'rgba(239,68,68,.07)',
          bd: 'rgba(239,68,68,.2)',
        }
      : kycRejected
        ? {
            icon: '⚠️',
            title: 'Action required — re-submit KYC',
            body: 'A KYC document was rejected. Please review the notes and submit again.',
            bg: 'rgba(239,68,68,.07)',
            bd: 'rgba(239,68,68,.2)',
          }
        : {
            icon: '⏳',
            title: 'Pending Approval',
            body: 'Your application is under review by the DrippleX Operations team. This typically takes 1–2 business days.',
            bg: 'rgba(245,158,11,.07)',
            bd: 'rgba(245,158,11,.2)',
          };

  if (loading) {
    return (
      <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <SectionHead title="Onboarding & Approval Status" />
        <div style={{ fontFamily: IT, fontSize: 13, color: MUTED, padding: '20px 0' }}>
          Loading your application status…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-scroll" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <SectionHead title="Onboarding & Approval Status" />
      <div
        style={{
          display: 'flex',
          gap: 14,
          padding: '14px 18px',
          borderRadius: 10,
          background: banner.bg,
          border: `1px solid ${banner.bd}`,
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 22 }}>{banner.icon}</span>
        <div>
          <div
            style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: WHITE, marginBottom: 3 }}
          >
            {banner.title}
          </div>
          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, lineHeight: 1.55 }}>
            {banner.body}
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
                {step.status === 'action' && step.nav && (
                  <div style={{ marginTop: 8 }}>
                    <MxBtn
                      label={
                        step.nav === 'kyc'
                          ? 'Submit documents →'
                          : step.nav === 'bank'
                            ? 'Add bank account →'
                            : 'Complete setup →'
                      }
                      variant="outline"
                      small
                      onClick={() => onNav(step.nav!)}
                    />
                  </div>
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
        {/* The sound a new order makes, and whether it makes one. The two
            toggles below are notification *channel* preferences and are a
            separate concern — this is what the shop actually hears. */}
        <SoundSettings />
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
function MerchantLoginScreen({
  onLogin,
  onApply,
  onForgot,
}: {
  onLogin: () => void;
  onApply?: () => void;
  onForgot?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          {onForgot && (
            <button
              type="button"
              onClick={onForgot}
              style={{
                display: 'block',
                marginLeft: 'auto',
                marginTop: 12,
                fontFamily: IT,
                fontSize: 13,
                fontWeight: 600,
                color: G3,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Forgot password?
            </button>
          )}
        </MxCard>
        {onApply && (
          <div
            style={{
              fontFamily: IT,
              fontSize: 13,
              color: MUTED,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            New merchant partner?{' '}
            <button
              type="button"
              onClick={onApply}
              style={{
                color: G3,
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: IT,
                fontSize: 13,
              }}
            >
              Apply to join →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — MERCHANT PORTAL SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function MerchantPortalScreen({
  initialPage = 'dashboard',
  onApply,
  onForgot,
}: {
  initialPage?: MerchantPage;
  onApply?: () => void;
  onForgot?: () => void;
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
      const count = res.total ?? res.items?.length ?? 0;
      setNewOrderCount((previous) => {
        // Only on a rise. The badge is polled every 8s, so comparing against
        // the last count is what separates "a new order arrived" from "the
        // same order is still waiting" — otherwise the shop would chime
        // continuously until someone accepted.
        if (count > previous) playNotificationSound('new-request');
        return count;
      });
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

  if (!isLoggedIn)
    return (
      <MerchantLoginScreen
        onLogin={() => setIsLoggedIn(true)}
        onApply={onApply}
        onForgot={onForgot}
      />
    );

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
            onExit={() => setPage('dashboard')}
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
export const MerchantDashboardScreen = ({
  onApply,
  onForgot,
}: {
  onApply?: () => void;
  onForgot?: () => void;
}) => <MerchantPortalScreen initialPage="dashboard" onApply={onApply} onForgot={onForgot} />;
export const MerchantOrdersScreen = () => <MerchantPortalScreen initialPage="orders" />;
export const MerchantProductsScreen = () => <MerchantPortalScreen initialPage="products" />;
export const MerchantStoreScreen = () => <MerchantPortalScreen initialPage="store" />;
export const MerchantEarningsScreen = () => <MerchantPortalScreen initialPage="earnings" />;
export const MerchantKYCScreen = () => <MerchantPortalScreen initialPage="kyc" />;
export const MerchantBankScreen = () => <MerchantPortalScreen initialPage="bank" />;
export const MerchantApprovalScreen = () => <MerchantPortalScreen initialPage="approval" />;
