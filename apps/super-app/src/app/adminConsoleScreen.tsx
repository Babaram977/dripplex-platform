import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api, type AdminVehicleDto, type AdminDriverDto, type AdminDriverKycDto } from '../lib/api';
import { auth } from '../lib/auth';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Design tokens ───────────────────────────────────────────────────────────
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
const C_INFO = '#3B82F6';
const C_OK = '#10B981';
const WHITE = '#FFFFFF';

// ─── Types ────────────────────────────────────────────────────────────────────
export type AdminPage =
  | 'dashboard'
  | 'livemap'
  | 'trips'
  | 'drivers'
  | 'drvkyc'
  | 'vehicles'
  | 'customers'
  | 'pricing'
  | 'incidents'
  | 'support'
  | 'analytics'
  | 'reports'
  | 'settings'
  | 'auditlogs'
  | 'profile';

// ─── Global styles injected once ─────────────────────────────────────────────
const STYLE_ID = 'dripplex-admin-styles';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
    .dx-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
    .dx-scroll::-webkit-scrollbar-track { background: transparent; }
    .dx-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 4px; }
    .dx-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.22); }
    .dx-nav-item { transition: background .15s, color .15s; cursor: pointer; }
    .dx-nav-item:hover { background: rgba(71,207,114,.06) !important; }
    .dx-row:hover { background: rgba(255,255,255,.025) !important; }
    .dx-btn { transition: opacity .15s, transform .08s; cursor: pointer; }
    .dx-btn:hover { opacity: .85; }
    .dx-btn:active { transform: scale(.97); }
    .dx-chip { transition: opacity .15s; }
    .dx-card { transition: box-shadow .2s; }
    .dx-card:hover { box-shadow: 0 0 0 1px rgba(71,207,114,.18) !important; }
    @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
    @keyframes ping { 0%{transform:scale(1);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
    .dx-pulse { animation: pulse-dot 1.8s ease-in-out infinite; }
    .dx-ping { animation: ping 1.4s ease-out infinite; }
    .dx-input { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 6px; color: #fff; font-family: Inter, sans-serif; font-size: 13px; padding: 7px 10px; outline: none; width: 100%; box-sizing: border-box; transition: border-color .15s; }
    .dx-input:focus { border-color: rgba(71,207,114,.45); }
    .dx-input::placeholder { color: rgba(255,255,255,.28); }
    .dx-select { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 6px; color: #fff; font-family: Inter, sans-serif; font-size: 12px; padding: 6px 8px; outline: none; cursor: pointer; }
    .dx-toggle { appearance: none; width: 36px; height: 20px; background: rgba(255,255,255,.12); border-radius: 10px; cursor: pointer; position: relative; transition: background .2s; flex-shrink: 0; }
    .dx-toggle:checked { background: #2BAC52; }
    .dx-toggle::after { content:''; position:absolute; top:3px; left:3px; width:14px; height:14px; border-radius:50%; background:#fff; transition: left .2s; }
    .dx-toggle:checked::after { left:19px; }
    .dx-tab { cursor: pointer; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-family: Inter, sans-serif; font-weight: 500; transition: background .15s, color .15s; }
  `;
  document.head.appendChild(s);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Chip({ label, color = WHITE, bg }: { label: string; color?: string; bg?: string }) {
  return (
    <span
      className="dx-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 9px',
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif',
        letterSpacing: 0.3,
        color,
        background: bg ?? `${color}1a`,
      }}
    >
      {label}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    active: [C_OK, 'Active'],
    inactive: [MUTED, 'Inactive'],
    online: [C_OK, 'Online'],
    offline: [MUTED, 'Offline'],
    busy: [C_WARN, 'Busy'],
    available: [G3, 'Available'],
    searching: [C_INFO, 'Searching'],
    accepted: [G2, 'Accepted'],
    arriving: [C_WARN, 'Arriving'],
    'in progress': [C_OK, 'In Progress'],
    completed: [G3, 'Completed'],
    cancelled: [C_ERR, 'Cancelled'],
    pending: [C_WARN, 'Pending'],
    approved: [C_OK, 'Approved'],
    rejected: [C_ERR, 'Rejected'],
    suspended: [C_ERR, 'Suspended'],
    verified: [C_OK, 'Verified'],
    unverified: [C_WARN, 'Unverified'],
    open: [C_ERR, 'Open'],
    resolved: [C_OK, 'Resolved'],
    escalated: [C_WARN, 'Escalated'],
    'in review': [C_INFO, 'In Review'],
    enabled: [C_OK, 'Enabled'],
    disabled: [MUTED, 'Disabled'],
    new: [C_INFO, 'New'],
    'in progress ticket': [C_WARN, 'In Progress'],
  };
  const [c, l] = map[status.toLowerCase()] ?? [MUTED, status];
  return <Chip label={l} color={c} />;
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const hue = (name.charCodeAt(0) * 17) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: `hsl(${hue},40%,28%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        color: `hsl(${hue},70%,78%)`,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {initials}
    </div>
  );
}

function Btn({
  label,
  color = G2,
  outline = false,
  small = false,
  onClick,
}: {
  label: string;
  color?: string;
  outline?: boolean;
  small?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="dx-btn"
      onClick={onClick}
      style={{
        border: outline ? `1px solid ${color}` : 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        letterSpacing: 0.2,
        fontSize: small ? 11 : 12,
        padding: small ? '4px 10px' : '6px 14px',
        background: outline ? 'transparent' : color,
        color: outline ? color : NAVY_DEEP,
      }}
    >
      {label}
    </button>
  );
}

const SEP = () => <div style={{ height: 1, background: BORDER, margin: '0 16px' }} />;

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <span
        style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 14, color: WHITE }}
      >
        {title}
      </span>
      {action}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="dx-card"
      style={{
        background: NAVY_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const TRIPS: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const CUSTOMERS: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const INCIDENTS: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const SUPPORT_TICKETS: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const REVENUE_DATA: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const TRIP_STATUS_PIE: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const WEEKLY_DATA: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const DRIVER_GROWTH: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const AUDIT_LOGS: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV_ITEMS: { page: AdminPage; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '⬛', label: 'Dashboard' },
  { page: 'livemap', icon: '🗺️', label: 'Live Map' },
  { page: 'trips', icon: '🚗', label: 'Trips' },
  { page: 'drivers', icon: '🧑‍✈️', label: 'Drivers' },
  { page: 'drvkyc', icon: '🪪', label: 'Driver KYC' },
  { page: 'vehicles', icon: '🔑', label: 'Vehicles' },
  { page: 'customers', icon: '👥', label: 'Customers' },
  { page: 'pricing', icon: '💲', label: 'Pricing' },
  { page: 'incidents', icon: '⚠️', label: 'Incidents' },
  { page: 'support', icon: '🎧', label: 'Support' },
  { page: 'analytics', icon: '📊', label: 'Analytics' },
  { page: 'reports', icon: '📄', label: 'Reports' },
  { page: 'settings', icon: '⚙️', label: 'Settings' },
  { page: 'auditlogs', icon: '🔍', label: 'Audit Logs' },
  { page: 'profile', icon: '👤', label: 'My Profile' },
];

// Real queue counts for the sidebar badges, keyed by page. Absent/0 → no badge.
type NavBadges = Partial<Record<AdminPage, number>>;

function Sidebar({
  page,
  onNav,
  badges,
}: {
  page: AdminPage;
  onNav: (p: AdminPage) => void;
  badges?: NavBadges;
}) {
  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        height: '100%',
        background: NAVY_DEEP,
        borderRight: `1px solid ${BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: `linear-gradient(135deg,${G0},${G3})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: NAVY_DEEP,
            }}
          >
            D
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                color: WHITE,
                lineHeight: 1.2,
              }}
            >
              DrippleX
            </div>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 9.5,
                color: MUTED,
                letterSpacing: 0.5,
              }}
            >
              OPERATIONS CONSOLE
            </div>
          </div>
        </div>
      </div>
      {/* Nav */}
      <div className="dx-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV_ITEMS.map((item) => {
          const active = item.page === page;
          return (
            <div
              key={item.page}
              className="dx-nav-item"
              onClick={() => onNav(item.page)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '8px 14px',
                margin: '1px 8px',
                borderRadius: 7,
                borderLeft: active ? `3px solid ${G3}` : '3px solid transparent',
                background: active ? `rgba(71,207,114,.09)` : 'transparent',
                color: active ? G3 : MUTED,
                fontFamily: 'Inter, sans-serif',
                fontSize: 12.5,
                fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, minWidth: 18 }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {badges?.[item.page] ? (
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
                  {badges[item.page]}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          v2.4.1 · Lagos, NG
        </div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
const PAGE_LABELS: Record<AdminPage, string> = {
  dashboard: 'Dashboard',
  livemap: 'Live Map',
  trips: 'Trips',
  drivers: 'Drivers',
  drvkyc: 'Driver KYC',
  vehicles: 'Vehicles',
  customers: 'Customers',
  pricing: 'Pricing & Fares',
  incidents: 'Incidents',
  support: 'Support Centre',
  analytics: 'Analytics',
  reports: 'Reports',
  settings: 'Settings',
  auditlogs: 'Audit Logs',
  profile: 'My Profile',
};

function Header({
  page,
  onNav,
  onSignOut,
}: {
  page: AdminPage;
  onNav?: (p: AdminPage) => void;
  onSignOut?: () => void;
}) {
  const [bell, setBell] = useState(false);
  const [admin, setAdmin] = useState(false);
  const user = auth.getUser();
  const adminName =
    user && `${user.firstName} ${user.lastName}`.trim().length > 0
      ? `${user.firstName} ${user.lastName}`.trim()
      : 'Operations';
  const adminRole =
    user?.roles?.[0]?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Operations';
  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        background: NAVY_BASE,
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <span style={{ fontSize: 12, color: MUTED }}>Operations Console</span>
        <span style={{ fontSize: 12, color: `rgba(255,255,255,.2)` }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{PAGE_LABELS[page]}</span>
      </div>
      {/* Live indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: `rgba(16,185,129,.1)`,
          borderRadius: 99,
          border: `1px solid rgba(16,185,129,.2)`,
        }}
      >
        <div style={{ position: 'relative', width: 8, height: 8 }}>
          <div
            className="dx-ping"
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C_OK }}
          />
          <div
            className="dx-pulse"
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: C_OK }}
          />
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C_OK,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: 0.5,
          }}
        >
          LIVE
        </span>
      </div>
      {/* Bell */}
      <div style={{ position: 'relative' }}>
        <button
          className="dx-btn"
          onClick={() => {
            setBell((b) => !b);
            setAdmin(false);
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: 'rgba(255,255,255,.05)',
            border: `1px solid ${BORDER}`,
            color: MUTED,
            fontSize: 15,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          🔔
        </button>
        {bell && (
          <div
            style={{
              position: 'absolute',
              top: 40,
              right: 0,
              width: 270,
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 16,
              zIndex: 100,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: MUTED,
                fontFamily: 'Inter, sans-serif',
                textAlign: 'center',
              }}
            >
              No new notifications.
            </div>
          </div>
        )}
      </div>
      {/* Admin */}
      <div style={{ position: 'relative' }}>
        <div
          className="dx-btn"
          onClick={() => {
            setAdmin((a) => !a);
            setBell(false);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: '5px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,.04)',
            border: `1px solid ${BORDER}`,
          }}
        >
          <Avatar name={adminName} size={24} />
          <div style={{ fontFamily: 'Inter, sans-serif' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>{adminName}</div>
            <div style={{ fontSize: 10, color: MUTED }}>{adminRole}</div>
          </div>
          <span style={{ fontSize: 10, color: MUTED }}>▾</span>
        </div>
        {admin && (
          <div
            style={{
              position: 'absolute',
              top: 42,
              right: 0,
              width: 180,
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              padding: 6,
              zIndex: 100,
            }}
          >
            {(
              [
                { label: 'My Profile', onClick: () => onNav?.('profile') },
                { label: 'Settings', onClick: () => onNav?.('settings') },
                { label: '─────────' },
                { label: 'Sign Out', onClick: () => onSignOut?.() },
              ] as { label: string; onClick?: () => void }[]
            ).map((item, i) =>
              item.label === '─────────' ? (
                <div key={i} style={{ height: 1, background: BORDER, margin: '4px 0' }} />
              ) : (
                <div
                  key={i}
                  className="dx-row"
                  onClick={() => {
                    setAdmin(false);
                    item.onClick?.();
                  }}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'Inter, sans-serif',
                    color: item.label === 'Sign Out' ? C_ERR : WHITE,
                  }}
                >
                  {item.label}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  color = G3,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon: string;
}) {
  return (
    <div
      className="dx-card"
      style={{
        background: NAVY_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
        >
          {label}
        </span>
        <span
          style={{ fontSize: 18, background: `${color}18`, borderRadius: 7, padding: '4px 6px' }}
        >
          {icon}
        </span>
      </div>
      <div
        style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 22, color: WHITE }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Chart theme helpers ──────────────────────────────────────────────────────
const CHART_GRID = { stroke: 'rgba(255,255,255,.04)' };
const AXIS_STYLE = { fontSize: 10, fill: MUTED, fontFamily: 'Inter, sans-serif' };
const TOOLTIP_STYLE = {
  backgroundColor: NAVY_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 11,
  fontFamily: 'Inter, sans-serif',
};

// ─── Page: Dashboard ──────────────────────────────────────────────────────────
function PageDashboard() {
  const [counters, setCounters] = useState<{
    openIncidentsCount: number;
    openSupportTicketsCount: number;
    waitingReviewCount: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api.admin
      .getOpsCounters()
      .then((c) => {
        if (!cancelled) setCounters(c);
      })
      .catch(() => {
        /* leave counters null → tiles show — */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Real counters where available; every other tile shows "—" rather than a fake
  // number until its metric is wired (trips/revenue/driver-availability).
  const c = (n: number | undefined) => (n === undefined ? '—' : String(n));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Row 1 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KpiCard label="Active Trips" value="—" sub="" color={G3} icon="🚗" />
        <KpiCard
          label="Pending Requests"
          value={c(counters?.waitingReviewCount)}
          sub="Awaiting review"
          color={C_WARN}
          icon="⏳"
        />
        <KpiCard label="Completed Today" value="—" sub="" color={C_OK} icon="✅" />
        <KpiCard label="Revenue Today" value="—" sub="" color={G2} icon="💰" />
      </div>
      {/* KPI Row 2 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KpiCard label="Online Drivers" value="—" sub="" color={C_OK} icon="🟢" />
        <KpiCard label="Offline Drivers" value="—" sub="" color={MUTED} icon="⚫" />
        <KpiCard
          label="Support Tickets"
          value={c(counters?.openSupportTicketsCount)}
          sub="Open"
          color={C_INFO}
          icon="🎧"
        />
        <KpiCard
          label="Open Incidents"
          value={c(counters?.openIncidentsCount)}
          sub="Open"
          color={C_ERR}
          icon="⚠️"
        />
      </div>
      {/* Charts row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Area chart */}
        <Card style={{ flex: 2, padding: '14px 16px' }}>
          <SectionHeader title="Revenue Over Time (Today)" />
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={REVENUE_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={G2} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={G2} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="time" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={fmt}
                tick={AXIS_STYLE}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={G3}
                fill="url(#revGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        {/* Pie chart */}
        <Card style={{ flex: 1, padding: '14px 16px' }}>
          <SectionHeader title="Trip Status" />
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={TRIP_STATUS_PIE}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={52}
                paddingAngle={3}
                dataKey="value"
              >
                {TRIP_STATUS_PIE.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 10, fontFamily: 'Inter, sans-serif', color: MUTED }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      {/* Live trip feed */}
      <Card style={{ padding: '14px 16px' }}>
        <SectionHeader
          title="Live Trip Feed"
          action={<Chip label="Auto-refresh: ON" color={G3} />}
        />
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['Trip ID', 'Driver', 'Passenger', 'Route', 'Fare', 'Status', 'ETA'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '6px 8px',
                    textAlign: 'left',
                    fontSize: 11,
                    color: MUTED,
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRIPS.map((t, i) => (
              <tr
                key={t.id}
                className="dx-row"
                style={{
                  borderBottom: `1px solid ${BORDER}`,
                  background: i % 2 === 1 ? 'rgba(255,255,255,.01)' : 'transparent',
                }}
              >
                <td style={{ padding: '7px 8px', fontSize: 11.5, color: G3, fontWeight: 600 }}>
                  {t.id}
                </td>
                <td style={{ padding: '7px 8px', fontSize: 11.5, color: WHITE }}>{t.driver}</td>
                <td style={{ padding: '7px 8px', fontSize: 11.5, color: WHITE }}>{t.passenger}</td>
                <td style={{ padding: '7px 8px', fontSize: 11, color: MUTED }}>
                  {t.pickup} → {t.dropoff}
                </td>
                <td style={{ padding: '7px 8px', fontSize: 11.5, color: WHITE, fontWeight: 600 }}>
                  {t.fare}
                </td>
                <td style={{ padding: '7px 8px' }}>
                  <StatusChip status={t.status} />
                </td>
                <td style={{ padding: '7px 8px', fontSize: 11, color: MUTED }}>{t.eta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Page: Live Map ───────────────────────────────────────────────────────────
function PageLiveMap() {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Available', 'Busy', 'Trips'];
  const drivers = [] as Record<string, unknown>[]; // mock cleared
  const routes = [] as Record<string, unknown>[]; // mock cleared
  const pickups = [] as Record<string, unknown>[]; // mock cleared
  const visible = drivers.filter((d) =>
    filter === 'All'
      ? true
      : filter === 'Available'
        ? d.status === 'available'
        : filter === 'Busy'
          ? d.status === 'busy'
          : true,
  );
  return (
    <div style={{ display: 'flex', gap: 12, height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {filters.map((f) => (
            <button
              key={f}
              className="dx-btn dx-tab"
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? G2 : 'rgba(255,255,255,.05)',
                color: filter === f ? NAVY_DEEP : MUTED,
                border: `1px solid ${filter === f ? 'transparent' : BORDER}`,
                borderRadius: 7,
                padding: '6px 14px',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: filter === f ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: MUTED,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <span style={{ color: G3, fontWeight: 600 }}>●</span> Available &nbsp;
            <span style={{ color: C_WARN, fontWeight: 600 }}>●</span> Busy &nbsp;
            <span style={{ color: C_INFO, fontWeight: 600 }}>●</span> Pickup
          </div>
        </div>
        {/* SVG Map */}
        <Card style={{ flex: 1, padding: 0, overflow: 'hidden', position: 'relative' }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 650 400"
            style={{ display: 'block', background: '#080f1c' }}
          >
            {/* Grid lines for map feel */}
            {Array.from({ length: 14 }).map((_, i) => (
              <line
                key={`vg${i}`}
                x1={i * 50}
                y1={0}
                x2={i * 50}
                y2={400}
                stroke="rgba(255,255,255,.025)"
                strokeWidth={1}
              />
            ))}
            {Array.from({ length: 9 }).map((_, i) => (
              <line
                key={`hg${i}`}
                x1={0}
                y1={i * 50}
                x2={650}
                y2={i * 50}
                stroke="rgba(255,255,255,.025)"
                strokeWidth={1}
              />
            ))}
            {/* Lagos major roads */}
            <path
              d="M80,360 Q200,340 320,280 Q420,230 560,200 Q600,195 630,190"
              stroke="rgba(255,255,255,.12)"
              strokeWidth={3}
              fill="none"
            />
            <path
              d="M100,80 Q180,120 260,200 Q320,260 350,330 Q370,370 380,395"
              stroke="rgba(255,255,255,.12)"
              strokeWidth={3}
              fill="none"
            />
            <path
              d="M60,200 Q160,190 280,195 Q380,200 480,185 Q560,175 630,160"
              stroke="rgba(255,255,255,.1)"
              strokeWidth={2}
              fill="none"
            />
            <path
              d="M200,50 Q220,130 240,200 Q255,250 280,320 Q295,360 300,400"
              stroke="rgba(255,255,255,.1)"
              strokeWidth={2}
              fill="none"
            />
            <path
              d="M440,50 Q450,120 460,200 Q465,260 480,330 Q490,365 500,400"
              stroke="rgba(255,255,255,.08)"
              strokeWidth={2}
              fill="none"
            />
            <path
              d="M80,250 Q200,240 320,230 Q420,225 560,230"
              stroke="rgba(255,255,255,.07)"
              strokeWidth={1.5}
              fill="none"
            />
            <path
              d="M350,80 Q360,160 375,240 Q385,290 390,380"
              stroke="rgba(255,255,255,.07)"
              strokeWidth={1.5}
              fill="none"
            />
            {/* Lekki-Epe Expressway label */}
            <text
              x="160"
              y="358"
              fill="rgba(255,255,255,.2)"
              fontSize={8}
              fontFamily="Inter, sans-serif"
            >
              Lekki–Epe Expressway
            </text>
            <text
              x="82"
              y="115"
              fill="rgba(255,255,255,.2)"
              fontSize={8}
              fontFamily="Inter, sans-serif"
            >
              Carter Bridge
            </text>
            <text
              x="410"
              y="185"
              fill="rgba(255,255,255,.2)"
              fontSize={8}
              fontFamily="Inter, sans-serif"
            >
              Third Mainland Bridge
            </text>
            {/* Trip route lines */}
            {routes.map((r, i) => (
              <line
                key={i}
                x1={r.x1}
                y1={r.y1}
                x2={r.x2}
                y2={r.y2}
                stroke={r.color}
                strokeWidth={2}
                strokeDasharray="6,4"
                opacity={0.7}
              />
            ))}
            {/* Pickup pins */}
            {pickups.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={8} fill={C_INFO} opacity={0.2} />
                <circle cx={p.x} cy={p.y} r={4} fill={C_INFO} />
                <text
                  x={p.x + 10}
                  y={p.y + 4}
                  fill={C_INFO}
                  fontSize={9}
                  fontFamily="Inter, sans-serif"
                >
                  {p.label}
                </text>
              </g>
            ))}
            {/* Driver dots */}
            {visible.map((d) => (
              <g key={d.id}>
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={10}
                  fill={d.status === 'available' ? G3 : C_WARN}
                  opacity={0.18}
                />
                <circle cx={d.x} cy={d.y} r={5} fill={d.status === 'available' ? G3 : C_WARN} />
                <text
                  x={d.x + 8}
                  y={d.y - 8}
                  fill={WHITE}
                  fontSize={8.5}
                  fontFamily="Inter, sans-serif"
                >
                  {d.name}
                </text>
              </g>
            ))}
            {/* Area labels */}
            <text
              x={440}
              y={70}
              fill="rgba(255,255,255,.15)"
              fontSize={11}
              fontFamily="Poppins, sans-serif"
              fontWeight={600}
            >
              Ikeja GRA
            </text>
            <text
              x={120}
              y={320}
              fill="rgba(255,255,255,.15)"
              fontSize={11}
              fontFamily="Poppins, sans-serif"
              fontWeight={600}
            >
              Surulere
            </text>
            <text
              x={530}
              y={280}
              fill="rgba(255,255,255,.15)"
              fontSize={11}
              fontFamily="Poppins, sans-serif"
              fontWeight={600}
            >
              Lekki
            </text>
            <text
              x={60}
              y={200}
              fill="rgba(255,255,255,.15)"
              fontSize={11}
              fontFamily="Poppins, sans-serif"
              fontWeight={600}
            >
              Apapa
            </text>
            <text
              x={270}
              y={100}
              fill="rgba(255,255,255,.15)"
              fontSize={11}
              fontFamily="Poppins, sans-serif"
              fontWeight={600}
            >
              Yaba
            </text>
          </svg>
          {/* Stats overlay */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(6,14,28,.85)',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>NOW LIVE</div>
            <div style={{ fontSize: 12, color: G3, fontWeight: 600 }}>— Active Drivers</div>
            <div style={{ fontSize: 11, color: MUTED }}>— Trips in Progress</div>
          </div>
        </Card>
      </div>
      {/* Driver panel */}
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 13, color: WHITE }}
        >
          Nearby Drivers
        </div>
        <div
          className="dx-scroll"
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {drivers.map((d) => (
            <Card key={d.id} style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={d.name} size={28} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: WHITE,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {d.name}
                  </div>
                  <StatusChip status={d.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page: Trips ──────────────────────────────────────────────────────────────
function PageTrips() {
  const statuses = [
    'All',
    'Searching',
    'Accepted',
    'Arriving',
    'In Progress',
    'Completed',
    'Cancelled',
  ];
  const [activeStatus, setActiveStatus] = useState('All');
  const [search, setSearch] = useState('');
  const filtered = TRIPS.filter(
    (t) =>
      (activeStatus === 'All' || t.status.toLowerCase() === activeStatus.toLowerCase()) &&
      (t.id + t.driver + t.passenger + t.pickup + t.dropoff)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {statuses.map((s) => (
          <button
            key={s}
            className="dx-btn"
            onClick={() => setActiveStatus(s)}
            style={{
              padding: '5px 12px',
              borderRadius: 99,
              fontSize: 11.5,
              fontWeight: activeStatus === s ? 700 : 400,
              background: activeStatus === s ? G2 : 'rgba(255,255,255,.05)',
              color: activeStatus === s ? NAVY_DEEP : MUTED,
              border: `1px solid ${activeStatus === s ? 'transparent' : BORDER}`,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {s}
          </button>
        ))}
        <input
          className="dx-input"
          placeholder="🔍 Search trips, drivers, passengers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', width: 240 }}
        />
      </div>
      {/* Table */}
      <Card style={{ padding: '14px 16px' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {[
                'Trip ID ↕',
                'Driver',
                'Passenger',
                'Pickup',
                'Drop-off',
                'Fare ↕',
                'Status',
                'ETA',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '7px 8px',
                    textAlign: 'left',
                    fontSize: 11,
                    color: MUTED,
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(filtered.length ? filtered : TRIPS).map((t, i) => (
              <tr
                key={t.id}
                className="dx-row"
                style={{ borderBottom: `1px solid rgba(255,255,255,.04)` }}
              >
                <td style={{ padding: '8px 8px', fontSize: 11.5, color: G3, fontWeight: 700 }}>
                  {t.id}
                </td>
                <td style={{ padding: '8px 8px', fontSize: 12, color: WHITE }}>{t.driver}</td>
                <td style={{ padding: '8px 8px', fontSize: 12, color: WHITE }}>{t.passenger}</td>
                <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{t.pickup}</td>
                <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{t.dropoff}</td>
                <td style={{ padding: '8px 8px', fontSize: 12, color: WHITE, fontWeight: 600 }}>
                  {t.fare}
                </td>
                <td style={{ padding: '8px 8px' }}>
                  <StatusChip status={t.status} />
                </td>
                <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{t.eta}</td>
                <td style={{ padding: '8px 8px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <Btn label="View" small outline color={G3} />
                    {t.status !== 'completed' && t.status !== 'cancelled' && (
                      <Btn label="Cancel" small outline color={C_ERR} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          Showing {filtered.length || TRIPS.length} of {TRIPS.length} trips
        </div>
      </Card>
    </div>
  );
}

// ─── Page: Drivers ─────────────────────────────────────────────────────────────
const driverKycState = (d: AdminDriverDto): 'verified' | 'pending' | 'unverified' => {
  if (d.kyc.some((k) => k.verificationStatus === 'PENDING')) return 'pending';
  if (d.kyc.some((k) => k.verificationStatus === 'VERIFIED')) return 'verified';
  return 'unverified';
};
const driverStatusChip = (s: string) => (s === 'UNDER_REVIEW' ? 'in review' : s.toLowerCase());

function PageDrivers() {
  const [drivers, setDrivers] = useState<AdminDriverDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('All KYC');
  const [selId, setSelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDrivers((await api.admin.listDrivers()).items);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load drivers.');
      setDrivers([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const rows = (drivers ?? []).filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch = (driverName(d) + (d.phone ?? '') + d.email).toLowerCase().includes(q);
    const k = driverKycState(d);
    const matchesKyc =
      kycFilter === 'All KYC' ||
      (kycFilter === 'Verified' && k === 'verified') ||
      (kycFilter === 'Pending' && k === 'pending');
    return matchesSearch && matchesKyc;
  });
  const selected = rows.find((d) => d.driverId === selId) ?? null;

  const suspend = async () => {
    if (!selected) return;
    if (suspendReason.trim().length < 3) {
      setNote('Add a short reason.');
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await api.admin.suspendDriver(selected.driverId, suspendReason.trim());
      setShowSuspend(false);
      setSuspendReason('');
      await load();
    } catch (e: unknown) {
      setNote((e as { message?: string }).message ?? 'Could not suspend.');
    } finally {
      setBusy(false);
    }
  };
  const reactivate = async () => {
    if (!selected) return;
    setBusy(true);
    setNote(null);
    try {
      await api.admin.reactivateDriver(selected.driverId);
      await load();
    } catch (e: unknown) {
      setNote((e as { message?: string }).message ?? 'Could not reactivate.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="dx-input"
            placeholder="🔍 Search drivers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <select className="dx-select" style={{ color: MUTED }}>
            <option>All Status</option>
            <option>Online</option>
            <option>Offline</option>
            <option>Busy</option>
          </select>
          <select
            className="dx-select"
            style={{ color: MUTED }}
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value)}
          >
            <option>All KYC</option>
            <option>Verified</option>
            <option>Pending</option>
          </select>
        </div>
        <Card style={{ padding: '12px 16px', flex: 1 }}>
          {drivers === null && !error ? (
            <div style={{ fontSize: 13, color: MUTED, padding: 8 }}>Loading…</div>
          ) : error ? (
            <div style={{ fontSize: 13, color: C_ERR, padding: 8 }}>{error}</div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED, padding: 8 }}>No drivers found.</div>
          ) : (
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {[
                    'Driver',
                    'Phone',
                    'Vehicle',
                    'Rating',
                    'Trips',
                    'Status',
                    'KYC',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '6px 8px',
                        textAlign: 'left',
                        fontSize: 11,
                        color: MUTED,
                        fontWeight: 500,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d, i) => (
                  <tr
                    key={d.driverId}
                    className="dx-row"
                    style={{
                      borderBottom: `1px solid rgba(255,255,255,.04)`,
                      background:
                        selId === d.driverId
                          ? 'rgba(71,207,114,.05)'
                          : i % 2 === 1
                            ? 'rgba(255,255,255,.01)'
                            : 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelId(d.driverId);
                      setShowSuspend(false);
                      setNote(null);
                    }}
                  >
                    <td style={{ padding: '8px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={driverName(d)} size={28} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>
                            {driverName(d)}
                          </div>
                          <div style={{ fontSize: 10, color: MUTED }}>{d.driverId.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: 11.5, color: MUTED }}>
                      {d.phone ?? '—'}
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>—</td>
                    <td style={{ padding: '8px 8px', fontSize: 12, color: MUTED }}>—</td>
                    <td style={{ padding: '8px 8px', fontSize: 12, color: MUTED }}>—</td>
                    <td style={{ padding: '8px 8px' }}>
                      <StatusChip status={driverStatusChip(d.status)} />
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <StatusChip status={driverKycState(d)} />
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn
                          label="View"
                          small
                          outline
                          color={G3}
                          onClick={() => {
                            setSelId(d.driverId);
                            setShowSuspend(false);
                            setNote(null);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {/* Detail panel */}
      {selected && (
        <div style={{ width: 230, flexShrink: 0 }}>
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  color: WHITE,
                }}
              >
                Driver Profile
              </div>
              <button
                onClick={() => setSelId(null)}
                className="dx-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: MUTED,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Avatar name={driverName(selected)} size={48} />
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: 14,
                    fontWeight: 700,
                    color: WHITE,
                  }}
                >
                  {driverName(selected)}
                </div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                  {selected.driverId.slice(0, 8)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <StatusChip status={driverStatusChip(selected.status)} />
                <StatusChip status={driverKycState(selected)} />
              </div>
            </div>
            <SEP />
            {[
              ['Phone', selected.phone ?? '—'],
              ['Email', selected.email],
              ['Vehicle', '—'],
              ['Total Trips', '—'],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <span style={{ fontSize: 11, color: MUTED }}>{k}</span>
                <span style={{ fontSize: 12, color: WHITE, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <SEP />
            {note && <span style={{ fontSize: 11, color: C_WARN }}>{note}</span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {selected.status === 'SUSPENDED' ? (
                <Btn
                  label={busy ? 'Reactivating…' : 'Reactivate Driver'}
                  color={G2}
                  onClick={() => void reactivate()}
                />
              ) : showSuspend ? (
                <>
                  <input
                    className="dx-input"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Reason for suspension"
                  />
                  <Btn
                    label={busy ? 'Suspending…' : 'Confirm Suspend'}
                    color={C_WARN}
                    onClick={() => void suspend()}
                  />
                  <Btn
                    label="Cancel"
                    color={MUTED}
                    outline
                    onClick={() => {
                      setShowSuspend(false);
                      setNote(null);
                    }}
                  />
                </>
              ) : (
                <Btn
                  label="Suspend Driver"
                  color={C_WARN}
                  outline
                  onClick={() => setShowSuspend(true)}
                />
              )}
              <Btn
                label="Deactivate Account"
                color={C_ERR}
                outline
                onClick={() =>
                  setNote('No permanent-deactivate endpoint yet — use Suspend to disable a driver.')
                }
              />
              <Btn
                label="View Trip History"
                color={G3}
                onClick={() =>
                  setNote('Trip history opens with the Trips screen (being wired next).')
                }
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Page: Driver KYC ─────────────────────────────────────────────────────────
const KYC_DOC_LABELS: Record<string, string> = {
  DRIVER_LICENSE: "Driver's Licence",
  NATIONAL_ID: 'NIN / National ID',
  PASSPORT: 'Passport',
  VEHICLE_REGISTRATION: 'Vehicle Reg. Cert',
  BUSINESS_REGISTRATION: 'Business Registration',
  CAC_CERTIFICATE: 'CAC Certificate',
  GUARANTOR_ID: 'Guarantor ID',
  INSURANCE: 'Insurance',
};
const kycDocLabel = (t: string) => KYC_DOC_LABELS[t] ?? t.replace(/_/g, ' ');
const driverName = (d: AdminDriverDto) =>
  `${d.firstName} ${d.lastName}`.trim() || d.driverId.slice(0, 8);

// One reviewable KYC document — real verify/reject against /admin/driver/kyc/:id.
function KycDocCard({ doc, onDone }: { doc: AdminDriverKycDto; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState<null | 'verify' | 'reject'>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const verify = async () => {
    setBusy('verify');
    setErr(null);
    try {
      await api.admin.verifyDriverKyc(doc.id);
      await onDone();
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Could not verify.');
      setBusy(null);
    }
  };
  const reject = async () => {
    if (reason.trim().length < 3) {
      setErr('Add a short reason.');
      return;
    }
    setBusy('reject');
    setErr(null);
    try {
      await api.admin.rejectDriverKyc(doc.id, reason.trim());
      await onDone();
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Could not reject.');
      setBusy(null);
    }
  };

  const st = doc.verificationStatus;
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: WHITE }}>
        {kycDocLabel(doc.documentType)}
      </div>
      <div
        style={{
          height: 90,
          background: doc.frontImage
            ? `center / cover no-repeat url(${doc.frontImage})`
            : 'rgba(255,255,255,.04)',
          borderRadius: 6,
          border: `1px dashed ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: MUTED,
          fontSize: 24,
        }}
      >
        {!doc.frontImage && '📄'}
      </div>
      {err && <span style={{ fontSize: 11, color: C_ERR }}>{err}</span>}
      {st !== 'PENDING' ? (
        <StatusChip status={st === 'VERIFIED' ? 'verified' : 'rejected'} />
      ) : rejecting ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            className="dx-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn
              label={busy === 'reject' ? '…' : 'Confirm'}
              small
              color={C_ERR}
              onClick={() => void reject()}
            />
            <Btn label="Cancel" small color={MUTED} outline onClick={() => setRejecting(false)} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn
            label={busy === 'verify' ? '…' : 'Approve'}
            small
            color={C_OK}
            onClick={() => void verify()}
          />
          <Btn label="Reject" small color={C_ERR} outline onClick={() => setRejecting(true)} />
        </div>
      )}
    </Card>
  );
}

function PageDrvKYC() {
  const [drivers, setDrivers] = useState<AdminDriverDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.admin.listDrivers();
      setDrivers(res.items);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load the KYC queue.');
      setDrivers([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // The queue is every driver with at least one document still awaiting review.
  const queue = (drivers ?? []).filter((d) =>
    d.kyc.some((k) => k.verificationStatus === 'PENDING'),
  );
  const sel = queue.find((d) => d.driverId === selId) ?? queue[0] ?? null;

  if (drivers === null && !error) {
    return (
      <Card>
        <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          Loading…
        </span>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <span style={{ fontSize: 13, color: C_ERR, fontFamily: 'Inter, sans-serif' }}>{error}</span>
      </Card>
    );
  }
  if (queue.length === 0) {
    return (
      <Card>
        <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          No drivers are awaiting KYC review.
        </span>
      </Card>
    );
  }

  const pendingDocs = sel ? sel.kyc.filter((k) => k.verificationStatus === 'PENDING') : [];
  const approveAll = async () => {
    for (const k of pendingDocs) {
      try {
        await api.admin.verifyDriverKyc(k.id);
      } catch {
        /* continue; per-doc errors surface on the cards after reload */
      }
    }
    await load();
  };

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      {/* Queue */}
      <div style={{ width: 230, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 13, color: WHITE }}
        >
          Pending Queue ({queue.length})
        </div>
        {queue.map((q) => {
          const pend = q.kyc.filter((k) => k.verificationStatus === 'PENDING').length;
          return (
            <Card
              key={q.driverId}
              style={{
                cursor: 'pointer',
                padding: '12px 14px',
                borderColor: sel?.driverId === q.driverId ? `${G3}44` : BORDER,
              }}
              onClick={() => setSelId(q.driverId)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar name={driverName(q)} size={32} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: WHITE,
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {driverName(q)}
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                    {q.phone ?? q.email}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                      {q.kyc.length} docs
                    </span>
                    <StatusChip status={pend > 0 ? 'pending' : 'verified'} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {/* Review panel */}
      {sel && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={driverName(sel)} size={36} />
            <div>
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 15,
                  fontWeight: 700,
                  color: WHITE,
                }}
              >
                {driverName(sel)}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
                KYC Review · {sel.kyc.length} documents submitted
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Btn label="Approve All" color={G2} onClick={() => void approveAll()} />
            </div>
          </div>
          {/* Document grid — real submitted documents */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {sel.kyc.map((doc) => (
              <KycDocCard key={doc.id} doc={doc} onDone={load} />
            ))}
          </div>
          {/* Selfie / face-match — no biometric backend (Smile ID removed), so
              this is shown as unavailable rather than a fake match score. */}
          <Card style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div
              style={{
                width: 70,
                height: 70,
                background: 'rgba(255,255,255,.04)',
                borderRadius: 8,
                border: `1px dashed ${BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                flexShrink: 0,
              }}
            >
              🤳
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 13,
                  fontWeight: 600,
                  color: WHITE,
                  marginBottom: 4,
                }}
              >
                Selfie Verification
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
                Automated face-match isn&apos;t enabled — review the ID photos above manually.
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Page: Vehicles ────────────────────────────────────────────────────────────
// One reviewable vehicle card — real approve/reject against /admin/vehicles.
function VehicleReviewCard({
  v,
  onResolved,
}: {
  v: AdminVehicleDto;
  onResolved: (id: string) => void;
}) {
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [showReject, setShowReject] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // VehicleDto carries no per-document verification state (that lives in driver
  // KYC, not the vehicle), so the doc checklist is shown neutral rather than
  // faking pass/fail. Documented gap — a vehicle-doc endpoint would fill it.
  const DOCS = ['Insurance', 'Road Worthiness', 'Vehicle Reg.', 'Inspection'];
  const ANGLES = ['Front', 'Rear', 'Left Side', 'Right Side'];

  const approve = async () => {
    setBusy('approve');
    setErr(null);
    try {
      await api.admin.approveVehicle(v.id);
      onResolved(v.id);
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Could not approve. Try again.');
      setBusy(null);
    }
  };
  const reject = async () => {
    if (reason.trim().length < 5) {
      setErr('Rejection reason must be at least 5 characters.');
      return;
    }
    setBusy('reject');
    setErr(null);
    try {
      await api.admin.rejectVehicle(v.id, reason.trim());
      onResolved(v.id);
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Could not reject. Try again.');
      setBusy(null);
    }
  };

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 700, color: WHITE }}
        >
          {v.make} {v.model} · {v.year}
        </div>
        <span style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          {v.plateNumber}
        </span>
        <Chip label={v.rideCategory} color={C_INFO} />
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            fontSize: 11,
            color: MUTED,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Driver: <Avatar name={v.driverId} size={20} /> {v.driverId.slice(0, 8)}
        </div>
      </div>
      {/* Photo grid — real vehicle photos where present */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {ANGLES.map((angle, idx) => {
          const url = v.photos[idx];
          return (
            <div
              key={angle}
              style={{
                height: 80,
                background: url ? `center / cover no-repeat url(${url})` : 'rgba(255,255,255,.04)',
                borderRadius: 7,
                border: `1px dashed ${BORDER}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              {!url && <span style={{ fontSize: 22 }}>🚗</span>}
              <span
                style={{
                  fontSize: 9,
                  color: url ? '#fff' : MUTED,
                  fontFamily: 'Inter, sans-serif',
                  background: url ? 'rgba(0,0,0,.45)' : 'transparent',
                  padding: url ? '1px 4px' : 0,
                  borderRadius: 3,
                }}
              >
                {angle}
              </span>
            </div>
          );
        })}
      </div>
      {/* Doc checklist — neutral (no per-vehicle doc state on the backend yet) */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {DOCS.map((d) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, color: MUTED }}>•</span>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>{d}</span>
          </div>
        ))}
      </div>
      {err && <span style={{ fontSize: 12, color: C_ERR }}>{err}</span>}
      {showReject ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="dx-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (min 5 characters)"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              label={busy === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
              color={C_ERR}
              onClick={() => void reject()}
            />
            <Btn
              label="Cancel"
              color={MUTED}
              outline
              onClick={() => {
                setShowReject(false);
                setErr(null);
              }}
            />
          </div>
        </div>
      ) : showCorrections ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, color: C_WARN, fontFamily: 'Inter, sans-serif' }}>
            A "request corrections" workflow isn&apos;t available on the backend yet — use Approve
            or Reject (with a reason) for now.
          </span>
          <Btn label="Dismiss" color={MUTED} outline onClick={() => setShowCorrections(false)} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn
            label={busy === 'approve' ? 'Approving…' : 'Approve Vehicle'}
            color={G2}
            onClick={() => void approve()}
          />
          <Btn
            label="Request Corrections"
            color={C_WARN}
            outline
            onClick={() => setShowCorrections(true)}
          />
          <Btn label="Reject" color={C_ERR} outline onClick={() => setShowReject(true)} />
        </div>
      )}
    </Card>
  );
}

function PageVehicles() {
  const [vehicles, setVehicles] = useState<AdminVehicleDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.admin.listVehicles('PENDING');
      setVehicles(res.items);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load pending vehicles.');
      setVehicles([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const onResolved = (id: string) =>
    setVehicles((cur) => (cur ? cur.filter((v) => v.id !== id) : cur));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 700, color: WHITE }}
        >
          Pending Vehicle Approvals
        </div>
        <Chip label={`${vehicles?.length ?? 0} pending`} color={C_WARN} />
      </div>
      {vehicles === null && !error && (
        <Card>
          <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            Loading…
          </span>
        </Card>
      )}
      {error && (
        <Card>
          <span style={{ fontSize: 13, color: C_ERR, fontFamily: 'Inter, sans-serif' }}>
            {error}
          </span>
        </Card>
      )}
      {vehicles && vehicles.length === 0 && !error && (
        <Card>
          <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            No vehicles are awaiting approval.
          </span>
        </Card>
      )}
      {vehicles?.map((v) => (
        <VehicleReviewCard key={v.id} v={v} onResolved={onResolved} />
      ))}
    </div>
  );
}

// ─── Page: Customers ──────────────────────────────────────────────────────────
function PageCustomers() {
  const [selected, setSelected] = useState<(typeof CUSTOMERS)[0] | null>(null);
  const [search, setSearch] = useState('');
  const filtered = CUSTOMERS.filter((c) =>
    (c.name + c.email + c.phone).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="dx-input"
            placeholder="🔍 Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <select className="dx-select" style={{ color: MUTED }}>
            <option>All Status</option>
            <option>Active</option>
            <option>Inactive</option>
            <option>Suspended</option>
          </select>
        </div>
        <Card style={{ padding: '12px 16px' }}>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {[
                  'Customer',
                  'Phone',
                  'Email',
                  'Trips',
                  'Rating',
                  'Total Spent',
                  'Status',
                  'Actions',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '6px 8px',
                      textAlign: 'left',
                      fontSize: 11,
                      color: MUTED,
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={c.id}
                  className="dx-row"
                  style={{
                    borderBottom: `1px solid rgba(255,255,255,.04)`,
                    background:
                      selected?.id === c.id
                        ? 'rgba(71,207,114,.05)'
                        : i % 2 === 1
                          ? 'rgba(255,255,255,.01)'
                          : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelected(c)}
                >
                  <td style={{ padding: '8px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={c.name} size={26} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{c.phone}</td>
                  <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{c.email}</td>
                  <td style={{ padding: '8px 8px', fontSize: 12, color: WHITE }}>{c.trips}</td>
                  <td style={{ padding: '8px 8px' }}>
                    <span style={{ color: C_WARN }}>★</span>
                    <span style={{ fontSize: 12, color: WHITE, fontWeight: 600 }}> {c.rating}</span>
                  </td>
                  <td style={{ padding: '8px 8px', fontSize: 12, color: G3, fontWeight: 600 }}>
                    {c.spent}
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <StatusChip status={c.status} />
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <Btn label="View" small outline color={G3} onClick={() => setSelected(c)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      {selected && (
        <div style={{ width: 230, flexShrink: 0 }}>
          <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  color: WHITE,
                }}
              >
                Customer Profile
              </span>
              <button
                onClick={() => setSelected(null)}
                className="dx-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: MUTED,
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Avatar name={selected.name} size={44} />
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  color: WHITE,
                }}
              >
                {selected.name}
              </div>
              <StatusChip status={selected.status} />
            </div>
            <SEP />
            {[
              ['Phone', selected.phone],
              ['Email', selected.email],
              ['Trips', selected.trips.toString()],
              ['Rating', `★ ${selected.rating}`],
              ['Total Spent', selected.spent],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <span style={{ fontSize: 11, color: MUTED }}>{k}</span>
                <span style={{ fontSize: 11.5, color: WHITE, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <SEP />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Btn label="Block Customer" color={C_ERR} outline />
              <Btn label="View All Trips" color={G3} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Page: Pricing ─────────────────────────────────────────────────────────────
function PagePricing() {
  const [base, setBase] = useState('500');
  const [dist, setDist] = useState('120');
  const [time, setTime] = useState('40');
  const [wait, setWait] = useState('35');
  const [surge, setSurge] = useState(false);
  const [mult, setMult] = useState('1.5');
  const DIST_KM = 14,
    TIME_MIN = 22;
  const calcFare = () => {
    const b = parseFloat(base) || 0;
    const d = parseFloat(dist) || 0;
    const t = parseFloat(time) || 0;
    const m = surge ? parseFloat(mult) || 1 : 1;
    return ((b + d * DIST_KM + t * TIME_MIN) * m).toFixed(0);
  };
  const promos = [] as Record<string, unknown>[]; // mock cleared
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {/* Fare config */}
        <Card style={{ flex: 1 }}>
          <SectionHeader
            title="Fare Configuration · Sedan"
            action={<Chip label="Editing" color={C_WARN} />}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              ['Base Fare (₦)', base, setBase],
              ['Distance Rate (₦/km)', dist, setDist],
              ['Time Rate (₦/min)', time, setTime],
              ['Waiting Fee (₦/min)', wait, setWait],
            ].map(([label, val, setter]) => (
              <div key={label as string}>
                <div
                  style={{
                    fontSize: 11,
                    color: MUTED,
                    fontFamily: 'Inter, sans-serif',
                    marginBottom: 5,
                  }}
                >
                  {label as string}
                </div>
                <input
                  className="dx-input"
                  type="number"
                  value={val as string}
                  onChange={(e) => (setter as any)(e.target.value)}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <Btn label="Save Configuration" color={G2} />
            <Btn label="Reset to Default" color={MUTED} outline />
          </div>
        </Card>
        {/* Surge + preview */}
        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <SectionHeader title="Surge Pricing" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                Enable Surge
              </span>
              <input
                type="checkbox"
                className="dx-toggle"
                checked={surge}
                onChange={(e) => setSurge(e.target.checked)}
              />
            </div>
            {surge && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: MUTED,
                    fontFamily: 'Inter, sans-serif',
                    marginBottom: 5,
                  }}
                >
                  Multiplier
                </div>
                <input
                  className="dx-input"
                  type="number"
                  step="0.1"
                  value={mult}
                  onChange={(e) => setMult(e.target.value)}
                />
              </div>
            )}
          </Card>
          <Card style={{ background: `linear-gradient(135deg,${G0}22,${NAVY_CARD})` }}>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11,
                color: MUTED,
                marginBottom: 4,
              }}
            >
              Live Fare Preview
            </div>
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11,
                color: MUTED,
                marginBottom: 12,
              }}
            >
              {DIST_KM}km · {TIME_MIN}min trip
            </div>
            <div
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 28,
                fontWeight: 700,
                color: G3,
              }}
            >
              ₦{parseInt(calcFare()).toLocaleString()}
            </div>
            {surge && <Chip label={`${mult}× Surge Applied`} color={C_WARN} />}
          </Card>
        </div>
      </div>
      {/* Promos */}
      <Card>
        <SectionHeader
          title="Promo Campaigns"
          action={<Btn label="+ New Promo" small color={G2} />}
        />
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['Code', 'Discount', 'Usage', 'Expires', 'Status', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '6px 8px',
                    textAlign: 'left',
                    fontSize: 11,
                    color: MUTED,
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {promos.map((p, i) => (
              <tr
                key={p.code}
                className="dx-row"
                style={{ borderBottom: `1px solid rgba(255,255,255,.04)` }}
              >
                <td
                  style={{
                    padding: '8px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: G3,
                    fontFamily: 'monospace',
                  }}
                >
                  {p.code}
                </td>
                <td style={{ padding: '8px 8px', fontSize: 12, color: WHITE }}>{p.discount}</td>
                <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{p.usage}</td>
                <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{p.expires}</td>
                <td style={{ padding: '8px 8px' }}>
                  <StatusChip status={p.status} />
                </td>
                <td style={{ padding: '8px 8px' }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <Btn label="Edit" small outline color={G3} />
                    <Btn label="End" small outline color={C_ERR} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Page: Incidents ──────────────────────────────────────────────────────────
function PageIncidents() {
  const [sel, setSel] = useState(0);
  const inc = INCIDENTS[sel];
  if (!inc)
    return (
      <Card>
        <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          No incidents in the queue.
        </span>
      </Card>
    );
  const sevColor = (s: string) =>
    s === 'critical' ? C_ERR : s === 'high' ? C_WARN : s === 'medium' ? C_INFO : MUTED;
  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      {/* Queue */}
      <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 13, color: WHITE }}
        >
          Incident Queue
        </div>
        {INCIDENTS.map((inc, i) => (
          <Card
            key={inc.id}
            style={{
              cursor: 'pointer',
              padding: '12px 14px',
              borderColor: sel === i ? `${G3}55` : BORDER,
            }}
            onClick={() => setSel(i)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{inc.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: WHITE,
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {inc.id}
                  </span>
                  <Chip label={inc.severity} color={sevColor(inc.severity)} />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: MUTED,
                    fontFamily: 'Inter, sans-serif',
                    lineHeight: 1.4,
                  }}
                >
                  {inc.desc.slice(0, 55)}...
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <StatusChip status={inc.status} />
                  <span style={{ fontSize: 10, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                    {inc.time}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {/* Detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{inc.icon}</span>
          <div>
            <div
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 15,
                fontWeight: 700,
                color: WHITE,
              }}
            >
              {inc.id} — {inc.type}
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
              {inc.time} · Trip {inc.trip}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Chip label={inc.severity.toUpperCase()} color={sevColor(inc.severity)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* SVG mini-map for SOS */}
          <Card style={{ flex: 1, padding: 12 }}>
            <div
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: 'Inter, sans-serif',
                marginBottom: 8,
              }}
            >
              Incident Location
            </div>
            <svg
              width="100%"
              height="140"
              viewBox="0 0 300 140"
              style={{ background: '#080f1c', borderRadius: 6 }}
            >
              <line x1={0} y1={70} x2={300} y2={70} stroke="rgba(255,255,255,.1)" strokeWidth={3} />
              <line
                x1={150}
                y1={0}
                x2={150}
                y2={140}
                stroke="rgba(255,255,255,.06)"
                strokeWidth={2}
              />
              <path
                d="M0,50 Q80,45 150,70 Q220,95 300,90"
                stroke="rgba(255,255,255,.08)"
                strokeWidth={2}
                fill="none"
              />
              <text
                x={10}
                y={40}
                fill="rgba(255,255,255,.15)"
                fontSize={9}
                fontFamily="Inter, sans-serif"
              >
                Lekki-Epe Expressway
              </text>
              {inc.type === 'SOS' && (
                <>
                  <circle cx={150} cy={70} r={24} fill={`${C_ERR}22`} />
                  <circle cx={150} cy={70} r={12} fill={`${C_ERR}44`} />
                  <circle cx={150} cy={70} r={6} fill={C_ERR} />
                  <text
                    x={160}
                    y={60}
                    fill={C_ERR}
                    fontSize={10}
                    fontWeight={700}
                    fontFamily="Inter, sans-serif"
                  >
                    🆘 SOS
                  </text>
                </>
              )}
              {inc.type !== 'SOS' && (
                <>
                  <circle cx={150} cy={70} r={8} fill={C_WARN} />
                  <text x={160} y={66} fill={C_WARN} fontSize={10} fontFamily="Inter, sans-serif">
                    {inc.icon}
                  </text>
                </>
              )}
            </svg>
          </Card>
          {/* Info */}
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                fontSize: 12,
                color: WHITE,
                fontFamily: 'Inter, sans-serif',
                lineHeight: 1.6,
              }}
            >
              {inc.desc}
            </div>
            <SEP />
            {[
              ['Driver', inc.driver],
              ['Passenger', inc.passenger],
              ['Trip', inc.trip],
              ['Status', ''],
              ['Time', inc.time],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'Inter, sans-serif',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: MUTED }}>{k}</span>
                {k === 'Status' ? (
                  <StatusChip status={inc.status} />
                ) : (
                  <span style={{ fontSize: 11.5, color: WHITE }}>{v}</span>
                )}
              </div>
            ))}
          </Card>
        </div>
        {/* Actions */}
        <Card style={{ display: 'flex', gap: 10 }}>
          <Btn label="✓ Resolve Incident" color={C_OK} />
          <Btn label="⬆ Escalate" color={C_WARN} outline />
          <Btn label="📞 Contact Driver" color={C_INFO} outline />
          <Btn label="📞 Contact Passenger" color={C_INFO} outline />
          <Btn label="Export Report" color={MUTED} outline />
        </Card>
      </div>
    </div>
  );
}

// ─── Page: Support ────────────────────────────────────────────────────────────
function PageSupport() {
  const [tab, setTab] = useState<'Tickets' | 'Chats' | 'Calls'>('Tickets');
  const [selIdx, setSelIdx] = useState(0);
  const [reply, setReply] = useState('');
  const selTicket = SUPPORT_TICKETS[selIdx];
  if (!selTicket)
    return (
      <Card>
        <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          No support tickets.
        </span>
      </Card>
    );
  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      {/* Left */}
      <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,.05)',
            borderRadius: 8,
            padding: 3,
          }}
        >
          {(['Tickets', 'Chats', 'Calls'] as const).map((t) => (
            <button
              key={t}
              className="dx-btn"
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '5px 0',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                background: tab === t ? NAVY_SURFACE : 'transparent',
                color: tab === t ? WHITE : MUTED,
                fontFamily: 'Inter, sans-serif',
                fontSize: 11.5,
                fontWeight: tab === t ? 600 : 400,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {/* Ticket queue */}
        {SUPPORT_TICKETS.map((tk, i) => (
          <Card
            key={tk.id}
            style={{
              cursor: 'pointer',
              padding: '10px 12px',
              borderColor: selIdx === i ? `${G3}55` : BORDER,
            }}
            onClick={() => setSelIdx(i)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: G3,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {tk.id}
              </span>
              <StatusChip status={tk.status === 'in progress' ? 'in progress ticket' : tk.status} />
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: WHITE,
                fontFamily: 'Inter, sans-serif',
                marginBottom: 2,
              }}
            >
              {tk.customer}
            </div>
            <div style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
              {tk.subject.slice(0, 40)}...
            </div>
            <div
              style={{ fontSize: 10, color: MUTED, fontFamily: 'Inter, sans-serif', marginTop: 4 }}
            >
              {tk.time}
            </div>
          </Card>
        ))}
      </div>
      {/* Chat panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Card
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${BORDER}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Avatar name={selTicket.customer} size={32} />
            <div>
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  color: WHITE,
                }}
              >
                {selTicket.customer}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
                {selTicket.subject}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <Btn label="Resolve" small color={C_OK} />
              <Btn label="Escalate" small color={C_WARN} outline />
            </div>
          </div>
          {/* Messages */}
          <div
            className="dx-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {selTicket.messages.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  color: MUTED,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12,
                  marginTop: 40,
                }}
              >
                No messages yet.
              </div>
            )}
            {selTicket.messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: m.from === 'agent' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '72%',
                    padding: '9px 13px',
                    borderRadius: m.from === 'agent' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.from === 'agent' ? `${G0}` : NAVY_SURFACE,
                    border: `1px solid ${m.from === 'agent' ? G2 + '44' : BORDER}`,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 12.5,
                    color: WHITE,
                    lineHeight: 1.5,
                  }}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          {/* Reply input */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: `1px solid ${BORDER}`,
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              className="dx-input"
              placeholder="Type a reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              style={{ flex: 1 }}
            />
            <Btn label="Send" color={G2} onClick={() => setReply('')} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Page: Analytics ──────────────────────────────────────────────────────────
const PEAK_HOURS: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

function PageAnalytics() {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  // No demand-analytics feed wired yet — return 0 so the heatmap renders empty
  // rather than synthetic values.
  const heatVal = (_d: number, _h: number) => 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Weekly revenue+trips */}
        <Card style={{ flex: 2, padding: '14px 16px' }}>
          <SectionHeader title="Weekly Revenue & Trips" />
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={WEEKLY_DATA} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="day" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tickFormatter={(v: number) => `₦${(v / 1000000).toFixed(1)}M`}
                tick={AXIS_STYLE}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AXIS_STYLE}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                wrapperStyle={{ fontSize: 10, fontFamily: 'Inter, sans-serif', color: MUTED }}
              />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                fill={G2}
                name="Revenue"
                radius={[3, 3, 0, 0]}
                opacity={0.85}
              />
              <Bar
                yAxisId="right"
                dataKey="trips"
                fill={C_INFO}
                name="Trips"
                radius={[3, 3, 0, 0]}
                opacity={0.7}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        {/* Driver growth */}
        <Card style={{ flex: 1, padding: '14px 16px' }}>
          <SectionHeader title="Driver Growth (6 mo)" />
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={DRIVER_GROWTH} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="month" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={42} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="drivers"
                stroke={G3}
                strokeWidth={2.5}
                dot={{ fill: G3, r: 3 }}
                name="Drivers"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
      {/* Peak hours bar */}
      <Card style={{ padding: '14px 16px' }}>
        <SectionHeader title="Peak Hour Demand Distribution" />
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
          {PEAK_HOURS.map((h) => (
            <div
              key={h.hour}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <div
                style={{
                  width: '100%',
                  borderRadius: '3px 3px 0 0',
                  height: `${h.demand * 0.72}px`,
                  background:
                    h.demand > 80
                      ? `linear-gradient(180deg,${G3},${G0})`
                      : h.demand > 50
                        ? G2
                        : `rgba(43,172,82,.4)`,
                }}
              />
              <span
                style={{
                  fontSize: 8.5,
                  color: MUTED,
                  fontFamily: 'Inter, sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >
                {h.hour}
              </span>
            </div>
          ))}
        </div>
      </Card>
      {/* Heatmap */}
      <Card style={{ padding: '14px 16px' }}>
        <SectionHeader title="Demand Heatmap — Trips by Day × Hour" />
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <div style={{ width: 32 }} />
            {HOURS.map((h) => (
              <div
                key={h}
                style={{
                  width: 18,
                  fontSize: 8,
                  color: MUTED,
                  fontFamily: 'Inter, sans-serif',
                  textAlign: 'center',
                }}
              >
                {h % 3 === 0 ? `${h}h` : ''}
              </div>
            ))}
          </div>
          {DAYS.map((d, di) => (
            <div key={d} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
              <div
                style={{
                  width: 32,
                  fontSize: 9.5,
                  color: MUTED,
                  fontFamily: 'Inter, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {d}
              </div>
              {HOURS.map((h) => {
                const v = heatVal(di, h);
                const alpha = v / 100;
                return (
                  <div
                    key={h}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      background:
                        v < 15
                          ? `rgba(239,68,68,${alpha * 0.8})`
                          : v < 40
                            ? `rgba(245,158,11,${alpha})`
                            : `rgba(43,172,82,${alpha})`,
                      title: `${d} ${h}:00 — ${Math.round(v)}%`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Page: Reports ────────────────────────────────────────────────────────────
function PageReports() {
  const [from, setFrom] = useState('2025-07-01');
  const [to, setTo] = useState('2025-07-20');
  const reportTypes = [
    { icon: '💰', label: 'Revenue Report', desc: 'Earnings breakdown by day, vehicle type' },
    { icon: '🚗', label: 'Trips Report', desc: 'Trip volume, duration, distance stats' },
    { icon: '🧑‍✈️', label: 'Driver Report', desc: 'Performance, ratings, hours online' },
    { icon: '👥', label: 'Customer Report', desc: 'Activity, spending, churn analysis' },
    { icon: '⚠️', label: 'Incident Report', desc: 'Incident frequency, resolution time' },
    { icon: '🎧', label: 'Support Report', desc: 'Ticket volume, CSAT scores' },
  ];
  const generated = [] as Record<string, unknown>[]; // mock cleared
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Date range */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
              From
            </span>
            <input
              className="dx-input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ width: 140 }}
            />
            <span style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>To</span>
            <input
              className="dx-input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ width: 140 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Today', 'This Week', 'This Month', 'Last Month'].map((p) => (
              <button
                key={p}
                className="dx-btn"
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'Inter, sans-serif',
                  background: 'rgba(255,255,255,.06)',
                  color: MUTED,
                  border: `1px solid ${BORDER}`,
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </Card>
      {/* Report types grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {reportTypes.map((r) => (
          <Card key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>{r.icon}</span>
              <div>
                <div
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: WHITE,
                  }}
                >
                  {r.label}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: MUTED }}>
                  {r.desc}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn label="PDF" small color={C_ERR} />
              <Btn label="Excel" small color={C_OK} />
            </div>
          </Card>
        ))}
      </div>
      {/* Generated reports */}
      <Card>
        <SectionHeader title="Generated Reports" />
        {generated.map((g, i) => (
          <div
            key={g.name}
            className="dx-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderBottom: i < generated.length - 1 ? `1px solid ${BORDER}` : 'none',
            }}
          >
            <span style={{ fontSize: 18 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  color: WHITE,
                }}
              >
                {g.name}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: MUTED }}>
                {g.format} · {g.size} · Generated {g.date}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn label="Download" small color={G2} />
              <Btn label="Share" small color={MUTED} outline />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Page: Settings ────────────────────────────────────────────────────────────
function PageSettings() {
  const [settingsTab, setSettingsTab] = useState<
    'General' | 'Notifications' | 'Roles' | 'Integrations'
  >('General');
  const [toggles, setToggles] = useState({
    autoAssign: true,
    receipts: true,
    sos: true,
    maintenance: false,
  });
  const integrations = [] as Record<string, unknown>[]; // mock cleared
  const roles = [] as Record<string, unknown>[]; // mock cleared
  const notifEvents = [
    ['New trip request', true, true, false],
    ['Driver SOS alert', true, true, true],
    ['KYC submission', true, false, false],
    ['High severity incident', true, true, true],
    ['System maintenance', true, false, false],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          background: 'rgba(255,255,255,.04)',
          borderRadius: 8,
          padding: 4,
          width: 'fit-content',
        }}
      >
        {(['General', 'Notifications', 'Roles', 'Integrations'] as const).map((t) => (
          <button
            key={t}
            className="dx-btn"
            onClick={() => setSettingsTab(t)}
            style={{
              padding: '6px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              background: settingsTab === t ? NAVY_SURFACE : 'transparent',
              color: settingsTab === t ? WHITE : MUTED,
              fontFamily: 'Inter, sans-serif',
              fontSize: 12.5,
              fontWeight: settingsTab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {settingsTab === 'General' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              key: 'autoAssign',
              label: 'Auto-assign Rides',
              desc: 'Automatically assign nearest driver to new trip requests',
            },
            {
              key: 'receipts',
              label: 'Trip Receipts',
              desc: 'Send email receipts to customers after every completed trip',
            },
            {
              key: 'sos',
              label: 'SOS Alerts',
              desc: 'Notify operations team immediately when driver activates SOS',
            },
            {
              key: 'maintenance',
              label: 'Maintenance Mode',
              desc: 'Disable the app for all users during system maintenance',
            },
          ].map(({ key, label, desc }) => (
            <Card key={key} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    color: WHITE,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 11,
                    color: MUTED,
                    marginTop: 2,
                  }}
                >
                  {desc}
                </div>
              </div>
              <input
                type="checkbox"
                className="dx-toggle"
                checked={toggles[key as keyof typeof toggles]}
                onChange={(e) => setToggles((t) => ({ ...t, [key]: e.target.checked }))}
              />
            </Card>
          ))}
        </div>
      )}
      {settingsTab === 'Notifications' && (
        <Card>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Event', 'In-App', 'Email', 'SMS'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '6px 8px',
                      textAlign: 'left',
                      fontSize: 11,
                      color: MUTED,
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notifEvents.map(([ev, inapp, email, sms], i) => (
                <tr
                  key={i as number}
                  className="dx-row"
                  style={{ borderBottom: `1px solid rgba(255,255,255,.04)` }}
                >
                  <td style={{ padding: '9px 8px', fontSize: 12, color: WHITE }}>{ev as string}</td>
                  {[inapp, email, sms].map((v, ci) => (
                    <td key={ci} style={{ padding: '9px 8px' }}>
                      <input type="checkbox" className="dx-toggle" defaultChecked={v as boolean} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {settingsTab === 'Roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {roles.map((r) => (
            <Card key={r.name}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: 13,
                    fontWeight: 700,
                    color: WHITE,
                  }}
                >
                  {r.name}
                </div>
                <Chip label={`${r.members} members`} color={G3} />
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {r.perms.map((p) => (
                  <Chip key={p} label={p} color={C_INFO} />
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <Btn label="Manage Role" small outline color={G3} />
              </div>
            </Card>
          ))}
        </div>
      )}
      {settingsTab === 'Integrations' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {integrations.map((int) => (
            <Card key={int.name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{int.icon}</span>
                <div>
                  <div
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 13,
                      fontWeight: 700,
                      color: WHITE,
                    }}
                  >
                    {int.name}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: MUTED }}>
                    {int.desc}
                  </div>
                </div>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <StatusChip status={int.status ? 'enabled' : 'disabled'} />
                <input type="checkbox" className="dx-toggle" defaultChecked={int.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page: Audit Logs ─────────────────────────────────────────────────────────
function PageAuditLogs() {
  const [search, setSearch] = useState('');
  const filtered = AUDIT_LOGS.filter((a) =>
    (a.admin + a.action + a.target).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="dx-input"
          placeholder="🔍 Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <div style={{ marginLeft: 'auto' }}>
          <Btn label="Export CSV" color={G2} />
        </div>
      </div>
      <Card style={{ padding: '12px 16px' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['Timestamp', 'Admin', 'Action', 'Target', 'IP Address'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '6px 8px',
                    textAlign: 'left',
                    fontSize: 11,
                    color: MUTED,
                    fontWeight: 500,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a, i) => (
              <tr
                key={i}
                className="dx-row"
                style={{
                  borderBottom: `1px solid rgba(255,255,255,.04)`,
                  background: i % 2 === 1 ? 'rgba(255,255,255,.01)' : 'transparent',
                }}
              >
                <td
                  style={{
                    padding: '8px 8px',
                    fontSize: 10.5,
                    color: MUTED,
                    fontFamily: 'monospace',
                  }}
                >
                  {a.ts}
                </td>
                <td style={{ padding: '8px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Avatar name={a.admin} size={22} />
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: WHITE }}>{a.admin}</div>
                      <div style={{ fontSize: 9.5, color: MUTED }}>{a.role}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '8px 8px', fontSize: 11.5, color: G3, fontWeight: 500 }}>
                  {a.action}
                </td>
                <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{a.target}</td>
                <td
                  style={{
                    padding: '8px 8px',
                    fontSize: 10.5,
                    color: MUTED,
                    fontFamily: 'monospace',
                  }}
                >
                  {a.ip}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          {filtered.length} of {AUDIT_LOGS.length} records
        </div>
      </Card>
    </div>
  );
}

// ─── Page: Profile ────────────────────────────────────────────────────────────
function PageProfile() {
  const u = auth.getUser();
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [twoFA, setTwoFA] = useState(true);
  const [name, setName] = useState(u ? `${u.firstName} ${u.lastName}`.trim() : '');
  const [email, setEmail] = useState(u?.email ?? '');
  const [phone, setPhone] = useState(u?.phone ?? '');
  const roleLabel =
    u?.roles?.[0]?.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()) ?? 'Operations';
  const sessions = [] as Record<string, unknown>[]; // mock cleared
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {/* Profile card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div style={{ position: 'relative' }}>
              <Avatar name={name || 'Operations'} size={60} />
              <button
                className="dx-btn"
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: G2,
                  border: 'none',
                  color: NAVY_DEEP,
                  fontSize: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✎
              </button>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 15,
                  fontWeight: 700,
                  color: WHITE,
                }}
              >
                {name || 'Operations'}
              </div>
              <Chip label={roleLabel} color={G3} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Full Name', name, setName],
              ['Email Address', email, setEmail],
              ['Phone Number', phone, setPhone],
            ].map(([label, val, setter]) => (
              <div key={label as string}>
                <div
                  style={{
                    fontSize: 10.5,
                    color: MUTED,
                    fontFamily: 'Inter, sans-serif',
                    marginBottom: 4,
                  }}
                >
                  {label as string}
                </div>
                <input
                  className="dx-input"
                  value={val as string}
                  onChange={(e) => (setter as any)(e.target.value)}
                />
              </div>
            ))}
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: MUTED,
                  fontFamily: 'Inter, sans-serif',
                  marginBottom: 4,
                }}
              >
                Department
              </div>
              <input className="dx-input" value={roleLabel} readOnly />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn label="Save Changes" color={G2} />
          </div>
        </Card>
      </div>
      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Security */}
        <Card>
          <SectionHeader title="Security" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: WHITE,
                  }}
                >
                  Two-Factor Authentication
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
                  Requires OTP on every login
                </div>
              </div>
              <input
                type="checkbox"
                className="dx-toggle"
                checked={twoFA}
                onChange={(e) => setTwoFA(e.target.checked)}
              />
            </div>
            <SEP />
            <Btn label="Change Password" color={MUTED} outline />
          </div>
        </Card>
        {/* Notifications */}
        <Card>
          <SectionHeader title="Notifications" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Email Notifications', emailNotif, setEmailNotif],
              ['Push Notifications', pushNotif, setPushNotif],
            ].map(([label, val, setter]) => (
              <div
                key={label as string}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: WHITE }}>
                  {label as string}
                </span>
                <input
                  type="checkbox"
                  className="dx-toggle"
                  checked={val as boolean}
                  onChange={(e) => (setter as any)(e.target.checked)}
                />
              </div>
            ))}
          </div>
        </Card>
        {/* Sessions */}
        <Card>
          <SectionHeader title="Active Sessions" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{s.device.includes('iPhone') ? '📱' : '💻'}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 12,
                      fontWeight: 600,
                      color: WHITE,
                    }}
                  >
                    {s.device}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: MUTED }}>
                    {s.location} · {s.time}
                  </div>
                </div>
                {s.current ? (
                  <Chip label="Current" color={G3} />
                ) : (
                  <Btn label="Revoke" small outline color={C_ERR} />
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Page router ──────────────────────────────────────────────────────────────
function renderPage(page: AdminPage) {
  switch (page) {
    case 'dashboard':
      return <PageDashboard />;
    case 'livemap':
      return <PageLiveMap />;
    case 'trips':
      return <PageTrips />;
    case 'drivers':
      return <PageDrivers />;
    case 'drvkyc':
      return <PageDrvKYC />;
    case 'vehicles':
      return <PageVehicles />;
    case 'customers':
      return <PageCustomers />;
    case 'pricing':
      return <PagePricing />;
    case 'incidents':
      return <PageIncidents />;
    case 'support':
      return <PageSupport />;
    case 'analytics':
      return <PageAnalytics />;
    case 'reports':
      return <PageReports />;
    case 'settings':
      return <PageSettings />;
    case 'auditlogs':
      return <PageAuditLogs />;
    case 'profile':
      return <PageProfile />;
    default:
      return <PageDashboard />;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
// A session is an Operations session only when it carries the operations_staff
// role or an operations:* permission — a leftover customer/merchant token must
// not slip past the gate (its /admin/* calls would all 403).
function isOpsAuthed(): boolean {
  const u = auth.getUser();
  if (!u || !auth.getAccessToken()) return false;
  return (
    u.roles.includes('operations_staff') ||
    u.roles.includes('admin') ||
    u.permissions.some((p) => p.startsWith('operations:'))
  );
}

// Ops sign-in — the console's front door. Reuses the existing Card/Btn/dx-input
// visual language (no new design) and the real POST /auth/login/operations.
function OpsSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.auth.loginOperations({ email, password });
      auth.setTokens(res.accessToken, res.refreshToken);
      auth.setUser(res.user);
      if (!isOpsAuthed()) {
        auth.clear();
        setError('This account does not have Operations access.');
        return;
      }
      onSignedIn();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: 641,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        background: NAVY_BASE,
      }}
    >
      <Card style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 17,
              fontWeight: 700,
              color: WHITE,
            }}
          >
            DrippleX Operations
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
            Sign in to the Operations Console
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Email</div>
          <input
            className="dx-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ops@dripplex.com"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Password</div>
          <input
            className="dx-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
        </div>
        {error && <div style={{ fontSize: 12, color: C_ERR }}>{error}</div>}
        <Btn label={loading ? 'Signing in…' : 'Sign In'} color={G2} onClick={() => void submit()} />
      </Card>
    </div>
  );
}

export function AdminConsoleScreen({ initialPage = 'dashboard' }: { initialPage?: AdminPage }) {
  const [page, setPage] = useState<AdminPage>(initialPage);
  const [authed, setAuthed] = useState<boolean>(() => isOpsAuthed());
  const [badges, setBadges] = useState<NavBadges>({});
  const handleSignOut = () => {
    auth.clear();
    setAuthed(false);
    setPage('dashboard');
  };

  // Real sidebar badge counts. Each source is independent so one failing queue
  // never blanks the others; absent/0 simply shows no badge.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    void (async () => {
      const next: NavBadges = {};
      try {
        next.vehicles = (await api.admin.listVehicles('PENDING')).items.length;
      } catch {
        /* leave unset */
      }
      try {
        next.drvkyc = (await api.admin.listDrivers()).items.filter((d) =>
          d.kyc.some((k) => k.verificationStatus === 'PENDING'),
        ).length;
      } catch {
        /* leave unset */
      }
      try {
        const c = await api.admin.getOpsCounters();
        next.incidents = c.openIncidentsCount;
        next.support = c.openSupportTicketsCount;
      } catch {
        /* leave unset */
      }
      if (!cancelled) setBadges(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, page]);

  if (!authed) return <OpsSignIn onSignedIn={() => setAuthed(true)} />;
  return (
    <div
      style={{
        width: '100%',
        height: 641,
        display: 'flex',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
        background: NAVY_BASE,
      }}
    >
      <Sidebar page={page} onNav={setPage} badges={badges} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <Header page={page} onNav={setPage} onSignOut={handleSignOut} />
        <div
          className="dx-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 18,
            background: NAVY_BASE,
          }}
        >
          {renderPage(page)}
          {/* Bottom padding */}
          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Thin wrapper exports ─────────────────────────────────────────────────────
export const AdminDashboardScreen = () => <AdminConsoleScreen initialPage="dashboard" />;
export const AdminLiveMapScreen = () => <AdminConsoleScreen initialPage="livemap" />;
export const AdminTripsScreen = () => <AdminConsoleScreen initialPage="trips" />;
export const AdminDriversScreen = () => <AdminConsoleScreen initialPage="drivers" />;
export const AdminKYCScreen = () => <AdminConsoleScreen initialPage="drvkyc" />;
export const AdminVehiclesScreen = () => <AdminConsoleScreen initialPage="vehicles" />;
export const AdminCustomersScreen = () => <AdminConsoleScreen initialPage="customers" />;
export const AdminPricingScreen = () => <AdminConsoleScreen initialPage="pricing" />;
export const AdminIncidentsScreen = () => <AdminConsoleScreen initialPage="incidents" />;
export const AdminSupportScreen = () => <AdminConsoleScreen initialPage="support" />;
export const AdminAnalyticsScreen = () => <AdminConsoleScreen initialPage="analytics" />;
export const AdminReportsScreen = () => <AdminConsoleScreen initialPage="reports" />;
export const AdminSettingsScreen = () => <AdminConsoleScreen initialPage="settings" />;
export const AdminAuditScreen = () => <AdminConsoleScreen initialPage="auditlogs" />;
export const AdminProfileScreen = () => <AdminConsoleScreen initialPage="profile" />;
