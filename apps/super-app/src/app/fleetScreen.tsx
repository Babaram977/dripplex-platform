import React, { useState, useEffect, useCallback } from 'react';

import { useNarrowViewport } from './useNarrowViewport';
import { api } from '../lib/api';
import { auth, endSession } from '../lib/auth';
import { signOutRequest } from '../lib/push';

import type { FleetMemberDto, FleetOverviewDto } from '../lib/api';

/**
 * DPX-FLEET — the fleet partner's own portal.
 *
 * Founder decision, 2026-08-31: "Fleet should be link to merchant portal, the
 * products are his riders or drivers."
 *
 * This replaces the first attempt, which put the owner's console inside the
 * Operations Console shell. That was Operations reading a fleet page, not a
 * partner running their own business — a fleet owner sitting under a sidebar
 * headed OPERATIONS CONSOLE, next to twenty pages that refuse him.
 *
 * So it is built as the merchant portal's sibling and deliberately mirrors it,
 * screen for screen: a merchant sells products and works orders; a fleet owner
 * fields riders and works their jobs. Same shell, same sidebar, same card and
 * table idiom, same narrow-viewport drawer — because it is the same kind of
 * thing, and the founder asked for the existing design to be left alone.
 */

const NAVY_DEEP = '#060E1C';
const NAVY_BASE = '#0A1628';
const NAVY_CARD = '#0D1B2E';
const NAVY_SURFACE = '#112238';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.38)';
const C_ERR = '#EF4444';
const WHITE = '#FFFFFF';
const G0 = '#176B30';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const PP = 'Poppins, sans-serif';
const IT = 'Inter, sans-serif';

const STYLE_ID = 'dripplex-fleet-styles';
if (typeof document !== 'undefined' && document.getElementById(STYLE_ID) === null) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    .fx-nav { display:flex; align-items:center; gap:9px; padding:8px 14px; margin:1px 8px;
              border-radius:7px; cursor:pointer; font-family:${IT}; font-size:12.5px;
              transition:background .15s; }
    .fx-nav:hover { background:rgba(255,255,255,.04); }
    .fx-scroll::-webkit-scrollbar { width:6px; }
    .fx-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:3px; }
    .fx-input { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1);
                border-radius:8px; color:#fff; font-family:${IT}; font-size:13px;
                padding:9px 12px; outline:none; width:100%; box-sizing:border-box; }
    .fx-input:focus { border-color:rgba(71,207,114,.45); }
    .fx-input::placeholder { color:rgba(255,255,255,.28); }
  `;
  document.head.appendChild(s);
}

type FleetPage = 'dashboard' | 'riders' | 'requests' | 'jobs' | 'earnings';

const NAV_PRIMARY: { page: FleetPage; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '⬛', label: 'Dashboard' },
  // The merchant's Products, in a fleet's terms. Founder: "the products are
  // his riders or drivers."
  { page: 'riders', icon: '🛵', label: 'My Riders' },
  { page: 'requests', icon: '🙋', label: 'Requests' },
  { page: 'jobs', icon: '📦', label: 'Jobs' },
  { page: 'earnings', icon: '💰', label: 'Commission' },
];

const money = (value: number): string => `₦${Math.round(value).toLocaleString()}`;
const pct = (rate: number | null): string =>
  rate === null ? '—' : `${String(Math.round(rate * 1000) / 10)}%`;

// ─── Shared pieces ────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: NAVY_CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '14px 16px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Btn({
  label,
  onClick,
  color = G3,
  outline = false,
  disabled = false,
}: {
  label: string;
  onClick?: () => void;
  color?: string;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: outline ? `1px solid ${color}` : 'none',
        borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: IT,
        fontWeight: 600,
        fontSize: 11.5,
        padding: '5px 12px',
        background: outline ? 'transparent' : color,
        color: outline ? color : NAVY_DEEP,
      }}
    >
      {label}
    </button>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{label}</div>
      <div style={{ fontFamily: PP, fontSize: 22, fontWeight: 700, color: WHITE, marginTop: 4 }}>
        {value}
      </div>
      {sub !== undefined && (
        <div style={{ fontFamily: IT, fontSize: 10.5, color: MUTED, marginTop: 2 }}>{sub}</div>
      )}
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: WHITE, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        padding: '7px 8px',
        textAlign: 'left',
        fontFamily: IT,
        fontSize: 11,
        color: MUTED,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td
      style={{
        padding: '9px 8px',
        fontFamily: IT,
        fontSize: 12,
        color: muted ? MUTED : WHITE,
      }}
    >
      {children}
    </td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: IT, fontSize: 12.5, color: MUTED, padding: '10px 2px' }}>
      {children}
    </div>
  );
}

// ─── Sign in ──────────────────────────────────────────────────────────────────
/**
 * A fleet owner signs in with the DrippleX account they registered the fleet
 * from — there is no separate fleet credential, and inventing a
 * `/auth/login/fleet` endpoint for one would be a second password to forget.
 * The customer portal admits them because registering a fleet requires an
 * account that already holds the `customer` role.
 */
function FleetLoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (email.trim() === '' || password === '' || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.loginCustomer({ email: email.trim(), password });
      auth.setTokens(res.accessToken, res.refreshToken);
      auth.setUser(res.user);
      if (!res.user.permissions.includes('fleet:own:read')) {
        auth.clear();
        setError('This account does not run a fleet on DrippleX.');
        return;
      }
      onLogin();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Sign in failed. Check your details.');
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
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: `linear-gradient(135deg,${G0},${G3})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: PP,
              fontSize: 16,
              fontWeight: 700,
              color: NAVY_DEEP,
            }}
          >
            D
          </div>
          <div>
            <div style={{ fontFamily: PP, fontWeight: 700, fontSize: 15, color: WHITE }}>
              DrippleX
            </div>
            <div style={{ fontFamily: IT, fontSize: 10, color: MUTED, letterSpacing: 0.5 }}>
              FLEET PORTAL
            </div>
          </div>
        </div>

        <Card>
          <div style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: WHITE }}>
            Sign in to your fleet
          </div>
          <div style={{ fontFamily: IT, fontSize: 12.5, color: MUTED, marginTop: 4 }}>
            Use the DrippleX account you registered your fleet with.
          </div>

          <input
            className="fx-input"
            style={{ marginTop: 14 }}
            placeholder="Email address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
          <input
            className="fx-input"
            style={{ marginTop: 10 }}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />

          {error !== '' && (
            <div style={{ marginTop: 10, fontFamily: IT, fontSize: 12, color: C_ERR }}>{error}</div>
          )}

          <div style={{ marginTop: 14 }}>
            <Btn
              label={loading ? 'Signing in…' : 'Sign in'}
              disabled={loading}
              onClick={() => {
                void submit();
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function FxSidebar({
  page,
  onNav,
  fleetName,
  fleetNumber,
  requestCount,
  onLogout,
  narrow = false,
  open = false,
  onClose,
}: {
  page: FleetPage;
  onNav: (p: FleetPage) => void;
  fleetName: string;
  fleetNumber: string;
  requestCount: number;
  onLogout: () => void;
  narrow?: boolean;
  open?: boolean;
  onClose?: () => void;
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
        ...(narrow
          ? {
              position: 'fixed' as const,
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 70,
              height: '100dvh',
              overflowY: 'auto' as const,
              transform: open ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform .22s ease',
              boxShadow: open ? '0 0 40px rgba(0,0,0,.6)' : 'none',
            }
          : {}),
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
              fontFamily: PP,
              fontSize: 13,
              fontWeight: 700,
              color: NAVY_DEEP,
            }}
          >
            D
          </div>
          <div>
            <div style={{ fontFamily: PP, fontWeight: 700, fontSize: 12, color: WHITE }}>
              DrippleX
            </div>
            <div style={{ fontFamily: IT, fontSize: 9, color: MUTED, letterSpacing: 0.5 }}>
              FLEET PORTAL
            </div>
          </div>
        </div>
        {/* The DX number is the thing an owner reads out to riders, so it is
            on every screen rather than buried on one. */}
        <div style={{ fontFamily: IT, fontSize: 11, color: WHITE }}>{fleetName}</div>
        <div style={{ fontFamily: IT, fontSize: 11, color: G3, fontWeight: 600, marginTop: 2 }}>
          {fleetNumber}
        </div>
      </div>

      <div className="fx-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV_PRIMARY.map((item) => {
          const active = item.page === page;
          const badge = item.page === 'requests' && requestCount > 0 ? requestCount : undefined;
          return (
            <div
              key={item.page}
              className="fx-nav"
              onClick={() => {
                onNav(item.page);
                onClose?.();
              }}
              style={{
                borderLeft: active ? `3px solid ${G3}` : '3px solid transparent',
                background: active ? 'rgba(71,207,114,.09)' : 'transparent',
                color: active ? G3 : MUTED,
                fontWeight: active ? 600 : 400,
                padding: narrow ? '11px 14px' : '8px 14px',
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {badge !== undefined && (
                <span
                  style={{
                    background: G2,
                    color: NAVY_DEEP,
                    borderRadius: 99,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                  }}
                >
                  {badge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${BORDER}` }}>
        <Btn label="Sign out" outline color={MUTED} onClick={onLogout} />
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────
function DashboardPage({
  overview,
  onNav,
}: {
  overview: FleetOverviewDto;
  onNav: (p: FleetPage) => void;
}) {
  const { fleet, period, summary, liveJobs } = overview;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fleet.status === 'PENDING_APPROVAL' && (
        <Card style={{ border: `1px solid rgba(71,207,114,.28)` }}>
          <div style={{ fontFamily: IT, fontSize: 12.5, color: WHITE }}>
            DrippleX is reviewing your fleet.
          </div>
          <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 4 }}>
            You can give your riders {fleet.fleetNumber} now and their requests will appear under
            Requests — nothing is counted or charged until your fleet is approved.
          </div>
        </Card>
      )}
      {fleet.status === 'SUSPENDED' && (
        <Card style={{ border: `1px solid rgba(239,68,68,.3)` }}>
          <div style={{ fontFamily: IT, fontSize: 12.5, color: C_ERR }}>
            Your fleet is suspended. {fleet.suspendedReason ?? ''}
          </div>
        </Card>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
        }}
      >
        <Kpi label="Riders & Drivers" value={String(summary.totalMembers)} sub="On your fleet" />
        <Kpi label="Online" value={String(summary.onlineMembers)} sub="Right now" />
        <Kpi label="On a job" value={String(summary.onJobMembers)} sub="Working" />
        <Kpi label="Waiting" value={String(summary.pendingRequests)} sub="To confirm" />
      </div>

      <Card>
        <SectionTitle>This month so far</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 12,
          }}
        >
          {[
            ['Jobs', String(period.orderCount)],
            ['Fees & fares', money(period.chargeableTotal)],
            [
              period.settled ? 'Rate charged' : 'Rate at this volume',
              pct(period.settled ? period.appliedRate : period.projectedRate),
            ],
            [
              period.settled ? 'Commission' : 'Estimated commission',
              period.settled
                ? money(period.commissionAmount ?? 0)
                : period.projectedCommission === null
                  ? '—'
                  : money(period.projectedCommission),
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{label}</div>
              <div
                style={{
                  fontFamily: PP,
                  fontSize: 16,
                  fontWeight: 700,
                  color: WHITE,
                  marginTop: 2,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <SectionTitle>Working now</SectionTitle>
          <Btn
            label="All jobs"
            outline
            color={G3}
            onClick={() => {
              onNav('jobs');
            }}
          />
        </div>
        {liveJobs.length === 0 ? (
          <Empty>Nobody is on a job right now.</Empty>
        ) : (
          <JobsTable jobs={liveJobs.slice(0, 5)} />
        )}
      </Card>
    </div>
  );
}

function JobsTable({ jobs }: { jobs: FleetOverviewDto['liveJobs'] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            <Th>Who</Th>
            <Th>Job</Th>
            <Th>Status</Th>
            <Th>Amount</Th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobId} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <Td>{job.memberName}</Td>
              <Td muted>{job.kind === 'RIDE' ? 'Trip' : 'Delivery'}</Td>
              <Td muted>{job.status}</Td>
              <Td>{money(job.amount)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The merchant's Products page, for a fleet. Founder: the riders are the products. */
function RidersPage({
  members,
  busyId,
  message,
  onAct,
}: {
  members: FleetMemberDto[];
  busyId: string | null;
  message: string | null;
  onAct: (m: FleetMemberDto, action: 'deactivate' | 'reactivate' | 'remove') => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  return (
    <Card>
      <SectionTitle>My Riders &amp; Drivers</SectionTitle>
      {message !== null && (
        <div style={{ fontFamily: IT, fontSize: 12, color: WHITE, marginBottom: 8 }}>{message}</div>
      )}
      {members.length === 0 ? (
        <Empty>
          Nobody on your fleet yet. Give your riders your Fleet DX number — they enter it when they
          sign up with DrippleX, and their requests appear under Requests.
        </Empty>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Jobs</Th>
                <Th>Gross</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const busy = busyId === m.memberId;
                return (
                  <tr key={m.memberId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <Td>
                      {m.name}
                      {m.onJob && <span style={{ color: G3 }}> · on a job</span>}
                      {!m.onJob && m.online && <span style={{ color: G3 }}> · online</span>}
                    </Td>
                    <Td muted>{m.phone ?? '—'}</Td>
                    <Td muted>{m.role === 'RIDER' ? 'Rider' : 'Driver'}</Td>
                    <Td muted={m.status !== 'ACTIVE'}>
                      {m.status === 'ACTIVE' ? 'Active' : 'Paused'}
                    </Td>
                    <Td>{String(m.completedThisMonth)}</Td>
                    <Td>{money(m.grossThisMonth)}</Td>
                    <td style={{ padding: '9px 8px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {m.status === 'ACTIVE' ? (
                          <Btn
                            label={busy ? '…' : 'Pause'}
                            outline
                            color={MUTED}
                            disabled={busy}
                            onClick={() => {
                              onAct(m, 'deactivate');
                            }}
                          />
                        ) : (
                          <Btn
                            label={busy ? '…' : 'Activate'}
                            outline
                            color={G3}
                            disabled={busy}
                            onClick={() => {
                              onAct(m, 'reactivate');
                            }}
                          />
                        )}
                        {/* Removing is not reversible by the owner — they would
                            have to be attached again — so it asks once. */}
                        <Btn
                          label={confirmRemove === m.memberId ? 'Confirm' : 'Remove'}
                          outline
                          color={C_ERR}
                          disabled={busy}
                          onClick={() => {
                            if (confirmRemove !== m.memberId) {
                              setConfirmRemove(m.memberId);
                              return;
                            }
                            setConfirmRemove(null);
                            onAct(m, 'remove');
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 10 }}>
        Removing takes someone off your fleet and frees them to join another. It never deletes their
        DrippleX account, their earnings or the trips they have already done.
      </div>
    </Card>
  );
}

function RequestsPage({
  requests,
  fleetNumber,
  busyId,
  message,
  onDecide,
}: {
  requests: FleetMemberDto[];
  fleetNumber: string;
  busyId: string | null;
  message: string | null;
  onDecide: (m: FleetMemberDto, action: 'approve' | 'reject') => void;
}) {
  return (
    <Card>
      <SectionTitle>Waiting for you to confirm</SectionTitle>
      <div style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginBottom: 10 }}>
        These people entered {fleetNumber} during their own DrippleX onboarding. They are not on
        your fleet, and nothing they do is charged to you, until you confirm them.
      </div>
      {message !== null && (
        <div style={{ fontFamily: IT, fontSize: 12, color: WHITE, marginBottom: 8 }}>{message}</div>
      )}
      {requests.length === 0 ? (
        <Empty>Nobody is waiting.</Empty>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Role</Th>
                <Th>Asked</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const busy = busyId === r.memberId;
                return (
                  <tr key={r.memberId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <Td>{r.name}</Td>
                    <Td muted>{r.phone ?? '—'}</Td>
                    <Td muted>{r.role === 'RIDER' ? 'Rider' : 'Driver'}</Td>
                    <Td muted>{new Date(r.joinedAt).toLocaleDateString('en-NG')}</Td>
                    <td style={{ padding: '9px 8px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Btn
                          label={busy ? '…' : 'Confirm'}
                          disabled={busy}
                          onClick={() => {
                            onDecide(r, 'approve');
                          }}
                        />
                        <Btn
                          label="Not mine"
                          outline
                          color={C_ERR}
                          disabled={busy}
                          onClick={() => {
                            onDecide(r, 'reject');
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function EarningsPage({ overview }: { overview: FleetOverviewDto }) {
  const { period, members } = overview;
  const top = [...members]
    .sort((a, b) => b.grossThisMonth - a.grossThisMonth)
    .filter((m) => m.completedThisMonth > 0)
    .slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <SectionTitle>What you owe DrippleX this month</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 12,
          }}
        >
          {[
            ['Jobs', String(period.orderCount)],
            ['Fees & fares', money(period.chargeableTotal)],
            [
              period.settled ? 'Rate charged' : 'Rate at this volume',
              pct(period.settled ? period.appliedRate : period.projectedRate),
            ],
            [
              period.settled ? 'Commission' : 'Estimated',
              period.settled
                ? money(period.commissionAmount ?? 0)
                : period.projectedCommission === null
                  ? '—'
                  : money(period.projectedCommission),
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>{label}</div>
              <div
                style={{
                  fontFamily: PP,
                  fontSize: 18,
                  fontWeight: 700,
                  color: WHITE,
                  marginTop: 2,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
        {!period.settled && (
          <div style={{ fontFamily: IT, fontSize: 11.5, color: MUTED, marginTop: 10 }}>
            {period.projectedRate === null
              ? 'No commission band covers this volume yet — DrippleX Operations will confirm your rate.'
              : 'An estimate. Your whole month is charged at the band your final volume reaches, so this can still improve.'}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Who earned it</SectionTitle>
        {top.length === 0 ? (
          <Empty>No completed jobs this month yet.</Empty>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Jobs</Th>
                  <Th>Fees &amp; fares</Th>
                </tr>
              </thead>
              <tbody>
                {top.map((m) => (
                  <tr key={m.memberId} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <Td>{m.name}</Td>
                    <Td muted>{m.role === 'RIDER' ? 'Rider' : 'Driver'}</Td>
                    <Td>{String(m.completedThisMonth)}</Td>
                    <Td>{money(m.grossThisMonth)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 10 }}>
          Fees and fares are what the jobs carried, not what you pay your riders. What they earn is
          between you and them.
        </div>
      </Card>
    </div>
  );
}

// ─── Portal shell ─────────────────────────────────────────────────────────────
export function FleetPortalScreen({ initialPage = 'dashboard' }: { initialPage?: FleetPage }) {
  // Only a session that actually runs a fleet counts as signed in. A leftover
  // customer session would otherwise skip the login and render a portal whose
  // every call 403s — the same trap the merchant portal guards against.
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const u = auth.getUser();
    return u !== null && u.permissions.includes('fleet:own:read');
  });
  const [page, setPage] = useState<FleetPage>(initialPage);
  const [overview, setOverview] = useState<FleetOverviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const narrow = useNarrowViewport();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!narrow) setNavOpen(false);
  }, [narrow]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await api.admin.getFleetOverview());
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Could not load your fleet.');
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    void load();
  }, [isLoggedIn, load]);

  const act = useCallback(
    async (member: FleetMemberDto, action: 'deactivate' | 'reactivate' | 'remove') => {
      setBusyId(member.memberId);
      setMessage(null);
      try {
        if (action === 'deactivate') await api.admin.deactivateFleetMember(member.memberId);
        else if (action === 'reactivate') await api.admin.reactivateFleetMember(member.memberId);
        else await api.admin.removeFleetMember(member.memberId);
        setMessage(
          action === 'remove'
            ? `${member.name} removed. Their DrippleX account is untouched.`
            : action === 'deactivate'
              ? `${member.name} paused — they will not be sent work.`
              : `${member.name} is active again.`,
        );
        await load();
      } catch (e: unknown) {
        setMessage((e as { message?: string }).message ?? 'That did not work.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const decide = useCallback(
    async (member: FleetMemberDto, action: 'approve' | 'reject') => {
      setBusyId(member.memberId);
      setMessage(null);
      try {
        if (action === 'approve') await api.fleet.approveRequest(member.memberId);
        else await api.fleet.rejectRequest(member.memberId);
        setMessage(
          action === 'approve'
            ? `${member.name} is on your fleet.`
            : `${member.name}’s request was turned down.`,
        );
        await load();
      } catch (e: unknown) {
        setMessage((e as { message?: string }).message ?? 'That did not work.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleLogout = () => {
    void endSession(signOutRequest).finally(() => {
      setIsLoggedIn(false);
      setOverview(null);
    });
  };

  if (!isLoggedIn) {
    return (
      <FleetLoginScreen
        onLogin={() => {
          setIsLoggedIn(true);
        }}
      />
    );
  }

  const renderPage = (): React.ReactNode => {
    if (error !== null) {
      return (
        <Card>
          <div style={{ fontFamily: IT, fontSize: 12.5, color: C_ERR }}>{error}</div>
        </Card>
      );
    }
    if (overview === null) {
      return (
        <Card>
          <div style={{ fontFamily: IT, fontSize: 12.5, color: MUTED }}>Loading…</div>
        </Card>
      );
    }
    switch (page) {
      case 'dashboard':
        return <DashboardPage overview={overview} onNav={setPage} />;
      case 'riders':
        return (
          <RidersPage
            members={overview.members}
            busyId={busyId}
            message={message}
            onAct={(m, a) => {
              void act(m, a);
            }}
          />
        );
      case 'requests':
        return (
          <RequestsPage
            requests={overview.pendingRequests}
            fleetNumber={overview.fleet.fleetNumber}
            busyId={busyId}
            message={message}
            onDecide={(m, a) => {
              void decide(m, a);
            }}
          />
        );
      case 'jobs':
        return (
          <Card>
            <SectionTitle>Jobs running now</SectionTitle>
            {overview.liveJobs.length === 0 ? (
              <Empty>Nobody is on a job right now.</Empty>
            ) : (
              <JobsTable jobs={overview.liveJobs} />
            )}
          </Card>
        );
      case 'earnings':
        return <EarningsPage overview={overview} />;
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
      <FxSidebar
        page={page}
        onNav={setPage}
        fleetName={overview?.fleet.name ?? 'Your fleet'}
        fleetNumber={overview?.fleet.fleetNumber ?? ''}
        requestCount={overview?.pendingRequests.length ?? 0}
        onLogout={handleLogout}
        narrow={narrow}
        open={navOpen}
        onClose={() => {
          setNavOpen(false);
        }}
      />
      {narrow && navOpen && (
        <div
          onClick={() => {
            setNavOpen(false);
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 60 }}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: `1px solid ${BORDER}`,
            background: NAVY_SURFACE,
            flexShrink: 0,
          }}
        >
          {narrow && (
            <button
              onClick={() => {
                setNavOpen(true);
              }}
              aria-label="Menu"
              style={{
                background: 'transparent',
                border: `1px solid ${BORDER}`,
                borderRadius: 7,
                color: WHITE,
                cursor: 'pointer',
                fontSize: 14,
                padding: '4px 9px',
              }}
            >
              ☰
            </button>
          )}
          <div style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: WHITE }}>
            {NAV_PRIMARY.find((n) => n.page === page)?.label ?? 'Fleet'}
          </div>
        </div>

        <div
          className="fx-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: 16, boxSizing: 'border-box' }}
        >
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export const FleetDashboardScreen = (): React.ReactElement => (
  <FleetPortalScreen initialPage="dashboard" />
);
