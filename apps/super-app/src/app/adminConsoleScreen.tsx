import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  api,
  type AdminVehicleDto,
  type AdminDriverDto,
  type AdminDriverKycDto,
  type AdminOperationsCaseDto,
  type AdminFleetDriverDto,
  type AdminFleetSummaryDto,
  type AdminLiveRideDto,
  type AdminCustomerDto,
  type AdminMerchantDto,
  type AdminInspectionDto,
  type SettlementReportDto,
  type AdminRiderDto,
  type DeliveryJobDto,
  type RideFareRateDto,
  type RideSurchargeTrigger,
  type RideSurchargeType,
  type RideSurchargeZoneDto,
  type RideType,
} from '../lib/api';
import { auth } from '../lib/auth';
import { addressPredictions, geocodeAddress, loadGoogleMaps, mapsEnabled } from '../lib/maps';

import type { AddressPrediction } from '../lib/maps';
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
  | 'inspections'
  | 'settlements'
  | 'merchants'
  | 'riders'
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
    /* Poppins and Inter come from the <link> in index.html — see the note in
       merchantScreen.tsx. Re-importing here re-fetched faces the page already
       had, at a narrower weight range than the app uses. */
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
  disabled = false,
}: {
  label: string;
  color?: string;
  outline?: boolean;
  small?: boolean;
  onClick?: () => void;
  /** So an action that is mid-flight cannot be fired twice. */
  disabled?: boolean;
}) {
  return (
    <button
      className="dx-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: outline ? `1px solid ${color}` : 'none',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
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

function Card({
  children,
  style,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  // Three queue rows pass an onClick and set `cursor: pointer`. Card silently
  // dropped it, so those rows looked clickable and selected nothing.
  onClick?: () => void;
}) {
  return (
    <div
      className="dx-card"
      onClick={onClick}
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

const REVENUE_DATA: Record<string, unknown>[] = []; // mock cleared — no revenue time-series feed yet

const WEEKLY_DATA: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

const DRIVER_GROWTH: Record<string, unknown>[] = []; // mock cleared — wired to backend per screen

/**
 * Shapes for the Ops screens that still have no backend feed.
 *
 * Each list below stays **empty** — nothing is invented, and the gaps remain
 * recorded in docs/reference/DPX-OPS-PREVIEW-WIRING-STATUS.md. What changes is
 * that the row is named instead of `Record<string, unknown>`: the render code
 * then typechecks, and the type states exactly which fields an endpoint has to
 * return before the screen can light up. An untyped bag documents nothing and
 * silently renders `undefined` the day something half-shaped is wired in.
 */
interface AuditLogRow {
  admin: string;
  action: string;
  target: string;
  role: string;
  ts: string;
  ip: string;
}

interface PromoRow {
  code: string;
  discount: string;
  usage: string;
  expires: string;
  status: string;
}

interface GeneratedReportRow {
  name: string;
  format: string;
  size: string;
  date: string;
}

interface RoleRow {
  name: string;
  members: number;
  perms: string[];
}

interface IntegrationRow {
  name: string;
  icon: string;
  desc: string;
  /** Enabled, as the toggle reads it. */
  status: boolean;
}

interface AdminSessionRow {
  device: string;
  location: string;
  time: string;
  /** The session the operator is looking at it from. */
  current: boolean;
}

const AUDIT_LOGS: AuditLogRow[] = []; // mock cleared — no ops audit-log feed yet

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV_ITEMS: { page: AdminPage; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '⬛', label: 'Dashboard' },
  { page: 'livemap', icon: '🗺️', label: 'Live Map' },
  { page: 'trips', icon: '🚗', label: 'Trips' },
  { page: 'drivers', icon: '🧑‍✈️', label: 'Drivers' },
  { page: 'drvkyc', icon: '🪪', label: 'Driver KYC' },
  { page: 'vehicles', icon: '🔑', label: 'Vehicles' },
  { page: 'inspections', icon: '🔧', label: 'Inspections' },
  { page: 'settlements', icon: '💰', label: 'Settlements' },
  { page: 'merchants', icon: '🏪', label: 'Merchants' },
  { page: 'riders', icon: '🛵', label: 'Riders' },
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
  // merchants/riders were missing since those desks shipped, so their header
  // title rendered blank; inspections would have joined them.
  inspections: 'Vehicle Inspections',
  settlements: 'Weekly Settlements',
  merchants: 'Merchants',
  riders: 'Riders',
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
  const [fleet, setFleet] = useState<AdminFleetSummaryDto | null>(null);
  const [rides, setRides] = useState<AdminLiveRideDto[] | null>(null);
  const [overview, setOverview] = useState<{ ridesCompleted: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Each metric source is independent — a failure in one leaves that tile at
    // "—" rather than blanking the whole dashboard.
    void api.admin.getOpsCounters().then(
      (v) => !cancelled && setCounters(v),
      () => {},
    );
    void api.admin.getFleet().then(
      (v) => !cancelled && setFleet(v.summary),
      () => {},
    );
    const loadRides = () =>
      api.admin.getRideQueue().then(
        (v) => !cancelled && setRides(v.rides),
        () => {},
      );
    void loadRides();
    // The "Live Trip Feed" card advertises Auto-refresh: ON — honour it by
    // re-polling the live ride queue on the platform's 15s cadence.
    const rideTimer = setInterval(() => void loadRides(), 15000);
    // "Completed today" — analytics overview scoped to the start of today → now.
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    void api.admin.getAnalyticsOverview(startOfToday.toISOString(), now.toISOString()).then(
      (v) => !cancelled && setOverview({ ridesCompleted: v.ridesCompleted }),
      () => {},
    );
    return () => {
      cancelled = true;
      clearInterval(rideTimer);
    };
  }, []);

  // Real counters where available; every other tile shows "—" rather than a fake
  // number until its metric is wired (revenue has no backend feed yet).
  const c = (n: number | undefined) => (n === undefined ? '—' : String(n));
  const activeTrips = rides === null ? undefined : rides.length;
  // Naira axis/tooltip formatter for the revenue chart (₦, K/M abbreviated).
  const fmt = (n: number) =>
    '₦' +
    (n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n);

  // Trip Status pie from the real live ride queue (status distribution).
  const pieData = (() => {
    if (!rides || rides.length === 0) return [] as { name: string; value: number; color: string }[];
    const buckets: Record<string, { value: number; color: string }> = {};
    const colorFor = (label: string) =>
      label === 'in progress'
        ? C_OK
        : label === 'accepted'
          ? G2
          : label === 'arriving'
            ? C_WARN
            : C_INFO;
    for (const r of rides) {
      const label = LIVE_RIDE_STATUS_LABEL[r.status];
      buckets[label] = { value: (buckets[label]?.value ?? 0) + 1, color: colorFor(label) };
    }
    return Object.entries(buckets).map(([name, v]) => ({
      name: name.replace(/\b\w/g, (m) => m.toUpperCase()),
      value: v.value,
      color: v.color,
    }));
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Row 1 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KpiCard label="Active Trips" value={c(activeTrips)} sub="Live now" color={G3} icon="🚗" />
        <KpiCard
          label="Pending Requests"
          value={c(counters?.waitingReviewCount)}
          sub="Awaiting review"
          color={C_WARN}
          icon="⏳"
        />
        <KpiCard
          label="Completed Today"
          value={c(overview?.ridesCompleted)}
          sub="Rides"
          color={C_OK}
          icon="✅"
        />
        <KpiCard label="Revenue Today" value="—" sub="No feed yet" color={G2} icon="💰" />
      </div>
      {/* KPI Row 2 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KpiCard
          label="Online Drivers"
          value={c(fleet?.onlineCount)}
          sub="Now"
          color={C_OK}
          icon="🟢"
        />
        <KpiCard
          label="Offline Drivers"
          value={c(fleet?.offlineCount)}
          sub="Now"
          color={MUTED}
          icon="⚫"
        />
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
          {pieData.length === 0 ? (
            <div
              style={{
                height: 120,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: MUTED,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              No live rides.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={52}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {pieData.map((e, i) => (
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
          )}
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
            {(rides ?? []).map((t, i) => {
              const route = `${t.pickupAddress ?? `${t.pickupLatitude.toFixed(2)},${t.pickupLongitude.toFixed(2)}`} → ${t.dropoffAddress ?? `${t.dropoffLatitude.toFixed(2)},${t.dropoffLongitude.toFixed(2)}`}`;
              return (
                <tr
                  key={t.rideId}
                  className="dx-row"
                  style={{
                    borderBottom: `1px solid ${BORDER}`,
                    background: i % 2 === 1 ? 'rgba(255,255,255,.01)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '7px 8px', fontSize: 11.5, color: G3, fontWeight: 600 }}>
                    {t.rideId.slice(0, 8)}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 11.5, color: WHITE }}>
                    {t.driverName ?? '—'}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 11.5, color: WHITE }}>
                    {t.customerName}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 11, color: MUTED }}>{route}</td>
                  <td style={{ padding: '7px 8px', fontSize: 11.5, color: MUTED, fontWeight: 600 }}>
                    —
                  </td>
                  <td style={{ padding: '7px 8px' }}>
                    <StatusChip status={LIVE_RIDE_STATUS_LABEL[t.status]} />
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 11, color: MUTED }}>—</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rides !== null && rides.length === 0 && (
          <div
            style={{ marginTop: 10, fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}
          >
            No live rides right now.
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Page: Live Map ───────────────────────────────────────────────────────────
// Project real lat/long onto the decorative map viewBox by normalising each
// driver's position within the bounding box of all plotted drivers. This is an
// honest *relative* plot (real coordinates, real spread) — it does not claim a
// driver sits on a specific illustrated street.
function projectFleet(
  drivers: AdminFleetDriverDto[],
): { d: AdminFleetDriverDto; x: number; y: number }[] {
  const withCoords = drivers.filter((d) => d.latitude != null && d.longitude != null);
  if (withCoords.length === 0) return [];
  const lats = withCoords.map((d) => d.latitude as number);
  const lons = withCoords.map((d) => d.longitude as number);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const spanLat = maxLat - minLat || 1;
  const spanLon = maxLon - minLon || 1;
  const PAD_X = 50;
  const PAD_Y = 50;
  const W = 650 - PAD_X * 2;
  const H = 400 - PAD_Y * 2;
  return withCoords.map((d) => ({
    d,
    x: withCoords.length === 1 ? 325 : PAD_X + (((d.longitude as number) - minLon) / spanLon) * W,
    // invert latitude so north is up
    y:
      withCoords.length === 1 ? 200 : PAD_Y + (1 - ((d.latitude as number) - minLat) / spanLat) * H,
  }));
}

function fleetDotColor(s: AdminFleetDriverDto['status']): string {
  switch (s) {
    case 'SOS':
      return C_ERR;
    case 'SUSPENDED':
      return C_ERR;
    case 'NEEDS_INSPECTION':
      return C_WARN;
    case 'BUSY':
      return C_WARN;
    case 'AVAILABLE':
      return G3;
    default:
      return MUTED;
  }
}

function PageLiveMap() {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Available', 'Busy', 'Trips'];
  const [fleet, setFleet] = useState<{
    drivers: AdminFleetDriverDto[];
    summary: AdminFleetSummaryDto;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.admin.getFleet();
      setFleet(res);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load the live fleet.');
      setFleet({
        drivers: [],
        summary: {
          totalDrivers: 0,
          onlineCount: 0,
          availableCount: 0,
          busyCount: 0,
          offlineCount: 0,
          sosCount: 0,
          suspendedCount: 0,
          needsInspectionCount: 0,
        },
      });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const allDrivers = fleet?.drivers ?? [];
  const drivers = allDrivers.filter((d) =>
    filter === 'All'
      ? true
      : filter === 'Available'
        ? d.status === 'AVAILABLE'
        : filter === 'Busy'
          ? d.status === 'BUSY'
          : d.activeRideId != null,
  );
  const projected = projectFleet(drivers);
  const activeCount = fleet?.summary.onlineCount ?? 0;
  const tripsInProgress = allDrivers.filter((d) => d.activeRideId != null).length;
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
            {/* Driver dots — real drivers plotted by normalised lat/long */}
            {projected.map(({ d, x, y }) => {
              const color = fleetDotColor(d.status);
              return (
                <g key={d.driverId}>
                  <circle cx={x} cy={y} r={10} fill={color} opacity={0.18} />
                  <circle cx={x} cy={y} r={5} fill={color} />
                  <text
                    x={x + 8}
                    y={y - 8}
                    fill={WHITE}
                    fontSize={8.5}
                    fontFamily="Inter, sans-serif"
                  >
                    {`${d.firstName} ${d.lastName}`.trim()}
                  </text>
                </g>
              );
            })}
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
            <div style={{ fontSize: 12, color: G3, fontWeight: 600 }}>
              {activeCount} Active Drivers
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>{tripsInProgress} Trips in Progress</div>
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
          {error && (
            <Card style={{ padding: '10px 12px' }}>
              <span style={{ fontSize: 11.5, color: C_ERR, fontFamily: 'Inter, sans-serif' }}>
                {error}
              </span>
            </Card>
          )}
          {!error && drivers.length === 0 && (
            <Card style={{ padding: '10px 12px' }}>
              <span style={{ fontSize: 11.5, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                No drivers online.
              </span>
            </Card>
          )}
          {drivers.map((d) => {
            const name = `${d.firstName} ${d.lastName}`.trim() || '—';
            return (
              <Card key={d.driverId} style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={name} size={28} />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: WHITE,
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {name}
                    </div>
                    <Chip
                      label={lifecycleLabelFromFleet(d.status)}
                      color={fleetDotColor(d.status)}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function lifecycleLabelFromFleet(s: AdminFleetDriverDto['status']): string {
  return s
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

// ─── Page: Trips ──────────────────────────────────────────────────────────────
// The Operations ride queue is live-only (active rides between request and
// settlement); it has no historical Completed/Cancelled rows, so those filter
// tabs simply match nothing here.
const LIVE_RIDE_STATUS_LABEL: Record<AdminLiveRideDto['status'], string> = {
  REQUESTED: 'searching',
  SEARCHING: 'searching',
  DRIVER_ASSIGNED: 'accepted',
  ARRIVED: 'arriving',
  IN_PROGRESS: 'in progress',
};

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
  const [rides, setRides] = useState<AdminLiveRideDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRides((await api.admin.getRideQueue()).rides);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load the live ride queue.');
      setRides([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const liveRides = rides ?? [];
  const filtered = liveRides.filter((t) => {
    const label = LIVE_RIDE_STATUS_LABEL[t.status];
    const matchesStatus = activeStatus === 'All' || label === activeStatus.toLowerCase();
    const hay = (
      t.rideId +
      (t.driverName ?? '') +
      t.customerName +
      (t.pickupAddress ?? '') +
      (t.dropoffAddress ?? '')
    ).toLowerCase();
    return matchesStatus && hay.includes(search.toLowerCase());
  });
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
            {filtered.map((t) => {
              const pickup =
                t.pickupAddress ??
                `${t.pickupLatitude.toFixed(3)}, ${t.pickupLongitude.toFixed(3)}`;
              const dropoff =
                t.dropoffAddress ??
                `${t.dropoffLatitude.toFixed(3)}, ${t.dropoffLongitude.toFixed(3)}`;
              return (
                <tr
                  key={t.rideId}
                  className="dx-row"
                  style={{ borderBottom: `1px solid rgba(255,255,255,.04)` }}
                >
                  <td style={{ padding: '8px 8px', fontSize: 11.5, color: G3, fontWeight: 700 }}>
                    {t.rideId.slice(0, 8)}
                  </td>
                  <td style={{ padding: '8px 8px', fontSize: 12, color: WHITE }}>
                    {t.driverName ?? '—'}
                  </td>
                  <td style={{ padding: '8px 8px', fontSize: 12, color: WHITE }}>
                    {t.customerName}
                  </td>
                  <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{pickup}</td>
                  <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{dropoff}</td>
                  <td style={{ padding: '8px 8px', fontSize: 12, color: MUTED, fontWeight: 600 }}>
                    —
                  </td>
                  <td style={{ padding: '8px 8px' }}>
                    <StatusChip status={LIVE_RIDE_STATUS_LABEL[t.status]} />
                  </td>
                  <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>—</td>
                  <td style={{ padding: '8px 8px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <Btn
                        label="View"
                        small
                        outline
                        color={G3}
                        onClick={() =>
                          setRowMsg(
                            `Ride ${t.rideId.slice(0, 8)} · ${t.customerName}${t.driverName ? ` ↔ ${t.driverName}` : ''} · ${LIVE_RIDE_STATUS_LABEL[t.status]}`,
                          )
                        }
                      />
                      <Btn
                        label="Cancel"
                        small
                        outline
                        color={C_ERR}
                        onClick={() =>
                          setRowMsg(
                            'Cancelling a ride from Operations isn’t available — the ride lifecycle is owned by the rider/driver apps (read-only here).',
                          )
                        }
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {error && (
          <div
            style={{ marginTop: 10, fontSize: 12, color: C_ERR, fontFamily: 'Inter, sans-serif' }}
          >
            {error}
          </div>
        )}
        {!error && rides !== null && filtered.length === 0 && (
          <div
            style={{ marginTop: 10, fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}
          >
            {liveRides.length === 0
              ? 'No live rides right now.'
              : 'No live rides match this filter (the queue is live-only — no completed/cancelled history).'}
          </div>
        )}
        {rides === null && !error && (
          <div
            style={{ marginTop: 10, fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}
          >
            Loading…
          </div>
        )}
        {rowMsg && (
          <div
            style={{ marginTop: 10, fontSize: 11.5, color: WHITE, fontFamily: 'Inter, sans-serif' }}
          >
            {rowMsg}
          </div>
        )}
        {rides !== null && filtered.length > 0 && (
          <div
            style={{ marginTop: 10, fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}
          >
            Showing {filtered.length} of {liveRides.length} live rides
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Page: Drivers ─────────────────────────────────────────────────────────────
/**
 * The three documents DrippleX actually requires of a driver, mirroring
 * REQUIRED_DRIVER_KYC_DOCUMENT_TYPES in the backend's driver.constants.ts. The
 * activation gate demands all three VERIFIED; anything less does not activate
 * anyone, so nothing less may be labelled "Verified" on this desk.
 */
const REQUIRED_DRIVER_KYC_DOCS = ['DRIVER_LICENSE', 'VEHICLE_REGISTRATION', 'GUARANTOR_ID'];

/**
 * This read "any one document verified → Verified", which is why every driver
 * on the desk showed **KYC Verified** next to **Status Pending** and looked
 * like a platform bug. It was not: one verified licence out of three required
 * documents is a driver who cannot be activated, being described as done.
 *
 * "Verified" now means what the activation gate means by it — every required
 * document verified. Partial progress reads as "pending", which is the truth.
 */
const driverKycState = (d: AdminDriverDto): 'verified' | 'pending' | 'unverified' => {
  const verified = REQUIRED_DRIVER_KYC_DOCS.filter((type) =>
    d.kyc.some((k) => k.documentType === type && k.verificationStatus === 'VERIFIED'),
  );
  if (verified.length === REQUIRED_DRIVER_KYC_DOCS.length) return 'verified';
  if (verified.length > 0 || d.kyc.some((k) => k.verificationStatus === 'PENDING'))
    return 'pending';
  return 'unverified';
};

/** "2 of 3 documents verified" — so the desk says how far along, not just that
 * something is outstanding. */
const driverKycProgress = (d: AdminDriverDto): string => {
  const verified = REQUIRED_DRIVER_KYC_DOCS.filter((type) =>
    d.kyc.some((k) => k.documentType === type && k.verificationStatus === 'VERIFIED'),
  ).length;
  return `${verified}/${REQUIRED_DRIVER_KYC_DOCS.length} docs`;
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
  // The sixth activation condition nobody could satisfy: `identityVerified` is
  // set only by an automated IDV provider (not yet chosen) or by this manual
  // review, which had a backend endpoint and no caller anywhere in the console.
  const verifyIdentity = async () => {
    if (!selected) return;
    setBusy(true);
    setNote(null);
    try {
      await api.admin.verifyDriverIdentity(
        selected.driverId,
        'Reviewed against submitted documents in Operations Console',
      );
      setNote('Identity verified. The driver can now be approved once their other steps pass.');
      await load();
    } catch (e: unknown) {
      setNote((e as { message?: string }).message ?? 'Could not verify identity.');
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StatusChip status={driverKycState(d)} />
                        {driverKycState(d) !== 'verified' && (
                          <span style={{ fontSize: 10, color: MUTED }}>{driverKycProgress(d)}</span>
                        )}
                      </div>
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
              <Btn
                label={busy ? 'Verifying…' : 'Mark Identity Verified'}
                color={G3}
                outline
                onClick={() => void verifyIdentity()}
              />
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

// ─── Page: Weekly Settlements ─────────────────────────────────────────────────
/**
 * DPX-PAYOUT-001 — the Monday payout run.
 *
 * Founder decision (2026-08-16): Operations transfers manually and works from
 * a generated report. So this page is the report: who is waiting, how much,
 * and the account to send it to. It does not move money — marking a line paid
 * is the same per-request action the withdrawal queue has always used, so
 * opening this page twice changes nothing.
 */
function PageSettlements() {
  const [report, setReport] = useState<SettlementReportDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    api.admin
      .getSettlementReport()
      .then((r) => {
        setReport(r);
        setError(null);
      })
      .catch((e: unknown) =>
        setError((e as { message?: string }).message ?? 'Could not load the settlement report.'),
      );
  }, []);
  useEffect(() => load(), [load]);

  const markPaid = async (withdrawalId: string, name: string) => {
    setBusyId(withdrawalId);
    setNote(null);
    try {
      await api.admin.completeWithdrawal(withdrawalId, 'Paid by bank transfer (weekly run)');
      setNote(`Marked ${name} as paid.`);
      load();
    } catch (e: unknown) {
      setNote((e as { message?: string }).message ?? 'Could not mark that one paid.');
    } finally {
      setBusyId(null);
    }
  };

  const money = (n: number) => `₦${Math.round(n).toLocaleString()}`;
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });

  if (error !== null) {
    return (
      <Card>
        <span style={{ color: C_WARN, fontSize: 12 }}>{error}</span>
      </Card>
    );
  }
  if (report === null) {
    return (
      <Card>
        <span style={{ color: MUTED, fontSize: 12 }}>Loading the settlement report…</span>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            ['Week of', day(report.weekStart)],
            ['Riders', String(report.totals.riderCount)],
            ['Drivers', String(report.totals.driverCount)],
            ['Rider total', money(report.totals.riderAmount)],
            ['Driver total', money(report.totals.driverAmount)],
            ['To transfer', money(report.totals.totalAmount)],
          ].map(([label, value]) => (
            <div key={label}>
              <p style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>{label}</p>
              <p
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: label === 'To transfer' ? G3 : WHITE,
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
        {note !== null && <p style={{ marginTop: 10, fontSize: 11, color: G3 }}>{note}</p>}
      </Card>

      <Card>
        {report.lines.length === 0 ? (
          <span style={{ color: MUTED, fontSize: 12 }}>
            Nobody is waiting to be paid. Payout requests appear here as riders and drivers make
            them, and are transferred on Monday.
          </span>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: MUTED, fontSize: 11 }}>
                  {[
                    'Partner',
                    'Phone',
                    'Bank',
                    'Account',
                    'Requested',
                    'Owes DrippleX',
                    'Amount',
                    '',
                  ].map((h) => (
                    <th key={h} style={{ padding: '8px 8px', fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr key={line.withdrawalId} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontSize: 13, color: WHITE, fontWeight: 600 }}>{line.name}</div>
                      <div style={{ fontSize: 10, color: MUTED }}>
                        {line.partnerType === 'RIDER' ? 'Rider' : 'Driver'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: MUTED }}>
                      {line.phone ?? '—'}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: WHITE }}>
                      {line.bankName}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: WHITE }}>
                      <div>{line.accountNumber}</div>
                      <div style={{ fontSize: 10, color: MUTED }}>{line.accountName}</div>
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: MUTED }}>
                      {day(line.requestedAt)}
                    </td>
                    {/* Shown, never subtracted — netting a payout against cash
                        owed is a policy decision nobody has recorded. */}
                    <td
                      style={{
                        padding: '10px 8px',
                        fontSize: 12,
                        color: line.outstandingCommission > 0 ? C_WARN : MUTED,
                      }}
                    >
                      {line.outstandingCommission > 0 ? money(line.outstandingCommission) : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 13, color: G3, fontWeight: 700 }}>
                      {money(line.amount)}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <Btn
                        label={busyId === line.withdrawalId ? 'Marking…' : 'Mark paid'}
                        small
                        outline
                        color={G3}
                        onClick={() => void markPaid(line.withdrawalId, line.name)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Page: Inspections ────────────────────────────────────────────────────────
/**
 * The physical vehicle inspection desk (DPX-DRIVER-002 Phase 3).
 *
 * The backend has had /admin/inspections since the inspection module shipped —
 * list, checklist, decide — but nothing in the console ever called it, so a
 * DrippleX officer had no way to record a walkthrough and a supervisor no way
 * to pass or fail one. `inspectionPassed` is one of the six conditions in the
 * driver activation gate, so with no desk no driver could ever be activated.
 *
 * The role split is the backend's, not a new idea: recording the checklist
 * needs INSPECTION_CHECKLIST_MANAGE, deciding needs INSPECTION_APPROVE.
 */
/**
 * DPX-DRIVER-002 — the walkthrough an officer works through on site.
 *
 * ⚠️ PROVISIONAL — awaiting founder sign-off. The API takes the checklist as
 * free-form items (key/label/passed/notes, 1–50), and nothing in this codebase
 * or in docs/ defines DrippleX's official roadworthiness list. These are
 * ordinary vehicle-safety checks, not a standard anyone has approved, so they
 * are a starting point rather than the specification. The officer can edit,
 * remove or add rows on site, and replacing this array replaces the default
 * everywhere.
 */
const DEFAULT_INSPECTION_CHECKLIST: { key: string; label: string }[] = [
  { key: 'tyres', label: 'Tyres — tread depth and condition' },
  { key: 'brakes', label: 'Brakes — response and handbrake' },
  { key: 'lights', label: 'Lights — head, brake, indicators, hazards' },
  { key: 'mirrors_glass', label: 'Mirrors and windscreen — intact, clear view' },
  { key: 'seatbelts', label: 'Seatbelts — all seats, latch and retract' },
  { key: 'horn_wipers', label: 'Horn and wipers — working' },
  { key: 'fluid_leaks', label: 'No visible oil, fuel or coolant leak' },
  { key: 'body_doors', label: 'Body and doors — open, close and lock' },
  { key: 'interior', label: 'Interior — clean, seats secure' },
  { key: 'fire_extinguisher', label: 'Fire extinguisher and warning triangle on board' },
  { key: 'plate_matches', label: 'Plate number matches the registered vehicle' },
];

const INSPECTION_STATUS_CHIP: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: C_WARN },
  PASSED: { label: 'Passed', color: C_OK },
  FAILED: { label: 'Failed', color: C_ERR },
  CANCELLED: { label: 'Cancelled', color: MUTED },
};

function InspectionCard({
  inspection,
  reload,
}: {
  inspection: AdminInspectionDto;
  reload: () => void;
}) {
  const [busy, setBusy] = useState<null | 'pass' | 'fail' | 'checklist'>(null);
  const [notes, setNotes] = useState('');
  const [showFail, setShowFail] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The officer's walkthrough, filled in on site. `POST /admin/inspections/:id
  // /checklist` has existed since the inspection module shipped and nothing
  // called it, so there was no way to record one — and the backend refuses a
  // decision until a checklist exists, which left every inspection stuck.
  const [recording, setRecording] = useState(false);
  const [items, setItems] = useState<
    { key: string; label: string; passed: boolean; note: string }[]
  >(() => DEFAULT_INSPECTION_CHECKLIST.map((item) => ({ ...item, passed: true, note: '' })));
  const [newItem, setNewItem] = useState('');
  const chip = INSPECTION_STATUS_CHIP[inspection.status] ?? {
    label: inspection.status,
    color: MUTED,
  };
  const decided = inspection.status === 'PASSED' || inspection.status === 'FAILED';
  const checklist = inspection.checklist ?? [];
  const failedItems = checklist.filter((item) => !item.passed);

  const saveChecklist = async (): Promise<void> => {
    setBusy('checklist');
    setErr(null);
    try {
      await api.admin.recordInspectionChecklist(inspection.id, {
        checklist: items.map((item) => ({
          key: item.key,
          label: item.label,
          passed: item.passed,
          ...(item.note.trim() ? { notes: item.note.trim() } : {}),
        })),
      });
      setRecording(false);
      reload();
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Could not save the walkthrough.');
    } finally {
      setBusy(null);
    }
  };

  const decide = async (passed: boolean): Promise<void> => {
    setBusy(passed ? 'pass' : 'fail');
    setErr(null);
    try {
      await api.admin.decideInspection(inspection.id, passed, notes.trim() || undefined);
      setShowFail(false);
      setNotes('');
      reload();
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Could not record the decision.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🔧</span>
        <div>
          {/* The driver leads: this desk is a queue of people to inspect, and
              "Inspection ae0b509c" told the inspector nothing about who. */}
          <div
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              color: WHITE,
            }}
          >
            {inspection.driverName ?? 'Unknown driver'}
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>
            {inspection.vehiclePlate ?? `Inspection ${inspection.id.slice(0, 8)}`}
          </div>
        </div>
        {inspection.reinspectionOfId && <Chip label="Re-inspection" color={C_INFO} />}
        <div style={{ marginLeft: 'auto' }}>
          <Chip {...chip} />
        </div>
      </div>
      <SEP />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Named, not referenced. This printed `driverId.slice(0, 8)` and
            `vehicleId.slice(0, 8)` — an inspector standing in a yard cannot
            match "ae0b509c" to the person in front of them or the car on the
            ramp, which is the one thing a physical inspection depends on. */}
        <DetailRow label="Driver" value={inspection.driverName ?? 'Unknown driver'} />
        {inspection.driverPhone !== null && (
          <DetailRow label="Phone" value={inspection.driverPhone} />
        )}
        <DetailRow
          label="Vehicle"
          value={
            [inspection.vehiclePlate, inspection.vehicleLabel].filter(Boolean).join(' · ') ||
            'Unknown vehicle'
          }
        />
        <DetailRow label="Scheduled" value={new Date(inspection.scheduledAt).toLocaleString()} />
        {inspection.completedAt && (
          <DetailRow label="Decided" value={new Date(inspection.completedAt).toLocaleString()} />
        )}
        {inspection.notes && <DetailRow label="Notes" value={inspection.notes} />}
      </div>

      {/* The officer's walkthrough. Empty until the checklist is recorded. */}
      {checklist.length > 0 ? (
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: 'rgba(255,255,255,.03)',
            border: `1px solid ${BORDER}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: WHITE }}>
            Walkthrough ({checklist.length - failedItems.length}/{checklist.length} passed)
          </span>
          {checklist.map((item) => (
            <div key={item.key} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, color: item.passed ? C_OK : C_ERR }}>
                {item.passed ? '✓' : '✕'}
              </span>
              <span style={{ fontSize: 11.5, color: WHITE }}>{item.label}</span>
              {item.notes && <span style={{ fontSize: 11, color: MUTED }}>— {item.notes}</span>}
            </div>
          ))}
        </div>
      ) : recording ? (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'rgba(255,255,255,.03)',
            border: `1px solid ${BORDER}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: WHITE }}>
            Record the walkthrough — tap an item to mark it failed
          </span>
          {items.map((item, index) => (
            <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => {
                    setItems((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, passed: !row.passed } : row)),
                    );
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    flexShrink: 0,
                    cursor: 'pointer',
                    background: item.passed ? 'rgba(43,172,82,.16)' : 'rgba(239,68,68,.16)',
                    border: `1px solid ${item.passed ? G2 : C_ERR}`,
                    color: item.passed ? C_OK : C_ERR,
                    fontSize: 12,
                  }}
                >
                  {item.passed ? '✓' : '✕'}
                </button>
                <span style={{ fontSize: 11.5, color: WHITE, flex: 1 }}>{item.label}</span>
                <button
                  onClick={() => {
                    setItems((prev) => prev.filter((_, i) => i !== index));
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: MUTED,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
              {/* A failure that says only "failed" tells the driver nothing
                  about what to put right before the re-inspection. */}
              {!item.passed && (
                <input
                  className="dx-input"
                  value={item.note}
                  onChange={(e) => {
                    const { value } = e.target;
                    setItems((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, note: value } : row)),
                    );
                  }}
                  placeholder="What exactly is wrong? The driver sees this."
                />
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="dx-input"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add another check…"
              style={{ flex: 1 }}
            />
            <Btn
              label="Add"
              color={MUTED}
              outline
              onClick={() => {
                const label = newItem.trim();
                if (label === '' || items.length >= 50) return;
                setItems((prev) => [
                  ...prev,
                  { key: `custom_${String(prev.length + 1)}`, label, passed: true, note: '' },
                ]);
                setNewItem('');
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn
              label={busy === 'checklist' ? 'Saving…' : 'Save walkthrough'}
              color={G2}
              onClick={busy || items.length === 0 ? undefined : () => void saveChecklist()}
            />
            <Btn
              label="Cancel"
              color={MUTED}
              outline
              onClick={() => {
                setRecording(false);
                setErr(null);
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11.5, color: C_WARN, fontFamily: 'Inter, sans-serif' }}>
            No walkthrough recorded yet — an officer records the checklist on site before a
            supervisor can decide.
          </span>
          {!decided && (
            <div>
              <Btn label="Record walkthrough" color={G2} onClick={() => setRecording(true)} />
            </div>
          )}
        </div>
      )}

      {inspection.photos.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {inspection.photos.map((photo, i) => (
            <a
              key={photo}
              href={photo}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11.5, color: G2 }}
            >
              Photo {i + 1} ↗
            </a>
          ))}
        </div>
      )}

      {err && <span style={{ fontSize: 12, color: C_ERR }}>{err}</span>}

      {/* Pass/Fail only once a walkthrough exists. The backend refuses a
          decision without one ("Checklist must be recorded before a decision
          can be made"), so offering the buttons first just produced an error
          the supervisor could do nothing about. */}
      {!decided &&
        checklist.length > 0 &&
        (showFail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="dx-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What failed? The driver sees this."
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                label={busy === 'fail' ? 'Recording…' : 'Confirm Fail'}
                color={C_ERR}
                onClick={busy ? undefined : () => void decide(false)}
              />
              <Btn
                label="Cancel"
                color={MUTED}
                outline
                onClick={() => {
                  setShowFail(false);
                  setErr(null);
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn
              label={busy === 'pass' ? 'Recording…' : 'Pass Inspection'}
              color={G2}
              onClick={busy ? undefined : () => void decide(true)}
            />
            <Btn label="Fail Inspection" color={C_ERR} outline onClick={() => setShowFail(true)} />
          </div>
        ))}
    </Card>
  );
}

function PageInspections() {
  const [inspections, setInspections] = useState<AdminInspectionDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'SCHEDULED' | 'PASSED' | 'FAILED' | 'CANCELLED' | 'ALL'>(
    'SCHEDULED',
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.admin.listInspections(filter === 'ALL' ? undefined : filter);
      setInspections(res.items);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load inspections.');
      setInspections([]);
    }
  }, [filter]);
  useEffect(() => {
    void load();
  }, [load]);

  const awaiting = (inspections ?? []).filter((i) => i.status === 'SCHEDULED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 700, color: WHITE }}
        >
          Vehicle Inspections
        </div>
        <Chip label={`${awaiting} awaiting decision`} color={C_WARN} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['SCHEDULED', 'PASSED', 'FAILED', 'CANCELLED', 'ALL'] as const).map((f) => (
          <Btn
            key={f}
            label={f === 'ALL' ? 'All' : (INSPECTION_STATUS_CHIP[f]?.label ?? f)}
            color={filter === f ? G2 : MUTED}
            outline={filter !== f}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      {inspections === null && !error && (
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
      {inspections && inspections.length === 0 && !error && (
        <Card>
          <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            No inspections in this state.
          </span>
        </Card>
      )}
      {inspections?.map((inspection) => (
        <InspectionCard key={inspection.id} inspection={inspection} reload={() => void load()} />
      ))}
    </div>
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

// ─── Merchants & Riders review desks ─────────────────────────────────────────
// Both personas share the same lifecycle status enum and KYC status shape, so
// the status chips are shared. Pending/Under-review are actionable (approve/
// reject); approved can be suspended; suspended can be reactivated.
const PERSONA_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: C_WARN },
  UNDER_REVIEW: { label: 'Under Review', color: C_INFO },
  APPROVED: { label: 'Approved', color: C_OK },
  REJECTED: { label: 'Rejected', color: C_ERR },
  SUSPENDED: { label: 'Suspended', color: C_ERR },
};
const personaStatus = (s: string) => PERSONA_STATUS[s] ?? { label: s, color: MUTED };
const kycChip = (s?: string) =>
  s === 'VERIFIED'
    ? { label: 'KYC Verified', color: C_OK }
    : s === 'REJECTED'
      ? { label: 'KYC Rejected', color: C_ERR }
      : s === 'PENDING'
        ? { label: 'KYC Pending', color: C_WARN }
        : { label: 'No KYC', color: MUTED };
const isActionable = (s: string) => s === 'PENDING' || s === 'UNDER_REVIEW';

// A small row of persona detail values.
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontFamily: 'Inter, sans-serif' }}>
      <span style={{ fontSize: 11, color: MUTED, minWidth: 64 }}>{label}</span>
      <span style={{ fontSize: 11.5, color: WHITE }}>{value}</span>
    </div>
  );
}

// ─── Page: Merchants ──────────────────────────────────────────────────────────
function MerchantReviewCard({ m, reload }: { m: AdminMerchantDto; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [showKycReject, setShowKycReject] = useState(false);
  const [kycRemarks, setKycRemarks] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const run = async (action: string, fn: () => Promise<unknown>) => {
    setBusy(action);
    setErr(null);
    try {
      await fn();
      reload();
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Action failed. Try again.');
    } finally {
      // Always clear the spinner. Clearing it only on failure left a button
      // reading "Verifying…"/"Approving…" forever after a SUCCESSFUL action,
      // because reload() refreshes the data but React keeps this component
      // instance — and its busy state — mounted.
      setBusy(null);
    }
  };
  const reject = () => {
    if (reason.trim().length < 5) {
      setErr('Rejection reason must be at least 5 characters.');
      return;
    }
    void run('reject', () => api.admin.rejectMerchant(m.merchantId, reason.trim()));
  };
  const rejectKyc = () => {
    if (kycRemarks.trim().length < 3) {
      setErr('Say why the document is rejected (at least 3 characters).');
      return;
    }
    void run('kyc-reject', () => api.admin.rejectMerchantKyc(m.merchantId, kycRemarks.trim()));
  };
  const st = personaStatus(m.status);
  // The backend surfaces the document Operations must act on next — the oldest
  // PENDING one — so this panel drains a multi-document submission (CAC, then
  // director's NIN) one review at a time.
  const kycDoc = m.kyc;
  const kyc = kycChip(kycDoc?.verificationStatus);
  const name = `${m.firstName} ${m.lastName}`.trim() || '—';

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>🏪</span>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 700, color: WHITE }}
        >
          {m.business?.businessName ?? 'Business not set'}
        </div>
        {m.business?.businessType && (
          <Chip label={m.business.businessType.replace(/_/g, ' ')} color={C_INFO} />
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Chip {...kyc} />
          <Chip {...st} />
        </div>
      </div>
      <SEP />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <DetailRow label="Owner" value={name} />
        <DetailRow label="Email" value={m.email} />
        <DetailRow label="Phone" value={m.phone ?? '—'} />
        <DetailRow
          label="Location"
          value={[m.business?.city, m.business?.state].filter(Boolean).join(', ') || '—'}
        />
        {m.status === 'REJECTED' && m.rejectedReason && (
          <DetailRow label="Reason" value={m.rejectedReason} />
        )}
      </div>
      {/* Business document review. A merchant submits several documents (CAC
          certificate, director's NIN, …); this panel shows the one awaiting
          review and re-renders with the next one after each decision. */}
      {kycDoc && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 10,
            borderRadius: 8,
            background: 'rgba(255,255,255,.03)',
            border: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: WHITE }}>Business document</span>
            <div style={{ marginLeft: 'auto' }}>
              <Chip {...kyc} />
            </div>
          </div>
          <DetailRow label="Type" value={kycDocLabel(kycDoc.documentType)} />
          <DetailRow label="Number" value={kycDoc.documentNumber ?? '—'} />
          {kycDoc.remarks && <DetailRow label="Remarks" value={kycDoc.remarks} />}
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href={kycDoc.frontImage}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11.5, color: G2 }}
            >
              View document ↗
            </a>
            {kycDoc.backImage && (
              <a
                href={kycDoc.backImage}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11.5, color: G2 }}
              >
                View back ↗
              </a>
            )}
          </div>
          {kycDoc.verificationStatus === 'PENDING' &&
            (showKycReject ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="dx-input"
                  value={kycRemarks}
                  onChange={(e) => setKycRemarks(e.target.value)}
                  placeholder="Why is this document rejected? (min 3 characters)"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn
                    label={busy === 'kyc-reject' ? 'Rejecting…' : 'Confirm Reject KYC'}
                    color={C_ERR}
                    onClick={rejectKyc}
                  />
                  <Btn
                    label="Cancel"
                    color={MUTED}
                    outline
                    onClick={() => {
                      setShowKycReject(false);
                      setErr(null);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn
                  label={busy === 'kyc-verify' ? 'Verifying…' : 'Verify KYC'}
                  color={G2}
                  onClick={
                    busy
                      ? undefined
                      : () =>
                          void run('kyc-verify', () => api.admin.verifyMerchantKyc(m.merchantId))
                  }
                />
                <Btn
                  label="Reject KYC"
                  color={C_ERR}
                  outline
                  onClick={() => setShowKycReject(true)}
                />
              </div>
            ))}
        </div>
      )}
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
              onClick={reject}
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
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isActionable(m.status) && (
            <>
              {/* KYC verify/reject live in the Business document panel above. */}
              <Btn
                label={busy === 'approve' ? 'Approving…' : 'Approve Merchant'}
                color={G2}
                onClick={
                  busy
                    ? undefined
                    : () => void run('approve', () => api.admin.approveMerchant(m.merchantId))
                }
              />
              <Btn label="Reject" color={C_ERR} outline onClick={() => setShowReject(true)} />
            </>
          )}
          {m.status === 'APPROVED' && (
            <Btn
              label={busy === 'suspend' ? 'Suspending…' : 'Suspend'}
              color={C_ERR}
              outline
              onClick={
                busy
                  ? undefined
                  : () =>
                      void run('suspend', () =>
                        api.admin.suspendMerchant(m.merchantId, 'Suspended by operations'),
                      )
              }
            />
          )}
          {m.status === 'SUSPENDED' && (
            <Btn
              label={busy === 'reactivate' ? 'Reactivating…' : 'Reactivate'}
              color={G2}
              onClick={
                busy
                  ? undefined
                  : () => void run('reactivate', () => api.admin.reactivateMerchant(m.merchantId))
              }
            />
          )}
        </div>
      )}
    </Card>
  );
}

function PageMerchants() {
  const [merchants, setMerchants] = useState<AdminMerchantDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setMerchants((await api.admin.listMerchants()).items);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load merchants.');
      setMerchants([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const pending = (merchants ?? []).filter((m) => isActionable(m.status)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 700, color: WHITE }}
        >
          Merchant Approvals
        </div>
        <Chip label={`${pending} awaiting review`} color={C_WARN} />
      </div>
      {merchants === null && !error && (
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
      {merchants && merchants.length === 0 && !error && (
        <Card>
          <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            No merchants have registered yet.
          </span>
        </Card>
      )}
      {merchants?.map((m) => (
        <MerchantReviewCard key={m.id} m={m} reload={() => void load()} />
      ))}
    </div>
  );
}

// ─── Page: Riders ─────────────────────────────────────────────────────────────
/**
 * One reviewable rider document, with its own Verify / Reject.
 *
 * A rider submits several documents (their own ID and a guarantor's), and the
 * card used to render only `kyc[0]` — so the second document could never be
 * actioned from the console. That is now a hard blocker rather than a cosmetic
 * one: dispatch requires EVERY required document verified before a rider is
 * offered work, so a rider whose guarantor ID could not be reached would never
 * become eligible. Each document gets its own panel and its own remarks box.
 */
function RiderKycDocPanel({
  doc,
  reload,
}: {
  doc: AdminRiderDto['kyc'][number];
  reload: () => void;
}) {
  const [busy, setBusy] = useState<null | 'verify' | 'reject'>(null);
  const [showReject, setShowReject] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const chip = kycChip(doc.verificationStatus);

  const run = async (action: 'verify' | 'reject', fn: () => Promise<unknown>): Promise<void> => {
    setBusy(action);
    setErr(null);
    try {
      await fn();
      setShowReject(false);
      setRemarks('');
      reload();
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Action failed. Try again.');
    } finally {
      // Always clear the spinner. Leaving it set left the button reading
      // "Verifying…" forever, because reload() replaces the data but React
      // keeps this component instance (and its state) mounted.
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        borderRadius: 8,
        background: 'rgba(255,255,255,.03)',
        border: `1px solid ${BORDER}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: WHITE }}>
          {kycDocLabel(doc.documentType)}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Chip {...chip} />
        </div>
      </div>
      <DetailRow label="Number" value={doc.documentNumber} />
      {doc.remarks && <DetailRow label="Remarks" value={doc.remarks} />}
      <div style={{ display: 'flex', gap: 10 }}>
        <a
          href={doc.frontImage}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11.5, color: G2 }}
        >
          View front ↗
        </a>
        {doc.backImage && (
          <a
            href={doc.backImage}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11.5, color: G2 }}
          >
            View back ↗
          </a>
        )}
      </div>
      {err && <span style={{ fontSize: 12, color: C_ERR }}>{err}</span>}
      {doc.verificationStatus === 'PENDING' &&
        (showReject ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="dx-input"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Why is this document rejected? (min 3 characters)"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                label={busy === 'reject' ? 'Rejecting…' : 'Confirm Reject KYC'}
                color={C_ERR}
                onClick={
                  busy
                    ? undefined
                    : () => {
                        if (remarks.trim().length < 3) {
                          setErr('Rejection remarks must be at least 3 characters.');
                          return;
                        }
                        void run('reject', () => api.admin.rejectRiderKyc(doc.id, remarks.trim()));
                      }
                }
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
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              label={busy === 'verify' ? 'Verifying…' : 'Verify KYC'}
              color={G2}
              onClick={
                busy ? undefined : () => void run('verify', () => api.admin.verifyRiderKyc(doc.id))
              }
            />
            <Btn label="Reject KYC" color={C_ERR} outline onClick={() => setShowReject(true)} />
          </div>
        ))}
    </div>
  );
}

function RiderReviewCard({ r, reload }: { r: AdminRiderDto; reload: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const run = async (action: string, fn: () => Promise<unknown>) => {
    setBusy(action);
    setErr(null);
    try {
      await fn();
      reload();
    } catch (e: unknown) {
      setErr((e as { message?: string }).message ?? 'Action failed. Try again.');
    } finally {
      // Always clear the spinner. Clearing it only on failure left a button
      // reading "Verifying…"/"Approving…" forever after a SUCCESSFUL action,
      // because reload() refreshes the data but React keeps this component
      // instance — and its busy state — mounted.
      setBusy(null);
    }
  };
  const reject = () => {
    if (reason.trim().length < 5) {
      setErr('Rejection reason must be at least 5 characters.');
      return;
    }
    void run('reject', () => api.admin.rejectRider(r.riderId, reason.trim()));
  };
  const st = personaStatus(r.status);
  // Every submitted document, each reviewable on its own — dispatch needs them
  // all verified, so none of them can be unreachable.
  const kycDocs = r.kyc ?? [];
  const name = `${r.firstName} ${r.lastName}`.trim() || '—';

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Avatar name={name} size={28} />
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 700, color: WHITE }}
        >
          {name}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Chip {...st} />
        </div>
      </div>
      <SEP />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <DetailRow label="Company" value={r.companyName ?? '—'} />
        <DetailRow label="Email" value={r.email} />
        <DetailRow label="Phone" value={r.phone ?? '—'} />
        {r.status === 'REJECTED' && r.rejectedReason && (
          <DetailRow label="Reason" value={r.rejectedReason} />
        )}
      </div>
      {/* DPX-RIDER-003 — identity document review, one panel per document. */}
      {kycDocs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: WHITE }}>
            Identity documents ({kycDocs.filter((d) => d.verificationStatus === 'VERIFIED').length}/
            {kycDocs.length} verified)
          </span>
          {kycDocs.map((doc) => (
            <RiderKycDocPanel key={doc.id} doc={doc} reload={reload} />
          ))}
        </div>
      )}

      {err && <span style={{ fontSize: 12, color: C_ERR }}>{err}</span>}
      {showSuspend ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: MUTED }}>
            Suspend {name}? They stop receiving delivery jobs until reactivated.
          </span>
          <input
            className="dx-input"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Reason for suspension (min 5 characters)"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              label={busy === 'suspend' ? 'Suspending…' : 'Confirm Suspend'}
              color={C_ERR}
              onClick={() => {
                if (suspendReason.trim().length < 5) {
                  setErr('Suspension reason must be at least 5 characters.');
                  return;
                }
                void run('suspend', () => api.admin.suspendRider(r.riderId, suspendReason.trim()));
              }}
            />
            <Btn
              label="Cancel"
              color={MUTED}
              outline
              onClick={() => {
                setShowSuspend(false);
                setErr(null);
              }}
            />
          </div>
        </div>
      ) : showReject ? (
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
              onClick={reject}
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
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isActionable(r.status) && (
            <>
              <Btn
                label={busy === 'approve' ? 'Approving…' : 'Approve Rider'}
                color={G2}
                onClick={
                  busy
                    ? undefined
                    : () => void run('approve', () => api.admin.approveRider(r.riderId))
                }
              />
              <Btn label="Reject" color={C_ERR} outline onClick={() => setShowReject(true)} />
            </>
          )}
          {r.status === 'APPROVED' && (
            <Btn
              label="Suspend"
              color={C_ERR}
              outline
              // Confirm first: this used to suspend on a single click, which is
              // easy to hit by mistake next to the status chips.
              onClick={() => setShowSuspend(true)}
            />
          )}
          {r.status === 'SUSPENDED' && (
            <Btn
              label={busy === 'reactivate' ? 'Reactivating…' : 'Reactivate'}
              color={G2}
              onClick={
                busy
                  ? undefined
                  : () => void run('reactivate', () => api.admin.reactivateRider(r.riderId))
              }
            />
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Deliveries that auto-assignment could not place. Dispatch runs exactly once —
 * when the merchant marks the order ready — and only considers riders that are
 * online, accepting, and have coordinates on record. If nobody qualified at
 * that moment the job stays PENDING with no rider and nothing retries it, so
 * the order silently never reaches anyone. This panel is the manual fallback:
 * it calls POST /admin/delivery/:id/assign, which the backend already exposed.
 */
function UnassignedDeliveries({ riders }: { riders: AdminRiderDto[] }) {
  const [jobs, setJobs] = useState<DeliveryJobDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      setJobs((await api.admin.listDeliveryJobs('PENDING')).items);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load deliveries.');
      setJobs([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Only approved riders can be handed a delivery.
  const assignable = riders.filter((r) => r.status === 'APPROVED');
  const unassigned = (jobs ?? []).filter((j) => j.riderId === null);

  if (unassigned.length === 0) return null;

  const assign = async (jobId: string) => {
    const riderId = choice[jobId] ?? assignable[0]?.riderId;
    if (!riderId) return;
    setBusy(jobId);
    setError(null);
    try {
      await api.admin.assignDeliveryRider(jobId, riderId);
      await load();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not assign this delivery.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 700, color: WHITE }}
        >
          Deliveries waiting for a rider
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Chip label={`${unassigned.length} unassigned`} color={C_WARN} />
        </div>
      </div>
      <span style={{ fontSize: 11.5, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
        These orders are ready but no rider was online and sharing location when they were
        dispatched. Assign one by hand.
      </span>
      {error && <span style={{ fontSize: 12, color: C_ERR }}>{error}</span>}
      {assignable.length === 0 && (
        <span style={{ fontSize: 12, color: C_WARN }}>
          No approved riders yet — approve a rider before assigning.
        </span>
      )}
      {unassigned.map((j) => (
        <div
          key={j.id}
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 10,
            borderRadius: 8,
            background: 'rgba(255,255,255,.03)',
            border: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 180 }}>
            <span style={{ fontSize: 11.5, color: WHITE }}>Order {j.orderId.slice(0, 8)}</span>
            <span style={{ fontSize: 11, color: MUTED }}>
              ₦{Math.round(j.deliveryFee).toLocaleString()} ·{' '}
              {(j.estimatedDistanceMeters / 1000).toFixed(1)} km
            </span>
          </div>
          <select
            className="dx-input"
            style={{ flex: 1, minWidth: 160 }}
            value={choice[j.id] ?? assignable[0]?.riderId ?? ''}
            onChange={(e) => setChoice((c) => ({ ...c, [j.id]: e.target.value }))}
            disabled={assignable.length === 0}
          >
            {assignable.map((r) => (
              <option key={r.riderId} value={r.riderId}>
                {`${r.firstName} ${r.lastName}`.trim() || r.email}
              </option>
            ))}
          </select>
          <Btn
            label={busy === j.id ? 'Assigning…' : 'Assign rider'}
            color={G2}
            onClick={busy || assignable.length === 0 ? undefined : () => void assign(j.id)}
          />
        </div>
      ))}
    </Card>
  );
}

function PageRiders() {
  const [riders, setRiders] = useState<AdminRiderDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRiders((await api.admin.listRiders()).items);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load riders.');
      setRiders([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const pending = (riders ?? []).filter((r) => isActionable(r.status)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 700, color: WHITE }}
        >
          Rider Approvals
        </div>
        <Chip label={`${pending} awaiting review`} color={C_WARN} />
      </div>
      {riders && <UnassignedDeliveries riders={riders} />}
      {riders === null && !error && (
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
      {riders && riders.length === 0 && !error && (
        <Card>
          <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            No riders have registered yet.
          </span>
        </Card>
      )}
      {riders?.map((r) => (
        <RiderReviewCard key={r.id} r={r} reload={() => void load()} />
      ))}
    </div>
  );
}

// ─── Page: Customers ──────────────────────────────────────────────────────────
function customerName(c: AdminCustomerDto): string {
  return `${c.firstName} ${c.lastName}`.trim() || '—';
}
function customerStatusChip(s: AdminCustomerDto['status']): { label: string; color: string } {
  switch (s) {
    case 'ACTIVE':
      return { label: 'Active', color: C_OK };
    case 'INACTIVE':
      return { label: 'Inactive', color: MUTED };
    case 'SUSPENDED':
      return { label: 'Suspended', color: C_ERR };
    case 'BLOCKED':
      return { label: 'Blocked', color: C_ERR };
    case 'PENDING_VERIFICATION':
      return { label: 'Pending', color: C_WARN };
    default:
      return { label: s, color: MUTED };
  }
}
const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

function PageCustomers() {
  const [customers, setCustomers] = useState<AdminCustomerDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminCustomerDto | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Pull a generous first page; refine client-side by search/status.
      const res = await api.admin.listCustomers({ limit: 100 });
      setCustomers(res.items);
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load customers.');
      setCustomers([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const rows = (customers ?? []).filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = (customerName(c) + c.email + (c.phone ?? '')).toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'All Status' ||
      customerStatusChip(c.status).label.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });
  const sel = selected ? ((customers ?? []).find((c) => c.id === selected.id) ?? selected) : null;

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
          <select
            className="dx-select"
            style={{ color: MUTED }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
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
              {rows.map((c, i) => {
                const chip = customerStatusChip(c.status);
                const name = customerName(c);
                return (
                  <tr
                    key={c.id}
                    className="dx-row"
                    style={{
                      borderBottom: `1px solid rgba(255,255,255,.04)`,
                      background:
                        sel?.id === c.id
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
                        <Avatar name={name} size={26} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: WHITE }}>{name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>
                      {c.phone ?? '—'}
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: 11, color: MUTED }}>{c.email}</td>
                    <td style={{ padding: '8px 8px', fontSize: 12, color: WHITE }}>
                      {c.tripsCount}
                    </td>
                    <td style={{ padding: '8px 8px', fontSize: 12, color: MUTED }}>—</td>
                    <td style={{ padding: '8px 8px', fontSize: 12, color: G3, fontWeight: 600 }}>
                      {naira(c.totalSpent)}
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <Chip label={chip.label} color={chip.color} />
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <Btn label="View" small outline color={G3} onClick={() => setSelected(c)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {customers === null && !error && (
            <div
              style={{
                padding: '8px 4px',
                fontSize: 12,
                color: MUTED,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Loading…
            </div>
          )}
          {error && (
            <div
              style={{
                padding: '8px 4px',
                fontSize: 12,
                color: C_ERR,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {error}
            </div>
          )}
          {customers !== null && !error && rows.length === 0 && (
            <div
              style={{
                padding: '8px 4px',
                fontSize: 12,
                color: MUTED,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {customers.length === 0 ? 'No customers yet.' : 'No customers match this filter.'}
            </div>
          )}
        </Card>
      </div>
      {sel && (
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
                onClick={() => {
                  setSelected(null);
                  setActionMsg(null);
                }}
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
              <Avatar name={customerName(sel)} size={44} />
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  color: WHITE,
                }}
              >
                {customerName(sel)}
              </div>
              <Chip {...customerStatusChip(sel.status)} />
            </div>
            <SEP />
            {[
              ['Phone', sel.phone ?? '—'],
              ['Email', sel.email],
              ['Trips', String(sel.tripsCount)],
              ['Total Spent', naira(sel.totalSpent)],
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
            {actionMsg && (
              <div style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                {actionMsg}
              </div>
            )}
            <SEP />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Btn
                label="Block Customer"
                color={C_ERR}
                outline
                onClick={() =>
                  setActionMsg(
                    'Blocking a customer isn’t available yet — no backend endpoint sets a customer’s blocked status.',
                  )
                }
              />
              <Btn
                label="View All Trips"
                color={G3}
                onClick={() =>
                  setActionMsg(
                    'A per-customer trip history screen isn’t wired yet — the roster shows the completed-trip count and spend.',
                  )
                }
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Page: Pricing ─────────────────────────────────────────────────────────────
/**
 * Pick a surcharge zone on a map.
 *
 * A zone is a centre and a radius, and the founder's airport premium is the
 * reason it exists. Typing a latitude and a longitude into two number boxes is
 * how an airport surcharge ends up centred in the Gulf of Guinea, so the centre
 * is a pin you drag and the radius is a circle you can see. Search jumps the map
 * to a place by name.
 *
 * Maps are activated by VITE_GOOGLE_MAPS_KEY. With no key the loader resolves
 * null by design, so this falls back to coordinate entry and says why, rather
 * than rendering a dead grey box.
 */
const LAGOS_CENTRE = { lat: 6.5244, lng: 3.3792 };
const RADIUS_MIN = 100;
const RADIUS_MAX = 50_000;

function SurchargeZoneEditor({
  zone,
  onClose,
  onSaved,
}: {
  /** null when creating. */
  zone: RideSurchargeZoneDto | null;
  onClose: () => void;
  onSaved: (saved: RideSurchargeZoneDto) => void;
}) {
  const [name, setName] = useState(zone?.name ?? '');
  const [lat, setLat] = useState(zone?.latitude ?? LAGOS_CENTRE.lat);
  const [lng, setLng] = useState(zone?.longitude ?? LAGOS_CENTRE.lng);
  const [radius, setRadius] = useState(zone?.radiusMeters ?? 2000);
  const [surchargeType, setSurchargeType] = useState<RideSurchargeType>(
    zone?.surchargeType ?? 'FLAT',
  );
  const [amount, setAmount] = useState(String(zone?.amount ?? 500));
  const [appliesTo, setAppliesTo] = useState<RideSurchargeTrigger>(zone?.appliesTo ?? 'EITHER');
  const [search, setSearch] = useState('');
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapLive, setMapLive] = useState<boolean | null>(null);

  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  // Build the map once. The marker carries the centre; the circle follows it.
  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps().then((g) => {
      if (cancelled) return;
      if (!g?.maps || !mapHostRef.current) {
        setMapLive(false);
        return;
      }
      const centre = { lat, lng };
      const map = new g.maps.Map(mapHostRef.current, {
        center: centre,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      const marker = new g.maps.Marker({ map, position: centre, draggable: true });
      const circle = new g.maps.Circle({
        map,
        center: centre,
        radius,
        strokeColor: G3,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: G2,
        fillOpacity: 0.16,
      });
      const move = (position: google.maps.LatLng | null | undefined): void => {
        if (!position) return;
        setLat(position.lat());
        setLng(position.lng());
      };
      marker.addListener('dragend', () => {
        move(marker.getPosition());
      });
      // Clicking the map is the same gesture as dropping the pin there.
      map.addListener('click', (event: google.maps.MapMouseEvent) => {
        move(event.latLng);
      });
      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      setMapLive(true);
    });
    return () => {
      cancelled = true;
    };
    // Built once — later centre/radius changes are pushed by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Centre changes (drag, click, search, typed coordinate) → move pin + circle.
  useEffect(() => {
    const position = { lat, lng };
    markerRef.current?.setPosition(position);
    circleRef.current?.setCenter(position);
    mapRef.current?.panTo(position);
  }, [lat, lng]);

  useEffect(() => {
    circleRef.current?.setRadius(radius);
  }, [radius]);

  // Search-as-you-type, debounced so a fast typist does not spend the quota.
  useEffect(() => {
    if (search.trim().length < 3) {
      setPredictions([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      void addressPredictions(search).then(setPredictions);
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  const jumpTo = async (prediction: AddressPrediction): Promise<void> => {
    const resolved = await geocodeAddress({ placeId: prediction.placeId });
    if (!resolved) {
      setError('Could not place that address on the map.');
      return;
    }
    setLat(resolved.latitude);
    setLng(resolved.longitude);
    setPredictions([]);
    setSearch(prediction.description);
    if (name.trim() === '') setName(prediction.description.split(',')[0] ?? '');
  };

  const save = async (): Promise<void> => {
    const trimmed = name.trim();
    const value = Number(amount);
    if (trimmed.length < 2) {
      setError('Give the zone a name — an operator reading the list needs to know what it is.');
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      setError('The amount must be a positive number.');
      return;
    }
    if (radius < RADIUS_MIN || radius > RADIUS_MAX) {
      setError(`The radius must be between ${RADIUS_MIN}m and ${RADIUS_MAX / 1000}km.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: trimmed,
        latitude: lat,
        longitude: lng,
        radiusMeters: Math.round(radius),
        surchargeType,
        amount: value,
        appliesTo,
      };
      const saved =
        zone === null
          ? await api.admin.createRideSurchargeZone({ ...body, active: true })
          : await api.admin.updateRideSurchargeZone(zone.id, body);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that zone');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, node: React.ReactNode): React.ReactNode => (
    <div>
      <div style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif', marginBottom: 5 }}>
        {label}
      </div>
      {node}
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3,8,16,.72)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        style={{
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          width: 760,
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 18,
        }}
      >
        <SectionHeader
          title={zone === null ? 'New Surcharge Zone' : `Edit · ${zone.name}`}
          action={<Btn label="Close" small outline color={MUTED} onClick={onClose} />}
        />

        {mapLive === false ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: NAVY_SURFACE,
              border: `1px solid ${C_WARN}44`,
              fontSize: 11.5,
              color: WHITE,
              fontFamily: 'Inter, sans-serif',
              marginBottom: 12,
            }}
          >
            {mapsEnabled()
              ? 'Google Maps did not load, so the map picker is unavailable. Enter the centre coordinates directly below.'
              : 'Maps are not activated (no VITE_GOOGLE_MAPS_KEY), so there is no map to pick from. Enter the centre coordinates directly below.'}
          </div>
        ) : null}

        {mapLive !== false ? (
          <>
            <input
              className="dx-input"
              placeholder="Search a place — e.g. Murtala Muhammed Airport"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              style={{ width: '100%', marginBottom: predictions.length > 0 ? 0 : 10 }}
            />
            {predictions.length > 0 && (
              <div
                style={{
                  border: `1px solid ${BORDER}`,
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  marginBottom: 10,
                  overflow: 'hidden',
                }}
              >
                {predictions.slice(0, 5).map((prediction) => (
                  <button
                    key={prediction.placeId}
                    onClick={() => void jumpTo(prediction)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: NAVY_SURFACE,
                      border: 'none',
                      borderBottom: `1px solid ${BORDER}`,
                      color: 'rgba(255,255,255,.8)',
                      fontSize: 12,
                      fontFamily: 'Inter, sans-serif',
                      cursor: 'pointer',
                    }}
                  >
                    {prediction.description}
                  </button>
                ))}
              </div>
            )}
            <div
              ref={mapHostRef}
              style={{
                height: 300,
                borderRadius: 10,
                border: `1px solid ${BORDER}`,
                background: NAVY_SURFACE,
                marginBottom: 6,
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: 'Inter, sans-serif',
                marginBottom: 12,
              }}
            >
              {mapLive === null
                ? 'Loading map…'
                : 'Drag the pin or tap the map to move the centre. The circle is the zone.'}
            </div>
          </>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {field(
            'Zone name',
            <input
              className="dx-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder="Murtala Muhammed Airport"
              style={{ width: '100%' }}
            />,
          )}
          {field(
            `Radius — ${(radius / 1000).toFixed(1)}km`,
            <input
              type="range"
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={100}
              value={radius}
              onChange={(e) => {
                setRadius(Number(e.target.value));
              }}
              style={{ width: '100%', accentColor: G3 }}
            />,
          )}
          {field(
            'Centre latitude',
            <input
              className="dx-input"
              type="number"
              step="0.0000001"
              value={lat}
              onChange={(e) => {
                setLat(Number(e.target.value));
              }}
              style={{ width: '100%' }}
            />,
          )}
          {field(
            'Centre longitude',
            <input
              className="dx-input"
              type="number"
              step="0.0000001"
              value={lng}
              onChange={(e) => {
                setLng(Number(e.target.value));
              }}
              style={{ width: '100%' }}
            />,
          )}
          {field(
            'Charge',
            <div style={{ display: 'flex', gap: 6 }}>
              {(['FLAT', 'MULTIPLIER'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSurchargeType(option);
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 8,
                    background: surchargeType === option ? `${G3}22` : NAVY_SURFACE,
                    border: `1px solid ${surchargeType === option ? G3 : BORDER}`,
                    color: surchargeType === option ? WHITE : MUTED,
                    fontSize: 11.5,
                    fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  {option === 'FLAT' ? 'Flat ₦' : 'Multiplier ×'}
                </button>
              ))}
            </div>,
          )}
          {field(
            surchargeType === 'FLAT' ? 'Amount (₦ added)' : 'Multiplier (1.25 = a quarter more)',
            <input
              className="dx-input"
              type="number"
              step={surchargeType === 'FLAT' ? '50' : '0.05'}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
              style={{ width: '100%' }}
            />,
          )}
        </div>

        {field(
          'Applies when the trip',
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(
              [
                ['EITHER', 'Starts or ends here'],
                ['PICKUP', 'Starts here'],
                ['DROPOFF', 'Ends here'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setAppliesTo(value);
                }}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 8,
                  background: appliesTo === value ? `${G3}22` : NAVY_SURFACE,
                  border: `1px solid ${appliesTo === value ? G3 : BORDER}`,
                  color: appliesTo === value ? WHITE : MUTED,
                  fontSize: 11.5,
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>,
        )}

        {error !== null && (
          <div style={{ fontSize: 11.5, color: C_ERR, fontFamily: 'Inter, sans-serif' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn
            label={saving ? 'Saving…' : zone === null ? 'Create Zone' : 'Save Zone'}
            color={G2}
            disabled={saving}
            onClick={() => void save()}
          />
          <Btn label="Cancel" color={MUTED} outline disabled={saving} onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

/**
 * Fares, against the real pricing endpoint.
 *
 * This page used to hold four hardcoded numbers and a Save button whose only
 * job was to say "the Operations backend has no fare-config endpoint". That
 * stopped being true: `/admin/rides/pricing/rates` (GET and PUT per ride type)
 * has existed since the pricing work, guarded by `admin:rides:pricing:manage`,
 * and the SDK has had a client for it — nothing had connected this screen to
 * it, so the founder could not change a price.
 *
 * The fourth field was "Waiting Fee (₦/min)", which the backend has never had.
 * The real fourth number is `minimumFare`, a floor under the computed fare
 * rather than an addition — a different thing that happens to sit in the same
 * corner of the form. Editing it here changes the founder-locked ₦1,500 floor.
 */
function PagePricing() {
  const [rates, setRates] = useState<RideFareRateDto[]>([]);
  const [rideType, setRideType] = useState<RideType | null>(null);
  const [base, setBase] = useState('');
  const [dist, setDist] = useState('');
  const [time, setTime] = useState('');
  const [minimum, setMinimum] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const DIST_KM = 14,
    TIME_MIN = 22;

  const applyRate = (rate: RideFareRateDto): void => {
    setRideType(rate.rideType);
    setBase(String(rate.baseFare));
    setDist(String(rate.perKmRate));
    setTime(String(rate.perMinuteRate));
    setMinimum(String(rate.minimumFare));
  };

  const load = useCallback(async (keepType: RideType | null) => {
    setLoading(true);
    try {
      const list = await api.admin.getRideFareRates();
      setRates(list);
      const chosen = list.find((rate) => rate.rideType === keepType) ?? list[0];
      if (chosen) applyRate(chosen);
    } catch (cause) {
      setMsg(cause instanceof Error ? cause.message : 'Could not load fare rates');
    } finally {
      setLoading(false);
    }
  }, []);

  const [zones, setZones] = useState<RideSurchargeZoneDto[]>([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zoneBusy, setZoneBusy] = useState<string | null>(null);
  // null = closed. { zone: null } = creating; { zone } = editing.
  const [zoneEdit, setZoneEdit] = useState<{ zone: RideSurchargeZoneDto | null } | null>(null);

  const loadZones = useCallback(async () => {
    setZonesLoading(true);
    try {
      setZones(await api.admin.getRideSurchargeZones());
    } catch (cause) {
      setMsg(cause instanceof Error ? cause.message : 'Could not load surcharge zones');
    } finally {
      setZonesLoading(false);
    }
  }, []);

  const toggleZone = async (zone: RideSurchargeZoneDto): Promise<void> => {
    setZoneBusy(zone.id);
    setMsg(null);
    try {
      // Only `active` is sent — resubmitting the geometry to switch a zone off
      // is how a coordinate gets fat-fingered.
      const updated = await api.admin.updateRideSurchargeZone(zone.id, { active: !zone.active });
      setZones((previous) => previous.map((z) => (z.id === updated.id ? updated : z)));
      setMsg(`${updated.name} is now ${updated.active ? 'charging' : 'off'}.`);
    } catch (cause) {
      setMsg(cause instanceof Error ? cause.message : 'Could not change that zone');
    } finally {
      setZoneBusy(null);
    }
  };

  useEffect(() => {
    void load(null);
    void loadZones();
  }, [load, loadZones]);

  const save = async (): Promise<void> => {
    if (rideType === null) return;
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api.admin.updateRideFareRate(rideType, {
        baseFare: Number(base),
        perKmRate: Number(dist),
        perMinuteRate: Number(time),
        minimumFare: Number(minimum),
      });
      setRates((previous) =>
        previous.map((rate) => (rate.rideType === updated.rideType ? updated : rate)),
      );
      applyRate(updated);
      setMsg(`Saved. ${updated.displayName} fares are live for new rides.`);
    } catch (cause) {
      setMsg(cause instanceof Error ? cause.message : 'Could not save these fares');
    } finally {
      setSaving(false);
    }
  };

  const selected = rates.find((rate) => rate.rideType === rideType) ?? null;
  // The fare the passenger would be quoted for this trip, by the same shape the
  // Ride module computes: base + distance + time, floored at the minimum.
  const previewFare = Math.max(
    (parseFloat(base) || 0) +
      (parseFloat(dist) || 0) * DIST_KM +
      (parseFloat(time) || 0) * TIME_MIN,
    parseFloat(minimum) || 0,
  );
  const promos: PromoRow[] = []; // no ops-facing promo feed (see wiring-status doc)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && (
        <Card style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 11.5, color: WHITE, fontFamily: 'Inter, sans-serif' }}>
            {msg}
          </span>
        </Card>
      )}
      <div style={{ display: 'flex', gap: 14 }}>
        {/* Fare config */}
        <Card style={{ flex: 1 }}>
          <SectionHeader
            title={`Fare Configuration · ${selected?.displayName ?? '—'}`}
            action={
              loading ? <Chip label="Loading" color={MUTED} /> : <Chip label="Live" color={C_OK} />
            }
          />
          {/* One row per ride type, named by the same catalogue the passenger
              app reads. "Sedan" was hardcoded and is not a DrippleX ride type. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {rates.map((rate) => {
              const on = rate.rideType === rideType;
              return (
                <button
                  key={rate.rideType}
                  onClick={() => {
                    applyRate(rate);
                    setMsg(null);
                  }}
                  style={{
                    background: on ? `${G3}22` : NAVY_SURFACE,
                    border: `1px solid ${on ? G3 : BORDER}`,
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontFamily: 'Inter, sans-serif',
                    color: on ? WHITE : MUTED,
                    cursor: 'pointer',
                  }}
                >
                  {rate.displayName}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              ['Base Fare (₦)', base, setBase],
              ['Distance Rate (₦/km)', dist, setDist],
              ['Time Rate (₦/min)', time, setTime],
              // Not "Waiting Fee" — the backend has never had one. This is the
              // floor under the computed fare, founder-locked at ₦1,500.
              ['Minimum Fare (₦)', minimum, setMinimum],
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
            <Btn
              label={saving ? 'Saving…' : 'Save Configuration'}
              color={G2}
              disabled={saving || loading || rideType === null}
              onClick={() => void save()}
            />
            {/* "Reset to Default" used to write four invented numbers into the
                form. There is no default to reset to — the saved rates are the
                truth — so this discards edits by reloading them. */}
            <Btn
              label="Discard Changes"
              color={MUTED}
              outline
              disabled={saving || loading}
              onClick={() => {
                setMsg(null);
                void load(rideType);
              }}
            />
          </div>
        </Card>
        {/* Surge + preview */}
        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* There is no *global* surge multiplier — no field for one on the
              fare rate, no endpoint. Premium pricing is done per zone instead
              (the card below), which is how the airport surcharge works: a
              circle on the map with a flat amount or a multiplier. The old
              toggle multiplied a local preview only, so the console displayed a
              price the Ride module would never charge. */}
          <Card>
            <SectionHeader title="Surge Pricing" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                Platform-wide surge
              </span>
              <input type="checkbox" className="dx-toggle" checked={false} disabled readOnly />
            </div>
            <span style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
              No platform-wide multiplier exists. Charge a premium by area instead — see Surcharge
              Zones below.
            </span>
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
              ₦{Math.round(previewFare).toLocaleString()}
            </div>
            {previewFare > 0 && previewFare === (parseFloat(minimum) || 0) ? (
              <Chip label="At minimum fare" color={C_WARN} />
            ) : null}
          </Card>
        </div>
      </div>

      {/* Surcharge zones — the airport premium and anything shaped like it.
          Fully built on the backend (GET/POST/PATCH /admin/rides/pricing/zones,
          audited) and never surfaced here, so the one place premium pricing
          actually exists was invisible to the person who sets prices. */}
      <Card>
        <SectionHeader
          title="Surcharge Zones"
          action={
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                {zonesLoading ? 'Loading…' : `${zones.filter((z) => z.active).length} active`}
              </span>
              <Btn
                label="+ New Zone"
                small
                color={G2}
                onClick={() => {
                  setZoneEdit({ zone: null });
                }}
              />
            </div>
          }
        />
        {zones.length === 0 ? (
          <span style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            {zonesLoading
              ? 'Loading zones…'
              : 'No surcharge zones yet. A zone is a circle on the map — a centre, a radius, and either a flat amount or a multiplier — applied when a trip starts or ends inside it.'}
          </span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {zones.map((zone) => (
              <div
                key={zone.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: NAVY_SURFACE,
                  border: `1px solid ${zone.active ? `${G3}44` : BORDER}`,
                  opacity: zone.active ? 1 : 0.62,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      fontWeight: 600,
                      color: WHITE,
                    }}
                  >
                    {zone.name}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
                    {(zone.radiusMeters / 1000).toFixed(1)}km radius ·{' '}
                    {zone.appliesTo === 'EITHER'
                      ? 'pickup or drop-off'
                      : zone.appliesTo === 'PICKUP'
                        ? 'pickup only'
                        : 'drop-off only'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 14,
                      fontWeight: 700,
                      color: G3,
                    }}
                  >
                    {zone.surchargeType === 'FLAT'
                      ? `+₦${zone.amount.toLocaleString()}`
                      : `${zone.amount}×`}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: MUTED }}>
                    {zone.surchargeType === 'FLAT' ? 'flat' : 'multiplier'}
                  </div>
                </div>
                <Btn
                  label="Edit"
                  small
                  outline
                  color={MUTED}
                  onClick={() => {
                    setZoneEdit({ zone });
                  }}
                />
                <Btn
                  label={zone.active ? 'Turn off' : 'Turn on'}
                  small
                  outline
                  color={zone.active ? C_WARN : G2}
                  disabled={zoneBusy === zone.id}
                  onClick={() => void toggleZone(zone)}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {zoneEdit !== null && (
        <SurchargeZoneEditor
          zone={zoneEdit.zone}
          onClose={() => {
            setZoneEdit(null);
          }}
          onSaved={(saved) => {
            setZones((previous) =>
              previous.some((z) => z.id === saved.id)
                ? previous.map((z) => (z.id === saved.id ? saved : z))
                : [...previous, saved],
            );
            setZoneEdit(null);
            setMsg(`${saved.name} saved.`);
          }}
        />
      )}

      {/* Promos */}
      <Card>
        <SectionHeader
          title="Promo Campaigns"
          action={
            <Btn
              label="+ New Promo"
              small
              color={G2}
              onClick={() =>
                setMsg(
                  'Promotions are managed on the marketing/admin surface (promotions:admin:manage), not the operations console.',
                )
              }
            />
          }
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
        {promos.length === 0 && (
          <div
            style={{
              padding: '8px 4px',
              fontSize: 12,
              color: MUTED,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            No promo campaigns to show here — promotions live on the marketing/admin surface, not
            the operations console.
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Page: Incidents ──────────────────────────────────────────────────────────
// ── Incident/SOS helpers (map real OperationsCase fields to the frozen UI) ────
const INCIDENT_PRIORITY_LADDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function nextPriority(p: AdminOperationsCaseDto['priority']): AdminOperationsCaseDto['priority'] {
  const i = INCIDENT_PRIORITY_LADDER.indexOf(p);
  return i < 0 || i >= INCIDENT_PRIORITY_LADDER.length - 1
    ? 'CRITICAL'
    : INCIDENT_PRIORITY_LADDER[i + 1];
}

function caseSeverity(c: AdminOperationsCaseDto): string {
  // SOS alerts always run at CRITICAL; incidents carry their own severity.
  return (c.severity ?? (c.caseType === 'SOS' ? 'CRITICAL' : c.priority)).toUpperCase();
}

function caseIcon(c: AdminOperationsCaseDto): string {
  if (c.caseType === 'SOS') return '🆘';
  switch (c.category) {
    case 'ACCIDENT':
      return '💥';
    case 'VEHICLE_BREAKDOWN':
      return '🔧';
    case 'PASSENGER_ALTERCATION':
      return '⚠️';
    case 'SAFETY_CONCERN':
      return '🛡️';
    default:
      return '⚠️';
  }
}

function caseTypeLabel(c: AdminOperationsCaseDto): string {
  if (c.caseType === 'SOS') return 'SOS';
  const cat = c.category ?? 'INCIDENT';
  return cat
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function caseDesc(c: AdminOperationsCaseDto): string {
  if (c.description && c.description.trim().length > 0) return c.description;
  return c.caseType === 'SOS'
    ? 'Emergency SOS alert triggered by the driver.'
    : 'No description was provided.';
}

function incidentSevColor(s: string): string {
  const u = s.toUpperCase();
  return u === 'CRITICAL' ? C_ERR : u === 'HIGH' ? C_WARN : u === 'MEDIUM' ? C_INFO : MUTED;
}

function lifecycleLabel(s: AdminOperationsCaseDto['status']): string {
  return s
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function lifecycleColor(s: AdminOperationsCaseDto['status']): string {
  switch (s) {
    case 'NEW':
      return C_INFO;
    case 'ASSIGNED':
      return G2;
    case 'IN_PROGRESS':
      return C_OK;
    case 'WAITING':
      return C_WARN;
    case 'RESOLVED':
      return G3;
    case 'CLOSED':
      return MUTED;
    default:
      return MUTED;
  }
}

function formatCaseTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PageIncidents() {
  const [cases, setCases] = useState<AdminOperationsCaseDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // The frozen "Incidents" screen shows both SOS alerts and incident
      // reports; fetch both work queues and merge, newest first.
      const [incidents, sos] = await Promise.all([
        api.admin.getIncidentQueue(),
        api.admin.getSosQueue(),
      ]);
      const merged = [...sos.items, ...incidents.items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setCases(merged);
      setSelId((cur) =>
        cur && merged.some((c) => c.caseId === cur) ? cur : (merged[0]?.caseId ?? null),
      );
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load the incident queue.');
      setCases([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const inc = cases?.find((c) => c.caseId === selId) ?? null;

  const runAction = useCallback(
    async (
      action: string,
      body: Parameters<typeof api.admin.updateCase>[1],
      successMsg: string,
    ) => {
      if (!inc) return;
      setBusy(action);
      setActionMsg(null);
      try {
        await api.admin.updateCase(inc.caseId, body);
        setActionMsg(successMsg);
        await load();
      } catch (e: unknown) {
        const msg = (e as { message?: string }).message ?? 'Action failed.';
        // 409 → someone else updated this case first; a reload refreshes version.
        setActionMsg(
          /conflict|version/i.test(msg)
            ? 'This case changed since you opened it — reloaded the latest.'
            : msg,
        );
        await load();
      } finally {
        setBusy(null);
      }
    },
    [inc, load],
  );

  if (cases === null && !error)
    return (
      <Card>
        <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          Loading…
        </span>
      </Card>
    );
  if (error)
    return (
      <Card>
        <span style={{ fontSize: 13, color: C_ERR, fontFamily: 'Inter, sans-serif' }}>{error}</span>
      </Card>
    );
  if (!inc)
    return (
      <Card>
        <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          No incidents or SOS alerts in the queue.
        </span>
      </Card>
    );

  const list = cases ?? [];
  const isSos = inc.caseType === 'SOS';
  const hasCoords = inc.latitude != null && inc.longitude != null;
  const canResolve = inc.status !== 'RESOLVED' && inc.status !== 'CLOSED';
  const canEscalate = inc.priority !== 'CRITICAL' && canResolve;

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%' }}>
      {/* Queue */}
      <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: 13, color: WHITE }}
        >
          Incident Queue
        </div>
        {list.map((c) => {
          const sev = caseSeverity(c);
          return (
            <Card
              key={c.caseId}
              style={{
                cursor: 'pointer',
                padding: '12px 14px',
                borderColor: selId === c.caseId ? `${G3}55` : BORDER,
              }}
              onClick={() => {
                setSelId(c.caseId);
                setActionMsg(null);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{caseIcon(c)}</span>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}
                  >
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: WHITE,
                        fontFamily: 'Poppins, sans-serif',
                      }}
                    >
                      {caseTypeLabel(c)}
                    </span>
                    <Chip label={sev} color={incidentSevColor(sev)} />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: MUTED,
                      fontFamily: 'Inter, sans-serif',
                      lineHeight: 1.4,
                    }}
                  >
                    {caseDesc(c).slice(0, 55)}
                    {caseDesc(c).length > 55 ? '…' : ''}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <Chip label={lifecycleLabel(c.status)} color={lifecycleColor(c.status)} />
                    <span style={{ fontSize: 10, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                      {formatCaseTime(c.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {/* Detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{caseIcon(inc)}</span>
          <div>
            <div
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 15,
                fontWeight: 700,
                color: WHITE,
              }}
            >
              {caseTypeLabel(inc)}
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
              {formatCaseTime(inc.createdAt)}
              {inc.rideId ? ` · Trip ${inc.rideId.slice(0, 8)}` : ''}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Chip label={caseSeverity(inc)} color={incidentSevColor(caseSeverity(inc))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {/* SVG mini-map */}
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
                {hasCoords
                  ? `${inc.latitude?.toFixed(4)}, ${inc.longitude?.toFixed(4)}`
                  : 'Location not reported'}
              </text>
              {isSos && hasCoords && (
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
              {!isSos && hasCoords && (
                <>
                  <circle cx={150} cy={70} r={8} fill={C_WARN} />
                  <text x={160} y={66} fill={C_WARN} fontSize={10} fontFamily="Inter, sans-serif">
                    {caseIcon(inc)}
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
              {caseDesc(inc)}
            </div>
            <SEP />
            {[
              ['Driver', inc.driverName || '—'],
              ['Driver Phone', inc.driverPhone ?? '—'],
              ['Trip', inc.rideId ? inc.rideId.slice(0, 8) : '—'],
              ['Assigned', inc.assignedToName ?? 'Unassigned'],
              ['Status', ''],
              ['Priority', inc.priority],
              ['Reported', formatCaseTime(inc.createdAt)],
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
                  <Chip label={lifecycleLabel(inc.status)} color={lifecycleColor(inc.status)} />
                ) : (
                  <span style={{ fontSize: 11.5, color: WHITE }}>{v}</span>
                )}
              </div>
            ))}
          </Card>
        </div>
        {actionMsg && (
          <Card style={{ padding: '10px 14px' }}>
            <span style={{ fontSize: 11.5, color: WHITE, fontFamily: 'Inter, sans-serif' }}>
              {actionMsg}
            </span>
          </Card>
        )}
        {/* Actions */}
        <Card style={{ display: 'flex', gap: 10 }}>
          <Btn
            label={busy === 'resolve' ? 'Resolving…' : '✓ Resolve Incident'}
            color={C_OK}
            onClick={
              busy || !canResolve
                ? undefined
                : () =>
                    void runAction(
                      'resolve',
                      { version: inc.version, status: 'RESOLVED' },
                      'Case marked resolved.',
                    )
            }
          />
          <Btn
            label={busy === 'escalate' ? 'Escalating…' : '⬆ Escalate'}
            color={C_WARN}
            outline
            onClick={
              busy || !canEscalate
                ? undefined
                : () => {
                    const np = nextPriority(inc.priority);
                    void runAction(
                      'escalate',
                      { version: inc.version, priority: np, status: 'IN_PROGRESS' },
                      `Escalated to ${np}.`,
                    );
                  }
            }
          />
          <Btn
            label="📞 Contact Driver"
            color={C_INFO}
            outline
            onClick={
              inc.driverPhone
                ? () => {
                    window.location.href = `tel:${inc.driverPhone ?? ''}`;
                  }
                : () => setActionMsg('No phone number on file for this driver.')
            }
          />
          <Btn
            label="📞 Contact Passenger"
            color={C_INFO}
            outline
            onClick={() =>
              setActionMsg(
                'Passenger contact isn’t available here — SOS/incident cases carry the driver’s details, not the passenger’s.',
              )
            }
          />
          <Btn
            label="Export Report"
            color={MUTED}
            outline
            onClick={() =>
              setActionMsg('Report export isn’t available yet — no backend endpoint exists.')
            }
          />
        </Card>
      </div>
    </div>
  );
}

// ─── Page: Support ────────────────────────────────────────────────────────────
function supportCategoryLabel(c?: string): string {
  if (!c) return 'Support';
  return c
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function PageSupport() {
  const [tab, setTab] = useState<'Tickets' | 'Chats' | 'Calls'>('Tickets');
  const [tickets, setTickets] = useState<AdminOperationsCaseDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.admin.getSupportQueue();
      const items = [...res.items].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setTickets(items);
      setSelId((cur) =>
        cur && items.some((c) => c.caseId === cur) ? cur : (items[0]?.caseId ?? null),
      );
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load support tickets.');
      setTickets([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const selTicket = tickets?.find((c) => c.caseId === selId) ?? null;

  const runAction = useCallback(
    async (action: string, body: Parameters<typeof api.admin.updateCase>[1], msg: string) => {
      if (!selTicket) return;
      setBusy(action);
      setActionMsg(null);
      try {
        await api.admin.updateCase(selTicket.caseId, body);
        setActionMsg(msg);
        await load();
      } catch (e: unknown) {
        const m = (e as { message?: string }).message ?? 'Action failed.';
        setActionMsg(
          /conflict|version/i.test(m) ? 'This ticket changed since you opened it — reloaded.' : m,
        );
        await load();
      } finally {
        setBusy(null);
      }
    },
    [selTicket, load],
  );

  if (tickets === null && !error)
    return (
      <Card>
        <span style={{ fontSize: 13, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          Loading…
        </span>
      </Card>
    );
  if (error)
    return (
      <Card>
        <span style={{ fontSize: 13, color: C_ERR, fontFamily: 'Inter, sans-serif' }}>{error}</span>
      </Card>
    );

  const list = tickets ?? [];
  const canResolve = selTicket
    ? selTicket.status !== 'RESOLVED' && selTicket.status !== 'CLOSED'
    : false;
  const canEscalate = selTicket ? selTicket.priority !== 'CRITICAL' && canResolve : false;

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
        {tab === 'Tickets' && list.length === 0 && (
          <Card style={{ padding: '10px 12px' }}>
            <span style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
              No support tickets.
            </span>
          </Card>
        )}
        {tab === 'Tickets' &&
          list.map((tk) => (
            <Card
              key={tk.caseId}
              style={{
                cursor: 'pointer',
                padding: '10px 12px',
                borderColor: selId === tk.caseId ? `${G3}55` : BORDER,
              }}
              onClick={() => {
                setSelId(tk.caseId);
                setActionMsg(null);
              }}
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
                  {supportCategoryLabel(tk.category)}
                </span>
                <Chip label={lifecycleLabel(tk.status)} color={lifecycleColor(tk.status)} />
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
                {tk.driverName || '—'}
              </div>
              <div style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
                {(tk.subject ?? '').slice(0, 40)}
                {(tk.subject ?? '').length > 40 ? '…' : ''}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: MUTED,
                  fontFamily: 'Inter, sans-serif',
                  marginTop: 4,
                }}
              >
                {formatCaseTime(tk.createdAt)}
              </div>
            </Card>
          ))}
        {tab !== 'Tickets' && (
          <Card style={{ padding: '10px 12px' }}>
            <span style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
              {tab} aren’t available yet — no backend channel exists for live {tab.toLowerCase()}.
            </span>
          </Card>
        )}
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
          {selTicket ? (
            <>
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
                <Avatar name={selTicket.driverName || 'Driver'} size={32} />
                <div>
                  <div
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 13,
                      fontWeight: 700,
                      color: WHITE,
                    }}
                  >
                    {selTicket.driverName || '—'}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: MUTED }}>
                    {selTicket.subject ?? supportCategoryLabel(selTicket.category)}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <Btn
                    label={busy === 'resolve' ? '…' : 'Resolve'}
                    small
                    color={C_OK}
                    onClick={
                      busy || !canResolve
                        ? undefined
                        : () =>
                            void runAction(
                              'resolve',
                              { version: selTicket.version, status: 'RESOLVED' },
                              'Ticket marked resolved.',
                            )
                    }
                  />
                  <Btn
                    label={busy === 'escalate' ? '…' : 'Escalate'}
                    small
                    color={C_WARN}
                    outline
                    onClick={
                      busy || !canEscalate
                        ? undefined
                        : () => {
                            const np = nextPriority(selTicket.priority);
                            void runAction(
                              'escalate',
                              { version: selTicket.version, priority: np, status: 'IN_PROGRESS' },
                              `Escalated to ${np}.`,
                            );
                          }
                    }
                  />
                </div>
              </div>
              {/* Messages — built from the real ticket body + admin response */}
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
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '72%',
                      padding: '9px 13px',
                      borderRadius: '14px 14px 14px 4px',
                      background: NAVY_SURFACE,
                      border: `1px solid ${BORDER}`,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 12.5,
                      color: WHITE,
                      lineHeight: 1.5,
                    }}
                  >
                    {selTicket.description ?? 'No description provided.'}
                  </div>
                </div>
                {selTicket.adminResponse && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div
                      style={{
                        maxWidth: '72%',
                        padding: '9px 13px',
                        borderRadius: '14px 14px 4px 14px',
                        background: `${G0}`,
                        border: `1px solid ${G2}44`,
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 12.5,
                        color: WHITE,
                        lineHeight: 1.5,
                      }}
                    >
                      {selTicket.adminResponse}
                    </div>
                  </div>
                )}
                {actionMsg && (
                  <div
                    style={{
                      textAlign: 'center',
                      color: MUTED,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 11.5,
                      marginTop: 6,
                    }}
                  >
                    {actionMsg}
                  </div>
                )}
              </div>
              {/* Reply input — no admin-reply endpoint exists yet, so this is honest */}
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
                <Btn
                  label="Send"
                  color={G2}
                  onClick={() => {
                    setActionMsg(
                      'Sending a reply to the driver isn’t available yet — no backend endpoint sets a support response.',
                    );
                    setReply('');
                  }}
                />
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: MUTED,
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
              }}
            >
              Select a ticket to view it.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Page: Analytics ──────────────────────────────────────────────────────────
interface PeakHourRow {
  hour: string;
  demand: number;
}

const PEAK_HOURS: PeakHourRow[] = []; // mock cleared — no demand-series endpoint yet

function PageAnalytics() {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  // No demand-analytics feed wired yet — return 0 so the heatmap renders empty
  // rather than synthetic values.
  const heatVal = (_d: number, _h: number) => 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: '10px 14px' }}>
        <span style={{ fontSize: 11.5, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
          These charts need day/hour/month time-series and a revenue feed. The Operations analytics
          endpoints currently return KPI aggregates and ranked lists (surfaced on the Dashboard),
          not chart-ready series — so these render empty until a series endpoint exists. See
          docs/reference/DPX-OPS-PREVIEW-WIRING-STATUS.md.
        </span>
      </Card>
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
                    // `title` is an attribute, not a CSS property — inside style
                    // it did nothing and the heatmap had no hover readout.
                    title={`${d} ${h}:00 — ${Math.round(v)}%`}
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
  const generated: GeneratedReportRow[] = []; // no report-generation endpoint yet
  const [msg, setMsg] = useState<string | null>(null);
  const notAvailable = () =>
    setMsg(
      'Report generation isn’t available yet — the Operations backend has no report/export endpoint (see docs/reference/DPX-OPS-PREVIEW-WIRING-STATUS.md).',
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && (
        <Card style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 11.5, color: WHITE, fontFamily: 'Inter, sans-serif' }}>
            {msg}
          </span>
        </Card>
      )}
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
              <Btn label="PDF" small color={C_ERR} onClick={notAvailable} />
              <Btn label="Excel" small color={C_OK} onClick={notAvailable} />
            </div>
          </Card>
        ))}
      </div>
      {/* Generated reports */}
      <Card>
        <SectionHeader title="Generated Reports" />
        {generated.length === 0 && (
          <div style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            No reports have been generated — report export isn’t wired to a backend yet.
          </div>
        )}
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
  const integrations: IntegrationRow[] = []; // mock cleared — no integrations endpoint yet
  const roles: RoleRow[] = []; // mock cleared — no ops role-catalogue endpoint yet
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
      {settingsTab === 'Roles' && roles.length === 0 && (
        <Card style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            No role-management endpoint is exposed to this console yet — roles/permissions are
            provisioned via the RBAC seed. See docs/reference/DPX-OPS-PREVIEW-WIRING-STATUS.md.
          </span>
        </Card>
      )}
      {settingsTab === 'Roles' && roles.length > 0 && (
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
      {settingsTab === 'Integrations' && integrations.length === 0 && (
        <Card style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            No integrations registry endpoint is exposed to this console yet.
          </span>
        </Card>
      )}
      {settingsTab === 'Integrations' && integrations.length > 0 && (
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
  const [msg, setMsg] = useState<string | null>(null);
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
          <Btn
            label="Export CSV"
            color={G2}
            onClick={() =>
              setMsg(
                'Audit logs aren’t available here — the AuditService writes entries but exposes no admin read/export endpoint yet (see docs/reference/DPX-OPS-PREVIEW-WIRING-STATUS.md).',
              )
            }
          />
        </div>
      </div>
      {msg && (
        <Card style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 11.5, color: WHITE, fontFamily: 'Inter, sans-serif' }}>
            {msg}
          </span>
        </Card>
      )}
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
        {AUDIT_LOGS.length === 0 && (
          <div style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter, sans-serif' }}>
            No audit-log read endpoint is available yet — entries are written but not exposed to
            this console.
          </div>
        )}
        {AUDIT_LOGS.length > 0 && (
          <div
            style={{ marginTop: 10, fontSize: 11, color: MUTED, fontFamily: 'Inter, sans-serif' }}
          >
            {filtered.length} of {AUDIT_LOGS.length} records
          </div>
        )}
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
  const sessions: AdminSessionRow[] = []; // mock cleared — no admin-session endpoint yet
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
    case 'inspections':
      return <PageInspections />;
    case 'settlements':
      return <PageSettlements />;
    case 'merchants':
      return <PageMerchants />;
    case 'riders':
      return <PageRiders />;
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
