import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, uploadFile } from '../lib/api';
import { AccountPageHost, AccountRows, type AccountPage } from './accountPages';
import { playNotificationSound } from '../lib/sound';
import { SoundSettings } from './soundSettings';
import { PayoutPanel } from './payoutPanel';
import { auth, endSession } from '../lib/auth';
import { signOutRequest } from '../lib/push';
import { useLocationHeartbeat } from '../lib/locationHeartbeat';
import {
  hasOverlayPermission,
  isDriverPresenceRunning,
  requestOverlayPermission,
  startRiderPresence,
  stopDriverPresence,
  type PresenceOutcome,
} from '../lib/driverPresence';
import { DriverPresenceStatus } from './presenceStatus';
import { getCurrentPosition } from '../lib/maps';
import type {
  DeliveryJobDto,
  RiderAvailabilityDto,
  RiderDeliveryJobDto,
  RiderProfileDto,
  WalletDto,
  WalletLedgerEntryDto,
} from '../lib/api';

/**
 * How often a rider/driver's position is pushed while they are online.
 *
 * Founder decision, 2026-08-16: 30s, "at least it will be lively". Dispatch
 * picks the NEAREST candidate and the customer's live map interpolates between
 * fixes, so a slower cadence both costs the courier work and makes tracking
 * look frozen. Faster than this starts to cost battery and mobile data for no
 * visible gain at city speeds.
 */
export const LOCATION_PUSH_INTERVAL_MS = 30_000;

const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";
const NAVY_BASE = '#0A1628';
const NAVY_CARD = '#0D1B2E';
const NAVY_SURFACE = '#112238';
const BORDER = 'rgba(255,255,255,.08)';
const MUTED = 'rgba(255,255,255,.38)';
const G0 = '#176B30';
const G2 = '#2BAC52';
const G3 = '#47CF72';
const C_ERR = '#EF4444';
const C_WARN = '#F59E0B';
const WHITE = '#FFFFFF';

/**
 * Top spacer for the device's own status bar.
 *
 * `dx-status-mock` is not decoration — it is what the theme keys off to hide
 * this row's contents on a real device (`.dx-status-mock > * { visibility:
 * hidden }`, both branches in shared.tsx). Every other screen's status bar
 * carries it; this one did not, so riders alone saw a second clock and a
 * painted signal and battery under the ones their phone already draws.
 * Reported from the field, 2026-08-30.
 *
 * `visibility: hidden` keeps the layout box, so the row still provides exactly
 * the spacing it always did — which is the only part of it that was ever real.
 */
function RStatusBar() {
  const now = new Date();
  const t = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div
      className="dx-status-mock"
      style={{
        paddingTop: 52,
        paddingBottom: 8,
        paddingLeft: 20,
        paddingRight: 20,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: IT,
        fontSize: 11,
        color: 'rgba(255,255,255,.45)',
      }}
    >
      <span>{t}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <span>📶</span>
        <span>🔋</span>
      </div>
    </div>
  );
}

function RBackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        background: NAVY_SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        fontFamily: IT,
        fontSize: 13,
        color: MUTED,
        cursor: 'pointer',
      }}
    >
      ← Back
    </button>
  );
}

function RGreenBtn({
  label,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        height: 54,
        borderRadius: 16,
        border: 'none',
        background:
          disabled || loading ? 'rgba(255,255,255,.08)' : `linear-gradient(135deg,${G0},${G2})`,
        color: disabled || loading ? MUTED : WHITE,
        fontFamily: PP,
        fontWeight: 700,
        fontSize: 16,
        boxShadow: !disabled && !loading ? `0 8px 28px rgba(43,172,82,.35)` : 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}

function JobStatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    PENDING: [C_WARN, 'Pending'],
    ASSIGNED: ['#3B82F6', 'Assigned'],
    ACCEPTED: [G3, 'Accepted'],
    PICKED_UP: [G2, 'Picked Up'],
    ON_THE_WAY: [G3, 'On the Way'],
    ARRIVED: [G2, 'Arrived'],
    DELIVERED: [G3, 'Delivered'],
    FAILED: [C_ERR, 'Failed'],
    CANCELLED: [C_ERR, 'Cancelled'],
  };
  const [color, label] = map[status] ?? [MUTED, status];
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
        color,
        background: `${color}1a`,
      }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER LOGIN
// ─────────────────────────────────────────────────────────────────────────────
export function RiderLoginScreen({
  onContinue,
  onBack,
  onApply,
  onForgot,
}: {
  onContinue: () => void;
  onBack: () => void;
  onApply?: () => void;
  onForgot?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.auth.loginRider({ email, password });
      auth.setTokens(resp.accessToken, resp.refreshToken);
      auth.setUser(resp.user);
      onContinue();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
        <div style={{ marginBottom: 24 }}>
          <RBackBtn onClick={onBack} />
        </div>

        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `linear-gradient(135deg,${G0},${G2})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              marginBottom: 16,
              boxShadow: `0 8px 28px rgba(43,172,82,.3)`,
            }}
          >
            🏍️
          </div>
          <p
            style={{ fontFamily: PP, fontSize: 26, fontWeight: 700, color: WHITE, marginBottom: 4 }}
          >
            Rider Portal
          </p>
          <p style={{ fontFamily: IT, fontSize: 14, color: MUTED }}>DrippleX Delivery Partner</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginBottom: 6 }}>Email</p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              border: `1px solid ${BORDER}`,
              background: NAVY_SURFACE,
              color: WHITE,
              fontFamily: IT,
              fontSize: 15,
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, marginBottom: 6 }}>Password</p>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              border: `1px solid ${BORDER}`,
              background: NAVY_SURFACE,
              color: WHITE,
              fontFamily: IT,
              fontSize: 15,
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)',
            }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{error}</p>
          </div>
        )}

        {onForgot && (
          <button
            type="button"
            onClick={onForgot}
            className="active:opacity-70"
            style={{
              display: 'block',
              marginLeft: 'auto',
              marginBottom: 14,
              fontFamily: IT,
              fontSize: 13,
              fontWeight: 600,
              color: G3,
            }}
          >
            Forgot password?
          </button>
        )}

        <RGreenBtn label={loading ? '' : 'Sign In →'} loading={loading} onClick={handleLogin} />

        <p style={{ fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 16 }}>
          New delivery partner?{' '}
          <button
            type="button"
            onClick={onApply}
            className="active:opacity-60"
            style={{ color: G3, fontWeight: 600 }}
          >
            Apply to join →
          </button>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER DASHBOARD — availability + jobs list
// ─────────────────────────────────────────────────────────────────────────────
export function RiderDashboardScreen({
  onJob,
  onEarnings,
  onAccount,
  onSignIn,
}: {
  onJob: (job: RiderDeliveryJobDto) => void;
  onEarnings: () => void;
  onAccount: () => void;
  onSignIn?: () => void;
}) {
  const [online, setOnline] = useState(false);

  /**
   * Same problem, same fix as the driver app: a position sent once at
   * go-online ages out, and a rider with a stale position is one the
   * assignment service can no longer place. Tunde reading "You are live ·
   * Waiting for delivery jobs…" with a ready order unassigned is this.
   */
  const heartbeat = useLocationHeartbeat(online, async (position) => {
    await api.rider.setAvailability({
      online: true,
      acceptingOrders: true,
      latitude: position.latitude,
      longitude: position.longitude,
    });
  });
  const [toggling, setToggling] = useState(false);
  /**
   * DPX-MOBILE-003, extended to riders.
   *
   * The heartbeat above is a WebView `setInterval`. Chromium clamps background
   * timers the moment the app is hidden, and Android kills the process outright
   * when it reclaims memory — so a rider who pockets their phone stops
   * reporting while this screen goes on saying they are live. That is the exact
   * failure drivers hit on 2026-08-27, from the exact same cause, and the fix
   * is the same native foreground service.
   *
   * The heartbeat stays. It is the foreground path, and the only path on iOS
   * and the web; both writing the same coordinates is harmless.
   */
  const [presence, setPresence] = useState<PresenceOutcome | null>(null);
  const [overlay, setOverlay] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<RiderDeliveryJobDto[]>([]);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  // Dispatch only considers riders that have coordinates on record
  // (AssignmentService drops null-location candidates), so track whether the
  // server actually has our position and say so instead of claiming "live".
  const [located, setLocated] = useState(false);
  const [locationErr, setLocationErr] = useState<string | null>(null);
  // Show the signed-in rider, not a demo persona.
  const riderName = (() => {
    const u = auth.getUser();
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || 'Rider';
  })();
  // One browser session is shared across every portal, so signing into the
  // Operations Console replaces the rider's session. Without this check the
  // dashboard rendered the ADMIN's name as the rider and then sent every job
  // action under the admin's id — which the backend rightly refused with
  // "Delivery job is not assigned to this rider". Mirrors the driver app gate.
  const isRider = auth.hasRole('rider');

  // Ids we have already chimed for. The poll runs every 8s, so comparing
  // against the previous set is what separates a job arriving from the same
  // job still sitting there unaccepted.
  const announcedJobIds = useRef<Set<string>>(new Set());

  const fetchJobs = useCallback(() => {
    api.rider
      .getJobs()
      .then((next) => {
        const fresh = next.filter((job) => !announcedJobIds.current.has(job.id));
        if (fresh.length > 0) {
          playNotificationSound('new-request');
          for (const job of fresh) announcedJobIds.current.add(job.id);
        }
        setJobs(next);
      })
      .catch((e) => setLoadErr(e.message));
  }, []);

  useEffect(() => {
    api.rider
      .getWallet()
      .then(setWallet)
      .catch(() => {});
    // Read the server's availability instead of assuming offline: a rider who
    // was online before a reload is still online for dispatch.
    api.rider
      .getAvailability()
      .then((a) => {
        if (!a) return;
        setOnline(a.online && a.acceptingOrders);
        setLocated(a.latitude !== null && a.longitude !== null);
      })
      .catch(() => {});
    fetchJobs();
    const t = setInterval(fetchJobs, 8000);
    return () => clearInterval(t);
  }, [fetchJobs]);

  // Push the current position while online. Riders move, and dispatch picks the
  // nearest one to the pickup point, so a stale fix costs the rider jobs.
  useEffect(() => {
    if (!online) return;
    const push = () => {
      void getCurrentPosition().then((pos) => {
        if (!pos) return;
        void api.rider
          .setAvailability({
            online: true,
            acceptingOrders: true,
            latitude: pos.latitude,
            longitude: pos.longitude,
          })
          .then(() => setLocated(true))
          .catch(() => {});
      });
    };
    const t = setInterval(push, LOCATION_PUSH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [online]);

  /**
   * Keep native presence in step with `online` however the rider got there.
   *
   * Presence used to start only from the toggle, so a rider whose stored
   * availability already said online — reopening the app mid-shift, or after
   * Android killed it — got "You are live" above a service that had never
   * started. That was bug 2 of the four in #318 on the driver side; it would
   * have shipped here too.
   *
   * Safe alongside the toggle's own start: a second `start` is a no-op
   * natively, and `isDriverPresenceRunning()` skips it in the ordinary case.
   */
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    void (async () => {
      try {
        if (await isDriverPresenceRunning()) return;
        const pos = await getCurrentPosition();
        const outcome = await startRiderPresence({
          acceptingOrders: true,
          ...(pos ? { latitude: pos.latitude, longitude: pos.longitude } : {}),
        });
        if (cancelled) return;
        setPresence(outcome);
        setOverlay(outcome === 'started' ? await hasOverlayPermission() : null);
      } catch {
        // Presence failing is a degraded shift, not a broken screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online]);

  /**
   * Re-check the overlay permission when the rider comes back to the app.
   *
   * SYSTEM_ALERT_WINDOW is granted in Settings, not by a dialog, so the app is
   * backgrounded while it happens and learns nothing on its own. Without this
   * the prompt stays on screen after they have already granted it.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && presence === 'started') {
        void hasOverlayPermission().then(setOverlay);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [presence]);

  const handleToggle = async () => {
    setToggling(true);
    setLocationErr(null);
    try {
      const next = !online;
      if (next) {
        // Going online without coordinates makes the rider invisible to
        // dispatch — the job is created but never assigned to anyone — so
        // refuse to claim "live" when the device won't share a position.
        const pos = await getCurrentPosition();
        if (!pos) {
          setLocationErr(
            'DrippleX needs your location to send you nearby deliveries. Allow location access, then try again.',
          );
          return;
        }
        await api.rider.setAvailability({
          online: true,
          acceptingOrders: true,
          latitude: pos.latitude,
          longitude: pos.longitude,
        });
        setLocated(true);
        // Hand the shift to the native service, which keeps reporting once
        // Android freezes this WebView's timers. Started here with the app on
        // screen because Android 12+ refuses a foreground service started from
        // the background. Not awaited: a rider must not be blocked from going
        // online because a platform call failed — but the verdict is recorded
        // rather than dropped, which is what made the driver version of this
        // bug invisible for a day.
        void startRiderPresence({
          acceptingOrders: true,
          // The fix from the getCurrentPosition() above. Without it the service
          // can start with no location at all and post nothing while claiming
          // the rider is online.
          latitude: pos.latitude,
          longitude: pos.longitude,
        }).then(async (outcome) => {
          setPresence(outcome);
          setOverlay(outcome === 'started' ? await hasOverlayPermission() : null);
        });
      } else {
        await api.rider.setAvailability({ online: false, acceptingOrders: false });
        // Stop before anything else can fail: a presence notification that
        // outlives the shift tells the rider they are working when the server
        // has them offline.
        void stopDriverPresence();
        setPresence(null);
        setOverlay(null);
      }
      setOnline(next);
    } catch (e) {
      setLocationErr((e as { message?: string }).message ?? 'Could not update your status.');
    } finally {
      setToggling(false);
    }
  };

  const activeJobs = jobs.filter((j) => !['DELIVERED', 'FAILED', 'CANCELLED'].includes(j.status));
  const pastJobs = jobs.filter((j) => ['DELIVERED', 'FAILED', 'CANCELLED'].includes(j.status));

  // Only a rider session can use this app. Rendering it for anyone else showed
  // their name as the rider and sent job actions under the wrong id.
  if (!isRider) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: NAVY_BASE,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '0 32px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 34 }}>🏍️</div>
        <div style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: WHITE }}>
          Sign in as a rider
        </div>
        <div style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>
          {auth.isLoggedIn()
            ? `You are signed in as ${riderName}, which is not a delivery-rider account. Sign in to your rider account to go online and accept deliveries.`
            : 'Sign in to your rider account to go online and accept deliveries.'}
        </div>
        {onSignIn && (
          <div style={{ marginTop: 8, width: '100%', maxWidth: 240 }}>
            <RGreenBtn label="Go to rider sign-in" onClick={onSignIn} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 32px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div>
            <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: WHITE }}>
              🏍️ {riderName}
            </p>
            <p style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>DrippleX Delivery Rider</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onEarnings}
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontFamily: IT,
                fontSize: 12,
                color: G3,
                cursor: 'pointer',
              }}
            >
              Earnings
            </button>
            {/* The portal had no way out and no way in: no sign-out, and no
                view of the rider's own approval/KYC state. */}
            <button
              onClick={onAccount}
              aria-label="Account"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontFamily: IT,
                fontSize: 12,
                color: WHITE,
                cursor: 'pointer',
              }}
            >
              Account
            </button>
          </div>
        </div>

        {/* Wallet */}
        {wallet && (
          <div
            style={{
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 20,
              background: `linear-gradient(135deg,${G0}CC,${G2})`,
              boxShadow: `0 12px 40px rgba(43,172,82,.3)`,
            }}
          >
            <p
              style={{
                fontFamily: IT,
                fontSize: 12,
                color: 'rgba(255,255,255,.7)',
                marginBottom: 4,
              }}
            >
              Wallet Balance
            </p>
            <p style={{ fontFamily: PP, fontSize: 28, fontWeight: 800, color: WHITE }}>
              ₦{wallet.availableBalance.toLocaleString()}
            </p>
          </div>
        )}

        {/* Online toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          style={{
            width: '100%',
            height: 60,
            borderRadius: 16,
            border: online ? '1.5px solid rgba(239,68,68,.3)' : 'none',
            background: toggling
              ? 'rgba(255,255,255,.06)'
              : online
                ? 'rgba(239,68,68,.1)'
                : `linear-gradient(135deg,${G0},${G2})`,
            color: toggling ? MUTED : online ? C_ERR : WHITE,
            fontFamily: PP,
            fontWeight: 700,
            fontSize: 17,
            cursor: toggling ? 'default' : 'pointer',
            boxShadow: !toggling && !online ? `0 10px 36px rgba(43,172,82,.36)` : 'none',
            marginBottom: 20,
          }}
        >
          {toggling ? '...' : online ? '⏹ Go Offline' : '▶ Go Online — Accept Deliveries'}
        </button>

        {/* Reused from the driver screen rather than copied: the two personas
            have the same failure modes and the same remedy, and its copy —
            "this phone stops showing you to dispatch" — is already true of
            both. A second implementation would be a second thing to keep
            correct. */}
        <DriverPresenceStatus
          outcome={presence}
          overlayGranted={overlay}
          onRequestOverlay={() => {
            void requestOverlayPermission().then((granted) => {
              if (granted) setOverlay(true);
            });
          }}
        />

        {locationErr && (
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,.07)',
              border: '1px solid rgba(239,68,68,.2)',
              marginBottom: 20,
            }}
          >
            <p style={{ fontFamily: IT, fontSize: 12.5, color: C_ERR }}>{locationErr}</p>
          </div>
        )}

        {online && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 12,
              background: located ? 'rgba(43,172,82,.06)' : 'rgba(245,158,11,.07)',
              border: located ? '1px solid rgba(43,172,82,.12)' : '1px solid rgba(245,158,11,.25)',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: located ? G2 : C_WARN,
                flexShrink: 0,
              }}
            />
            <p style={{ fontFamily: IT, fontSize: 13, color: located ? G3 : C_WARN }}>
              {located
                ? heartbeat.degraded
                  ? 'Location unavailable — you will stop receiving jobs. Check location access.'
                  : 'You are live · Waiting for delivery jobs...'
                : 'Online, but we do not have your location — deliveries are sent to the nearest rider, so you will not be offered any until location sharing is on.'}
            </p>
          </div>
        )}

        {/* Active jobs */}
        {activeJobs.length > 0 && (
          <>
            <p
              style={{
                fontFamily: PP,
                fontSize: 13,
                fontWeight: 600,
                color: MUTED,
                marginBottom: 10,
                letterSpacing: 0.5,
              }}
            >
              ACTIVE JOBS ({activeJobs.length})
            </p>
            {activeJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => onJob(job)}
                style={{
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 10,
                  background: NAVY_CARD,
                  border: `1px solid ${BORDER}`,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${G2}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: WHITE }}>
                    Order #{job.orderId.slice(-6).toUpperCase()}
                  </p>
                  <JobStatusChip status={job.status} />
                </div>
                <p style={{ fontFamily: IT, fontSize: 12, color: MUTED }}>
                  Fee: ₦{job.deliveryFee.toLocaleString()} · ~
                  {Math.round(job.estimatedDurationSeconds / 60)} min
                </p>
              </div>
            ))}
          </>
        )}

        {/* Load error */}
        {loadErr && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)',
              marginBottom: 16,
            }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{loadErr}</p>
          </div>
        )}

        {/* Past jobs */}
        {pastJobs.length > 0 && (
          <>
            <p
              style={{
                fontFamily: PP,
                fontSize: 13,
                fontWeight: 600,
                color: MUTED,
                marginBottom: 10,
                marginTop: 8,
                letterSpacing: 0.5,
              }}
            >
              RECENT DELIVERIES
            </p>
            {pastJobs.slice(0, 5).map((job) => (
              <div
                key={job.id}
                style={{
                  borderRadius: 14,
                  padding: '12px 16px',
                  marginBottom: 8,
                  background: NAVY_SURFACE,
                  border: `1px solid ${BORDER}`,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <p style={{ fontFamily: IT, fontSize: 13, color: WHITE }}>
                    #{job.orderId.slice(-6).toUpperCase()}
                  </p>
                  <JobStatusChip status={job.status} />
                </div>
                <p style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginTop: 4 }}>
                  ₦{job.deliveryFee.toLocaleString()} ·{' '}
                  {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </>
        )}

        {jobs.length === 0 && !loadErr && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: MUTED }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <p style={{ fontFamily: IT, fontSize: 14 }}>No delivery jobs yet</p>
            <p style={{ fontFamily: IT, fontSize: 12, marginTop: 6 }}>
              Go online to start receiving jobs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER JOB DETAIL — accept / pickup / arrive / deliver / cash confirm
// ─────────────────────────────────────────────────────────────────────────────
export function RiderJobScreen({
  job: initialJob,
  onBack,
  onDone,
  onMessageCustomer,
}: {
  job: RiderDeliveryJobDto;
  onBack: () => void;
  onDone: () => void;
  // A rider at the door had no way to reach the customer. The job now carries
  // the customer's NAME — never their phone number — and in-app chat is the
  // channel, so the thread opens with a person on it rather than "Customer".
  onMessageCustomer?: (deliveryJobId: string, customerName: string | null) => void;
}) {
  const [job, setJob] = useState(initialJob);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState(String(initialJob.cashCollectedAmount ?? ''));
  // Real proof-of-delivery photo: uploaded to the delivery-proofs folder, then
  // sent to /deliver — never a placeholder URL.
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofUploading, setProofUploading] = useState(false);

  const handleProofPhoto = async (file: File | undefined) => {
    if (!file) return;
    setProofUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file, 'delivery-proofs');
      setProofUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the photo. Try again.');
    } finally {
      setProofUploading(false);
    }
  };

  // Poll for job status updates
  useEffect(() => {
    const t = setInterval(() => {
      api.rider
        .getJob(job.id)
        .then(setJob)
        .catch(() => {});
    }, 6000);
    return () => clearInterval(t);
  }, [job.id]);

  // The job *actions* return a plain DeliveryJobDto — only GET /rider/jobs and
  // GET /rider/jobs/:id carry `customerName`. Replacing the whole job with an
  // action's result therefore dropped the customer's name, and the "Message
  // customer" button fell back to "Your customer" for the rest of the delivery.
  // Merge instead, and keep the name we already have.
  const act = async (fn: () => Promise<DeliveryJobDto>) => {
    setActing(true);
    setError(null);
    try {
      const updated = await fn();
      // Same reason `customerName` is carried across: the lifecycle endpoints
      // return the plain DeliveryJobDto, so a spread would blank every
      // rider-only field the screen already has.
      setJob((prev) => ({
        ...updated,
        customerName: prev.customerName,
        riderEarning: prev.riderEarning,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const isTerminal = ['DELIVERED', 'FAILED', 'CANCELLED'].includes(job.status);
  // A delivered cash job still owes one action — confirming what was collected —
  // so it gets the cash panel instead of the finished-job panel below.
  const awaitingCashConfirm = job.status === 'DELIVERED' && job.cashCollectedAmount !== null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <RBackBtn onClick={onBack} />
          <div>
            <p style={{ fontFamily: PP, fontSize: 15, fontWeight: 700, color: WHITE }}>
              Job #{job.orderId.slice(-6).toUpperCase()}
            </p>
            {/* Who this delivery is for. A rider looking for one person among
                several at a gate needs a name, not an order number. */}
            <p style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 2 }}>
              For {job.customerName ?? 'your customer'}
            </p>
            <JobStatusChip status={job.status} />
          </div>
          {onMessageCustomer && (
            <button
              onClick={() => onMessageCustomer(job.id, job.customerName)}
              style={{
                marginLeft: 'auto',
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontFamily: IT,
                fontSize: 12,
                color: G3,
                cursor: 'pointer',
              }}
            >
              💬 Message
            </button>
          )}
        </div>

        {/* Job info */}
        <div
          style={{
            borderRadius: 16,
            padding: '16px',
            marginBottom: 16,
            background: NAVY_CARD,
            border: `1px solid ${BORDER}`,
          }}
        >
          {[
            ['Delivery Fee', `₦${job.deliveryFee.toLocaleString()}`],
            ['Est. Duration', `${Math.round(job.estimatedDurationSeconds / 60)} min`],
            ['Est. Distance', `${(job.estimatedDistanceMeters / 1000).toFixed(1)} km`],
            [
              'Cash to Collect',
              job.cashCollectedAmount ? `₦${job.cashCollectedAmount.toLocaleString()}` : 'N/A',
            ],
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
              <span style={{ fontFamily: IT, fontSize: 13, color: WHITE, fontWeight: 500 }}>
                {v}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)',
              marginBottom: 16,
            }}
          >
            <p style={{ fontFamily: IT, fontSize: 12, color: C_ERR }}>{error}</p>
          </div>
        )}

        {/* Action button per status */}
        {job.status === 'ASSIGNED' && (
          <RGreenBtn
            label={acting ? '' : '✓ Accept Job'}
            loading={acting}
            onClick={() => act(() => api.rider.acceptJob(job.id))}
          />
        )}
        {job.status === 'ACCEPTED' && (
          <RGreenBtn
            label={acting ? '' : 'Picked Up from Merchant →'}
            loading={acting}
            onClick={() => act(() => api.rider.pickup(job.id))}
          />
        )}
        {job.status === 'PICKED_UP' && (
          <RGreenBtn
            label={acting ? '' : 'Arrived at Customer →'}
            loading={acting}
            onClick={() => act(() => api.rider.arrived(job.id))}
          />
        )}
        {job.status === 'ARRIVED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>Proof of delivery</p>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 54,
                borderRadius: 16,
                border: `1.5px dashed ${proofUrl ? G2 : BORDER}`,
                background: NAVY_SURFACE,
                color: proofUrl ? G3 : MUTED,
                fontFamily: IT,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {proofUploading
                ? 'Uploading photo…'
                : proofUrl
                  ? '✓ Photo attached — retake'
                  : '📷 Take delivery photo'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => void handleProofPhoto(e.target.files?.[0])}
              />
            </label>
            <RGreenBtn
              label={acting ? '' : 'Mark as Delivered →'}
              loading={acting}
              disabled={!proofUrl || proofUploading}
              onClick={() =>
                proofUrl &&
                act(() => api.rider.deliver(job.id, { proofType: 'PHOTO', photoUrl: proofUrl }))
              }
            />
          </div>
        )}
        {job.status === 'ON_THE_WAY' && (
          <RGreenBtn
            label={acting ? '' : 'Arrived at Customer →'}
            loading={acting}
            onClick={() => act(() => api.rider.arrived(job.id))}
          />
        )}

        {/* Cash confirm after delivered */}
        {awaitingCashConfirm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p
              style={{
                fontFamily: PP,
                fontSize: 16,
                fontWeight: 700,
                color: G3,
                textAlign: 'center',
              }}
            >
              Order Delivered ✅
            </p>
            <p style={{ fontFamily: IT, fontSize: 13, color: MUTED, textAlign: 'center' }}>
              Confirm cash collected from customer
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: PP, fontSize: 18, color: WHITE }}>₦</span>
              <input
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                type="number"
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 14,
                  border: `1px solid ${BORDER}`,
                  background: NAVY_SURFACE,
                  color: WHITE,
                  fontFamily: IT,
                  fontSize: 16,
                  padding: '0 16px',
                  outline: 'none',
                }}
              />
            </div>
            <RGreenBtn
              label={acting ? '' : 'Confirm Cash Collected'}
              loading={acting}
              onClick={() => act(() => api.rider.confirmCash(job.id, Number(cashAmount)))}
            />
          </div>
        )}

        {/* Excluding DELIVERED here left a rider who finished a non-cash job with
            no "Done" button and no confirmation — stranded on the job screen —
            and made the "✅ Delivered" branch below unreachable. Only the cash
            panel above should replace this one. */}
        {isTerminal && !awaitingCashConfirm && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p
              style={{
                fontFamily: PP,
                fontSize: 16,
                color: job.status === 'DELIVERED' ? G3 : MUTED,
              }}
            >
              {job.status === 'DELIVERED'
                ? '✅ Delivered'
                : job.status === 'CANCELLED'
                  ? 'Cancelled'
                  : 'Failed'}
            </p>
            <button
              onClick={onDone}
              style={{
                marginTop: 16,
                padding: '10px 24px',
                borderRadius: 12,
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                color: G3,
                fontFamily: IT,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDER EARNINGS
// ─────────────────────────────────────────────────────────────────────────────
/** A titled block on the rider's earnings screen. Two of these replaced a
 *  screen that ended at the payout panel. */
function RiderSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ fontFamily: PP, fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function RiderEmptyLine({ text }: { text: string }): React.JSX.Element {
  return <p style={{ fontFamily: IT, fontSize: 12, color: MUTED, padding: '8px 0' }}>{text}</p>;
}

export function RiderEarningsScreen({ onBack }: { onBack: () => void }) {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [loading, setLoading] = useState(true);
  // The two things a balance on its own cannot answer: what made it, and what
  // work produced it. Riders had neither — a courier could read a number and
  // had no way to check it against anything.
  const [txs, setTxs] = useState<WalletLedgerEntryDto[]>([]);
  const [history, setHistory] = useState<RiderDeliveryJobDto[]>([]);
  // The rejection was unhandled and the screen fell through to a bare "Unable
  // to load wallet", which tells a rider nothing about whether to retry, sign
  // in again, or call support.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.rider
      .getWallet()
      .then(setWallet)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load your wallet');
      })
      .finally(() => setLoading(false));
    // Loaded independently of the balance: either can fail on its own, and a
    // rider who can see their money should not lose the ledger with it.
    api.rider
      .getWalletTransactions({ pageSize: 20 })
      .then((page) => setTxs(page.items))
      .catch(() => {});
    api.rider
      .getJobHistory({ pageSize: 20 })
      .then((page) => setHistory(page.items))
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <RBackBtn onClick={onBack} />
          <p style={{ fontFamily: PP, fontSize: 17, fontWeight: 700, color: WHITE }}>Earnings</p>
        </div>

        {loading ? (
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}
          >
            <p style={{ fontFamily: IT, color: MUTED }}>Loading...</p>
          </div>
        ) : wallet ? (
          <>
            <div
              style={{
                borderRadius: 20,
                padding: '24px 20px',
                marginBottom: 20,
                background: `linear-gradient(135deg,${G0}CC,${G2})`,
                boxShadow: `0 16px 56px rgba(43,172,82,.35)`,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: IT,
                  fontSize: 13,
                  color: 'rgba(255,255,255,.7)',
                  marginBottom: 6,
                }}
              >
                Available Balance
              </p>
              <p style={{ fontFamily: PP, fontSize: 36, fontWeight: 800, color: WHITE }}>
                ₦{wallet.availableBalance.toLocaleString()}
              </p>
              {wallet.pendingBalance > 0 && (
                <p
                  style={{
                    fontFamily: IT,
                    fontSize: 12,
                    color: 'rgba(255,255,255,.6)',
                    marginTop: 6,
                  }}
                >
                  + ₦{wallet.pendingBalance.toLocaleString()} pending
                </p>
              )}
            </div>

            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}
            >
              {[
                {
                  l: 'Daily Limit',
                  v: wallet.dailyLimit ? `₦${wallet.dailyLimit.toLocaleString()}` : 'No limit',
                },
                { l: 'Currency', v: wallet.currency },
              ].map(({ l, v }) => (
                <div
                  key={l}
                  style={{
                    borderRadius: 14,
                    padding: '16px',
                    background: NAVY_CARD,
                    border: `1px solid ${BORDER}`,
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontFamily: IT, fontSize: 11, color: MUTED, marginBottom: 6 }}>{l}</p>
                  <p style={{ fontFamily: PP, fontSize: 16, fontWeight: 700, color: WHITE }}>{v}</p>
                </div>
              ))}
            </div>

            {/* Earnings were visible but unreachable — the rider portal had no
                bank account, no payout request, no way to be paid at all. */}
            <PayoutPanel
              client={api.rider}
              availableBalance={Number(wallet.availableBalance)}
              onChanged={() => {
                api.rider
                  .getWallet()
                  .then(setWallet)
                  .catch(() => {});
              }}
            />

            <RiderSection title="RECENT TRANSACTIONS">
              {txs.length === 0 ? (
                <RiderEmptyLine text="Nothing has moved through your wallet yet." />
              ) : (
                txs.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontFamily: IT,
                          fontSize: 13,
                          color: WHITE,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tx.description ?? tx.referenceType ?? 'Wallet movement'}
                      </p>
                      <p style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                        {new Date(tx.createdAt).toLocaleString('en-NG')}
                      </p>
                    </div>
                    <p
                      style={{
                        fontFamily: PP,
                        fontSize: 14,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        color: tx.direction === 'CREDIT' ? G3 : '#F59E0B',
                      }}
                    >
                      {tx.direction === 'CREDIT' ? '+' : '−'}₦{Number(tx.amount).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </RiderSection>

            <RiderSection title="DELIVERY HISTORY">
              {history.length === 0 ? (
                <RiderEmptyLine text="No completed deliveries yet." />
              ) : (
                history.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: IT, fontSize: 13, color: WHITE }}>
                        #{job.id.slice(0, 8)}
                        {job.customerName !== null ? ` · ${job.customerName}` : ''}
                      </p>
                      <p style={{ fontFamily: IT, fontSize: 11, color: MUTED }}>
                        {job.deliveredAt !== null
                          ? new Date(job.deliveredAt).toLocaleString('en-NG')
                          : job.status}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {/* riderEarning is null until settlement runs. Showing
                          ₦0 there would read as "you earned nothing for this",
                          which is a different and untrue statement. */}
                      <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: G3 }}>
                        {job.riderEarning != null
                          ? `₦${Number(job.riderEarning).toLocaleString()}`
                          : '—'}
                      </p>
                      <p style={{ fontFamily: IT, fontSize: 10, color: MUTED }}>
                        {job.status === 'DELIVERED' ? 'Delivered' : job.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </RiderSection>
          </>
        ) : (
          <p style={{ fontFamily: IT, color: MUTED, textAlign: 'center' }}>
            {error ?? 'Unable to load wallet'}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The rider's own account — identity, application state, and sign-out.
 *
 * The portal had none of this: a rider could see Earnings and nothing else,
 * could not sign out (the session is shared across portals, so they were stuck
 * as whoever logged in last), and had no way to find out why they were sitting
 * idle. Everything here reads endpoints that already exist — GET /rider/profile
 * and GET /rider/availability — so nothing about approval or KYC is invented.
 */
export function RiderAccountScreen({
  onBack,
  onSignedOut,
}: {
  onBack: () => void;
  onSignedOut: () => void;
}) {
  const [profile, setProfile] = useState<RiderProfileDto | null>(null);
  const [availability, setAvailability] = useState<RiderAvailabilityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountPage, setAccountPage] = useState<AccountPage | null>(null);

  useEffect(() => {
    void Promise.all([
      api.rider.getProfile().catch((e: { message?: string }) => {
        setError(e.message ?? 'Could not load your profile.');
        return null;
      }),
      api.rider.getAvailability().catch(() => null),
    ])
      .then(([p, a]) => {
        if (p) setProfile(p);
        setAvailability(a);
      })
      .finally(() => setLoading(false));
  }, []);

  const signOut = () => {
    // Best-effort server-side revoke; the local session is cleared either way,
    // so a network failure can never leave the rider signed in. endSession
    // also caps the wait, so a request that never settles cannot leave the
    // rider staring at a button that appears to do nothing.
    void endSession(signOutRequest).finally(() => onSignedOut());
  };

  const user = auth.getUser();
  const fullName =
    [profile?.firstName ?? user?.firstName, profile?.lastName ?? user?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Rider';

  const docStatus = (documentType: string): 'VERIFIED' | 'PENDING' | 'REJECTED' | 'MISSING' =>
    profile?.kyc.find((d) => d.documentType === documentType)?.verificationStatus ?? 'MISSING';

  // Mirrors the backend's dispatch gate exactly (listAvailableRiders): approved
  // profile + a VERIFIED document of every required type + online, accepting,
  // and sharing a position. Any one of these missing means no job is ever
  // offered — which used to be completely invisible from inside the app.
  const checks: { label: string; ok: boolean; detail: string }[] = [
    {
      label: 'Approved by DrippleX',
      ok: profile?.status === 'APPROVED' && profile.isApproved,
      detail:
        profile?.status === 'REJECTED'
          ? (profile.rejectedReason ?? 'Your application was rejected.')
          : profile?.status === 'SUSPENDED'
            ? 'Your account is suspended.'
            : 'Operations still has your application under review.',
    },
    {
      label: 'National ID verified',
      ok: docStatus('NATIONAL_ID') === 'VERIFIED',
      detail:
        docStatus('NATIONAL_ID') === 'MISSING'
          ? 'Not submitted yet.'
          : docStatus('NATIONAL_ID') === 'REJECTED'
            ? 'Rejected — submit a new one.'
            : 'Submitted, awaiting review.',
    },
    {
      label: 'Guarantor ID verified',
      ok: docStatus('GUARANTOR_ID') === 'VERIFIED',
      detail:
        docStatus('GUARANTOR_ID') === 'MISSING'
          ? 'Not submitted yet.'
          : docStatus('GUARANTOR_ID') === 'REJECTED'
            ? 'Rejected — submit a new one.'
            : 'Submitted, awaiting review.',
    },
    {
      label: 'Online and accepting jobs',
      ok: (availability?.online ?? false) && (availability?.acceptingOrders ?? false),
      detail: 'Use the Go Online button on your dashboard.',
    },
    {
      label: 'Sharing your location',
      ok: availability?.latitude !== null && availability?.longitude !== null,
      detail: 'Dispatch picks the nearest rider, so it skips riders with no position.',
    },
  ];
  const blocked = checks.filter((c) => !c.ok);

  const row = (label: string, value: string) => (
    <div
      key={label}
      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}
    >
      <span style={{ fontFamily: IT, fontSize: 13, color: MUTED }}>{label}</span>
      <span
        style={{
          fontFamily: IT,
          fontSize: 13,
          color: WHITE,
          textAlign: 'right',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: NAVY_BASE,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <RStatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <RBackBtn onClick={onBack} />
          <p style={{ fontFamily: PP, fontSize: 17, fontWeight: 700, color: WHITE }}>Account</p>
        </div>

        {loading ? (
          <p style={{ fontFamily: IT, color: MUTED, textAlign: 'center' }}>Loading…</p>
        ) : (
          <>
            <div
              style={{
                borderRadius: 16,
                padding: '18px 20px',
                marginBottom: 16,
                background: NAVY_CARD,
                border: `1px solid ${BORDER}`,
              }}
            >
              <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: WHITE }}>
                🏍️ {fullName}
              </p>
              <p style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 2 }}>
                DrippleX Delivery Rider
              </p>
              {error && (
                <p style={{ fontFamily: IT, fontSize: 12, color: C_ERR, marginTop: 10 }}>{error}</p>
              )}
              {profile && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${BORDER}` }}>
                  {row('Email', profile.email)}
                  {row('Phone', profile.phone ?? 'Not provided')}
                  {profile.companyName ? row('Company', profile.companyName) : null}
                  {row('Application', profile.status)}
                  {row('Joined', new Date(profile.createdAt).toLocaleDateString())}
                </div>
              )}
            </div>

            {profile && (
              <div
                style={{
                  borderRadius: 16,
                  padding: '18px 20px',
                  marginBottom: 16,
                  background: NAVY_CARD,
                  border: `1px solid ${blocked.length > 0 ? 'rgba(245,158,11,.35)' : BORDER}`,
                }}
              >
                <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: WHITE }}>
                  {blocked.length === 0 ? 'You can receive jobs' : 'Why you are not getting jobs'}
                </p>
                <p style={{ fontFamily: IT, fontSize: 12, color: MUTED, marginTop: 4 }}>
                  {blocked.length === 0
                    ? 'Everything DrippleX checks before offering a delivery is in place.'
                    : 'Every item must be met before dispatch will offer you a delivery.'}
                </p>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {checks.map((c) => (
                    <div key={c.label} style={{ display: 'flex', gap: 10 }}>
                      <span style={{ fontSize: 13, color: c.ok ? G3 : C_WARN }}>
                        {c.ok ? '✓' : '•'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontFamily: IT,
                            fontSize: 13,
                            color: c.ok ? WHITE : 'rgba(255,255,255,.75)',
                          }}
                        >
                          {c.label}
                        </p>
                        {!c.ok && (
                          <p style={{ fontFamily: IT, fontSize: 11.5, color: MUTED, marginTop: 2 }}>
                            {c.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* A rider needs the same four things a driver does — a payout
                PIN, the two legal documents, and a way to reach support. The
                rider screen had none of them; the driver's were dead buttons.
                Both now share one implementation. */}
            <p
              style={{
                fontFamily: IT,
                fontSize: 12,
                fontWeight: 600,
                color: MUTED,
                letterSpacing: '0.08em',
                margin: '4px 0 10px 4px',
              }}
            >
              ACCOUNT
            </p>
            <div style={{ marginBottom: 16 }}>
              <AccountRows onOpen={setAccountPage} />
            </div>

            <SoundSettings />

            <button
              onClick={signOut}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 14,
                background: 'rgba(239,68,68,.06)',
                border: '1px solid rgba(239,68,68,.18)',
                fontFamily: IT,
                fontSize: 14,
                fontWeight: 600,
                color: C_ERR,
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </>
        )}
      </div>

      <AccountPageHost page={accountPage} audience="rider" onClose={() => setAccountPage(null)} />
    </div>
  );
}
