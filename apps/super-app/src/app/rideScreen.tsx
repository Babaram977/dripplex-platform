import { PLATFORM_BASE_CENTRE } from '@dripplex/types';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  G0,
  G2,
  G3,
  NAVY_DEEP,
  NAVY_CARD,
  NAVY_SURFACE,
  BORDER,
  MUTED,
  timeGreeting,
} from './shared';
import {
  COLOR_SUCCESS,
  COLOR_WARNING,
  COLOR_ERROR,
  COLOR_INFO,
  TEXT_SECONDARY,
} from '../tokens/colors';
import { api } from '../lib/api';
import { gatewayCallbackUrl, rememberGatewayReturn } from '../lib/gatewayReturn';

/** What the passenger can pick on the ride payment screen. The two gateway
 *  values are RidePaymentMethod members the backend already accepts. */
type RidePaymentChoice = 'WALLET' | 'CASH' | 'PAYSTACK' | 'FLUTTERWAVE';
import { playNotificationSound } from '../lib/sound';
import { auth } from '../lib/auth';
import { ws } from '../lib/ws';
import {
  addressPredictions,
  geocodeAddress,
  getCurrentPosition,
  reverseGeocode,
} from '../lib/maps';
import { referralShareUrl } from '../lib/referralLink';

import type { AddressPrediction } from '../lib/maps';
import type {
  CardProviderOptionDto,
  CustomerRideDto,
  EstimateRideFareResponse,
  ReferralStatsDto,
  RideDto,
  RideReceiptDto,
  RideStatus,
  SharedRideDto,
  RideType,
  RideTypeCatalogEntryDto,
} from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const NAVY_BASE = '#0A1628';
const PP = "'Poppins',sans-serif";
const IT = "'Inter',sans-serif";

/**
 * Fallback map centre only — NEVER a booked pickup.
 *
 * This used to be the pickup for every ride in the product: a hardcoded "Ikeja
 * GRA, Lagos" that was sent to POST /customer/rides no matter where the
 * passenger actually stood, while the pickup row on Set Destination was a dead
 * label they could not change. A passenger in Kano booked a ride from Lagos.
 * The real pickup now comes from the device (see useDevicePickup) or from the
 * passenger picking one, and booking is refused without it.
 */
export const RIDE_MAP_FALLBACK_CENTRE = PLATFORM_BASE_CENTRE;

/** Where the passenger is being collected from. */
export interface RidePickup {
  latitude: number;
  longitude: number;
  address: string;
}

/**
 * Stands in for the address when the geocoder gives us nothing back — no Maps
 * key, offline, or a coordinate it has no street for. Exported so the views
 * that render a pickup can recognise it instead of captioning it: the ride
 * sheet prints "Your current location: {address}", which read
 * "Your current location: Your current location" whenever this was the value.
 */
export const UNNAMED_PICKUP = 'Your current location';

/**
 * Resolves the passenger's real pickup: device position, reverse-geocoded to a
 * readable address. Returns null while unresolved and on refusal — callers must
 * treat "no pickup" as "cannot book", not as "use a default".
 */
export function useDevicePickup(): {
  pickup: RidePickup | null;
  setPickup: (p: RidePickup) => void;
  resolving: boolean;
  error: string | null;
  locate: () => void;
} {
  const [pickup, setPickup] = useState<RidePickup | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    setResolving(true);
    setError(null);
    void getCurrentPosition()
      .then(async (pos) => {
        if (!pos) {
          setError('Allow location access, or set your pickup point by hand.');
          return;
        }
        const resolved = await reverseGeocode(pos);
        // `ResolvedAddress` has no `formattedAddress` field — reading one meant
        // this always fell through to "Your current location" even when the
        // geocoder had returned a perfectly good street and city. Build the
        // label from the fields that actually exist.
        // Lagos city inside Lagos state is a real address, and "Ikeja, Lagos,
        // Lagos" is not how anyone writes it — drop repeats.
        const label = resolved
          ? [...new Set([resolved.addressLine1, resolved.city, resolved.state])]
              .filter((part) => part.length > 0)
              .join(', ')
          : '';
        setPickup({
          latitude: pos.latitude,
          longitude: pos.longitude,
          // A coordinate with no street name is still a true pickup; showing it
          // beats naming somewhere the passenger is not.
          address: label.length > 0 ? label : UNNAMED_PICKUP,
        });
      })
      .catch(() => setError('Could not read your location. Set your pickup point by hand.'))
      .finally(() => setResolving(false));
  }, []);

  useEffect(() => locate(), [locate]);

  return { pickup, setPickup, resolving, error, locate };
}

export interface RideDestination {
  latitude: number;
  longitude: number;
  address: string;
  label: string;
}

// Display maps derived from the real `RideType` enum (decorative labels/icons
// only — not fabricated data). The ride-type CATALOG (name/description/price)
// comes from `api.rides.getRideTypes()` + `api.rides.estimate()`.
const RIDE_TYPE_LABEL: Record<RideType, string> = {
  ECONOMY: 'Economy',
  COMFORT: 'Comfort',
  XL: 'XL',
  TRICYCLE: 'Tricycle',
};
// Founder decision 2026-08-20: the ride tiers keep their colourful emoji.
// The rest of the app moved to drawn icons, but on the fare chips the emoji
// carry the tier apart at a glance better than four monochrome silhouettes at
// 15px do — and the backend catalogue already ships one per tier.
const RIDE_TYPE_EMOJI: Record<RideType, string> = {
  ECONOMY: '🚗',
  COMFORT: '🚙',
  XL: '🚐',
  TRICYCLE: '🛺',
};

// Shared money formatter — backend money is numeric; format for display.
const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;

// Human-readable date for history/receipt rows from an ISO timestamp.
const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Live ride loader — polls `api.rides.get(id)` (same 3s cadence the
// FindingDriver poll uses) and rides the ws status fast-path. Returns the
// authoritative `RideDto` for the active-ride screens.
function useLiveRide(rideId?: string) {
  const [ride, setRide] = useState<CustomerRideDto | null>(null);
  useEffect(() => {
    if (!rideId) return;
    let alive = true;
    const load = () =>
      api.rides
        .get(rideId)
        .then((r) => {
          if (alive) setRide(r);
        })
        .catch(() => {});
    ws.joinRide(rideId);
    const offStatus = ws.onRideStatus(load);
    const poll = setInterval(load, 3000);
    load();
    return () => {
      alive = false;
      clearInterval(poll);
      offStatus();
    };
  }, [rideId]);
  return ride;
}

/**
 * Moves the passenger through the trip when the *trip* moves.
 *
 * These screens used to advance on buttons the passenger pressed — including
 * one labelled "Simulate: Driver Arrived". So a driver could mark themselves
 * arrived, enter the trip code and pull away while the passenger's phone still
 * said "Driver on the way". The ride's status on the server is the only thing
 * that knows what is happening, so it is what drives the screens now.
 */
function useRideStatusAdvance(
  status: RideStatus | undefined,
  handlers: Partial<Record<RideStatus, (() => void) | undefined>>,
): void {
  const handler = status === undefined ? undefined : handlers[status];
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    ref.current?.();
  }, [status]);
}

/** The car the passenger is looking for. Real plate, real colour, from the
 * driver's approved vehicle — or an honest "—" when the driver has no
 * approved vehicle on file, never an invented plate. */
function VehicleFacts({ ride }: { ride: CustomerRideDto | null }) {
  const vehicle = ride?.driverVehicle ?? null;
  const typeLabel = ride ? RIDE_TYPE_LABEL[ride.rideType] : null;
  return (
    <div className="grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: BORDER }}>
      {[
        ['🚗 Vehicle', vehicle ? `${vehicle.color} ${vehicle.make} ${vehicle.model}` : '—'],
        ['🔢 Plate', vehicle?.plateNumber ?? '—'],
        ['🏷 Class', typeLabel ?? '—'],
      ].map(([l, v]) => (
        <div key={l}>
          <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            {l}
          </p>
          <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
            {v}
          </p>
        </div>
      ))}
    </div>
  );
}

/** The passenger's own trip code. Read it to the driver; the driver types it
 * into their app and the backend checks it. Nobody sees it but the passenger,
 * which is what makes it worth anything. */
function TripCodeCard({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <div
      className="mb-4 flex items-center gap-4 rounded-2xl p-4"
      style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.25)' }}
    >
      <div className="flex-1">
        <p className="text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
          Your trip code
        </p>
        <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          Read this to your driver before you set off
        </p>
      </div>
      <p
        className="text-[28px] font-bold tracking-[.3em]"
        style={{ fontFamily: PP, color: G3 }}
        aria-label={`Trip code ${code.split('').join(' ')}`}
      >
        {code}
      </p>
    </div>
  );
}

/** "Share trip with family" — one control, the same on every screen of the
 * trip, because the founder asked for it to be there the whole way through. */
function ShareTripRow({ onShare }: { onShare?: () => void }) {
  if (!onShare) return null;
  return (
    <button
      onClick={onShare}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl p-3.5 transition-all active:scale-[.97]"
      style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={G2}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
      <div className="flex-1 text-left">
        <p className="text-[14px] font-medium" style={{ fontFamily: PP, color: '#fff' }}>
          Share trip with family
        </p>
        <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
          Let someone follow your ride live
        </p>
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={MUTED}
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function RideStatusBar() {
  return (
    <div
      className="dx-status-mock relative z-10 flex w-full items-center justify-between px-5 pt-[52px]"
      style={{ fontFamily: IT, fontSize: 11, color: 'rgba(255,255,255,.55)' }}
    >
      <span>9:41</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
          <rect x="0" y="6" width="3" height="6" rx=".6" opacity=".4" />
          <rect x="4.5" y="3.5" width="3" height="8.5" rx=".6" opacity=".6" />
          <rect x="9" y="1" width="3" height="11" rx=".6" opacity=".85" />
          <rect x="13.5" y="0" width="3" height="12" rx=".6" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="currentColor">
          <rect
            x=".5"
            y=".5"
            width="22"
            height="11"
            rx="3.5"
            stroke="currentColor"
            strokeOpacity=".35"
            fill="none"
          />
          <rect x="2" y="2" width="17" height="8" rx="2" opacity=".65" />
          <path d="M24 4v4a2 2 0 000-4z" opacity=".4" />
        </svg>
      </div>
    </div>
  );
}

function BackArrow({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all active:scale-95"
      style={{ background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}` }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

function GreenButton({
  label,
  onClick,
  disabled,
  loading,
  small,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full ${small ? 'h-12 rounded-xl text-sm' : 'h-14 rounded-2xl text-[15px]'} flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[.97]`}
      style={{
        fontFamily: PP,
        background:
          disabled || loading
            ? 'rgba(255,255,255,.06)'
            : `linear-gradient(135deg,${G0} 0%,${G2} 52%,${G3} 100%)`,
        color: disabled || loading ? 'rgba(255,255,255,.22)' : '#fff',
        boxShadow:
          disabled || loading
            ? 'none'
            : `0 10px 36px rgba(43,172,82,.36),0 0 0 1px rgba(43,172,82,.24)`,
      }}
    >
      {loading ? (
        <svg
          width="18"
          height="18"
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

function MapCanvas({ variant = 'default', progress = 0 }: { variant?: string; progress?: number }) {
  const routes: Record<string, { cx: number; cy: number; dx: number; dy: number; color: string }> =
    {
      default: { cx: 100, cy: 240, dx: 290, dy: 100, color: G2 },
      finding: { cx: 100, cy: 220, dx: 290, dy: 120, color: '#3B82F6' },
      assigned: { cx: 80, cy: 250, dx: 300, dy: 90, color: G2 },
      arrived: { cx: 195, cy: 180, dx: 195, dy: 180, color: G2 },
      inprogress: { cx: 60, cy: 260, dx: 320, dy: 80, color: G2 },
      complete: { cx: 60, cy: 260, dx: 320, dy: 80, color: '#10B981' },
    };
  const r = routes[variant] || routes.default;
  const midX = (r.cx + r.dx) / 2;
  const midY = (r.cy + r.dy) / 2 - 60;
  const pathD = `M${r.cx},${r.cy} Q${midX},${midY} ${r.dx},${r.dy}`;
  const totalLen = 280;
  const filled = Math.round(totalLen * progress);

  // The canvas was pinned to 390×320 — the Figma frame width — so on any
  // handset wider than 390pt the map stopped short of the right edge and left
  // a black strip beside it, and in the 200px container it overflowed. The
  // viewBox keeps the drawing's coordinate system; `slice` scales it to cover
  // whatever box it is given and crops the excess, the way a real map behaves.
  // Every caller sets its own container height, which is now what decides how
  // tall the map is.
  return (
    <svg
      viewBox="0 0 390 320"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      {/* map bg */}
      <rect width="390" height="320" fill="#0D1B2E" />
      {/* grid lines */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={`h${i}`}
          x1="0"
          y1={i * 46}
          x2="390"
          y2={i * 46}
          stroke="rgba(255,255,255,.04)"
          strokeWidth="1"
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <line
          key={`v${i}`}
          x1={i * 44}
          y1="0"
          x2={i * 44}
          y2="320"
          stroke="rgba(255,255,255,.04)"
          strokeWidth="1"
        />
      ))}
      {/* roads */}
      <line x1="0" y1="180" x2="390" y2="180" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="195" y1="0" x2="195" y2="320" stroke="rgba(255,255,255,.07)" strokeWidth="2.5" />
      <line x1="0" y1="90" x2="390" y2="140" stroke="rgba(255,255,255,.04)" strokeWidth="1.5" />
      <line x1="50" y1="0" x2="340" y2="320" stroke="rgba(255,255,255,.04)" strokeWidth="1.5" />
      {/* route shadow */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(43,172,82,.12)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* route base */}
      <path
        d={pathD}
        fill="none"
        stroke="rgba(43,172,82,.25)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="8 4"
      />
      {/* route progress */}
      {progress > 0 && (
        <path
          d={pathD}
          fill="none"
          stroke={r.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${totalLen}`}
        />
      )}
      {/* buildings */}
      {[
        [30, 100, 24, 40],
        [60, 90, 18, 50],
        [130, 110, 28, 36],
        [280, 100, 22, 40],
        [310, 88, 30, 52],
        [340, 106, 20, 34],
      ].map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx="2"
          fill="rgba(255,255,255,.04)"
          stroke="rgba(255,255,255,.06)"
          strokeWidth="1"
        />
      ))}
      {/* green zone */}
      <ellipse cx="195" cy="200" rx="60" ry="30" fill="rgba(43,172,82,.06)" />
      {/* origin pin */}
      <circle cx={r.cx} cy={r.cy} r="10" fill={G2} opacity=".2" />
      <circle cx={r.cx} cy={r.cy} r="5" fill={G2} />
      <circle cx={r.cx} cy={r.cy} r="3" fill="#fff" />
      {/* dest pin */}
      {variant !== 'arrived' && (
        <g>
          <circle cx={r.dx} cy={r.dy} r="14" fill="rgba(43,172,82,.15)" />
          <circle cx={r.dx} cy={r.dy} r="8" fill={G2} />
          <circle cx={r.dx} cy={r.dy} r="4" fill="#fff" />
          <rect x={r.dx - 1.5} y={r.dy - 28} width="3" height="20" rx="1.5" fill={G2} />
        </g>
      )}
      {/* car icon for active states */}
      {['assigned', 'arrived', 'inprogress'].includes(variant) && (
        <g transform={`translate(${r.cx + 20},${r.cy - 20})`}>
          <circle r="18" fill="#0D1B2E" stroke={G2} strokeWidth="2" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="16">
            🚗
          </text>
        </g>
      )}
      {/* ETA bubble */}
      {['assigned', 'inprogress'].includes(variant) && (
        <g>
          <rect x="140" y="22" width="110" height="34" rx="10" fill={G2} />
          <text
            x="195"
            y="44"
            textAnchor="middle"
            fill="#fff"
            fontSize="12"
            fontFamily="Poppins"
            fontWeight="600"
          >
            {variant === 'inprogress' ? '8 min left' : '3 min away'}
          </text>
        </g>
      )}
      {/* gradient overlay bottom */}
      <defs>
        <linearGradient id="mapFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NAVY_BASE} stopOpacity="0" />
          <stop offset="100%" stopColor={NAVY_BASE} stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect width="390" height="320" fill="url(#mapFade)" />
    </svg>
  );
}

function BottomSheet({
  children,
  title,
  peek,
}: {
  children: React.ReactNode;
  title?: string;
  peek?: boolean;
}) {
  return (
    <div
      // min-h-0 so the sheet is bounded by the screen rather than by its own
      // content. Without it the sheet grows past the frame and anything pinned
      // to its bottom — the Book button — is clipped away.
      className="relative z-10 flex min-h-0 flex-1 flex-col"
      style={{
        background: NAVY_BASE,
        borderRadius: peek ? '28px 28px 0 0' : 0,
        boxShadow: peek ? '0 -24px 80px rgba(0,0,0,.7)' : 'none',
      }}
    >
      {peek && (
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,.15)' }} />
        </div>
      )}
      {title && (
        <p
          className="px-5 pb-2 pt-4 text-[17px] font-bold"
          style={{ fontFamily: PP, color: '#fff' }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function SafetyChip() {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.2)' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={G2} strokeWidth="2.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span style={{ fontFamily: IT, fontSize: 11, color: G3, fontWeight: 600 }}>
        DrippleX Safe
      </span>
    </div>
  );
}

function StarRow({
  value,
  onChange,
  rating,
  size,
}: {
  value?: number;
  onChange?: (v: number) => void;
  rating?: number;
  size?: number;
}) {
  // Display mode: a `rating` is shown read-only, without interactive click
  // handling. Guarding here prevents a runtime crash when StarRow is used
  // purely to render a rating (no `onChange` supplied).
  if (!onChange) {
    const filled = Math.round(rating ?? value ?? 0);
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            style={{
              fontSize: size ?? 14,
              filter: n <= filled ? 'none' : 'grayscale(1) opacity(.3)',
            }}
          >
            ⭐
          </span>
        ))}
      </div>
    );
  }

  // Interactive mode: clickable stars that report the selected value.
  const current = value ?? 0;
  return (
    <div className="flex justify-center gap-3">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className="transition-transform active:scale-90"
          style={{ fontSize: 36, filter: n <= current ? 'none' : 'grayscale(1) opacity(.3)' }}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-001 — RIDE HOME
// ─────────────────────────────────────────────────────────────────────────────
export function RideHomeScreen({
  onBack,
  onSearch,
  onHistory,
  pickup,
}: {
  onBack: () => void;
  onSearch: () => void;
  onHistory: () => void;
  /** The passenger's real resolved pickup, so this screen stops announcing a
   *  city they may be a thousand kilometres from. */
  pickup?: RidePickup | null;
}) {
  const [inputFocused, setInputFocused] = useState(false);
  // The signed-in passenger — the greeting used to name "Chidi" to everyone.
  const firstName = auth.getUser()?.firstName ?? '';

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      {/* Map */}
      <div className="relative flex-shrink-0" style={{ height: 340 }}>
        <MapCanvas variant="default" />
        {/* Status bar overlay */}
        <div className="absolute inset-0 left-0 right-0 top-0">
          <RideStatusBar />
        </div>
        {/* Top bar */}
        <div
          className="absolute left-0 right-0 top-14 flex items-center justify-between px-5"
          style={{ marginTop: 16 }}
        >
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-2xl active:scale-95"
            style={{
              background: 'rgba(6,14,28,.85)',
              border: `1px solid ${BORDER}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,.7)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <SafetyChip />
            <button
              onClick={onHistory}
              className="flex h-10 w-10 items-center justify-center rounded-2xl active:scale-95"
              style={{
                background: 'rgba(6,14,28,.85)',
                border: `1px solid ${BORDER}`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,.7)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </button>
          </div>
        </div>
        {/* Location btn */}
        <button
          className="absolute bottom-16 right-5 flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(6,14,28,.85)',
            border: `1px solid ${BORDER}`,
            backdropFilter: 'blur(12px)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G2}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>

      {/* Bottom sheet */}
      <BottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
          {/* Greeting */}
          <div className="mb-4">
            {/* Was "Where to, Chidi?" above "Ikeja GRA, Lagos" for every
                passenger on the platform — a name nobody has and a city most
                of them are not in. */}
            <p className="mb-0.5 text-[18px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              {firstName ? `Where to, ${firstName}?` : 'Where to?'}
            </p>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              {!pickup
                ? 'Finding your location…'
                : pickup.address === UNNAMED_PICKUP
                  ? pickup.address
                  : `Your current location: ${pickup.address}`}
            </p>
          </div>

          {/* Destination input */}
          <button onClick={onSearch} className="mb-4 w-full text-left">
            <div
              className="flex h-14 items-center gap-3 rounded-2xl px-4"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${inputFocused ? `rgba(43,172,82,.4)` : BORDER}`,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G2}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span style={{ fontFamily: IT, fontSize: 15, color: MUTED }}>
                Where are you going?
              </span>
            </div>
          </button>

          {/* Saved places removed: DrippleX has no saved-places API, so
              "Home · Ikeja, Lagos" and "Work · Victoria Island" were invented
              addresses shown to every passenger, and tapping either just
              opened the search box anyway. The search above is the real way
              to set a destination. */}
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-002 — DESTINATION SEARCH
// ─────────────────────────────────────────────────────────────────────────────
export function DestinationSearchScreen({
  onBack,
  onSelect,
  pickup,
  onPickupChange,
  pickupResolving,
  pickupError,
  onLocateMe,
}: {
  onBack: () => void;
  onSelect: (dest: RideDestination) => void;
  // The pickup row was a dead label reading "Ikeja GRA, Lagos" for every
  // passenger. It now shows where they actually are and can be changed.
  pickup?: RidePickup | null;
  onPickupChange?: (p: RidePickup) => void;
  pickupResolving?: boolean;
  pickupError?: string | null;
  onLocateMe?: () => void;
}) {
  // Which field the search box is filling. Tapping the pickup row switches the
  // same Places search over to it instead of leaving it inert.
  const [editing, setEditing] = useState<'destination' | 'pickup'>('destination');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  // Real destination search via Google Places. Previously this searched a
  // hardcoded list of demo places ("Home · 12 Adewale Close, Ikeja") that carried
  // real coordinates, so picking one would route a ride to a stranger's address.
  const [placeResults, setPlaceResults] = useState<AddressPrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickErr, setPickErr] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setPlaceResults([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void addressPredictions(q)
        .then((r) => {
          if (alive) setPlaceResults(r);
        })
        .finally(() => {
          if (alive) setSearching(false);
        });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const pick = (p: { label: string; sub: string; lat?: number; lng?: number }) => {
    if (p.lat === undefined || p.lng === undefined) return;
    onSelect({
      latitude: p.lat,
      longitude: p.lng,
      address: `${p.label} · ${p.sub}`,
      label: p.label,
    });
  };

  // Resolve a Places suggestion to real coordinates before selecting it — a ride
  // must never be booked to a guessed location.
  const pickPrediction = async (pred: AddressPrediction) => {
    setPickErr(null);
    const resolved = await geocodeAddress({ placeId: pred.placeId });
    if (!resolved) {
      setPickErr("We couldn't locate that place. Try another search.");
      return;
    }
    const [head, ...rest] = pred.description.split(',');
    if (editing === 'pickup') {
      onPickupChange?.({
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        address: pred.description,
      });
      setEditing('destination');
      setQuery('');
      setPlaceResults([]);
      return;
    }
    onSelect({
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      address: pred.description,
      label: head?.trim() || pred.description,
    });
    void rest;
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // No fabricated "saved places" — DrippleX has no saved-places API yet, so an
  // empty search shows an empty state rather than someone else's addresses.
  const filtered: { icon: string; label: string; sub: string; lat?: number; lng?: number }[] = [];

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <RideStatusBar />

      <div className="px-5 pb-4 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <BackArrow onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Set Destination
          </p>
        </div>

        {/* Pickup row — tappable, and showing the passenger's real position */}
        <button
          onClick={() => {
            setEditing('pickup');
            setQuery('');
            setPlaceResults([]);
            inputRef.current?.focus();
          }}
          className="mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left active:opacity-70"
          style={{
            background: NAVY_SURFACE,
            border: `1px solid ${editing === 'pickup' ? G2 : BORDER}`,
          }}
        >
          <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: G2 }} />
          <span className="flex-1 text-[14px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
            {pickupResolving
              ? 'Finding your location…'
              : (pickup?.address ?? 'Set your pickup point')}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ background: 'rgba(43,172,82,.12)', color: G3 }}
          >
            {editing === 'pickup' ? 'Editing' : 'Change'}
          </span>
        </button>

        {pickupError && !pickup && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11.5px]" style={{ fontFamily: IT, color: '#F59E0B' }}>
              {pickupError}
            </span>
            {onLocateMe && (
              <button
                onClick={onLocateMe}
                className="text-[11.5px] font-semibold underline active:opacity-60"
                style={{ fontFamily: IT, color: G3 }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Destination input */}
        <div
          className="flex h-14 items-center gap-3 rounded-2xl px-4"
          style={{
            background: NAVY_SURFACE,
            border: `1px solid ${focused ? 'rgba(43,172,82,.4)' : BORDER}`,
          }}
        >
          <div
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: '#EF4444' }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={editing === 'pickup' ? 'Search a pickup point…' : 'Enter destination...'}
            className="flex-1 bg-transparent outline-none"
            style={{ fontFamily: IT, fontSize: 15, color: '#fff' }}
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery('')}
              className="flex h-6 w-6 items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,.1)' }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {query.trim().length < 3 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ background: NAVY_SURFACE }}
            >
              📍
            </div>
            <p className="text-[15px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              Where are you going?
            </p>
            <p className="text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              Start typing an address or place name
            </p>
          </div>
        )}

        {placeResults.map((pred) => (
          <button
            key={pred.placeId}
            onClick={() => void pickPrediction(pred)}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-3.5 transition-all active:bg-white/[.03]"
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              📍
            </div>
            <div className="flex-1 text-left">
              <p className="text-[14px] font-medium" style={{ fontFamily: PP, color: '#fff' }}>
                {pred.description.split(',')[0]}
              </p>
              <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                {pred.description}
              </p>
            </div>
          </button>
        ))}

        {pickErr && (
          <p className="px-1 py-2 text-[12px]" style={{ fontFamily: IT, color: '#F87171' }}>
            {pickErr}
          </p>
        )}

        {query.trim().length >= 3 && !searching && placeResults.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ background: NAVY_SURFACE }}
            >
              🔍
            </div>
            <p className="text-[15px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              No results found
            </p>
            <p className="text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              Try a different search term
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-003 — PICKUP CONFIRMATION
// ─────────────────────────────────────────────────────────────────────────────
export function PickupConfirmScreen({
  onBack,
  onConfirm,
  pickup,
  dropoff,
}: {
  onBack: () => void;
  onConfirm: () => void;
  // This screen used to read "Ikeja GRA, Lagos → Victoria Island, Lagos" for
  // every passenger on earth, next to a fabricated "~14 km · ~22 min · Fast
  // Route". It is the step where someone confirms where they are going, so it
  // now shows where they are actually going.
  pickup?: RidePickup | null;
  dropoff?: RideDestination | null;
}) {
  const [note, setNote] = useState('');
  const [leg, setLeg] = useState<{ distanceMeters: number; durationSeconds: number } | null>(null);
  const [legError, setLegError] = useState<string | null>(null);

  // Real distance/duration from the fare estimator — the same numbers the fare
  // is built from. Nothing is guessed locally.
  useEffect(() => {
    if (!pickup || !dropoff) return;
    let alive = true;
    setLegError(null);
    void api.rides
      .estimate({
        rideType: 'ECONOMY',
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        dropoffLatitude: dropoff.latitude,
        dropoffLongitude: dropoff.longitude,
      })
      .then((e) => {
        if (!alive) return;
        // EstimateRideFareResponse calls these `distanceMeters`/`durationSeconds`
        // — the `estimated*` prefix belongs to RideDto, not to the estimator.
        setLeg({ distanceMeters: e.distanceMeters, durationSeconds: e.durationSeconds });
      })
      .catch((e: unknown) => {
        // Blank figures rather than an invented trip length — but say why,
        // instead of leaving the passenger staring at two dashes.
        if (alive) {
          setLegError(e instanceof Error ? e.message : 'Could not measure this trip right now.');
        }
      });
    return () => {
      alive = false;
    };
  }, [pickup?.latitude, pickup?.longitude, dropoff?.latitude, dropoff?.longitude]);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
        <MapCanvas variant="default" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 px-5">
            <BackArrow onClick={onBack} />
          </div>
        </div>
        {/* Pickup pin center */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 48 }}>
          <div className="flex flex-col items-center">
            <div
              className="mb-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold"
              style={{
                background: G2,
                color: '#fff',
                fontFamily: IT,
                boxShadow: `0 4px 16px rgba(43,172,82,.4)`,
              }}
            >
              Drag to adjust
            </div>
            <div
              className="h-4 w-4 flex-shrink-0 rounded-full border-2"
              style={{ background: G2, borderColor: '#fff' }}
            />
            <div className="h-5 w-px" style={{ background: G2 }} />
          </div>
        </div>
      </div>

      <BottomSheet peek title="Confirm Pickup Point">
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {/* Route summary */}
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex flex-shrink-0 flex-col items-center gap-1 pt-1">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: G2 }} />
                <div className="min-h-[24px] w-px flex-1" style={{ background: BORDER }} />
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} />
              </div>
              <div className="flex-1">
                <div className="mb-3">
                  <p
                    className="mb-0.5 text-[11px] font-medium"
                    style={{ fontFamily: IT, color: MUTED }}
                  >
                    PICKUP
                  </p>
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    {pickup?.address ?? 'Locating you…'}
                  </p>
                </div>
                <div>
                  <p
                    className="mb-0.5 text-[11px] font-medium"
                    style={{ fontFamily: IT, color: MUTED }}
                  >
                    DROP-OFF
                  </p>
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#fff' }}
                  >
                    {dropoff?.address ?? 'Choose a destination'}
                  </p>
                </div>
              </div>
            </div>
            {legError !== null && (
              <p
                className="mb-2 text-[11.5px] leading-relaxed"
                style={{ fontFamily: IT, color: '#F87171' }}
              >
                {legError}
              </p>
            )}
            <div className="flex gap-3 border-t pt-3" style={{ borderColor: BORDER }}>
              {/* "Traffic: Fast Route" is gone — DrippleX has no traffic feed,
                  so there was nothing behind it to be right or wrong. */}
              {[
                [leg ? `${(leg.distanceMeters / 1000).toFixed(1)} km` : '—', 'Distance'],
                [
                  leg ? `${Math.max(1, Math.round(leg.durationSeconds / 60))} min` : '—',
                  'Est. time',
                ],
              ].map(([v, l]) => (
                <div key={l} className="flex-1 text-center">
                  <p className="text-[13px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                    {v}
                  </p>
                  <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                    {l}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pickup note */}
          <div className="mb-5">
            <p
              className="mb-2 text-[13px] font-medium"
              style={{ fontFamily: PP, color: TEXT_SECONDARY }}
            >
              Pickup note (optional)
            </p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. I'm at the gate"
              className="h-12 w-full rounded-2xl px-4 outline-none"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                fontFamily: IT,
                fontSize: 14,
                color: '#fff',
              }}
            />
          </div>

          <GreenButton label="Confirm Pickup →" onClick={onConfirm} />
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-004 — FARE ESTIMATE
// ─────────────────────────────────────────────────────────────────────────────
export function FareEstimateScreen({
  onBack,
  onBook,
  dropoff,
  pickup,
  rideType: initialRideType = 'ECONOMY',
}: {
  onBack: () => void;
  onBook: (rideId: string) => void;
  dropoff?: RideDestination;
  // The passenger's REAL pickup. Absent means we do not know where they are,
  // and a ride must not be booked from a guess — this used to be a hardcoded
  // Lagos address sent for every passenger everywhere.
  pickup?: RidePickup | null;
  rideType?: RideType;
}) {
  // Dispatch matches DriverAvailability.vehicleType against the ride type the
  // passenger asked for, exactly. The driver app sends the real category of the
  // car they drive, but this screen hardcoded ECONOMY and offered no choice —
  // so a Comfort, XL or Keke driver could be approved, online, waiting and
  // metres away, and was unmatchable for every ride ever requested. That is the
  // "searching for 4 minutes and never matched" case.
  const [rideType, setRideType] = useState<RideType>(initialRideType);

  // Real ride-type catalog (label/description). Price is NOT taken from the
  // catalog per route — the per-route fare comes from `api.rides.estimate()`.
  const [catalog, setCatalog] = useState<RideTypeCatalogEntryDto[] | null>(null);
  // Live wallet balance for the Wallet payment option.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // The API's own type, not a hand-written subset. The subset listed seven
  // fields and omitted the surcharge and the minimum fare — so the price
  // breakdown could not show them even though both were on the wire, and the
  // itemised lines did not add up to the total.
  const [estimate, setEstimate] = useState<EstimateRideFareResponse | null>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.wallet
      .get()
      .then((w) => setWalletBalance(w.availableBalance))
      .catch(() => {});
  }, []);

  // The catalog is re-fetched with the pickup point so each type carries
  // whether a driver of that type is reachable from *here*. Without a pickup
  // we still load the catalog — the passenger needs the labels either way —
  // but every entry comes back with no availability claim.
  useEffect(() => {
    api.rides
      .getRideTypes(pickup ? { latitude: pickup.latitude, longitude: pickup.longitude } : undefined)
      .then(setCatalog)
      .catch(() => {});
  }, [pickup?.latitude, pickup?.longitude]);

  useEffect(() => {
    if (!dropoff || !pickup) return;
    api.rides
      .estimate({
        rideType,
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        dropoffLatitude: dropoff.latitude,
        dropoffLongitude: dropoff.longitude,
      })
      .then((e) => {
        setEstimate(e);
        setError(null);
      })
      // Swallowing this is what made the coordinate-precision bug invisible:
      // the fare, distance and time simply read "—" with no reason given, on
      // every ride, for anyone whose coordinates had too many decimals.
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? `We could not price this trip: ${e.message}`
            : 'We could not price this trip.',
        ),
      );
  }, [dropoff, pickup, rideType]);

  // `type` / `displayName` / `emoji` are the backend's field names. This read
  // `.rideType` / `.label`, which the API has never sent, so every lookup here
  // was undefined and the local maps below silently covered for it.
  const entry = catalog?.find((c) => c.type === rideType) ?? null;
  const typeName = entry?.displayName ?? RIDE_TYPE_LABEL[rideType];
  const typeDesc = entry?.description ?? '';
  const typeEmoji = entry?.emoji ?? RIDE_TYPE_EMOJI[rideType];
  // GAP: backend ride catalog exposes no per-type "seats" field — omitted.
  const durationMin = estimate ? Math.max(1, Math.round(estimate.durationSeconds / 60)) : null;
  // Honest fallback: no fabricated flat price before the estimate resolves.
  const fareLabel = estimate ? naira(estimate.totalFare) : '—';
  const kmLabel = estimate ? (estimate.distanceMeters / 1000).toFixed(0) : '—';

  const handleBook = async () => {
    if (booking || !dropoff) return;
    if (!pickup) {
      setError('We need your pickup point before booking. Go back and set it.');
      return;
    }
    setBooking(true);
    setError(null);
    try {
      const created = await api.rides.book({
        rideType,
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        pickupAddress: pickup.address,
        dropoffLatitude: dropoff.latitude,
        dropoffLongitude: dropoff.longitude,
        dropoffAddress: dropoff.address,
      });
      onBook(created.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not book ride');
      setBooking(false);
    }
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      {/* 260px of map left roughly a third of a phone for the fare, the
          payment choice, the breakdown and the button. The route is already
          drawn on the previous screen; here the sheet is the screen. */}
      <div className="relative flex-shrink-0" style={{ height: 200 }}>
        <MapCanvas variant="default" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 px-5">
            <BackArrow onClick={onBack} />
          </div>
        </div>
      </div>

      <BottomSheet peek title="Fare Estimate">
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {/* Ride type — every type the catalog offers, because dispatch only
              matches drivers whose vehicle category equals the one chosen. */}
          {(catalog?.length ?? 0) > 1 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {/* Founder decision, 2026-08-19: no "none nearby" label and no
                  dimming. Announcing an empty road before the passenger has even
                  asked reads as "try another app", and it was shown on every
                  type at once — so the screen talked them out of all of them.
                  Dispatch widens its search 5→10→15km and drivers come online
                  while a request is live, so the honest moment to say nobody
                  came is after the search has actually run, on the finding
                  screen — not before it starts. */}
              {(catalog ?? []).map((option) => {
                const active = option.type === rideType;
                return (
                  <button
                    key={option.type}
                    onClick={() => setRideType(option.type)}
                    className="flex-shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold active:scale-[.97]"
                    style={{
                      background: active ? 'rgba(43,172,82,.16)' : NAVY_SURFACE,
                      border: `1px solid ${active ? G2 : BORDER}`,
                      color: active ? '#fff' : MUTED,
                      fontFamily: IT,
                    }}
                  >
                    {option.emoji} {option.displayName}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected ride card */}
          <div
            className="mb-4 flex items-center gap-4 rounded-2xl p-4"
            style={{ background: 'rgba(43,172,82,.08)', border: '1.5px solid rgba(43,172,82,.3)' }}
          >
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-3xl"
              style={{ background: 'rgba(43,172,82,.12)' }}
            >
              {typeEmoji}
            </div>
            <div className="flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                  {typeName}
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: 'rgba(43,172,82,.18)', color: G3 }}
                >
                  MVP
                </span>
              </div>
              <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                {[typeDesc, durationMin ? `${durationMin} min` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p
                className="text-[22px] font-bold leading-tight"
                style={{ fontFamily: PP, color: G3 }}
              >
                {fareLabel}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                est. fare
              </p>
            </div>
          </div>

          {/* Payment.

              This was a three-way Wallet / Card / Cash selector. It did
              nothing: `setPayment` updated state that was never read again,
              and `api.rides.book` takes no payment method — so whichever tile
              the passenger tapped, the ride was created with paymentMethod
              null. A control that looks like a choice and silently isn't is
              worse than no control, because the passenger believes they have
              chosen.

              Payment is taken after the trip, per the founder-locked order in
              RIDE-002.7, so this says when it happens and what the wallet
              holds, and the real choice is made on PaymentScreen. */}
          <div className="mb-4">
            <p
              className="mb-2.5 text-[13px] font-semibold"
              style={{ fontFamily: PP, color: MUTED }}
            >
              PAYMENT
            </p>
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{ background: NAVY_SURFACE, border: `1.5px solid ${BORDER}` }}
            >
              <span style={{ fontSize: 20 }}>💳</span>
              <div className="flex-1">
                <p className="text-[13px] font-semibold" style={{ fontFamily: IT, color: '#fff' }}>
                  Pay when the trip ends
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  Wallet or cash — you choose on arrival
                  {walletBalance != null ? ` · Wallet ${naira(walletBalance)}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Price breakdown */}
          <div
            className="mb-5 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
              PRICE BREAKDOWN
            </p>
            {/* Every line that moves the total, including the two that used to
                move it invisibly.

                A surcharge zone has been adding to fares since it shipped, and
                a minimum fare has been flooring short trips, and neither
                appeared here. So a 2km trip listed ₦300 + ₦198 + ₦66 and then
                a total of ₦1,500, and an airport trip listed the same ₦564 of
                lines under ₦16,767. Reported, correctly, as the breakdown not
                adding up — which from the passenger's side is indistinguishable
                from being overcharged.

                The surcharge names its zone, because "airport pickup" is a
                reason and "surcharge" is not. The minimum-fare row shows the
                difference it made rather than just its own value, so the column
                still adds up to the total when read top to bottom. */}
            {[
              ['Base fare', estimate ? naira(estimate.baseFare) : '—'],
              [`Distance (${kmLabel} km)`, estimate ? naira(estimate.distanceFare) : '—'],
              ['Time fee', estimate ? naira(estimate.timeFare) : '—'],
              ...(estimate && estimate.surchargeAmount > 0
                ? [
                    [
                      estimate.surchargeZoneName
                        ? `Surcharge · ${estimate.surchargeZoneName}`
                        : 'Zone surcharge',
                      naira(estimate.surchargeAmount),
                    ] as [string, string],
                  ]
                : []),
              ...(estimate && estimate.minimumFareApplied
                ? [
                    [
                      `Minimum fare (${naira(estimate.minimumFare)})`,
                      `+${naira(estimate.minimumFare - estimate.meteredFare - estimate.surchargeAmount)}`,
                    ] as [string, string],
                  ]
                : []),
              ['Promo applied', estimate ? `−${naira(estimate.promoDiscount)}` : '−₦0'],
            ].map(([l, v]) => (
              <div key={l} className="mb-2 flex items-center justify-between">
                <p className="text-[13px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                  {l}
                </p>
                <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: '#fff' }}>
                  {v}
                </p>
              </div>
            ))}
            <div className="my-2 h-px" style={{ background: BORDER }} />
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                Total
              </p>
              <p className="text-[18px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                {fareLabel}
              </p>
            </div>
          </div>
        </div>

        {/* The Book button used to sit at the end of the scrolling content,
            below the price breakdown — so on a phone the one action the screen
            exists for was under the fold, and the passenger could not confirm
            the ride at all. It is pinned to the bottom of the sheet now: the
            fare details scroll behind it, the button never moves. */}
        <div
          className="flex-shrink-0 px-5 pb-5 pt-3"
          style={{ borderTop: `1px solid ${BORDER}`, background: NAVY_BASE }}
        >
          {error && (
            <p
              className="mb-2.5 text-center text-[12px]"
              style={{ fontFamily: IT, color: COLOR_ERROR }}
            >
              {error}
            </p>
          )}

          <GreenButton
            label={booking ? 'Booking…' : `Book ${typeName} · ${fareLabel}`}
            onClick={handleBook}
          />

          <p className="mt-2 text-center text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            Price may vary with traffic · Ride protected by DrippleX Safe
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-005 — FINDING DRIVER
// ─────────────────────────────────────────────────────────────────────────────
/** When the searching copy starts acknowledging the wait. Long enough that a
 * normal match never reaches it, short enough to reassure someone who is
 * watching a spinner. */
const LONG_SEARCH_SECONDS = 45;

export function FindingDriverScreen({
  onBack,
  onFound,
  rideId,
}: {
  onBack: () => void;
  onFound: (ride: RideDto) => void;
  rideId?: string;
}) {
  const [dots, setDots] = useState(1);
  const [eta, setEta] = useState(8);
  const foundRef = useRef(false);
  // The search ends one of three ways: a driver takes it, nobody does, or the
  // passenger cancels. Only the first was handled, so a ride the backend had
  // already closed left this screen spinning "Finding your driver" forever.
  const [outcome, setOutcome] = useState<'searching' | 'cancelled'>('searching');
  // Seconds spent searching, so the copy can acknowledge a long wait without
  // ever declaring the trip unfulfillable.
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    const d = setInterval(() => setDots((p) => (p === 3 ? 1 : p + 1)), 500);
    const c = setInterval(() => setEta((p) => Math.max(1, p - 1)), 1000);
    const w = setInterval(() => setWaited((p) => p + 1), 1000);
    return () => {
      clearInterval(d);
      clearInterval(c);
      clearInterval(w);
    };
  }, []);

  // Poll the real ride until a driver is assigned; ws gives us the fast path.
  useEffect(() => {
    if (!rideId) return;
    const settle = (ride: RideDto) => {
      if (foundRef.current) return;
      const assigned =
        !!ride.driverId ||
        ['DRIVER_ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(ride.status);
      if (assigned) {
        foundRef.current = true;
        // foundRef already guarantees this runs once, so the passenger who
        // has been watching "Finding your driver" hears it exactly once.
        playNotificationSound('success');
        onFound(ride);
        return;
      }
      // NO_DRIVERS_FOUND is the backstop far beyond any real wait, and it is
      // not something to announce — the passenger keeps waiting or cancels.
      if (ride.status === 'NO_DRIVERS_FOUND') {
        return;
      }
      if (ride.status === 'CANCELLED') {
        foundRef.current = true;
        setOutcome('cancelled');
      }
    };
    ws.joinRide(rideId);
    const offStatus = ws.onRideStatus(() => {
      api.rides
        .get(rideId)
        .then(settle)
        .catch(() => {});
    });
    const poll = setInterval(() => {
      api.rides
        .get(rideId)
        .then(settle)
        .catch(() => {});
    }, 3000);
    api.rides
      .get(rideId)
      .then(settle)
      .catch(() => {});
    return () => {
      clearInterval(poll);
      offStatus();
    };
  }, [rideId, onFound]);

  const handleCancel = async () => {
    try {
      if (rideId) await api.rides.cancel(rideId);
    } catch {
      /* leave anyway */
    }
    onBack();
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 280 }}>
        <MapCanvas variant="finding" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 px-5">
            <BackArrow onClick={onBack} />
          </div>
        </div>
        {/* Pulse ring animation */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 110 }}>
          <div
            className="relative flex items-center justify-center"
            style={{ width: 80, height: 80 }}
          >
            <div
              className="absolute h-20 w-20 rounded-full"
              style={{
                background: 'rgba(43,172,82,.08)',
                animation: 'pulse-ring 1.4s ease-out infinite',
              }}
            />
            <div
              className="absolute h-16 w-16 rounded-full"
              style={{
                background: 'rgba(43,172,82,.12)',
                animation: 'pulse-ring 1.4s ease-out infinite .3s',
              }}
            />
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{ background: G2, boxShadow: `0 0 32px rgba(43,172,82,.5)` }}
            >
              🚗
            </div>
          </div>
        </div>
      </div>

      <BottomSheet peek>
        <div className="flex flex-col items-center gap-5 px-5 pb-8 pt-2">
          <div className="text-center">
            <p className="mb-1 text-[20px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              {outcome === 'cancelled'
                ? 'This ride was cancelled'
                : `Finding your driver${'.'.repeat(dots)}`}
            </p>
            <p className="text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
              {/* Founder decision, 2026-08-19: never tell a passenger DrippleX
                  could not arrange their ride. The request stays open and keeps
                  looking; after the first stretch the copy acknowledges the
                  wait rather than declaring failure, because drivers come
                  online while a request is live. Cancelling stays the
                  passenger's call, and it is one tap away below. */}
              {outcome === 'cancelled'
                ? 'Nothing has been charged.'
                : waited >= LONG_SEARCH_SECONDS
                  ? 'Still looking — drivers come online all the time. Nothing has been charged while you wait.'
                  : 'Matching you with the best driver nearby'}
            </p>
          </div>
          {/* The three tiles here read "4 Drivers nearby · ~3 min Est. pickup
              · 4.8★ Avg rating" — none of it measured, all of it constant, on
              a screen a passenger stares at while nothing is happening.
              DrippleX exposes no nearby-driver count or ETA to a customer
              mid-search, so there is nothing honest to put here. Removed
              rather than kept as decoration. */}

          {/* Progress bar — only while there is still something to wait for. */}
          {outcome === 'searching' && (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ background: G2, animation: 'bar-fill 4s ease-in-out forwards' }}
              />
            </div>
          )}

          {outcome === 'searching' ? (
            // Always available, never automatic: stopping the search is the
            // passenger's decision, not something the app does to them.
            <button
              onClick={handleCancel}
              className="text-[14px] font-medium active:opacity-60"
              style={{ fontFamily: IT, color: MUTED }}
            >
              Cancel ride
            </button>
          ) : (
            <div className="w-full">
              <GreenButton label="Book another ride" onClick={onBack} />
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-006 — DRIVER ASSIGNED
// ─────────────────────────────────────────────────────────────────────────────
export function DriverAssignedScreen({
  onBack,
  onArrived,
  onStarted,
  onCancel,
  onShare,
  rideId,
  onMessageDriver,
}: {
  onBack: () => void;
  onArrived: () => void;
  /** The driver can start the trip straight from ARRIVED, and a passenger who
   * had the app backgrounded can miss the arrival entirely — so this screen
   * has to be able to jump the whole way. */
  onStarted?: () => void;
  onCancel?: () => void;
  onShare?: () => void;
  rideId?: string;
  onMessageDriver?: (rideId: string, driverName: string | null) => void;
}) {
  const ride = useLiveRide(rideId);
  // Honest ETA from the backend's estimated trip duration (real field).
  const eta = ride ? Math.max(0, Math.round(ride.estimatedDurationSeconds / 60)) : null;
  const assigned = !!ride?.driverId;
  const typeLabel = ride ? RIDE_TYPE_LABEL[ride.rideType] : null;
  useRideStatusAdvance(ride?.status, { ARRIVED: onArrived, IN_PROGRESS: onStarted });

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
        <MapCanvas variant="assigned" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 flex items-start justify-between px-5">
            <BackArrow onClick={onBack} />
            <SafetyChip />
          </div>
        </div>
      </div>

      <BottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          {/* ETA banner */}
          <div
            className="mb-4 flex items-center gap-4 rounded-2xl p-4"
            style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.2)' }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
              style={{ background: 'rgba(43,172,82,.12)' }}
            >
              🚗
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                {assigned ? 'Driver on the way' : 'Finding your driver'}
              </p>
              <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                {eta != null ? `Arriving in approximately ${eta} min` : 'Estimating arrival…'}
              </p>
            </div>
            <div className="text-center">
              <p
                className="text-[22px] font-bold leading-none"
                style={{ fontFamily: PP, color: G3 }}
              >
                {eta != null ? eta : '—'}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                min
              </p>
            </div>
          </div>

          {/* Driver card */}
          {/* The driver's NAME is now on the ride (CustomerRideDto.driverName),
              so this no longer has to say "details shared after pickup" while a
              stranger drives towards you. Vehicle make/model, plate and rating
              are still not exposed by any endpoint — those stay honest gaps
              rather than invented values. */}
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="mb-4 flex items-center gap-4">
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-2xl"
                style={{
                  background: `linear-gradient(135deg,${G0},${G2})`,
                  color: '#fff',
                  fontFamily: PP,
                }}
              >
                🚗
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                    {assigned ? (ride?.driverName ?? 'Driver assigned') : 'Assigning driver…'}
                  </p>
                  {assigned && (
                    <div
                      className="flex h-4 w-4 items-center justify-center rounded-full"
                      style={{ background: G2 }}
                    >
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* GAP: no driver rating/trips endpoint — show ride status instead. */}
                  <span className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                    {assigned ? 'Your driver' : 'Driver details shared once assigned'}
                  </span>
                </div>
                {typeLabel && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: 'rgba(43,172,82,.12)', color: G3, fontFamily: IT }}
                  >
                    {typeLabel}
                  </span>
                )}
              </div>
            </div>

            <VehicleFacts ride={ride} />
          </div>

          <TripCodeCard code={ride?.verificationCode ?? null} />

          {/* Actions */}
          {/* "Call Driver" lived here and did nothing — and it cannot be made to
              work without handing the passenger the driver's personal number,
              which is exactly what DrippleX has decided not to do. The channel
              between these two people is in-app chat, so that is the control
              that remains, and it is now wired. */}
          <div className="mb-4 flex gap-3">
            <button
              onClick={() => {
                if (rideId) onMessageDriver?.(rideId, ride?.driverName ?? null);
              }}
              disabled={!assigned || !rideId || !onMessageDriver}
              aria-label="Message driver"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold transition-all active:scale-[.97]"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                fontFamily: IT,
                fontSize: 14,
                color: '#fff',
                opacity: assigned && rideId && onMessageDriver ? 1 : 0.45,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G2}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Message {ride?.driverName ? ride.driverName.split(' ')[0] : 'driver'}
            </button>
            <button
              onClick={onCancel}
              className="flex h-12 items-center justify-center rounded-2xl px-4 transition-all active:scale-[.97]"
              style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M4.93 4.93l14.14 14.14" />
              </svg>
            </button>
          </div>

          <ShareTripRow onShare={onShare} />
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-007 — DRIVER ARRIVED
// ─────────────────────────────────────────────────────────────────────────────
export function DriverArrivedScreen({
  onBack,
  onStart,
  onShare,
  rideId,
  onMessageDriver,
}: {
  onBack: () => void;
  /** Fired when the *driver* starts the trip, not when the passenger taps
   * anything — the passenger cannot start their own ride. */
  onStart: () => void;
  onShare?: () => void;
  rideId?: string;
  onMessageDriver?: (rideId: string, driverName: string | null) => void;
}) {
  const ride = useLiveRide(rideId);
  const typeLabel = ride ? RIDE_TYPE_LABEL[ride.rideType] : null;
  const [pulse, setPulse] = useState(true);
  useRideStatusAdvance(ride?.status, { IN_PROGRESS: onStart });
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 260 }}>
        <MapCanvas variant="arrived" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 flex justify-between px-5">
            <BackArrow onClick={onBack} />
            <SafetyChip />
          </div>
        </div>
      </div>

      <BottomSheet peek>
        <div className="flex flex-col gap-4 px-5 pb-8 pt-2">
          {/* Arrived banner */}
          <div
            className="flex items-center gap-4 rounded-2xl p-4"
            style={{
              background: 'rgba(43,172,82,.08)',
              border: `1.5px solid ${pulse ? 'rgba(43,172,82,.4)' : 'rgba(43,172,82,.2)'}`,
              transition: 'border-color .6s',
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{
                background: G2,
                boxShadow: pulse ? `0 0 24px rgba(43,172,82,.5)` : 'none',
                transition: 'box-shadow .6s',
              }}
            >
              ✅
            </div>
            <div>
              <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                Your driver has arrived!
              </p>
              <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                {ride?.driverVehicle
                  ? `Look for the ${ride.driverVehicle.color} ${ride.driverVehicle.make} ${ride.driverVehicle.model} — ${ride.driverVehicle.plateNumber}`
                  : typeLabel
                    ? `Look for your ${typeLabel} ride`
                    : 'Your ride is here'}
              </p>
            </div>
          </div>

          {/* Driver card — a real name and a real car, because a passenger
              about to get in has to be able to check both. */}
          <div
            className="rounded-2xl p-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
                style={{
                  background: `linear-gradient(135deg,${G0},${G2})`,
                  color: '#fff',
                  fontFamily: PP,
                }}
              >
                🚗
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  {ride?.driverName ?? 'Your driver'}
                </p>
                <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                  Waiting at your pickup point
                </p>
              </div>
              {/* Chat, not a phone call — the passenger never receives the
                  driver's number. The button that sat here dialled nothing. */}
              {onMessageDriver && rideId && (
                <button
                  onClick={() => onMessageDriver(rideId, ride?.driverName ?? null)}
                  aria-label="Message driver"
                  className="flex h-10 items-center justify-center gap-1.5 rounded-2xl px-3"
                  style={{
                    background: 'rgba(43,172,82,.12)',
                    border: '1px solid rgba(43,172,82,.2)',
                    fontFamily: IT,
                    fontSize: 12,
                    color: G3,
                  }}
                >
                  💬 Message
                </button>
              )}
            </div>
            <VehicleFacts ride={ride} />
          </div>

          <TripCodeCard code={ride?.verificationCode ?? null} />

          <ShareTripRow onShare={onShare} />

          {/* No "Start Trip" button. The passenger cannot start their own
              ride — the driver does, after the trip code checks out — so a
              button here only ever lied about who was in control. */}
          <div
            className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: G3 }} />
            <p className="text-[13px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
              Give your driver the trip code to set off
            </p>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-008 — RIDE IN PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
export function RideInProgressScreen({
  onBack,
  onComplete,
  onSOS,
  onShare,
  rideId,
  onMessageDriver,
}: {
  onBack: () => void;
  /** Fired when the driver completes the trip on the server — not on a timer. */
  onComplete: () => void;
  onSOS?: () => void;
  onShare?: () => void;
  rideId?: string;
  onMessageDriver?: (rideId: string, driverName: string | null) => void;
}) {
  const ride = useLiveRide(rideId);
  const typeLabel = ride ? RIDE_TYPE_LABEL[ride.rideType] : null;
  const [expanded, setExpanded] = useState(false);
  useRideStatusAdvance(ride?.status, { COMPLETED: onComplete });

  // A ticking clock, so the elapsed figures below stay current between polls.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  /**
   * Progress against the *estimated* duration, measured from the real
   * `startedAt` on the ride. This used to be a 1.2s interval that filled a bar
   * and then declared the trip over and navigated to the receipt — regardless
   * of where the car was. Now the bar is an estimate that says so, and only
   * the driver completing the trip ends it.
   */
  const totalMin = ride ? Math.max(1, Math.round(ride.estimatedDurationSeconds / 60)) : null;
  const totalKm = ride ? ride.estimatedDistanceMeters / 1000 : null;
  const startedAtMs = ride?.startedAt ? new Date(ride.startedAt).getTime() : null;
  const elapsedMin =
    startedAtMs !== null && !Number.isNaN(startedAtMs)
      ? Math.max(0, (now - startedAtMs) / 60000)
      : null;
  const progress =
    totalMin !== null && elapsedMin !== null ? Math.min(elapsedMin / totalMin, 1) : 0;
  const remaining = totalMin !== null ? Math.max(0, Math.round(totalMin * (1 - progress))) : null;
  const distLeft = totalKm !== null ? (totalKm * (1 - progress)).toFixed(1) : '—';
  const fareLabel = ride ? naira(ride.totalFare) : '—';

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
        <MapCanvas variant="inprogress" progress={progress} />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 flex justify-between px-5">
            <div />
            <SafetyChip />
          </div>
        </div>
      </div>

      <BottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="mb-2 flex justify-between">
              <p className="text-[13px] font-medium" style={{ fontFamily: IT, color: MUTED }}>
                Trip progress (estimated)
              </p>
              <p className="text-[13px] font-semibold" style={{ fontFamily: IT, color: G3 }}>
                {Math.round(progress * 100)}%
              </p>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-[1200ms]"
                style={{
                  width: `${progress * 100}%`,
                  background: `linear-gradient(90deg,${G0},${G3})`,
                }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="mb-4 flex gap-2">
            {[
              { v: remaining !== null ? `${remaining}` : '—', u: 'min left', icon: '⏱' },
              { v: distLeft, u: 'km left', icon: '📍' },
              { v: fareLabel, u: 'fare', icon: '💳' },
            ].map((s) => (
              <div
                key={s.u}
                className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-3"
                style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              >
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                  {s.v}
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {s.u}
                </p>
              </div>
            ))}
          </div>

          {/* Driver row — the passenger's own driver, by name, with the car
              they are sitting in. It used to read "Driver assigned · details
              after trip", which is no use to someone already in the seat. */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mb-3 flex w-full items-center gap-3 rounded-2xl p-3 transition-all"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                color: '#fff',
                fontFamily: PP,
              }}
            >
              🚗
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                {ride?.driverName ?? 'Your driver'}
              </p>
              <p className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                {ride?.driverVehicle
                  ? `${ride.driverVehicle.color} ${ride.driverVehicle.make} ${ride.driverVehicle.model} · ${ride.driverVehicle.plateNumber}`
                  : (typeLabel ?? '—')}
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={MUTED}
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform .2s',
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {expanded && (
            <div className="mb-3 flex gap-2">
              {[
                {
                  label: 'Message',
                  icon: '💬',
                  fn:
                    onMessageDriver && rideId
                      ? () => onMessageDriver(rideId, ride?.driverName ?? null)
                      : undefined,
                },
                { label: 'Emergency', icon: '🆘', fn: onSOS },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={a.fn}
                  disabled={!a.fn}
                  className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 transition-all active:scale-[.95]"
                  style={{
                    background: NAVY_CARD,
                    border: `1px solid ${BORDER}`,
                    fontFamily: IT,
                    fontSize: 12,
                    color: TEXT_SECONDARY,
                    opacity: a.fn ? 1 : 0.45,
                  }}
                >
                  <span>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          )}

          <ShareTripRow onShare={onShare} />

          {/* Route */}
          <div
            className="flex items-center gap-2 rounded-2xl p-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="h-2 w-2 rounded-full" style={{ background: G2 }} />
              <div className="h-8 w-px" style={{ background: BORDER }} />
              <div className="h-2 w-2 rounded-full" style={{ background: '#EF4444' }} />
            </div>
            <div className="flex-1">
              <p className="mb-2 text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                {ride?.pickupAddress ?? '—'}
              </p>
              <p className="text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                {ride?.dropoffAddress ?? '—'}
              </p>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-009 — TRIP COMPLETED
// ─────────────────────────────────────────────────────────────────────────────
export function TripCompletedScreen({
  onRate,
  onHome,
  onTip,
  onPay,
  rideId,
}: {
  onRate: () => void;
  onHome: () => void;
  // Founder request, 2026-08-16: a passenger who feels like adding something
  // for the driver should be able to. 100% of a tip goes to the driver.
  onTip?: () => void;
  /** Take an unpaid fare. See the unpaid branch below. */
  onPay?: () => void;
  rideId?: string;
}) {
  const ride = useLiveRide(rideId);
  // The receipt is the ONLY place with driver identity (name) — post-ride.
  const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof api.rides.getReceipt>> | null>(
    null,
  );
  useEffect(() => {
    if (!rideId) return;
    api.rides
      .getReceipt(rideId)
      .then(setReceipt)
      .catch(() => {});
  }, [rideId]);

  const typeLabel = ride ? RIDE_TYPE_LABEL[ride.rideType] : null;
  const durationLabel = ride
    ? `${Math.max(1, Math.round(ride.estimatedDurationSeconds / 60))} min`
    : '—';
  const distanceLabel = ride ? `${(ride.estimatedDistanceMeters / 1000).toFixed(1)} km` : '—';
  const routeLabel = ride ? `${ride.pickupAddress ?? '—'} → ${ride.dropoffAddress ?? '—'}` : '—';
  // `receipt.fare` is the fare *breakdown* object, not a number — passing it
  // straight to naira() is what printed "₦NaN" on the trip-completed screen.
  const totalLabel = receipt
    ? naira(receipt.fare.totalFare + (receipt.fare.tipAmount ?? 0))
    : ride
      ? naira(ride.totalFare)
      : '—';
  // Only once the ride has actually loaded — an unknown ride must not be
  // announced as unpaid.
  const unpaid = ride != null && ride.paymentStatus !== 'PAID';
  // Cash is chosen by the passenger and settled by the DRIVER: selecting it
  // records the method and leaves paymentStatus PENDING until the driver
  // confirms they were handed the money. `unpaid` alone cannot see that
  // difference, so a passenger who picked cash was sent back to "Pay ₦1,500",
  // tapped it, chose cash again, and came back to the same button — with no
  // way out and nothing on screen saying the ball was in the driver's court.
  // Reported as "no paid option, only stays at pay 1500 — after I have paid
  // nothing happens, only return to pay 1500". Confirmed on the ride behind
  // that report: paymentMethod CASH, paymentStatus PENDING.
  const awaitingCashConfirmation = unpaid && ride?.paymentMethod === 'CASH';

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <RideStatusBar />
      {/* Scrolls, and centres only when there is room to. `justify-center` on
          its own clipped the bottom of the receipt whenever the Route line
          wrapped to two lines — which it does for any real Kano address pair —
          taking the Total Charged row off the screen entirely. That is why the
          fare looked missing. `m-auto` on the inner column centres a short
          screenful and lets a tall one scroll instead of being cut. */}
      <div
        className="flex flex-1 flex-col overflow-y-auto px-5"
        style={{ animation: 'fade-up .5s ease both', scrollbarWidth: 'none' }}
      >
        <div className="m-auto flex w-full flex-col items-center gap-6 py-4">
          {/* Success icon */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: 120, height: 120 }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: 'rgba(43,172,82,.08)' }}
            />
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                boxShadow: `0 0 60px rgba(43,172,82,.35)`,
                animation: 'success-bounce .6s ease both',
              }}
            >
              🏁
            </div>
          </div>

          <div className="text-center">
            <p
              className="mb-1 text-[10px] font-bold tracking-widest"
              style={{ fontFamily: IT, color: G3 }}
            >
              TRIP COMPLETED
            </p>
            <p className="mb-2 text-[26px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              You have arrived!
            </p>
            <p className="text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
              {ride?.dropoffAddress ?? '—'}
            </p>
          </div>

          {/* Receipt card */}
          <div
            className="w-full overflow-hidden rounded-3xl"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <div className="border-b px-5 py-4" style={{ borderColor: BORDER }}>
              <p
                className="mb-3 text-[13px] font-semibold"
                style={{ fontFamily: PP, color: MUTED }}
              >
                TRIP SUMMARY
              </p>
              {[
                ['Duration', durationLabel],
                ['Distance', distanceLabel],
                ['Route', routeLabel],
                ['Driver', receipt?.driver?.name ?? ride?.driverName ?? '—'],
                [
                  'Vehicle',
                  ride?.driverVehicle
                    ? `${ride.driverVehicle.color} ${ride.driverVehicle.make} ${ride.driverVehicle.model} · ${ride.driverVehicle.plateNumber}`
                    : (typeLabel ?? '—'),
                ],
              ].map(([l, v]) => (
                <div key={l} className="mb-2.5 flex items-start justify-between">
                  <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
                    {l}
                  </p>
                  <p
                    className="max-w-[55%] text-right text-[13px] font-medium"
                    style={{ fontFamily: IT, color: '#fff' }}
                  >
                    {v}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-4">
              <p className="text-[15px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
                {unpaid ? 'Total Due' : 'Total Charged'}
              </p>
              <div className="text-right">
                <p
                  className="text-[22px] font-bold"
                  style={{ fontFamily: PP, color: unpaid ? '#F59E0B' : G3 }}
                >
                  {totalLabel}
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {/* "Not yet paid" is wrong for a cash fare the passenger has
                      already handed over — the money is with the driver and
                      only the confirmation is outstanding. */}
                  {awaitingCashConfirmation
                    ? 'Cash · awaiting driver confirmation'
                    : unpaid
                      ? 'Not yet paid'
                      : (ride?.paymentMethod ?? '—')}
                </p>
              </div>
            </div>
          </div>

          {/* Actions. An unpaid fare comes first and alone. Tipping is refused
            outright by the backend until the ride settles ("Ride must be paid
            before it can be tipped" — ride-payment.service.ts), which is the
            failure Sameer hit; rating is not gated, but burying an unpaid fare
            under a rating prompt is how it stays unpaid. Rate and tip are one
            tap away again the moment the fare clears. */}
          <div className="flex w-full flex-col gap-3">
            {awaitingCashConfirmation ? (
              /* Cash is chosen, and the passenger has nothing left to do. The
                 button they kept being shown could only take them back to the
                 same choice, so it is gone — replaced by what is actually
                 true. "Pay another way" stays, because a driver who never
                 confirms would otherwise leave the fare open with no exit. */
              <>
                <div
                  className="w-full rounded-2xl px-4 py-3.5 text-center"
                  style={{
                    background: 'rgba(245,158,11,.10)',
                    border: '1px solid rgba(245,158,11,.28)',
                  }}
                >
                  <p
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: PP, color: '#F59E0B' }}
                  >
                    Pay {totalLabel} in cash to your driver
                  </p>
                  <p className="mt-1 text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                    Waiting for your driver to confirm they received it. Rating and tipping unlock
                    as soon as they do.
                  </p>
                </div>
                <button
                  onClick={onPay ?? (() => undefined)}
                  className="flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-semibold transition-all active:scale-[.97]"
                  style={{
                    background: 'rgba(255,255,255,.06)',
                    border: `1px solid ${BORDER}`,
                    fontFamily: IT,
                    color: '#FFF',
                  }}
                >
                  Pay another way instead
                </button>
              </>
            ) : unpaid ? (
              <>
                <GreenButton label={`Pay ${totalLabel}`} onClick={onPay ?? (() => undefined)} />
                <p className="text-center text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                  Your trip is finished — settle the fare to rate or tip your driver.
                </p>
              </>
            ) : (
              <GreenButton label="Rate Your Ride ★" onClick={onRate} />
            )}
            {!unpaid && onTip && (
              <button
                onClick={onTip}
                className="flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-semibold transition-all active:scale-[.97]"
                style={{
                  background: 'rgba(34,197,94,.10)',
                  border: `1px solid rgba(34,197,94,.28)`,
                  fontFamily: IT,
                  color: G3,
                }}
              >
                💚 Add a tip for {receipt?.driver?.name ?? 'your driver'}
              </button>
            )}
            <button
              onClick={onHome}
              className="flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
              style={{
                background: NAVY_SURFACE,
                border: `1px solid ${BORDER}`,
                fontFamily: IT,
                color: TEXT_SECONDARY,
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-010 — RATE DRIVER
// ─────────────────────────────────────────────────────────────────────────────
export function RateDriverScreen({
  onBack,
  onSubmit,
  rideId,
}: {
  onBack: () => void;
  onSubmit: () => void;
  rideId?: string;
}) {
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>(['Safe driving', 'Friendly']);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Driver name comes from the post-ride receipt (only source of driver identity).
  const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof api.rides.getReceipt>> | null>(
    null,
  );
  useEffect(() => {
    if (!rideId) return;
    api.rides
      .getReceipt(rideId)
      .then(setReceipt)
      .catch(() => {});
  }, [rideId]);
  const driverName = receipt?.driver?.name ?? null;
  const driverInitials = driverName
    ? driverName
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '🚗';

  const ALL_TAGS = [
    'Safe driving',
    'Friendly',
    'On time',
    'Clean car',
    'Great music',
    'Quiet ride',
    'Professional',
    'Smooth ride',
  ];
  const TIPS = [200, 500, 1000];

  const toggleTag = (t: string) =>
    setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const handleSubmit = () => {
    setSubmitted(true);
    if (rideId) {
      const comboComment = [comment, ...tags].filter(Boolean).join(' · ');
      api.rides
        .rateDriver(rideId, { rating: stars, comment: comboComment || undefined })
        .catch(() => {});
      if (tip) api.rides.tip(rideId, tip).catch(() => {});
    }
    setTimeout(onSubmit, 1600);
  };

  if (submitted)
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-5"
        style={{ background: NAVY_BASE }}
      >
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            boxShadow: `0 0 40px rgba(43,172,82,.35)`,
            animation: 'success-bounce .5s ease both',
          }}
        >
          🙌
        </div>
        <p className="text-center text-[20px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
          Thanks for the feedback!
        </p>
        <p className="text-center text-[14px]" style={{ fontFamily: IT, color: MUTED }}>
          Your rating helps improve DrippleX Ride for everyone
        </p>
      </div>
    );

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <RideStatusBar />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 pt-3">
          <BackArrow onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Rate Your Ride
          </p>
        </div>

        {/* Driver */}
        <div className="mb-6 flex flex-col items-center">
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-bold"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              color: '#fff',
              fontFamily: PP,
              boxShadow: `0 8px 32px rgba(43,172,82,.3)`,
            }}
          >
            {driverInitials}
          </div>
          <p className="mb-0.5 text-[18px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            {driverName ?? 'Your driver'}
          </p>
          {/* GAP: receipt exposes driver name only; no vehicle make/model. */}
          <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            Thanks for riding with DrippleX
          </p>
        </div>

        {/* Stars */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <StarRow value={stars} onChange={setStars} />
          <p className="text-[14px] font-medium" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][stars]}
          </p>
        </div>

        {/* Tags */}
        <div className="mb-5">
          <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            WHAT STOOD OUT?
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-all active:scale-[.95]"
                style={{
                  background: tags.includes(t) ? 'rgba(43,172,82,.15)' : NAVY_SURFACE,
                  border: `1px solid ${tags.includes(t) ? 'rgba(43,172,82,.4)' : BORDER}`,
                  color: tags.includes(t) ? G3 : TEXT_SECONDARY,
                  fontFamily: IT,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div className="mb-5">
          <p className="mb-3 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            ADD A TIP (OPTIONAL)
          </p>
          <div className="flex gap-2">
            {TIPS.map((t) => (
              <button
                key={t}
                onClick={() => setTip(tip === t ? null : t)}
                className="flex-1 rounded-2xl py-3 text-[14px] font-semibold transition-all active:scale-[.95]"
                style={{
                  background: tip === t ? 'rgba(43,172,82,.12)' : NAVY_SURFACE,
                  border: `1px solid ${tip === t ? 'rgba(43,172,82,.35)' : BORDER}`,
                  color: tip === t ? G3 : TEXT_SECONDARY,
                  fontFamily: PP,
                }}
              >
                ₦{t.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <p className="mb-2 text-[13px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            ADD A COMMENT
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about your experience..."
            rows={3}
            className="w-full resize-none rounded-2xl px-4 py-3 outline-none"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              fontSize: 14,
              color: '#fff',
            }}
          />
        </div>

        <GreenButton
          label={tip ? `Submit & Tip ₦${tip.toLocaleString()}` : 'Submit Rating'}
          onClick={handleSubmit}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-011 — RIDE HISTORY
// ─────────────────────────────────────────────────────────────────────────────
export function RideHistoryScreen({
  onBack,
  onDetail,
}: {
  onBack: () => void;
  onDetail: (id: string) => void;
}) {
  const [tab, setTab] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [rides, setRides] = useState<RideDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    api.rides
      .list({ limit: 50 })
      .then((res) => setRides(res.items))
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load rides');
        setRides([]);
      });
  }, []);

  const all = rides ?? [];
  const filtered =
    tab === 'all'
      ? all
      : all.filter((r) =>
          tab === 'completed' ? r.status === 'COMPLETED' : r.status === 'CANCELLED',
        );

  const completed = all.filter((r) => r.status === 'COMPLETED');
  const totalSpent = completed.reduce((sum, r) => sum + r.totalFare, 0);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <RideStatusBar />

      <div className="flex-shrink-0 px-5 pb-4 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <BackArrow onClick={onBack} />
          <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
            Ride History
          </p>
        </div>

        {/* Summary card */}
        <div
          className="mb-4 flex gap-3 rounded-2xl p-4"
          style={{ background: 'rgba(43,172,82,.06)', border: '1px solid rgba(43,172,82,.15)' }}
        >
          {[
            { v: completed.length.toString(), l: 'Completed' },
            { v: naira(totalSpent), l: 'Total Spent' },
            // GAP: RideDto carries no per-ride star rating; no average available.
            { v: '—', l: 'Avg Rating' },
          ].map((s) => (
            <div key={s.l} className="flex-1 text-center">
              <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                {s.v}
              </p>
              <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                {s.l}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['all', 'completed', 'cancelled'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="h-9 flex-1 rounded-xl text-[12px] font-semibold capitalize transition-all"
              style={{
                background: tab === t ? G2 : NAVY_SURFACE,
                color: tab === t ? '#fff' : MUTED,
                fontFamily: IT,
                boxShadow: tab === t ? `0 4px 16px rgba(43,172,82,.3)` : 'none',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
        {filtered.map((ride) => {
          const isCompleted = ride.status === 'COMPLETED';
          return (
            <button
              key={ride.id}
              onClick={() => onDetail(ride.id)}
              className="w-full rounded-2xl p-4 text-left transition-all active:scale-[.98]"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                    style={{
                      background: isCompleted ? 'rgba(43,172,82,.12)' : 'rgba(239,68,68,.1)',
                    }}
                  >
                    {isCompleted ? '🚗' : '❌'}
                  </div>
                  <div>
                    <p
                      className="text-[13px] font-semibold"
                      style={{ fontFamily: PP, color: '#fff' }}
                    >
                      {RIDE_TYPE_LABEL[ride.rideType]} Ride
                    </p>
                    <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                      {fmtDate(ride.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className="text-[15px] font-bold"
                    style={{ fontFamily: PP, color: isCompleted ? '#fff' : MUTED }}
                  >
                    {naira(ride.totalFare)}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold`}
                    style={{
                      background: isCompleted ? 'rgba(43,172,82,.12)' : 'rgba(239,68,68,.1)',
                      color: isCompleted ? G3 : COLOR_ERROR,
                      fontFamily: IT,
                    }}
                  >
                    {ride.status}
                  </span>
                </div>
              </div>

              <div className="mb-2 flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: G2 }} />
                  <div className="h-4 w-px" style={{ background: BORDER }} />
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#EF4444' }} />
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                    {ride.pickupAddress ?? '—'}
                  </p>
                  <p className="text-[12px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                    {ride.dropoffAddress ?? '—'}
                  </p>
                </div>
              </div>
              {/* GAP: RideDto has no driver name or star rating for a history row. */}
            </button>
          );
        })}

        {rides === null && !loadError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ background: NAVY_SURFACE }}
            >
              🚗
            </div>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              Loading your rides…
            </p>
          </div>
        )}

        {loadError && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ background: NAVY_SURFACE }}
            >
              ⚠️
            </div>
            <p className="text-[15px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              Couldn't load rides
            </p>
            <p className="text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              {loadError}
            </p>
          </div>
        )}

        {rides !== null && !loadError && filtered.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{ background: NAVY_SURFACE }}
            >
              🚗
            </div>
            <p className="text-[15px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
              No rides here
            </p>
            <p className="text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
              {all.length === 0
                ? 'Your rides will appear here'
                : `Your ${tab} rides will appear here`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIDE-012 — RIDE DETAILS
// ─────────────────────────────────────────────────────────────────────────────
export function RideDetailScreen({
  onBack,
  rideId,
  onRebook,
  onReport,
}: {
  onBack: () => void;
  rideId?: string;
  onRebook?: () => void;
  onReport?: () => void;
}) {
  const [ride, setRide] = useState<RideDto | null>(null);
  const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof api.rides.getReceipt>> | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareVisible, setShareVisible] = useState(false);

  useEffect(() => {
    if (!rideId) return;
    setLoadError(null);
    api.rides
      .get(rideId)
      .then(setRide)
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : 'Failed to load ride'),
      );
    // Driver identity (name) is only on the post-ride receipt.
    api.rides
      .getReceipt(rideId)
      .then(setReceipt)
      .catch(() => {});
  }, [rideId]);

  if (!ride) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5"
        style={{ background: NAVY_BASE }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ background: NAVY_SURFACE }}
        >
          {loadError ? '⚠️' : '🚗'}
        </div>
        <p className="text-[15px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
          {loadError ? "Couldn't load ride" : 'Loading ride…'}
        </p>
        {loadError && (
          <p className="text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            {loadError}
          </p>
        )}
        <button
          onClick={onBack}
          className="mt-2 text-[14px] font-medium active:opacity-60"
          style={{ fontFamily: IT, color: G3 }}
        >
          ← Back to history
        </button>
      </div>
    );
  }

  const isCompleted = ride.status === 'COMPLETED';
  const typeLabel = RIDE_TYPE_LABEL[ride.rideType];
  const durationLabel = `${Math.max(1, Math.round(ride.estimatedDurationSeconds / 60))} min`;
  const distanceLabel = `${(ride.estimatedDistanceMeters / 1000).toFixed(1)} km`;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      <RideStatusBar />

      {/* Map snippet */}
      <div className="relative flex-shrink-0" style={{ height: 200 }}>
        <MapCanvas variant={isCompleted ? 'complete' : 'default'} progress={1} />
        <div className="absolute inset-0">
          <div className="mt-[52px] flex items-center gap-3 px-5 pt-2">
            <BackArrow onClick={onBack} />
            <p className="text-[17px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Ride Details
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Status badge */}
        <div className="mb-4 flex items-center justify-between pt-4">
          <div>
            <p
              className="mb-0.5 text-[12px] font-semibold"
              style={{ fontFamily: IT, color: MUTED }}
            >
              {fmtDate(ride.createdAt)}
            </p>
            <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
              ID: {ride.id}
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1.5 text-[11px] font-bold"
            style={{
              background: isCompleted ? 'rgba(43,172,82,.12)' : 'rgba(239,68,68,.1)',
              color: isCompleted ? G3 : COLOR_ERROR,
              fontFamily: IT,
            }}
          >
            {ride.status}
          </span>
        </div>

        {/* Route card */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div className="mb-3 flex items-start gap-3">
            <div className="flex flex-shrink-0 flex-col items-center gap-1 pt-1">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: G2 }} />
              <div className="h-6 w-px" style={{ background: BORDER }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} />
            </div>
            <div className="flex-1">
              <div className="mb-3">
                <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  PICKUP
                </p>
                <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  {ride.pickupAddress ?? '—'}
                </p>
              </div>
              <div>
                <p className="mb-0.5 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  DROP-OFF
                </p>
                <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  {ride.dropoffAddress ?? '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 border-t pt-3" style={{ borderColor: BORDER }}>
            {[
              [durationLabel, 'Duration'],
              [distanceLabel, 'Distance'],
              [typeLabel, 'Ride Type'],
            ].map(([v, l]) => (
              <div key={l} className="flex-1 text-center">
                <p className="text-[13px] font-bold" style={{ fontFamily: PP, color: G3 }}>
                  {v}
                </p>
                <p className="text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
                  {l}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Driver card */}
        {/* GAP: driver identity is only the name from the receipt (post-ride);
            no plate/rating/vehicle. Star rating the customer gave is not exposed. */}
        {isCompleted && (
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            <p className="mb-3 text-[12px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
              DRIVER
            </p>
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
                style={{
                  background: `linear-gradient(135deg,${G0},${G2})`,
                  color: '#fff',
                  fontFamily: PP,
                }}
              >
                🚗
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
                  {receipt?.driver?.name ?? '—'}
                </p>
                <span className="text-[12px]" style={{ fontFamily: IT, color: MUTED }}>
                  {typeLabel} ride
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p className="mb-3 text-[12px] font-semibold" style={{ fontFamily: PP, color: MUTED }}>
            PAYMENT
          </p>
          {[
            ['Base fare', naira(ride.baseFare)],
            ['Distance', naira(ride.distanceFare)],
            ['Time fee', naira(ride.timeFare)],
          ].map(([l, v]) => (
            <div key={l} className="mb-2 flex justify-between">
              <p className="text-[13px]" style={{ fontFamily: IT, color: TEXT_SECONDARY }}>
                {l}
              </p>
              <p className="text-[13px]" style={{ fontFamily: IT, color: '#fff' }}>
                {v}
              </p>
            </div>
          ))}
          <div className="my-2 h-px" style={{ background: BORDER }} />
          <div className="flex justify-between">
            <p className="text-[14px] font-bold" style={{ fontFamily: PP, color: '#fff' }}>
              Total
            </p>
            <p className="text-[16px] font-bold" style={{ fontFamily: PP, color: G3 }}>
              {naira(ride.totalFare)}
            </p>
          </div>
          <p className="mt-1 text-[11px]" style={{ fontFamily: IT, color: MUTED }}>
            {ride.paymentMethod ? `Paid via ${ride.paymentMethod}` : 'Payment method not recorded'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onRebook}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              fontFamily: IT,
              color: TEXT_SECONDARY,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Book same route again
          </button>
          <button
            onClick={onReport}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
            style={{
              background: 'rgba(239,68,68,.06)',
              border: '1px solid rgba(239,68,68,.12)',
              fontFamily: IT,
              color: '#EF4444',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Report an issue
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW SCREENS (appended)
// ─────────────────────────────────────────────────────────────────────────────

// 1. DriverProfileSheet
export function DriverProfileSheet({
  onBack,
  onMessage,
}: {
  onBack?: () => void;
  onMessage?: () => void;
}) {
  const reviews = [
    { name: 'Tunde A.', text: 'Very professional, knew the city well. 10/10!' },
    { name: 'Ngozi F.', text: 'Smooth ride and very polite. Would book again.' },
    { name: 'Emeka R.', text: 'Clean car, punctual and friendly. Highly recommend.' },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Driver Profile
        </p>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Avatar + name card */}
        <div
          className="mx-5 mb-4 flex flex-col items-center rounded-2xl p-5"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div
            className="mb-3 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontSize: 28,
              fontWeight: 700,
              color: '#fff',
              fontFamily: PP,
            }}
          >
            AO
          </div>
          <p style={{ fontFamily: PP, fontSize: 20, fontWeight: 700, color: '#fff' }}>
            Adeyemi Okafor
          </p>
          <div
            className="mt-1 rounded-full px-3 py-1"
            style={{ background: 'rgba(234,179,8,.15)', border: '1px solid rgba(234,179,8,.3)' }}
          >
            <p style={{ fontSize: 12, color: '#EAB308', fontFamily: PP, fontWeight: 600 }}>
              Gold Driver 🏅
            </p>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <StarRow rating={4.92} size={14} />
            <p
              style={{
                fontSize: 13,
                color: '#fff',
                fontFamily: PP,
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              4.92
            </p>
          </div>
          {/* Stats row */}
          <div className="mt-4 flex w-full justify-around gap-4">
            {[
              ['3,847', 'Trips'],
              ['4 yrs', 'Experience'],
              ['Top 5%', 'Rating'],
            ].map(([v, l]) => (
              <div key={l} className="flex flex-col items-center">
                <p style={{ fontFamily: PP, fontSize: 16, fontWeight: 700, color: G3 }}>{v}</p>
                <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Vehicle card */}
        <div
          className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{ fontSize: 11, fontFamily: PP, color: MUTED, fontWeight: 600, marginBottom: 8 }}
          >
            VEHICLE
          </p>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 28 }}>🚗</span>
            <div>
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                Toyota Camry (White)
              </p>
              <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>LAG 482 KA</p>
            </div>
          </div>
        </div>
        {/* Verified badges */}
        <div className="mx-5 mb-4 flex gap-2">
          {['ID ✓', 'Background ✓', 'Licensed ✓'].map((b) => (
            <div
              key={b}
              className="rounded-full px-3 py-1.5"
              style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)' }}
            >
              <p style={{ fontSize: 11, color: G3, fontFamily: PP, fontWeight: 600 }}>{b}</p>
            </div>
          ))}
        </div>
        {/* Reviews */}
        <div className="mx-5 mb-6">
          <p
            style={{
              fontFamily: PP,
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 10,
            }}
          >
            Passenger Reviews
          </p>
          {reviews.map((r) => (
            <div
              key={r.name}
              className="mb-3 rounded-xl p-3"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontFamily: PP,
                  fontWeight: 600,
                  color: G3,
                  marginBottom: 2,
                }}
              >
                {r.name}
              </p>
              <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>{r.text}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Buttons */}
      {/* Same rule as the assigned screen: no phone call, because DrippleX does
          not hand a passenger their driver's personal number. Chat is the
          channel, so it is the only action offered here. */}
      <div className="flex gap-3 px-5 pb-8 pt-3">
        <button
          className="h-12 flex-1 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
          style={{
            background: 'transparent',
            border: `1.5px solid ${BORDER}`,
            fontFamily: IT,
            color: TEXT_SECONDARY,
          }}
          onClick={onMessage || (() => {})}
        >
          💬 Message
        </button>
      </div>
    </div>
  );
}

// 2. PaymentScreen
//
// The fare is collected HERE, after the trip — not at booking. That ordering
// is the founder's locked decision (docs/RIDE-002.7-WALLET-PAYMENT-DESIGN.md:
// "Ride Completes -> Final fare known -> Payment screen -> Payment successful
// -> Driver credited -> Receipt"), because charging up front turns every ride
// that ends badly into a refund.
//
// Until now nothing in the passenger flow reached this screen: RideInProgress
// went straight to TripCompleted, and `ridepayment` was reachable only from
// itself and the dev screen index. So every ride was created with
// paymentMethod null / paymentStatus PENDING, completed, and charged nobody —
// and the tip then failed on the backend's own guard ("Ride must be paid
// before it can be tipped"), which is the correct behaviour for an unpaid
// ride. This screen and its routing are that missing step.
//
// Wallet and Cash settle synchronously inside RidePaymentService. Card leaves
// the app: RidePaymentService.initiateGatewayPayment returns an authorization
// URL, the customer pays on the gateway's page, and the fare is settled by
// ride-payment-webhook.subscriber.ts whether or not they come back — the same
// round trip lib/gatewayReturn.ts already runs for top-ups, utilities and
// hotel bookings.
//
// The gateways offered are whatever the server says are live
// (`api.payments.providers()`), never a hardcoded pair, so a rotated or pulled
// key removes the button instead of leaving a dead one on screen.
//
// OPay is still absent: OpayProvider throws NotImplementedException, and
// RIDE_PAYMENT_METHOD_TO_PROVIDER deliberately omits it so the request is
// rejected at initiation rather than 501-ing in production.
export function PaymentScreen({
  onBack,
  onPaid,
  onCash,
  rideId,
}: {
  onBack?: () => void;
  /** Fare settled — go to the receipt. */
  onPaid?: () => void;
  /** Passenger chose cash — hand off to the cash confirmation screen. */
  onCash?: () => void;
  rideId?: string;
}) {
  const ride = useLiveRide(rideId);
  const [balance, setBalance] = useState<number | null>(null);
  const [cardProviders, setCardProviders] = useState<CardProviderOptionDto[]>([]);
  const [selected, setSelected] = useState<RidePaymentChoice>('CASH');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.wallet
      .get()
      .then((w) => {
        setBalance(w.availableBalance);
      })
      .catch(() => {
        // A wallet that will not load must not silently read as ₦0 — that
        // would look like "top up" when the truth is "we do not know".
        setBalance(null);
      });
  }, []);

  useEffect(() => {
    let live = true;
    api.payments
      .providers()
      .then((config) => {
        if (live) setCardProviders(config.cardProviders);
      })
      .catch(() => {
        // No gateway list means no card buttons. Wallet and cash still work.
        if (live) setCardProviders([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const fare = ride ? Number(ride.totalFare) : null;
  const short = fare != null && balance != null && balance < fare;
  const alreadyPaid = ride?.paymentStatus === 'PAID';

  const routeLabel =
    ride?.pickupAddress != null && ride.dropoffAddress != null
      ? `${ride.pickupAddress} → ${ride.dropoffAddress}`
      : '—';
  const typeLabel = ride ? (RIDE_TYPE_LABEL[ride.rideType] ?? ride.rideType) : '—';
  const distanceLabel = ride ? `${(ride.estimatedDistanceMeters / 1000).toFixed(1)} km` : '—';

  const methods: {
    id: RidePaymentChoice;
    icon: string;
    label: string;
    sub: string;
    disabled: boolean;
  }[] = [
    {
      id: 'WALLET',
      icon: '💜',
      label: 'DrippleX Wallet',
      sub:
        balance == null
          ? 'Balance unavailable'
          : short
            ? `Balance: ${naira(balance)} — not enough for this fare`
            : `Balance: ${naira(balance)}`,
      disabled: balance == null || short,
    },
    ...cardProviders.map((p) => ({
      id: p.provider,
      icon: '💳',
      label: p.label,
      sub: 'Pay by card or bank transfer',
      disabled: false,
    })),
    {
      id: 'CASH',
      icon: '💵',
      label: 'Cash',
      sub: 'Pay your driver directly',
      disabled: false,
    },
  ];

  const handlePay = async () => {
    if (paying || !rideId) return;
    if (selected === 'CASH') {
      onCash?.();
      return;
    }
    setPaying(true);
    setError(null);
    try {
      if (selected === 'WALLET') {
        await api.rides.pay(rideId, { method: 'WALLET' });
        onPaid?.();
        return;
      }

      // Card. Remember the ride BEFORE leaving, because the tab that comes
      // back is this one and sessionStorage is the only thing that survives
      // the trip. The settlement itself does not depend on the customer
      // returning at all — the gateway webhook settles the fare either way —
      // so this is what lets them SEE it, not what makes it happen.
      rememberGatewayReturn('ride', rideId);
      const res = await api.rides.pay(rideId, {
        method: selected,
        callbackUrl: gatewayCallbackUrl('ride'),
      });
      if (res.authorizationUrl != null && res.authorizationUrl !== '') {
        window.location.assign(res.authorizationUrl);
        return;
      }
      // A gateway that returns no URL has not taken anything. Saying so beats
      // navigating to a receipt for a fare nobody paid.
      setError('The card gateway did not start. Try another method.');
    } catch (e: unknown) {
      // Surfaced, never swallowed: a wallet debit that fails leaves the ride
      // unpaid, and telling the passenger it worked is how a driver ends up
      // unpaid too.
      setError(e instanceof Error ? e.message : 'Payment could not be completed');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Choose Payment
        </p>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Fare summary — the real fare for this ride, not a placeholder. */}
        <div
          className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>{routeLabel}</p>
          <p style={{ fontFamily: PP, fontSize: 32, fontWeight: 800, color: G3, margin: '4px 0' }}>
            {fare != null ? naira(fare) : '—'}
          </p>
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>
            {typeLabel} • {distanceLabel}
          </p>
        </div>
        {/* Payment method list */}
        <div className="mx-5 mb-4">
          <p
            style={{
              fontSize: 11,
              fontFamily: PP,
              fontWeight: 600,
              color: MUTED,
              marginBottom: 10,
            }}
          >
            PAYMENT METHOD
          </p>
          {methods.map((m) => (
            <button
              key={m.id}
              disabled={m.disabled}
              className="mb-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[.98]"
              style={{
                background: selected === m.id ? 'rgba(34,197,94,.08)' : NAVY_CARD,
                border: selected === m.id ? `1.5px solid ${G3}` : `1px solid ${BORDER}`,
                opacity: m.disabled ? 0.5 : 1,
              }}
              onClick={() => {
                setSelected(m.id);
              }}
            >
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <div className="flex-1">
                <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                  {m.label}
                </p>
                <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>{m.sub}</p>
              </div>
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  border: selected === m.id ? 'none' : `2px solid ${BORDER}`,
                  background: selected === m.id ? G3 : 'transparent',
                }}
              >
                {selected === m.id && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>
        {error != null && (
          <div
            className="mx-5 mb-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.30)' }}
          >
            <p style={{ fontSize: 13, color: '#FCA5A5', fontFamily: IT }}>{error}</p>
          </div>
        )}
        {/* Total row */}
        <div
          className="mx-5 mb-4 flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontFamily: PP, fontSize: 14, color: '#fff', fontWeight: 600 }}>Total</p>
          <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 800, color: G3 }}>
            {fare != null ? naira(fare) : '—'}
          </p>
        </div>
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton
          label={
            alreadyPaid
              ? 'Already paid — continue'
              : paying
                ? 'Paying…'
                : selected === 'CASH'
                  ? 'Pay with cash'
                  : selected === 'WALLET'
                    ? 'Pay from wallet'
                    : 'Pay by card'
          }
          onClick={alreadyPaid ? () => onPaid?.() : handlePay}
        />
      </div>
    </div>
  );
}

// 3. OPayPaymentScreen
export function OPayPaymentScreen({
  onBack,
  onSuccess,
}: {
  onBack?: () => void;
  onSuccess?: () => void;
}) {
  const [pin, setPin] = useState('');
  const [state, setState] = useState<'input' | 'processing' | 'success'>('input');
  const handleNum = (d: string) => {
    if (pin.length < 6) setPin((p) => p + d);
  };
  const handleDel = () => setPin((p) => p.slice(0, -1));
  const handleSubmit = () => {
    if (pin.length === 6) {
      setState('processing');
      setTimeout(() => setState('success'), 2000);
    }
  };
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#00C853' }}>OPay</p>
      </div>
      {/* Step dots */}
      <div className="mb-6 flex justify-center gap-2">
        {['Enter', 'Verify', 'Done'].map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  state === 'success'
                    ? G3
                    : i === 0
                      ? G3
                      : i === 1 && state !== 'input'
                        ? G3
                        : BORDER,
              }}
            />
            {i < 2 && <div className="h-px w-6" style={{ background: BORDER }} />}
          </div>
        ))}
      </div>
      {state === 'success' ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5">
          <div
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'rgba(34,197,94,.15)' }}
          >
            <span style={{ fontSize: 40 }}>✅</span>
          </div>
          <p
            style={{
              fontFamily: PP,
              fontSize: 24,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 4,
            }}
          >
            ₦2,100 paid!
          </p>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 24 }}>
            Payment via OPay successful
          </p>
          <GreenButton label="Return to ride" onClick={onSuccess || (() => {})} />
        </div>
      ) : state === 'processing' ? (
        <div className="flex flex-1 flex-col items-center justify-center">
          <div
            className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: `${G3} transparent transparent transparent` }}
          />
          <p style={{ fontFamily: PP, fontSize: 16, color: '#fff' }}>Connecting to OPay...</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center px-5">
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 6 }}>
            Phone: +234 801 234 5678
          </p>
          <p
            style={{
              fontFamily: PP,
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              marginBottom: 16,
            }}
          >
            Enter your OPay PIN
          </p>
          {/* PIN dots */}
          <div className="mb-8 flex gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full"
                style={{
                  background: i < pin.length ? G3 : NAVY_SURFACE,
                  border: `2px solid ${i < pin.length ? G3 : BORDER}`,
                }}
              />
            ))}
          </div>
          {/* Numpad */}
          <div className="grid w-full max-w-xs grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '⌫'].map((d) => (
              <button
                key={d}
                className="h-14 rounded-2xl text-xl font-semibold transition-all active:scale-95"
                style={{
                  background: NAVY_CARD,
                  border: `1px solid ${BORDER}`,
                  color: '#fff',
                  fontFamily: PP,
                }}
                onClick={() => (d === '⌫' ? handleDel() : handleNum(d))}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            className="mt-6 h-12 w-full max-w-xs rounded-2xl text-sm font-semibold"
            style={{
              background: pin.length === 6 ? G3 : NAVY_SURFACE,
              color: pin.length === 6 ? '#0A1628' : MUTED,
              fontFamily: PP,
            }}
            onClick={handleSubmit}
          >
            Pay ₦2,100
          </button>
        </div>
      )}
    </div>
  );
}

// 4. CashPaymentScreen
export function CashPaymentScreen({
  onBack,
  onConfirm,
  rideId,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
  rideId?: string;
}) {
  const ride = useLiveRide(rideId);
  const [checked, setChecked] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fare = ride ? Number(ride.totalFare) : null;

  const handleConfirm = async () => {
    if (paying || !rideId) return;
    setPaying(true);
    setError(null);
    try {
      await api.rides.pay(rideId, { method: 'CASH' });
      onConfirm?.();
    } catch (e: unknown) {
      // This used to `catch {}` and continue to the confirmation regardless,
      // so a ride whose payment method never recorded still showed a receipt.
      // The driver's cash figure and the platform's commission both come off
      // this call — if it fails, the passenger has to see that.
      setError(e instanceof Error ? e.message : 'Could not confirm the cash payment');
    } finally {
      setPaying(false);
    }
  };
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Cash Payment</p>
      </div>
      <div
        className="flex flex-1 flex-col items-center overflow-y-auto px-5"
        style={{ scrollbarWidth: 'none' }}
      >
        <span style={{ fontSize: 72, marginTop: 24, marginBottom: 16 }}>💵</span>
        {/* Instruction card */}
        <div
          className="mb-4 w-full rounded-2xl p-5"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              fontFamily: PP,
              fontSize: 15,
              fontWeight: 600,
              color: '#fff',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            Have this amount ready
          </p>
          <p
            style={{
              fontFamily: PP,
              fontSize: 40,
              fontWeight: 800,
              color: '#F59E0B',
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            {fare != null ? naira(fare) : '—'}
          </p>
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT, textAlign: 'center' }}>
            Hand this to your driver now
          </p>
        </div>
        {/* Tips */}
        <div
          className="mb-4 w-full rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 8 }}
          >
            TIPS
          </p>
          {['Driver may not have change for large notes', 'Ask for receipt after payment'].map(
            (t) => (
              <div key={t} className="mb-2 flex items-start gap-2">
                <span style={{ color: '#F59E0B', fontSize: 14, marginTop: 1 }}>•</span>
                <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>{t}</p>
              </div>
            ),
          )}
        </div>
        {/* Checkbox */}
        <button
          className="mb-4 flex w-full items-center gap-3 rounded-2xl p-4 transition-all active:scale-[.98]"
          style={{
            background: checked ? 'rgba(34,197,94,.08)' : NAVY_CARD,
            border: checked ? `1.5px solid ${G3}` : `1px solid ${BORDER}`,
          }}
          onClick={() => setChecked(!checked)}
        >
          <div
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
            style={{
              background: checked ? G3 : 'transparent',
              border: checked ? 'none' : `2px solid ${BORDER}`,
            }}
          >
            {checked && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <polyline
                  points="2,6 5,9 10,3"
                  stroke="#0A1628"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
          <p style={{ fontSize: 14, fontFamily: IT, color: '#fff' }}>I have the exact amount</p>
        </button>
        <p
          style={{
            fontSize: 11,
            color: MUTED,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Cash rides are not refundable
        </p>
        {error != null && (
          <div
            className="mb-4 w-full rounded-xl px-4 py-3"
            style={{ background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.30)' }}
          >
            <p style={{ fontSize: 13, color: '#FCA5A5', fontFamily: IT }}>{error}</p>
          </div>
        )}
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton label={paying ? 'Confirming…' : 'Confirm Cash Ride'} onClick={handleConfirm} />
      </div>
    </div>
  );
}

// 5. TipDriverScreen
export function TipDriverScreen({
  onBack,
  onSubmit,
  onSkip,
  rideId,
}: {
  onBack?: () => void;
  onSubmit?: () => void;
  onSkip?: () => void;
  // Which ride is being tipped. Without it this screen was a mock: preset
  // chips, a made-up driver called "Adeyemi Okafor", and a Send Tip button
  // that charged nothing and paid nobody.
  rideId?: string | null;
}) {
  const PRESETS = [100, 200, 500, 1000] as const;
  const [selected, setSelected] = useState<number | 'custom'>(200);
  const [custom, setCustom] = useState('');
  // GET /customer/rides/:id returns CustomerRideDto — RideDto plus the driver's
  // name. Typing this as the bare RideDto meant `ride.driverName` was never
  // there and the passenger was always tipping "your driver".
  const [ride, setRide] = useState<CustomerRideDto | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!rideId) return;
    api.rides
      .get(rideId)
      .then(setRide)
      .catch(() => {});
  }, [rideId]);

  const amount = selected === 'custom' ? Number(custom.replace(/[^\d.]/g, '')) : selected;
  const amountValid = Number.isFinite(amount) && amount > 0;
  const alreadyTipped = (ride?.tipAmount ?? 0) > 0;

  const handleSend = async () => {
    if (!rideId) {
      setError('This trip cannot be tipped.');
      return;
    }
    if (!amountValid) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      // 100% of a tip goes to the driver — RidePaymentService.tipDriver takes
      // no platform commission, unlike the fare.
      await api.rides.tip(rideId, amount);
      setSent(true);
      onSubmit?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send the tip.');
    } finally {
      setSending(false);
    }
  };

  const driverName = ride?.driverName ?? 'your driver';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Leave a Tip</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Driver mini-card */}
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontFamily: PP,
              fontWeight: 700,
              color: '#fff',
              fontSize: 16,
            }}
          >
            {driverName
              .split(' ')
              .map((part) => part[0] ?? '')
              .join('')
              .slice(0, 2)
              .toUpperCase() || '🚗'}
          </div>
          <div className="flex-1">
            <p style={{ fontFamily: PP, fontSize: 15, fontWeight: 600, color: '#fff' }}>
              {driverName}
            </p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT, marginTop: 2 }}>
              {ride ? `Trip fare ${naira(ride.totalFare ?? 0)}` : 'Loading your trip…'}
            </p>
          </div>
        </div>
        {/* Preset chips */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}
        >
          Select tip amount
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {[...PRESETS, 'custom' as const].map((p) => (
            <button
              key={String(p)}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95"
              style={{
                background: selected === p ? G3 : NAVY_CARD,
                color: selected === p ? '#0A1628' : TEXT_SECONDARY,
                border: selected === p ? 'none' : `1px solid ${BORDER}`,
                fontFamily: PP,
                borderRadius: 999,
              }}
              onClick={() => setSelected(p)}
            >
              {p === 'custom' ? 'Custom' : naira(p)}
            </button>
          ))}
        </div>
        {selected === 'custom' && (
          <div className="mb-4">
            <input
              type="number"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Enter amount (₦)"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: NAVY_SURFACE,
                border: `1.5px solid ${G3}`,
                color: '#fff',
                fontFamily: IT,
              }}
            />
          </div>
        )}
        <div
          className="mb-4 rounded-xl p-4"
          style={{ background: 'rgba(34,197,94,.06)', border: `1px solid rgba(34,197,94,.15)` }}
        >
          <p style={{ fontSize: 13, color: G3, fontFamily: IT, textAlign: 'center' }}>
            💚 100% goes directly to your driver
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-5 pb-8 pt-3">
        {error && (
          <p style={{ fontFamily: IT, fontSize: 12.5, color: '#F87171' }} className="text-center">
            {error}
          </p>
        )}
        {alreadyTipped && !sent && (
          <p style={{ fontFamily: IT, fontSize: 12.5, color: G3 }} className="text-center">
            You already tipped {naira(ride?.tipAmount ?? 0)} on this trip.
          </p>
        )}
        <GreenButton
          label={sending ? 'Sending…' : `Send Tip${amountValid ? ` (${naira(amount)})` : ''}`}
          onClick={sending || alreadyTipped ? () => {} : () => void handleSend()}
        />
        <button
          onClick={onSkip}
          className="h-10 w-full text-sm"
          style={{ color: MUTED, fontFamily: IT, background: 'transparent' }}
        >
          Skip, no tip
        </button>
      </div>
    </div>
  );
}

// 6. ReportTripScreen
export function ReportTripScreen({
  onBack,
  onSubmit,
}: {
  onBack?: () => void;
  onSubmit?: () => void;
}) {
  const issues = [
    { id: 'safety', label: '🚨 Safety concern' },
    { id: 'charge', label: '💰 Overcharge / wrong fare' },
    { id: 'driver', label: '🚗 Driver behaviour' },
    { id: 'route', label: '📍 Wrong route taken' },
    { id: 'cancel', label: '❌ Trip cancelled by driver' },
    { id: 'lost', label: '📦 Lost item' },
    { id: 'other', label: 'Other' },
  ];
  const [selected, setSelected] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Report an Issue
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Trip summary */}
        <div
          className="mb-4 flex items-center gap-3 rounded-xl p-3"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED }}>
              RX-20241205-0012
            </p>
            <p style={{ fontSize: 13, color: '#fff', fontFamily: IT }}>
              Ikeja → Victoria Island • Today 9:41 AM
            </p>
          </div>
        </div>
        {/* Issue list */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}
        >
          What happened?
        </p>
        {issues.map((issue) => (
          <button
            key={issue.id}
            className="mb-2 flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition-all active:scale-[.98]"
            style={{
              background: selected === issue.id ? 'rgba(34,197,94,.08)' : NAVY_CARD,
              border: selected === issue.id ? `1.5px solid ${G3}` : `1px solid ${BORDER}`,
            }}
            onClick={() => setSelected(issue.id)}
          >
            <div className="flex-1">
              <p style={{ fontSize: 14, color: '#fff', fontFamily: IT }}>{issue.label}</p>
            </div>
            <div
              className="h-4 w-4 rounded-full"
              style={{
                border: selected === issue.id ? 'none' : `2px solid ${BORDER}`,
                background: selected === issue.id ? G3 : 'transparent',
              }}
            >
              {selected === issue.id && (
                <div className="mx-auto mt-[1px] h-2 w-2 rounded-full bg-white" />
              )}
            </div>
          </button>
        ))}
        {/* Description */}
        <div className="mb-4 mt-4">
          <textarea
            value={desc}
            onChange={(e) => desc.length <= 140 && setDesc(e.target.value)}
            placeholder="Describe what happened..."
            rows={3}
            className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: NAVY_SURFACE,
              border: `1px solid ${BORDER}`,
              color: '#fff',
              fontFamily: IT,
            }}
          />
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, textAlign: 'right' }}>
            {desc.length}/140
          </p>
        </div>
        {/* Photo attach */}
        <button
          className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl"
          style={{ background: NAVY_SURFACE, border: `1px dashed ${BORDER}` }}
        >
          <span style={{ fontSize: 18 }}>📎</span>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>
            Attach photo (optional)
          </p>
        </button>
        <p
          style={{
            fontSize: 11,
            color: MUTED,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Your report is reviewed within 24 hours
        </p>
      </div>
      <div className="px-5 pb-8 pt-3">
        <GreenButton label="Submit Report" onClick={onSubmit || (() => {})} />
      </div>
    </div>
  );
}

// 7. SavedPlacesScreen
export function SavedPlacesScreen({ onBack, onAdd }: { onBack?: () => void; onAdd?: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // DrippleX has no saved-places API yet (documented gap) — start empty rather
  // than presenting demo addresses as the customer's own saved places.
  const pinned: { id: string; icon: string; label: string; sub: string }[] = [];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Saved Places</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        <p
          style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 10 }}
        >
          PINNED PLACES
        </p>
        {pinned.map((p) => (
          <div
            key={p.id}
            className="mb-3 overflow-hidden rounded-2xl"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              borderLeft: `3px solid ${G3}`,
            }}
          >
            {editingId === p.id ? (
              <div className="p-4">
                <input
                  defaultValue={p.sub}
                  className="mb-2 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: NAVY_SURFACE,
                    border: `1.5px solid ${G3}`,
                    color: '#fff',
                    fontFamily: IT,
                  }}
                />
                <div className="flex gap-2">
                  <button
                    className="h-9 flex-1 rounded-xl text-sm font-semibold"
                    style={{ background: G3, color: '#0A1628', fontFamily: PP }}
                    onClick={() => setEditingId(null)}
                  >
                    Save
                  </button>
                  <button
                    className="h-9 flex-1 rounded-xl text-sm"
                    style={{
                      background: NAVY_SURFACE,
                      color: MUTED,
                      fontFamily: IT,
                      border: `1px solid ${BORDER}`,
                    }}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <div className="flex-1">
                  <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    {p.label}
                  </p>
                  <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>{p.sub}</p>
                </div>
                <button
                  style={{ fontSize: 12, color: G3, fontFamily: PP, fontWeight: 600 }}
                  onClick={() => setEditingId(p.id)}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}
        {/* Recent places */}
        <p
          style={{
            fontSize: 11,
            fontFamily: PP,
            fontWeight: 600,
            color: MUTED,
            marginTop: 16,
            marginBottom: 10,
          }}
        >
          RECENT PLACES
        </p>
        {/* No recent-places API exists yet (documented gap) — show an honest
            empty state rather than demo addresses with real coordinates. */}
        <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginBottom: 8 }}>
          No recent places yet.
        </p>
        {/* Add place CTA */}
        <button
          className="mb-6 mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl transition-all active:scale-[.98]"
          style={{ border: `1.5px dashed rgba(34,197,94,.4)`, background: 'transparent' }}
          onClick={onAdd || (() => {})}
        >
          <span style={{ fontSize: 20, color: G3 }}>+</span>
          <p style={{ fontSize: 14, color: G3, fontFamily: PP, fontWeight: 600 }}>Add a place</p>
        </button>
      </div>
    </div>
  );
}

// 8. ScheduleRideScreen
export function ScheduleRideScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const days = ['Today', 'Tomorrow', 'Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13'];
  const [selDay, setSelDay] = useState(0);
  const [hour, setHour] = useState(9);
  const [min, setMin] = useState(0);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [reminder, setReminder] = useState(true);
  const [confirm, setConfirm] = useState(false);
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Schedule a Ride
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Route summary */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>From</p>
          <p style={{ fontSize: 14, color: MUTED, fontFamily: IT, marginBottom: 6 }}>
            Set your pickup
          </p>
          <div className="h-px" style={{ background: BORDER }} />
          <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginTop: 6 }}>To</p>
          <p style={{ fontSize: 14, color: MUTED, fontFamily: IT }}>Set your destination</p>
        </div>
        {/* Day picker */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}
        >
          Select date
        </p>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {days.map((d, i) => (
            <button
              key={d}
              className="flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95"
              style={{
                background: selDay === i ? G3 : NAVY_CARD,
                color: selDay === i ? '#0A1628' : TEXT_SECONDARY,
                border: selDay === i ? 'none' : `1px solid ${BORDER}`,
                fontFamily: PP,
                borderRadius: 999,
              }}
              onClick={() => setSelDay(i)}
            >
              {d}
            </button>
          ))}
        </div>
        {/* Time picker */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}
        >
          Select time
        </p>
        <div className="mb-4 flex gap-3">
          {/* Hour */}
          <div
            className="flex-1 rounded-xl p-3"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <p
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: IT,
                textAlign: 'center',
                marginBottom: 6,
              }}
            >
              Hour
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                style={{ color: G3, fontSize: 20 }}
                onClick={() => setHour((h) => (h === 1 ? 12 : h - 1))}
              >
                ‹
              </button>
              <p
                style={{
                  fontFamily: PP,
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#fff',
                  minWidth: 30,
                  textAlign: 'center',
                }}
              >
                {String(hour).padStart(2, '0')}
              </p>
              <button
                style={{ color: G3, fontSize: 20 }}
                onClick={() => setHour((h) => (h === 12 ? 1 : h + 1))}
              >
                ›
              </button>
            </div>
          </div>
          {/* Minute */}
          <div
            className="flex-1 rounded-xl p-3"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <p
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: IT,
                textAlign: 'center',
                marginBottom: 6,
              }}
            >
              Minute
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                style={{ color: G3, fontSize: 20 }}
                onClick={() => setMin((m) => (m === 0 ? 55 : m - 5))}
              >
                ‹
              </button>
              <p
                style={{
                  fontFamily: PP,
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#fff',
                  minWidth: 30,
                  textAlign: 'center',
                }}
              >
                {String(min).padStart(2, '0')}
              </p>
              <button
                style={{ color: G3, fontSize: 20 }}
                onClick={() => setMin((m) => (m === 55 ? 0 : m + 5))}
              >
                ›
              </button>
            </div>
          </div>
          {/* AM/PM */}
          <div className="flex flex-col justify-center gap-1">
            {(['AM', 'PM'] as const).map((a) => (
              <button
                key={a}
                className="h-10 w-14 rounded-xl text-sm font-semibold"
                style={{
                  background: ampm === a ? G3 : NAVY_CARD,
                  color: ampm === a ? '#0A1628' : TEXT_SECONDARY,
                  fontFamily: PP,
                  border: ampm === a ? 'none' : `1px solid ${BORDER}`,
                }}
                onClick={() => setAmpm(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        {/* Fare estimate */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 4 }}
          >
            ESTIMATED FARE
          </p>
          <p style={{ fontFamily: PP, fontSize: 20, fontWeight: 800, color: G3 }}>
            ₦2,100 – ₦2,400
          </p>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginTop: 2 }}>
            Surge pricing may apply
          </p>
        </div>
        {/* Reminder toggle */}
        <div
          className="mb-6 flex items-center justify-between rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Notify me 15 min before
            </p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>
              Push notification reminder
            </p>
          </div>
          <button
            className="relative h-6 w-12 rounded-full transition-all"
            style={{ background: reminder ? G3 : NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            onClick={() => setReminder(!reminder)}
          >
            <div
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
              style={{ left: reminder ? 'calc(100% - 22px)' : 2 }}
            />
          </button>
        </div>
      </div>
      {/* Confirm bottom sheet */}
      {confirm && (
        <div
          className="absolute inset-0 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.5)', zIndex: 20 }}
        >
          <div className="rounded-t-3xl p-6" style={{ background: NAVY_CARD }}>
            <p
              style={{
                fontFamily: PP,
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                marginBottom: 12,
              }}
            >
              Confirm Schedule
            </p>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 6 }}>
              📅 {days[selDay]} at {String(hour).padStart(2, '0')}:{String(min).padStart(2, '0')}{' '}
              {ampm}
            </p>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 16 }}>
              📍 Ikeja → Victoria Island
            </p>
            <div className="flex gap-3">
              <GreenButton label="Confirm Ride" onClick={onConfirm || (() => {})} />
              <button
                className="h-12 flex-1 rounded-2xl"
                style={{
                  background: NAVY_SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                  fontFamily: IT,
                }}
                onClick={() => setConfirm(false)}
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="px-5 pb-8 pt-3">
        <GreenButton label="Schedule Ride" onClick={() => setConfirm(true)} />
      </div>
    </div>
  );
}

// 9. PromoCodeScreen
export function PromoCodeScreen({
  onBack,
  onApply,
}: {
  onBack?: () => void;
  onApply?: () => void;
}) {
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(false);
  const availablePromos = [
    { code: 'NEWRIDE', desc: '₦500 off your first 3 rides', expires: 'Expires Dec 31' },
    { code: 'WEEKEND', desc: '20% off weekend rides', expires: 'Expires Dec 31' },
  ];
  const handleApply = (c?: string) => {
    setCode(c || code);
    setApplied(true);
    onApply && onApply();
  };
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Promo Code</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Input row */}
        <div className="mb-6 flex gap-2">
          <div
            className="flex flex-1 items-center rounded-xl px-4"
            style={{ background: NAVY_CARD, border: `1.5px solid ${applied ? G3 : BORDER}` }}
          >
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setApplied(false);
              }}
              placeholder="Enter promo code"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              style={{ color: '#fff', fontFamily: IT }}
            />
            {code.length > 0 && (
              <button
                style={{ color: MUTED, fontSize: 18 }}
                onClick={() => {
                  setCode('');
                  setApplied(false);
                }}
              >
                ×
              </button>
            )}
          </div>
          <button
            className="h-12 rounded-xl px-5 text-sm font-semibold"
            style={{ background: G3, color: '#0A1628', fontFamily: PP }}
            onClick={() => handleApply()}
          >
            Apply
          </button>
        </div>
        {/* Success state */}
        {applied && (
          <div
            className="mb-6 flex items-center gap-3 rounded-2xl p-4"
            style={{ background: 'rgba(34,197,94,.08)', border: `1.5px solid ${G3}` }}
          >
            <span style={{ fontSize: 24 }}>✅</span>
            <div>
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: G3 }}>
                ₦500 discount applied!
              </p>
              <div className="mt-0.5 flex gap-2">
                <p
                  style={{
                    fontSize: 12,
                    color: TEXT_SECONDARY,
                    textDecoration: 'line-through',
                    fontFamily: IT,
                  }}
                >
                  ₦2,100
                </p>
                <p style={{ fontSize: 12, color: G3, fontFamily: PP, fontWeight: 600 }}>₦1,600</p>
              </div>
            </div>
          </div>
        )}
        {/* Available promos */}
        {!applied && (
          <>
            <p
              style={{
                fontFamily: PP,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                marginBottom: 12,
              }}
            >
              Available for you
            </p>
            {availablePromos.map((p) => (
              <div
                key={p.code}
                className="mb-3 rounded-2xl p-4"
                style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: 'rgba(34,197,94,.15)', color: G3, fontFamily: PP }}
                  >
                    {p.code}
                  </span>
                  <button
                    className="rounded-full px-3 py-1 text-xs"
                    style={{
                      border: `1px solid ${G3}`,
                      color: G3,
                      fontFamily: PP,
                      fontWeight: 600,
                    }}
                    onClick={() => handleApply(p.code)}
                  >
                    Apply
                  </button>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    color: '#fff',
                    fontFamily: PP,
                    fontWeight: 600,
                    marginTop: 6,
                  }}
                >
                  {p.desc}
                </p>
                <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginTop: 2 }}>
                  {p.expires}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// 10. ReferralScreen
export function ReferralScreen({ onBack }: { onBack?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  // The code used to be the literal string 'DRIPX-OLA42' and the reward the
  // literal 500 — a mockup shown to every customer, for a code the server had
  // never issued and an amount nobody had approved. Both come from
  // /customer/referrals/stats now, which returns the caller's real code
  // alongside the amounts from REFERRAL_REWARD_AMOUNTS.
  const [stats, setStats] = useState<ReferralStatsDto | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let live = true;
    api.referrals
      .stats()
      .then((s) => {
        if (live) setStats(s);
      })
      .catch(() => {
        if (live) setLoadError(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const code = stats?.code ?? '';
  const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;
  // A link beats a code read aloud: tapping it lands the friend in the app
  // with the code already in the registration field, so there is nothing to
  // remember or mistype. The code stays in the text too, for anyone who
  // receives it somewhere links do not survive.
  const shareLink = code ? referralShareUrl(code) : '';
  const shareMessage = code
    ? `Join me on DrippleX. Use my code ${code} when you sign up${
        stats ? ` and get ${naira(stats.refereeRewardAmount)} off your first ride` : ''
      }. ${shareLink}`
    : '';

  const handleCopyLink = () => {
    if (!shareLink) return;
    void navigator.clipboard
      ?.writeText(shareLink)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      })
      .catch(() => {
        setCopiedLink(false);
      });
  };

  const handleCopy = () => {
    if (!code) return;
    // This button never copied anything — it only flipped the label to
    // "Copied!". writeText can reject (insecure context, denied permission),
    // so the confirmation is shown only once it resolves.
    void navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        setCopied(false);
      });
  };

  const steps = [
    { n: 1, text: 'Share your referral code with a friend' },
    { n: 2, text: 'Your friend completes their first ride' },
    {
      n: 3,
      text: stats
        ? `They get ${naira(stats.refereeRewardAmount)}, you get ${naira(stats.referrerRewardAmount)}`
        : 'You both get credited',
    },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Refer & Earn</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Hero card */}
        <div
          className="mb-4 rounded-2xl p-6 text-center"
          style={{
            background: 'linear-gradient(135deg,#064e3b,#166534)',
            border: `1px solid rgba(34,197,94,.2)`,
          }}
        >
          <p
            style={{
              fontFamily: PP,
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 6,
            }}
          >
            {stats
              ? `Give ${naira(stats.refereeRewardAmount)}. Get ${naira(stats.referrerRewardAmount)}.`
              : 'Refer & Earn'}
          </p>
          <p
            style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontFamily: IT, lineHeight: 1.6 }}
          >
            {stats
              ? `Your friend gets ${naira(stats.refereeRewardAmount)} off their first ride. You earn ${naira(stats.referrerRewardAmount)} when they complete it.`
              : 'Share your code and you both earn when your friend takes their first ride.'}
          </p>
        </div>
        {/* Referral code */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              flex: 1,
              fontFamily: PP,
              fontSize: 22,
              fontWeight: 800,
              color: G3,
              letterSpacing: 2,
            }}
          >
            {code || (loadError ? 'Unavailable' : 'Loading…')}
          </p>
          <button
            className="rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95"
            style={{
              background: copied ? 'rgba(34,197,94,.15)' : NAVY_SURFACE,
              color: copied ? G3 : TEXT_SECONDARY,
              fontFamily: PP,
              border: `1px solid ${copied ? G3 : BORDER}`,
            }}
            onClick={handleCopy}
            disabled={!code}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {/* Share link — the thing most people will actually send */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-3"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              flex: 1,
              fontFamily: IT,
              fontSize: 12,
              color: TEXT_SECONDARY,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {shareLink || 'Your invite link will appear here'}
          </p>
          <button
            className="rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95"
            style={{
              background: copiedLink ? 'rgba(34,197,94,.15)' : NAVY_SURFACE,
              color: copiedLink ? G3 : TEXT_SECONDARY,
              fontFamily: PP,
              border: `1px solid ${copiedLink ? G3 : BORDER}`,
              flexShrink: 0,
            }}
            onClick={handleCopyLink}
            disabled={!shareLink}
          >
            {copiedLink ? 'Copied!' : 'Copy link'}
          </button>
        </div>

        {/* Share row */}
        <p
          style={{ fontSize: 11, fontFamily: PP, fontWeight: 600, color: MUTED, marginBottom: 10 }}
        >
          SHARE VIA
        </p>
        <div className="mb-6 flex gap-3">
          {[
            // These four buttons had no onClick at all. Instagram is gone
            // rather than faked — it has no URL that accepts shared text, so
            // the tile could only ever have done nothing. "More" hands the
            // message to the OS share sheet, which is where Instagram
            // actually lives on a phone.
            {
              label: 'WhatsApp',
              emoji: '💬',
              href: () => `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
            },
            {
              label: 'X',
              emoji: '𝕏',
              href: () => `https://x.com/intent/post?text=${encodeURIComponent(shareMessage)}`,
            },
            {
              label: 'SMS',
              emoji: '✉️',
              href: () => `sms:?body=${encodeURIComponent(shareMessage)}`,
            },
            { label: 'More', emoji: '📤', href: null },
          ].map((channel) => (
            <button
              key={channel.label}
              disabled={!code}
              onClick={() => {
                if (!code) return;
                if (channel.href) {
                  window.open(channel.href(), '_blank', 'noopener');
                  return;
                }
                if (navigator.share) {
                  void navigator.share({ text: shareMessage }).catch(() => {
                    /* Dismissed by the customer — not an error. */
                  });
                  return;
                }
                handleCopy();
              }}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl p-3 transition-all active:scale-95"
              style={{
                background: NAVY_CARD,
                border: `1px solid ${BORDER}`,
                opacity: code ? 1 : 0.5,
              }}
            >
              <span style={{ fontSize: 20 }}>{channel.emoji}</span>
              <p style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: IT }}>{channel.label}</p>
            </button>
          ))}
        </div>
        {/* Stats */}
        <div className="mb-6 flex gap-3">
          {[
            // Was a hardcoded 3 friends and ₦1,500 earned, shown to every
            // customer including one who had referred nobody. Earned is
            // rewarded redemptions times the referrer amount, both from the API.
            [stats ? String(stats.totalRedemptions) : '—', 'Friends Referred'],
            [stats ? naira(stats.rewardedRedemptions * stats.referrerRewardAmount) : '—', 'Earned'],
          ].map(([v, l]) => (
            <div
              key={l}
              className="flex-1 rounded-2xl p-4 text-center"
              style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            >
              <p style={{ fontFamily: PP, fontSize: 22, fontWeight: 800, color: G3 }}>{v}</p>
              <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>{l}</p>
            </div>
          ))}
        </div>
        {/* How it works */}
        <p
          style={{ fontFamily: PP, fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}
        >
          How it works
        </p>
        {steps.map((s) => (
          <div key={s.n} className="mb-3 flex items-start gap-3">
            <div
              className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: G3 }}
            >
              <p style={{ fontSize: 11, fontFamily: PP, fontWeight: 700, color: '#0A1628' }}>
                {s.n}
              </p>
            </div>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>{s.text}</p>
          </div>
        ))}
        {/* Leaderboard tease */}
        <div
          className="mb-6 mt-4 rounded-2xl p-4 text-center"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontSize: 14, color: '#fff', fontFamily: PP, fontWeight: 600 }}>
            You're #12 this week 🏆
          </p>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginTop: 2 }}>
            Keep referring to climb the leaderboard
          </p>
        </div>
      </div>
    </div>
  );
}

// 11. EmergencySOSScreen
export function EmergencySOSScreen({ onBack, onSOS }: { onBack?: () => void; onSOS?: () => void }) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHold = () => {
    setHolding(true);
    setProgress(0);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timerRef.current!);
          setHolding(false);
          onSOS && onSOS();
          return 100;
        }
        return p + 100 / 30;
      });
    }, 100);
  };
  const stopHold = () => {
    setHolding(false);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const circumference = 2 * Math.PI * 44;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: '#0D0A14', fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <span style={{ fontSize: 18 }}>🛡️</span>
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Emergency SOS
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Trip info */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
        >
          <p
            style={{
              fontFamily: PP,
              fontSize: 13,
              fontWeight: 600,
              color: '#EF4444',
              marginBottom: 6,
            }}
          >
            Current Trip
          </p>
          {/* GAP: no live driver name/plate endpoint (RideDto exposes only driverId). */}
          <p style={{ fontSize: 13, color: '#fff', fontFamily: IT }}>Driver: Assigned</p>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>Plate: —</p>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>
            Location: Ozumba Mbadiwe Ave, VI
          </p>
        </div>
        {/* Action cards */}
        {[
          {
            icon: '🚨',
            label: 'Call 911 / Emergency',
            sub: 'Connect to emergency services',
            color: '#EF4444',
            bg: 'rgba(239,68,68,.1)',
          },
          {
            icon: '📍',
            label: 'Share Live Location',
            sub: 'Send trip details to your contacts',
            color: '#3B82F6',
            bg: 'rgba(59,130,246,.1)',
          },
          {
            icon: '💬',
            label: 'Contact DrippleX Safety',
            sub: 'Chat with our safety team',
            color: G3,
            bg: 'rgba(34,197,94,.1)',
          },
        ].map((a) => (
          <button
            key={a.label}
            className="mb-3 flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[.97]"
            style={{ background: a.bg, border: `1px solid ${a.color}22` }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `${a.color}22` }}
            >
              <span style={{ fontSize: 22 }}>{a.icon}</span>
            </div>
            <div>
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 700, color: a.color }}>
                {a.label}
              </p>
              <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>{a.sub}</p>
            </div>
          </button>
        ))}
        {/* Emergency contacts */}
        <p
          style={{
            fontFamily: PP,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            marginTop: 8,
            marginBottom: 10,
          }}
        >
          Emergency Contacts
        </p>
        <div
          className="mb-2 flex items-center justify-between rounded-xl p-3.5"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontSize: 13, color: '#fff', fontFamily: PP, fontWeight: 600 }}>Mum</p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>+234 803 000 0001</p>
          </div>
          <button
            className="rounded-full px-3 py-1 text-xs"
            style={{
              background: 'rgba(34,197,94,.1)',
              color: G3,
              fontFamily: PP,
              fontWeight: 600,
              border: `1px solid rgba(34,197,94,.2)`,
            }}
          >
            Call
          </button>
        </div>
        <button
          className="mb-6 w-full p-3 text-left"
          style={{ color: G3, fontSize: 13, fontFamily: IT }}
        >
          + Add emergency contact
        </button>
      </div>
      {/* SOS hold button */}
      <div className="flex flex-col items-center pb-6 pt-2">
        <p
          style={{
            fontSize: 11,
            color: MUTED,
            fontFamily: IT,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          Your location is shared with our safety team during this ride.
        </p>
        <div
          className="relative flex items-center justify-center"
          style={{ width: 120, height: 120 }}
        >
          <svg
            width={120}
            height={120}
            style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
          >
            <circle
              cx={60}
              cy={60}
              r={44}
              fill="none"
              stroke="rgba(239,68,68,.2)"
              strokeWidth={8}
            />
            <circle
              cx={60}
              cy={60}
              r={44}
              fill="none"
              stroke="#EF4444"
              strokeWidth={8}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress / 100)}
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
          </svg>
          <button
            className="flex h-24 w-24 flex-col items-center justify-center rounded-full transition-all active:scale-95"
            style={{ background: holding ? '#DC2626' : '#EF4444' }}
            onMouseDown={startHold}
            onMouseUp={stopHold}
            onTouchStart={startHold}
            onTouchEnd={stopHold}
          >
            <span style={{ fontSize: 24 }}>🆘</span>
            <p
              style={{ fontSize: 10, fontFamily: PP, fontWeight: 700, color: '#fff', marginTop: 2 }}
            >
              HOLD 3 SEC
            </p>
          </button>
        </div>
        <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginTop: 8 }}>
          Hold to Alert Contacts
        </p>
      </div>
    </div>
  );
}

// 12. ShareTripScreen — a real link to a real live trip.
//
// This screen used to show a hardcoded `drpx.app/t/RX-5201`, a hardcoded
// driver ("Adeyemi Okafor • LAG 482 KA"), share buttons wired to nothing, a
// QR code drawn with Math.random(), and an "auto-share with emergency
// contacts" toggle that saved nowhere. Nothing was ever shared.
export function ShareTripScreen({ onBack, rideId }: { onBack?: () => void; rideId?: string }) {
  const ride = useLiveRide(rideId);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!rideId) return;
    let alive = true;
    api.rides
      .share(rideId)
      .then((res) => {
        if (alive) setLink(`${window.location.origin}${res.path}`);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not create a link right now.');
      });
    return () => {
      alive = false;
    };
  }, [rideId]);

  const message = link
    ? `I'm on a DrippleX trip${ride?.dropoffAddress ? ` to ${ride.dropoffAddress}` : ''}. Follow me here: ${link}`
    : '';

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copying is blocked in this browser — select the link above instead.');
    }
  };

  // The OS share sheet is the only way to reach WhatsApp, Messages, Telegram
  // and the rest without pretending to integrate with each of them.
  const nativeShare = async () => {
    if (!link) return;
    if (typeof navigator.share !== 'function') {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: 'My DrippleX trip', text: message, url: link });
    } catch {
      /* The person dismissed the share sheet. Nothing to report. */
    }
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          Share Your Trip
        </p>
        {link && (
          <div
            className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: 'rgba(34,197,94,.15)', border: `1px solid ${G3}` }}
          >
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: G3 }} />
            <p style={{ fontSize: 11, fontFamily: PP, fontWeight: 700, color: G3 }}>LIVE</p>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        {/* Trip snapshot — the driver and car actually on this ride. */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
            {ride?.driverName ?? 'Driver not assigned yet'}
            {ride?.driverVehicle ? ` • ${ride.driverVehicle.plateNumber}` : ''}
          </p>
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT, marginTop: 2 }}>
            {ride?.dropoffAddress ? `Heading to ${ride.dropoffAddress}` : 'Trip in progress'}
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-xl px-3 py-2"
            style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)' }}
          >
            <p style={{ fontSize: 12, fontFamily: IT, color: '#F87171' }}>{error}</p>
          </div>
        )}

        {/* The link itself */}
        <div className="mb-4 flex gap-2">
          <div
            className="flex flex-1 items-center overflow-hidden rounded-xl px-4 py-3"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <p
              className="truncate"
              style={{ fontSize: 13, color: link ? G3 : MUTED, fontFamily: IT, flex: 1 }}
            >
              {link ?? 'Creating your link…'}
            </p>
          </div>
          <button
            disabled={!link}
            className="rounded-xl px-4 text-sm font-semibold"
            style={{
              background: copied ? 'rgba(34,197,94,.1)' : NAVY_SURFACE,
              color: copied ? G3 : TEXT_SECONDARY,
              fontFamily: PP,
              border: `1px solid ${copied ? G3 : BORDER}`,
              opacity: link ? 1 : 0.45,
            }}
            onClick={() => void copy()}
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>

        <button
          disabled={!link}
          onClick={() => void nativeShare()}
          className="mb-6 flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-semibold active:scale-[.97]"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            fontFamily: IT,
            color: '#fff',
            opacity: link ? 1 : 0.45,
          }}
        >
          Send to family or friends
        </button>

        <p
          style={{
            fontSize: 11,
            color: MUTED,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          Anyone with this link can follow your trip until 30 minutes after it ends. They see your
          driver&apos;s first name, the car and where it is — not your phone number and not your
          trip code.
        </p>
      </div>
    </div>
  );
}

/**
 * What the family member opening a shared link actually sees.
 *
 * Reached at `/t/<token>` with no sign-in. It polls the public endpoint, which
 * returns first names and a last-known position and nothing else.
 */
export function SharedTripScreen({ token }: { token: string }) {
  const [trip, setTrip] = useState<SharedRideDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.rides
        .getShared(token)
        .then((t) => {
          if (alive) {
            setTrip(t);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (alive) setError(e instanceof Error ? e.message : 'This trip link is not valid.');
        });
    load();
    const poll = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [token]);

  const headline: Record<RideStatus, string> = {
    REQUESTED: 'Looking for a driver',
    SEARCHING: 'Looking for a driver',
    DRIVER_ASSIGNED: 'Driver on the way to pickup',
    ARRIVED: 'Driver has arrived at pickup',
    IN_PROGRESS: 'On the way',
    COMPLETED: 'Arrived safely',
    CANCELLED: 'Trip cancelled',
    NO_DRIVERS_FOUND: 'No driver was found',
  };

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-y-auto"
      style={{ background: NAVY_DEEP, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="px-5 pb-8 pt-4">
        <p style={{ fontFamily: PP, fontSize: 20, fontWeight: 700, color: '#fff' }}>
          DrippleX live trip
        </p>

        {error && !trip && (
          <div
            className="mt-6 rounded-2xl p-4"
            style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)' }}
          >
            <p style={{ fontSize: 13, fontFamily: IT, color: '#F87171' }}>{error}</p>
          </div>
        )}

        {trip && (
          <>
            <div
              className="mt-4 rounded-2xl p-4"
              style={{ background: 'rgba(43,172,82,.08)', border: '1px solid rgba(43,172,82,.25)' }}
            >
              <p style={{ fontFamily: PP, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {headline[trip.status]}
              </p>
              <p style={{ fontSize: 13, fontFamily: IT, color: MUTED, marginTop: 2 }}>
                {trip.passengerFirstName ? `${trip.passengerFirstName}'s trip` : 'A DrippleX trip'}
              </p>
            </div>

            <div
              className="mt-4 rounded-2xl p-4"
              style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            >
              {[
                ['Driver', trip.driverFirstName ?? 'Not assigned yet'],
                [
                  'Vehicle',
                  trip.vehicle
                    ? `${trip.vehicle.color} ${trip.vehicle.make} ${trip.vehicle.model}`
                    : '—',
                ],
                ['Plate', trip.vehicle?.plateNumber ?? '—'],
                ['From', trip.pickupAddress ?? '—'],
                ['To', trip.dropoffAddress ?? '—'],
                [
                  'Driver position',
                  trip.driverPosition
                    ? `${trip.driverPosition.latitude.toFixed(4)}, ${trip.driverPosition.longitude.toFixed(4)}`
                    : 'Not available',
                ],
              ].map(([l, v]) => (
                <div key={l} className="mb-2.5 flex items-start justify-between gap-4">
                  <p style={{ fontSize: 13, fontFamily: IT, color: MUTED }}>{l}</p>
                  <p
                    className="max-w-[60%] text-right"
                    style={{ fontSize: 13, fontFamily: IT, color: '#fff', fontWeight: 500 }}
                  >
                    {v}
                  </p>
                </div>
              ))}
            </div>

            <p
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: IT,
                textAlign: 'center',
                marginTop: 20,
              }}
            >
              This page refreshes on its own. The link stops working 30 minutes after the trip ends.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// 13. TripReceiptScreen
export function TripReceiptScreen({
  onBack,
  rideId,
  onReport,
}: {
  onBack?: () => void;
  rideId?: string;
  onReport?: () => void;
}) {
  // Every figure on this screen used to be invented: an ₦800 base fare, a
  // ₦500 "NEWRIDE" promo nobody had applied, a ₦1,590 total, a driver called
  // Adeyemi Okafor rated 4.92, and Ikeja → Victoria Island. It took a rideId
  // and never asked the server what the trip had actually cost.
  const [receipt, setReceipt] = useState<RideReceiptDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!rideId) return;
    setLoadError(null);
    api.rides
      .getReceipt(rideId)
      .then(setReceipt)
      .catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : 'Failed to load receipt'),
      );
  }, [rideId]);

  if (!receipt) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5"
        style={{ background: NAVY_BASE }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ background: NAVY_SURFACE }}
        >
          {loadError ? '⚠️' : '🧾'}
        </div>
        <p className="text-[15px] font-semibold" style={{ fontFamily: PP, color: '#fff' }}>
          {loadError ? "Couldn't load receipt" : 'Loading receipt…'}
        </p>
        {loadError && (
          <p className="text-center text-[13px]" style={{ fontFamily: IT, color: MUTED }}>
            {loadError}
          </p>
        )}
        <button
          onClick={onBack}
          className="mt-2 text-[14px] font-medium active:opacity-60"
          style={{ fontFamily: IT, color: G3 }}
        >
          ← Back
        </button>
      </div>
    );
  }

  const f = receipt.fare;
  const km = receipt.distanceMeters === null ? null : (receipt.distanceMeters / 1000).toFixed(1);
  const mins =
    receipt.durationSeconds === null ? null : Math.max(1, Math.round(receipt.durationSeconds / 60));

  // Only lines the server actually returned. A zero surcharge or an absent tip
  // is left off entirely rather than printed as ₦0.
  const breakdown: { label: string; amount: string; bold?: boolean; large?: boolean }[] = [
    { label: 'Base fare', amount: naira(f.baseFare) },
    { label: km ? `Distance (${km} km)` : 'Distance', amount: naira(f.distanceFare) },
    { label: mins ? `Time (${mins} min)` : 'Time', amount: naira(f.timeFare) },
  ];
  if (f.surchargeAmount > 0) {
    breakdown.push({
      label: f.surchargeZoneName ? `Surcharge (${f.surchargeZoneName})` : 'Surcharge',
      amount: naira(f.surchargeAmount),
    });
  }
  if (f.tipAmount && f.tipAmount > 0) {
    breakdown.push({ label: 'Tip', amount: naira(f.tipAmount) });
  }
  breakdown.push({ label: 'Total', amount: naira(f.totalFare), bold: true, large: true });

  const stamped = new Date(receipt.completedAt ?? receipt.requestedAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const PAYMENT_LABEL: Record<string, string> = {
    WALLET: 'DrippleX Wallet',
    CASH: 'Cash',
    CARD: 'Card',
    PAYSTACK: 'Card · Paystack',
    FLUTTERWAVE: 'Card · Flutterwave',
  };
  const paymentLabel = receipt.paymentMethod
    ? (PAYMENT_LABEL[receipt.paymentMethod] ?? receipt.paymentMethod)
    : 'Not recorded';
  const paidLabel =
    receipt.paymentStatus === 'PAID'
      ? 'Paid'
      : receipt.paymentStatus === 'REFUNDED'
        ? 'Refunded'
        : receipt.paymentStatus === 'FAILED'
          ? 'Failed'
          : 'Pending';
  const paidColor = receipt.paymentStatus === 'PAID' ? G3 : '#F59E0B';
  const driverName = receipt.driver?.name ?? null;
  const driverInitials = driverName
    ? driverName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part.charAt(0).toUpperCase())
        .join('')
    : '🚗';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="flex items-center gap-3 px-5 pb-4 pt-2">
        <BackArrow onClick={onBack || (() => {})} />
        <p style={{ fontFamily: PP, fontSize: 18, fontWeight: 700, color: '#fff' }}>Trip Receipt</p>
      </div>
      <div className="flex-1 overflow-y-auto px-5" style={{ scrollbarWidth: 'none' }}>
        <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginBottom: 16 }}>
          {stamped} • {receipt.rideId}
        </p>
        {/* Route visual */}
        <div className="mb-4 flex gap-4">
          <div className="flex flex-col items-center" style={{ paddingTop: 4 }}>
            <div className="h-3 w-3 rounded-full" style={{ background: G3 }} />
            <div
              className="my-1 w-px flex-1"
              style={{ background: BORDER, borderLeft: '2px dashed', borderColor: BORDER }}
            />
            <div className="h-3 w-3 rounded-full" style={{ background: '#3B82F6' }} />
          </div>
          <div className="flex-1">
            <div className="mb-3">
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {receipt.pickupAddress ?? 'Pickup not recorded'}
              </p>
              <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>Pickup</p>
            </div>
            <div>
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {receipt.dropoffAddress ?? 'Dropoff not recorded'}
              </p>
              <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>Dropoff</p>
            </div>
          </div>
          <div className="text-right">
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>
              {km ? `${km} km` : '—'}
            </p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>
              {mins ? `${mins} min` : '—'}
            </p>
          </div>
        </div>
        {/* Fare breakdown */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            style={{
              fontSize: 11,
              fontFamily: PP,
              fontWeight: 600,
              color: MUTED,
              marginBottom: 10,
            }}
          >
            FARE BREAKDOWN
          </p>
          {breakdown.map((row) => (
            <div key={row.label}>
              {row.label === 'Total' && (
                <div className="my-2 h-px" style={{ background: BORDER }} />
              )}
              <div className="mb-2 flex items-center justify-between">
                <p
                  style={{
                    fontSize: row.bold ? 14 : 13,
                    fontFamily: row.bold ? PP : IT,
                    fontWeight: row.bold ? 600 : 400,
                    color: '#fff',
                  }}
                >
                  {row.label}
                </p>
                <p
                  style={{
                    fontSize: row.large ? 18 : 13,
                    fontFamily: row.bold ? PP : IT,
                    fontWeight: row.bold ? 700 : 400,
                    color: row.large ? G3 : TEXT_SECONDARY,
                  }}
                >
                  {row.amount}
                </p>
              </div>
            </div>
          ))}
        </div>
        {/* Payment method */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-4"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <span style={{ fontSize: 20 }}>{receipt.paymentMethod === 'CASH' ? '💵' : '💳'}</span>
          <p style={{ fontFamily: IT, fontSize: 14, color: '#fff', flex: 1 }}>{paymentLabel}</p>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: `${paidColor}26`, color: paidColor, fontFamily: PP }}
          >
            {paidLabel}
          </span>
        </div>
        {/* Driver row. No rating is shown: the receipt carries the driver's
            name and vehicle type, and no per-driver rating exists in the API,
            so the old "4.92 ★" was a number the platform does not hold. */}
        {driverName && (
          <div
            className="mb-4 flex items-center gap-3 rounded-2xl p-4"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg,#16a34a,#22c55e)',
                fontFamily: PP,
                fontWeight: 700,
                color: '#fff',
                fontSize: 14,
              }}
            >
              {driverInitials}
            </div>
            <div className="flex-1">
              <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {driverName}
              </p>
              <p style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: IT, marginTop: 2 }}>
                {receipt.driver ? RIDE_TYPE_LABEL[receipt.driver.vehicleType] : 'Driver'}
              </p>
            </div>
          </div>
        )}
        {/* Support link */}
        <div className="mb-6 text-center">
          <button onClick={onReport} style={{ fontSize: 12, color: '#EF4444', fontFamily: IT }}>
            Issue with this trip?
          </button>
        </div>
      </div>
    </div>
  );
}

// 14. RideHomeExtendedScreen
export function RideHomeExtendedScreen({
  onBack,
  onSearch,
  onSchedule,
  onHistory,
  onSavedPlaces,
  onPromo,
  onReferral,
  onSOS,
}: {
  onBack?: () => void;
  onSearch?: () => void;
  onSchedule?: () => void;
  onHistory?: () => void;
  onSavedPlaces?: () => void;
  onPromo?: () => void;
  onReferral?: () => void;
  onSOS?: () => void;
}) {
  const actions = [
    { icon: '📅', label: 'Schedule', onTap: onSchedule },
    { icon: '📍', label: 'Saved', onTap: onSavedPlaces },
    { icon: '🎟', label: 'Promo', onTap: onPromo },
    { icon: '👥', label: 'Refer', onTap: onReferral },
    { icon: '🚨', label: 'SOS', onTap: onSOS },
    { icon: '📋', label: 'History', onTap: onHistory },
    { icon: '💳', label: 'Payment', onTap: undefined },
    { icon: '⚙️', label: 'Settings', onTap: undefined },
  ];
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      {/* Map background */}
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="home" />
      </div>
      {/* Overlay gradient */}
      <div
        className="absolute inset-0 top-10"
        style={{
          background:
            'linear-gradient(to bottom, rgba(10,22,40,.7) 0%, rgba(10,22,40,.2) 40%, rgba(10,22,40,.6) 70%, rgba(10,22,40,.95) 100%)',
          zIndex: 1,
        }}
      />
      {/* Content */}
      <div className="relative flex flex-1 flex-col px-5 pt-4" style={{ zIndex: 2 }}>
        {/* Greeting */}
        <p
          style={{ fontFamily: PP, fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 12 }}
        >
          {(() => {
            // Was hardcoded "Good morning, Chidi 👋" — every passenger was
            // greeted by a designer's placeholder name, at any hour.
            const n = auth.greetingName();
            return n ? `${timeGreeting()}, ${n} 👋` : `${timeGreeting()} 👋`;
          })()}
        </p>
        {/* Search bar */}
        <button
          className="mb-4 flex h-14 w-full items-center gap-3 rounded-2xl px-4 transition-all active:scale-[.98]"
          style={{
            background: 'rgba(255,255,255,.08)',
            border: `1px solid rgba(255,255,255,.12)`,
            backdropFilter: 'blur(8px)',
          }}
          onClick={onSearch || (() => {})}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={MUTED}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p style={{ fontSize: 15, color: MUTED, fontFamily: IT }}>Where to?</p>
        </button>
        {/* Quick actions grid */}
        <div className="grid grid-cols-4 gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              className="flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,.07)',
                border: `1px solid rgba(255,255,255,.1)`,
                backdropFilter: 'blur(8px)',
              }}
              onClick={a.onTap || (() => {})}
            >
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <p style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: IT }}>{a.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 15. LiveTrackingScreen
export function LiveTrackingScreen({
  onBack,
  onShare,
  onSOS,
  onChat,
}: {
  onBack?: () => void;
  onShare?: () => void;
  onSOS?: () => void;
  onChat?: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      {/* Full screen map */}
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="inprogress" progress={0.6} />
      </div>
      {/* Top bar */}
      <div
        className="absolute left-0 right-0 top-10 flex items-center gap-2 px-4 pt-3"
        style={{ zIndex: 10 }}
      >
        <div
          className="flex flex-1 items-center gap-2 rounded-2xl px-3 py-2"
          style={{
            background: 'rgba(10,22,40,.85)',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${BORDER}`,
          }}
        >
          <BackArrow onClick={onBack || (() => {})} />
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT, flex: 1 }}>
            Trip RX-5201
          </p>
          <div
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{ background: 'rgba(34,197,94,.15)' }}
          >
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: G3 }} />
            <p style={{ fontSize: 10, fontFamily: PP, fontWeight: 700, color: G3 }}>LIVE</p>
          </div>
        </div>
      </div>
      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: NAVY_CARD, zIndex: 10, border: `1px solid ${BORDER}` }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: BORDER }} />
        <p
          style={{ fontFamily: PP, fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}
        >
          On the way to Victoria Island
        </p>
        <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 12 }}>
          8 min • 4.2 km remaining
        </p>
        {/* Driver row */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontFamily: PP,
              fontWeight: 700,
              color: '#fff',
              fontSize: 14,
            }}
          >
            AO
          </div>
          <div className="flex-1">
            {/* GAP: RideDto exposes only driverId; no live driver name/rating. */}
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Driver assigned
            </p>
            <div className="flex items-center gap-1">
              <p style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: IT }}>
                Details after pickup
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G3}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 10.5a19.79 19.79 0 01-3.07-8.67A2 2 0 012.85 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 7.62a16 16 0 006.29 6.29l1-1a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0121.9 15a2 2 0 01.1.92z" />
              </svg>
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              onClick={onChat || (() => {})}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G3}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mb-4 h-2 rounded-full" style={{ background: NAVY_SURFACE }}>
          <div className="h-2 rounded-full" style={{ background: G3, width: '60%' }} />
        </div>
        {/* Action pills */}
        <div className="mb-3 flex gap-2">
          {[
            { icon: '📍', label: 'Share Trip', fn: onShare },
            { icon: '🚨', label: 'SOS', fn: onSOS },
            { icon: '📞', label: 'Call', fn: undefined },
          ].map((a) => (
            <button
              key={a.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-all active:scale-95"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
              onClick={a.fn || (() => {})}
            >
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <p style={{ fontSize: 10, color: TEXT_SECONDARY, fontFamily: IT }}>{a.label}</p>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, textAlign: 'center' }}>
          Swipe up for more details
        </p>
      </div>
    </div>
  );
}

// 16. DriverEnRouteScreen
export function DriverEnRouteScreen({
  onBack,
  onContact,
  onCancel,
}: {
  onBack?: () => void;
  onContact?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="assigned" />
      </div>
      <div
        className="absolute inset-0 top-10"
        style={{
          background: 'linear-gradient(to bottom, transparent 40%, rgba(10,22,40,.95) 100%)',
          zIndex: 1,
        }}
      />
      {/* Back button */}
      <div className="absolute left-4 top-14" style={{ zIndex: 10 }}>
        <BackArrow onClick={onBack || (() => {})} />
      </div>
      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: NAVY_CARD, zIndex: 10, border: `1px solid ${BORDER}` }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: BORDER }} />
        <div className="mb-1 flex items-center justify-between">
          <p style={{ fontFamily: PP, fontSize: 17, fontWeight: 700, color: '#fff' }}>
            Adeyemi is on the way
          </p>
          <SafetyChip />
        </div>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: G3 }} />
          <p style={{ fontSize: 13, color: G3, fontFamily: PP, fontWeight: 600 }}>
            Arriving in 3 min
          </p>
        </div>
        {/* Driver card */}
        <div
          className="mb-4 flex items-center gap-3 rounded-2xl p-3.5"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(135deg,#16a34a,#22c55e)',
              fontFamily: PP,
              fontWeight: 700,
              color: '#fff',
              fontSize: 14,
            }}
          >
            AO
          </div>
          <div className="flex-1">
            {/* GAP: no live driver name/vehicle/plate/rating (RideDto exposes only driverId). */}
            <p style={{ fontFamily: PP, fontSize: 14, fontWeight: 600, color: '#fff' }}>
              Driver assigned
            </p>
            <p style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT }}>—</p>
            <div className="mt-0.5 flex items-center gap-1">
              <p style={{ fontSize: 11, color: TEXT_SECONDARY, fontFamily: IT }}>
                Details after pickup
              </p>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="mb-3 flex gap-3">
          {[
            { icon: '📞', label: 'Call', fn: onContact },
            { icon: '💬', label: 'Chat', fn: undefined },
            { icon: '❌', label: 'Cancel', fn: onCancel },
          ].map((a) => (
            <button
              key={a.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl py-2.5 transition-all active:scale-95"
              style={{
                background: a.label === 'Cancel' ? 'rgba(239,68,68,.08)' : NAVY_SURFACE,
                border:
                  a.label === 'Cancel' ? '1px solid rgba(239,68,68,.15)' : `1px solid ${BORDER}`,
              }}
              onClick={a.fn || (() => {})}
            >
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <p
                style={{
                  fontSize: 11,
                  color: a.label === 'Cancel' ? '#EF4444' : TEXT_SECONDARY,
                  fontFamily: IT,
                }}
              >
                {a.label}
              </p>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#F59E0B', fontFamily: IT, textAlign: 'center' }}>
          Free cancellation until driver arrives
        </p>
      </div>
    </div>
  );
}

// 17. PassengerWaitingScreen
export function PassengerWaitingScreen({
  onBack,
  onContact,
  onBoard,
}: {
  onBack?: () => void;
  onContact?: () => void;
  onBoard?: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="arrived" />
      </div>
      <div
        className="absolute inset-0 top-10"
        style={{
          background: 'linear-gradient(to bottom, transparent 30%, rgba(10,22,40,.95) 70%)',
          zIndex: 1,
        }}
      />
      <div className="absolute left-4 top-14" style={{ zIndex: 10 }}>
        <BackArrow onClick={onBack || (() => {})} />
      </div>
      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: NAVY_CARD, zIndex: 10, border: `1px solid ${BORDER}` }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: BORDER }} />
        {/* Pulsing car */}
        <div className="mb-4 flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: 'rgba(34,197,94,.12)',
              boxShadow: `0 0 0 0 rgba(34,197,94,.4)`,
              animation: 'pulse 1.5s infinite',
            }}
          >
            <span style={{ fontSize: 32 }}>🚗</span>
          </div>
        </div>
        <p
          style={{
            fontFamily: PP,
            fontSize: 20,
            fontWeight: 800,
            color: '#fff',
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          Your driver is here!
        </p>
        <p
          style={{
            fontSize: 13,
            color: TEXT_SECONDARY,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Look for white Toyota Camry • LAG 482 KA
        </p>
        {/* Verify code */}
        <div
          className="mb-4 rounded-2xl p-4 text-center"
          style={{ background: 'rgba(34,197,94,.08)', border: `1.5px solid ${G3}` }}
        >
          <p style={{ fontSize: 12, color: MUTED, fontFamily: IT, marginBottom: 4 }}>
            Show driver code
          </p>
          <p
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 36,
              fontWeight: 700,
              color: G3,
              letterSpacing: 8,
            }}
          >
            7421
          </p>
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginTop: 4 }}>
            Confirm the code matches before boarding
          </p>
        </div>
        <GreenButton label="I'm in the car → Start Ride" onClick={onBoard || (() => {})} />
        <button
          className="mt-2 w-full py-2 text-center"
          style={{ fontSize: 12, color: MUTED, fontFamily: IT, background: 'transparent' }}
          onClick={onContact || (() => {})}
        >
          Not my driver? Contact support
        </button>
      </div>
    </div>
  );
}

// 18. DriverArrivedExtendedScreen
export function DriverArrivedExtendedScreen({
  onBack,
  onStart,
  onReport,
}: {
  onBack?: () => void;
  onStart?: () => void;
  onReport?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const waitSeconds = 134; // 2:14
  const freeSeconds = 180;
  const remaining = freeSeconds - waitSeconds;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="arrived" />
      </div>
      <div
        className="absolute inset-0 top-10"
        style={{
          background: 'linear-gradient(to bottom, transparent 30%, rgba(10,22,40,.95) 70%)',
          zIndex: 1,
        }}
      />
      <div className="absolute left-4 top-14" style={{ zIndex: 10 }}>
        <BackArrow onClick={onBack || (() => {})} />
      </div>
      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: NAVY_CARD, zIndex: 10, border: `1px solid ${BORDER}` }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: BORDER }} />
        <div className="mb-3 flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(34,197,94,.12)' }}
          >
            <span style={{ fontSize: 28 }}>🚗</span>
          </div>
        </div>
        <p
          style={{
            fontFamily: PP,
            fontSize: 18,
            fontWeight: 800,
            color: '#fff',
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          Your driver is here!
        </p>
        <p
          style={{
            fontSize: 13,
            color: TEXT_SECONDARY,
            fontFamily: IT,
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          White Toyota Camry • LAG 482 KA
        </p>
        {/* Timer */}
        <div
          className="mb-3 flex items-center justify-between rounded-2xl p-3.5"
          style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
        >
          <div>
            <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Waiting time</p>
            <p
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {fmt(waitSeconds)}
            </p>
          </div>
          <div className="text-right">
            <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Free time remaining</p>
            <p
              style={{
                fontFamily: PP,
                fontSize: 15,
                fontWeight: 700,
                color: remaining > 0 ? G3 : '#EF4444',
              }}
            >
              {fmt(remaining)} remaining
            </p>
          </div>
        </div>
        {waitSeconds >= 180 && (
          <div
            className="mb-3 rounded-xl p-3 text-center"
            style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}
          >
            <p style={{ fontSize: 12, color: '#F59E0B', fontFamily: IT }}>
              ₦30/min waiting fee applies
            </p>
          </div>
        )}
        {/* Verify code */}
        <div
          className="mb-3 rounded-2xl p-3 text-center"
          style={{ background: 'rgba(34,197,94,.08)', border: `1.5px solid ${G3}` }}
        >
          <p style={{ fontSize: 11, color: MUTED, fontFamily: IT, marginBottom: 2 }}>
            Show driver code
          </p>
          <p
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 28,
              fontWeight: 700,
              color: G3,
              letterSpacing: 8,
            }}
          >
            7421
          </p>
        </div>
        {/* Expandable tips */}
        <button
          className="mb-3 flex w-full items-center justify-between py-2"
          onClick={() => setExpanded(!expanded)}
        >
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, fontFamily: IT }}>
            Having trouble finding your driver?
          </p>
          <span style={{ color: G3, fontSize: 16 }}>{expanded ? '▲' : '▼'}</span>
        </button>
        {expanded && (
          <div
            className="mb-3 rounded-xl px-3 py-3"
            style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
          >
            {[
              'Check the plate number: LAG 482 KA',
              'Driver is in a white Toyota Camry',
              'Try calling — tap the Call button below',
              "Your pin is visible on driver's app",
            ].map((t) => (
              <p
                key={t}
                style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 4 }}
              >
                • {t}
              </p>
            ))}
          </div>
        )}
        <GreenButton label="I'm in the car → Start Ride" onClick={onStart || (() => {})} />
        <button
          className="mt-2 w-full py-2 text-center"
          style={{ fontSize: 12, color: '#EF4444', fontFamily: IT, background: 'transparent' }}
          onClick={onReport || (() => {})}
        >
          Report an issue
        </button>
      </div>
    </div>
  );
}

// 19. WalletPaySuccessScreen
export function WalletPaySuccessScreen({
  onDone,
  onReceipt,
}: {
  onDone?: () => void;
  onReceipt?: () => void;
}) {
  const confettiDots = Array.from({ length: 18 }).map((_, i) => ({
    x: Math.sin(i * 1.4) * 120 + 160,
    y: Math.cos(i * 1.2) * 100 + 200,
    color: [G3, '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6'][i % 5],
    size: 4 + (i % 3) * 3,
  }));

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{ background: NAVY_BASE, fontFamily: IT }}
    >
      <RideStatusBar />
      {/* Confetti dots */}
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
        {confettiDots.map((d, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: d.x,
              top: d.y,
              width: d.size,
              height: d.size,
              background: d.color,
              opacity: 0.6,
              animation: `bounce ${1.2 + (i % 3) * 0.3}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes drawCheck {
          from { stroke-dashoffset: 120; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes scaleCircle {
          from { stroke-dashoffset: 283; opacity: 0; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-12px); }
        }
      `}</style>
      {/* Content */}
      <div className="flex flex-col items-center px-6" style={{ zIndex: 1 }}>
        {/* Animated checkmark */}
        <div className="mb-6" style={{ width: 100, height: 100 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={G3}
              strokeWidth="4"
              strokeDasharray="283"
              style={{ animation: 'scaleCircle 0.6s ease-out forwards' }}
            />
            <path
              d="M28 50 L44 66 L72 36"
              fill="none"
              stroke={G3}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="120"
              strokeDashoffset="120"
              style={{ animation: 'drawCheck 0.5s ease-out 0.4s forwards' }}
            />
          </svg>
        </div>
        <p
          style={{ fontFamily: PP, fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 4 }}
        >
          ₦2,100 paid!
        </p>
        <p style={{ fontSize: 16, color: TEXT_SECONDARY, fontFamily: IT, marginBottom: 32 }}>
          Payment successful
        </p>
        {/* Receipt mini-card */}
        <div
          className="mb-8 w-full rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="mb-2 flex justify-between">
            <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Payment method</p>
            <p style={{ fontSize: 12, color: '#fff', fontFamily: IT }}>DrippleX Wallet 💜</p>
          </div>
          <div className="mb-2 flex justify-between">
            <p style={{ fontSize: 12, color: MUTED, fontFamily: IT }}>Time</p>
            <p style={{ fontSize: 12, color: '#fff', fontFamily: IT }}>Today, 9:41 AM</p>
          </div>
          <div className="my-2 h-px" style={{ background: BORDER }} />
          <div className="flex justify-between">
            <p style={{ fontSize: 11, color: MUTED, fontFamily: IT }}>Transaction ID</p>
            <p
              style={{
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontFamily: "'Courier New', monospace",
              }}
            >
              TXN-2024120500841
            </p>
          </div>
        </div>
        {/* Buttons */}
        <div className="flex w-full flex-col gap-3">
          <button
            className="h-12 w-full rounded-2xl text-sm font-semibold transition-all active:scale-[.97]"
            style={{
              background: 'transparent',
              border: `1.5px solid ${BORDER}`,
              color: TEXT_SECONDARY,
              fontFamily: PP,
            }}
            onClick={onReceipt || (() => {})}
          >
            View Receipt
          </button>
          <GreenButton label="Back to Home" onClick={onDone || (() => {})} />
        </div>
      </div>
    </div>
  );
}
