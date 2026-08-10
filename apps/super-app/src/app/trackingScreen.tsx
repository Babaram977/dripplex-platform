import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import type { OrderDto, CustomerDeliveryDto, DeliveryEtaDto, PaymentStatus } from '../lib/api';
import { G0, G2, G3, NAVY_BASE, NAVY_CARD, NAVY_DEEP, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { BottomNavigation, FloatingAIButton } from '../components/navigation';
import type { NavTabKey } from '../components/navigation/BottomNavigation';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
type UIStatus =
  'confirmed' | 'preparing' | 'accepted' | 'assigned' | 'on_the_way' | 'delivered' | 'cancelled';

const API_TO_UI: Record<string, UIStatus> = {
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  READY: 'accepted',
  DRIVER_ASSIGNED: 'assigned',
  PICKED_UP: 'on_the_way',
  IN_TRANSIT: 'on_the_way',
  DELIVERED: 'delivered',
  COMPLETED: 'delivered',
  CANCELLED: 'cancelled',
};

const STATUS_STEPS: { key: UIStatus; label: string; icon: string; sub: string }[] = [
  { key: 'confirmed', label: 'Order Confirmed', icon: '✓', sub: 'Payment received' },
  { key: 'preparing', label: 'Preparing Order', icon: '✓', sub: 'Your meal is being cooked' },
  { key: 'accepted', label: 'Ready for Pickup', icon: '✓', sub: 'Merchant confirmed ready' },
  { key: 'assigned', label: 'Driver Assigned', icon: '✓', sub: 'Rider heading to merchant' },
  { key: 'on_the_way', label: 'On the Way', icon: '🛵', sub: 'Rider is heading your way' },
  { key: 'delivered', label: 'Delivered', icon: '○', sub: 'Order delivered successfully' },
];

const STATUS_ORDER: UIStatus[] = STATUS_STEPS.map((s) => s.key);

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED MAP
// ─────────────────────────────────────────────────────────────────────────────
function LiveMap({ progress, etaMin }: { progress: number; etaMin: number }) {
  const W = 350,
    H = 200;
  const MX = 68,
    MY = 52;
  const CX = 278,
    CY = 158;
  const CP1X = 160,
    CP1Y = 30;
  const CP2X = 200,
    CP2Y = 178;
  const t = Math.min(1, Math.max(0, progress));
  const driverX =
    Math.pow(1 - t, 3) * MX +
    3 * Math.pow(1 - t, 2) * t * CP1X +
    3 * (1 - t) * t * t * CP2X +
    t * t * t * CX;
  const driverY =
    Math.pow(1 - t, 3) * MY +
    3 * Math.pow(1 - t, 2) * t * CP1Y +
    3 * (1 - t) * t * t * CP2Y +
    t * t * t * CY;
  const routeD = `M ${MX} ${MY} C ${CP1X} ${CP1Y}, ${CP2X} ${CP2Y}, ${CX} ${CY}`;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ height: H, background: '#0C1A2C' }}
    >
      <svg width={W} height={H} className="absolute inset-0" style={{ opacity: 0.55 }}>
        {[40, 80, 120, 160].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2={W} y2={y} stroke="#1E3A5F" strokeWidth="6" />
        ))}
        {[50, 120, 200, 280].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2={H} stroke="#1E3A5F" strokeWidth="6" />
        ))}
        {[80, 160].map((y) => (
          <line
            key={`cl${y}`}
            x1="0"
            y1={y}
            x2={W}
            y2={y}
            stroke="#243B55"
            strokeWidth="1.5"
            strokeDasharray="8 6"
          />
        ))}
        {[120, 280].map((x) => (
          <line
            key={`cv${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2={H}
            stroke="#243B55"
            strokeWidth="1.5"
            strokeDasharray="8 6"
          />
        ))}
        {[
          [20, 10, 24, 28],
          [100, 20, 32, 22],
          [155, 95, 28, 26],
          [230, 20, 38, 28],
          [290, 80, 30, 22],
          [30, 140, 24, 28],
          [175, 50, 26, 18],
        ].map(([x, y, w, h], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="3"
            fill="#112238"
            stroke="#1E3A5F"
            strokeWidth="0.5"
          />
        ))}
      </svg>
      <svg width={W} height={H} className="absolute inset-0">
        <path
          d={routeD}
          fill="none"
          stroke="rgba(43,172,82,.2)"
          strokeWidth="3"
          strokeDasharray="6 5"
        />
      </svg>
      <svg width={W} height={H} className="absolute inset-0">
        <defs>
          <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={G0} />
            <stop offset="100%" stopColor={G3} />
          </linearGradient>
        </defs>
        <path
          d={routeD}
          fill="none"
          stroke="url(#routeGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${progress * 340} 340`}
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ left: MX - 18, top: MY - 38 }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl text-xl"
          style={{
            background: 'linear-gradient(135deg,#7C2D12,#F97316)',
            border: '2px solid rgba(255,255,255,.2)',
            boxShadow: '0 4px 12px rgba(0,0,0,.5)',
          }}
        >
          🍗
        </div>
        <div
          className="h-0 w-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '7px solid #F97316',
          }}
        />
      </div>
      <div className="absolute flex flex-col items-center" style={{ left: CX - 18, top: CY - 38 }}>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            border: '2px solid rgba(255,255,255,.2)',
            boxShadow: '0 4px 12px rgba(43,172,82,.4)',
          }}
        >
          🏠
        </div>
        <div
          className="h-0 w-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `7px solid ${G2}`,
          }}
        />
      </div>
      <div
        className="absolute flex flex-col items-center"
        style={{
          left: driverX - 18,
          top: driverY - 38,
          transition: 'left 1.2s ease, top 1.2s ease',
        }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl"
          style={{
            background: '#FFF',
            border: `2.5px solid ${G2}`,
            boxShadow: `0 4px 16px rgba(43,172,82,.5), 0 0 0 4px rgba(43,172,82,.15)`,
            animation: 'glow-ring 2s ease-in-out infinite',
          }}
        >
          🛵
        </div>
      </div>
      <div
        className="absolute right-3 top-3 flex items-center gap-1.5 rounded-xl px-3 py-1.5"
        style={{
          background: 'rgba(6,14,28,.88)',
          border: `1px solid rgba(43,172,82,.35)`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: G3,
            boxShadow: `0 0 5px ${G3}`,
            animation: 'avatar-pulse 1.8s ease-in-out infinite',
          }}
        />
        <span className="text-[12px] font-bold" style={{ color: G3 }}>
          {etaMin > 0 ? `~${etaMin} min` : 'Arriving…'}
        </span>
      </div>
      <div
        className="absolute bottom-3 left-3 rounded-xl px-3 py-1"
        style={{
          background: 'rgba(6,14,28,.82)',
          border: `1px solid ${BORDER}`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span className="text-[11px]" style={{ color: MUTED }}>
          {progress < 1 ? 'En route' : 'Arrived'}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
function OrderTimeline({ currentStatus }: { currentStatus: UIStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  return (
    <div className="flex flex-col gap-0">
      {STATUS_STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const pending = i > currentIdx;
        return (
          <div key={step.key} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center" style={{ width: 32 }}>
              {i > 0 && (
                <div
                  className="h-3 w-0.5 shrink-0"
                  style={{ background: done || active ? G2 : BORDER }}
                />
              )}
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] transition-all duration-500"
                style={{
                  background: done ? G2 : active ? 'rgba(43,172,82,.18)' : 'rgba(255,255,255,.05)',
                  border: `2px solid ${done ? G2 : active ? G2 : BORDER}`,
                  boxShadow: active ? `0 0 0 4px rgba(43,172,82,.15)` : 'none',
                  fontFamily: "'Poppins',sans-serif",
                  fontWeight: 700,
                  color: done ? '#FFF' : active ? G3 : MUTED,
                }}
              >
                {done ? '✓' : active ? step.icon : ''}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className="w-0.5 flex-1"
                  style={{
                    minHeight: 16,
                    background: done ? G2 : BORDER,
                    transition: 'background .6s ease',
                  }}
                />
              )}
            </div>
            <div className="pb-4 pt-0.5">
              <p
                className="text-[13px] font-semibold leading-none"
                style={{
                  color: pending ? 'rgba(255,255,255,.3)' : active ? 'white' : G3,
                  fontFamily: "'Poppins',sans-serif",
                }}
              >
                {step.label}
                {active && (
                  <span
                    className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: 'rgba(43,172,82,.18)', color: G3 }}
                  >
                    LIVE
                  </span>
                )}
              </p>
              <p
                className="mt-0.5 text-[11px]"
                style={{ color: pending ? 'rgba(255,255,255,.18)' : MUTED }}
              >
                {step.sub}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER CARD
// ─────────────────────────────────────────────────────────────────────────────
function DriverCard({
  riderName,
  riderPhone,
}: {
  riderName: string | null;
  riderPhone: string | null;
}) {
  const initials = riderName
    ? riderName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'DR';
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="relative">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold"
            style={{
              background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
              border: `2px solid rgba(255,255,255,.1)`,
              color: '#FFF',
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            {initials}
          </div>
          <div
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full"
            style={{ background: G2, border: `2px solid ${NAVY_CARD}` }}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[15px] font-semibold text-white"
            style={{ fontFamily: "'Poppins',sans-serif" }}
          >
            {riderName ?? 'Your Rider'}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
            Delivery Partner
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: G3,
              boxShadow: `0 0 8px ${G3}`,
              animation: 'avatar-pulse 1.8s ease-in-out infinite',
            }}
          />
          <span className="text-[10px] font-semibold" style={{ color: G3 }}>
            LIVE
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        <a
          href={riderPhone ? `tel:${riderPhone}` : undefined}
          className="flex h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            boxShadow: `0 6px 18px rgba(43,172,82,.3)`,
            cursor: riderPhone ? 'pointer' : 'default',
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
          >
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 1.18 2 2 0 012.1 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
          Call
        </a>
        <button
          className="flex h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-all active:scale-95"
          style={{
            background: 'rgba(255,255,255,.06)',
            border: `1.5px solid ${BORDER}`,
            color: 'rgba(255,255,255,.75)',
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
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Message
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERED STATE
// ─────────────────────────────────────────────────────────────────────────────
function DeliveredScreen({
  orderNumber,
  onHome,
  onRate,
  hasRider,
}: {
  orderNumber?: string;
  onHome: () => void;
  onRate?: () => void;
  hasRider?: boolean;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 60%,#0B1D2F 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {['🟢', '✨', '💚', '⭐', '🎉', '💫', '🟩', '✅'].map((e, i) => (
          <div
            key={i}
            className="absolute text-base"
            style={{
              left: `${8 + i * 11}%`,
              top: '-16px',
              animation: `fade-up ${1.4 + (i % 5) * 0.2}s ease ${0.05 + i * 0.1}s both`,
              opacity: 0.75,
            }}
          >
            {e}
          </div>
        ))}
      </div>
      <div
        className="relative mb-6 flex items-center justify-center"
        style={{
          width: 128,
          height: 128,
          animation: 'success-bounce .7s cubic-bezier(.34,1.56,.64,1) .15s both',
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: `2px solid ${G2}`, animation: 'pulse-ring 1.5s ease-out .7s infinite' }}
        />
        <svg width="128" height="128" viewBox="0 0 128 128" fill="none" className="absolute">
          <circle
            cx="64"
            cy="64"
            r="58"
            stroke={`url(#dg2)`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="364"
            strokeDashoffset="364"
            style={{ animation: 'circle-draw .7s ease .25s both' }}
          />
          <defs>
            <linearGradient id="dg2" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
              <stop stopColor={G0} />
              <stop offset="1" stopColor={G3} />
            </linearGradient>
          </defs>
        </svg>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="absolute">
          <path
            d="M10 26l14 14 20-20"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="68"
            strokeDashoffset="68"
            style={{ animation: 'check-draw .45s ease .8s both' }}
          />
        </svg>
      </div>
      <div className="mb-6 flex flex-col items-center gap-2 px-8 text-center">
        <h2
          className="text-[28px] font-bold text-white"
          style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.025em' }}
        >
          Delivered!
        </h2>
        <p className="text-[14px]" style={{ color: MUTED }}>
          Your order has arrived. Enjoy your meal!
        </p>
        {orderNumber && (
          <div
            className="mt-2 flex items-center gap-2 rounded-2xl px-4 py-2"
            style={{ background: 'rgba(43,172,82,.12)', border: `1px solid rgba(43,172,82,.25)` }}
          >
            <span className="text-[13px]" style={{ color: MUTED }}>
              Order <span className="font-bold text-white">#{orderNumber}</span>
            </span>
          </div>
        )}
      </div>
      <div className="flex w-full flex-col gap-3 px-7">
        {hasRider && onRate && (
          <button
            onClick={onRate}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97]"
            style={{
              background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
              boxShadow: `0 10px 32px rgba(43,172,82,.36)`,
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            ⭐ Rate your rider
          </button>
        )}
        <button
          onClick={onHome}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold transition-all active:scale-[.97]"
          style={
            hasRider && onRate
              ? {
                  background: NAVY_SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: '#fff',
                  fontFamily: "'Poppins',sans-serif",
                }
              : {
                  background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
                  boxShadow: `0 10px 32px rgba(43,172,82,.36)`,
                  color: '#fff',
                  fontFamily: "'Poppins',sans-serif",
                }
          }
        >
          Continue Shopping
        </button>
      </div>
      <p className="mt-5 text-[11px] font-semibold tracking-widest" style={{ color: G2 }}>
        life,Simplified
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER HISTORY SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function OrderHistoryScreen({
  onBack,
  onOrder,
}: {
  onBack: () => void;
  onOrder: (orderId: string) => void;
}) {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchOrders = useCallback(
    async (p: number, append = false) => {
      try {
        const res = await api.orders.list({ page: p, pageSize: 15 });
        const items =
          (res as { items?: OrderDto[]; data?: OrderDto[] }).items ??
          (res as { data?: OrderDto[] }).data ??
          (Array.isArray(res) ? (res as OrderDto[]) : []);
        const total = (res as { total?: number }).total ?? items.length;
        setOrders((prev) => (append ? [...prev, ...items] : items));
        setHasMore(items.length === 15 && orders.length + items.length < total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load orders');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [orders.length],
  );

  useEffect(() => {
    fetchOrders(1);
  }, []);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    fetchOrders(next, true);
  };

  const statusColor = (s: string) => {
    if (s === 'DELIVERED' || s === 'COMPLETED') return G3;
    if (s === 'CANCELLED' || s === 'REFUNDED') return '#F87171';
    if (s === 'IN_TRANSIT' || s === 'PICKED_UP') return '#60A5FA';
    return '#FCD34D';
  };

  const statusBg = (s: string) => {
    if (s === 'DELIVERED' || s === 'COMPLETED') return 'rgba(43,172,82,.1)';
    if (s === 'CANCELLED' || s === 'REFUNDED') return 'rgba(248,113,113,.1)';
    if (s === 'IN_TRANSIT' || s === 'PICKED_UP') return 'rgba(96,165,250,.1)';
    return 'rgba(251,191,36,.1)';
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ background: NAVY_BASE }}>
      {/* Status bar */}
      <div
        className="flex shrink-0 items-center justify-between px-5 pb-1 pt-[52px]"
        style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: "'Inter',sans-serif" }}
      >
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="11" viewBox="0 0 17 12" fill="currentColor">
            <rect x="0" y="6" width="3" height="6" rx=".6" opacity=".4" />
            <rect x="4.5" y="3.5" width="3" height="8.5" rx=".6" opacity=".6" />
            <rect x="9" y="1" width="3" height="11" rx=".6" opacity=".85" />
            <rect x="13.5" y="0" width="3" height="12" rx=".6" />
          </svg>
          <svg width="24" height="11" viewBox="0 0 26 12" fill="currentColor">
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
            <rect x="2" y="2" width="17" height="8" rx="2" opacity=".6" />
            <path d="M24 4v4a2 2 0 000-4z" opacity=".4" />
          </svg>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-2">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}` }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p
            className="text-[18px] font-bold text-white"
            style={{ fontFamily: "'Poppins',sans-serif" }}
          >
            Order History
          </p>
          <p className="text-[11px]" style={{ color: MUTED }}>
            All your past orders
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}>Loading orders…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <p className="text-center text-[14px]" style={{ color: '#F87171' }}>
              {error}
            </p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                fetchOrders(1);
              }}
              className="h-10 rounded-xl px-5 text-[13px] font-semibold"
              style={{
                background: 'rgba(43,172,82,.12)',
                border: `1px solid rgba(43,172,82,.3)`,
                color: G3,
              }}
            >
              Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <span style={{ fontSize: 48 }}>🛍</span>
            <p
              className="text-[16px] font-semibold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              No orders yet
            </p>
            <p className="text-[13px]" style={{ color: MUTED }}>
              Your order history will appear here
            </p>
          </div>
        ) : (
          <>
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => onOrder(order.id)}
                className="mb-3 w-full rounded-2xl p-4 text-left transition-all active:scale-[.98]"
                style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[14px] font-semibold text-white"
                      style={{ fontFamily: "'Poppins',sans-serif" }}
                    >
                      Order #{order.orderNumber}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={{ background: statusBg(order.status), color: statusColor(order.status) }}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                {order.items && order.items.length > 0 && (
                  <p className="mb-2 truncate text-[12px]" style={{ color: MUTED }}>
                    {order.items.map((i) => `${i.quantity}× ${i.snapshotName}`).join(', ')}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <p
                    className="text-[15px] font-bold"
                    style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
                  >
                    ₦{order.total.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1" style={{ color: MUTED }}>
                    <span className="text-[11px]">View details</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="mb-4 h-11 w-full rounded-2xl text-[13px] font-medium"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                  opacity: loadingMore ? 0.5 : 1,
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TRACKING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export interface TrackingScreenProps {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  onHistory?: () => void;
  orderId?: string;
  // DPX-REVIEWS-001 — navigate to the rate-rider screen after a delivery.
  onRateRider?: (jobId: string, riderName?: string) => void;
}

export function TrackingScreen({
  onBack,
  onHome,
  onAccount,
  onNotifications,
  onHistory,
  orderId,
  onRateRider,
}: TrackingScreenProps) {
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [delivery, setDelivery] = useState<CustomerDeliveryDto | null>(null);
  const [eta, setEta] = useState<DeliveryEtaDto | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [driverProgress, setDriverProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<NavTabKey>('market');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const orderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deliveryPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const etaPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const payPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived UI status
  const uiStatus: UIStatus = order ? (API_TO_UI[order.status] ?? 'confirmed') : 'confirmed';
  const isDelivered = uiStatus === 'delivered';
  const isCancelled = uiStatus === 'cancelled';
  const hasRider = delivery?.riderId != null;

  // ── Fetch order (poll every 6s) ──────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const o = await api.orders.get(orderId);
      setOrder(o);
    } catch {
      /* keep last state */
    }
  }, [orderId]);

  // ── Fetch delivery + ETA + tracking (poll every 8s once rider assigned) ─
  const fetchDeliveryData = useCallback(async () => {
    if (!orderId) return;
    try {
      const [d, e, track] = await Promise.allSettled([
        api.orders.getDelivery(orderId),
        api.orders.getEta(orderId),
        api.orders.getTracking(orderId),
      ]);
      if (d.status === 'fulfilled') setDelivery(d.value);
      if (e.status === 'fulfilled') setEta(e.value);
      if (e.status === 'fulfilled' && e.value.remainingSeconds != null) {
        // Estimate progress: assume 15-minute total journey
        const totalSeconds = Math.max(e.value.remainingSeconds, 60);
        const elapsed = 900 - e.value.remainingSeconds; // 900s = 15 min baseline
        const prog = Math.min(0.98, Math.max(0, elapsed / 900));
        setDriverProgress(prog);
      }
      if (track.status === 'fulfilled' && Array.isArray(track.value) && track.value.length > 0) {
        const len = track.value.length;
        setDriverProgress((p) => Math.min(0.98, Math.max(p, len / Math.max(len + 3, 10))));
      }
    } catch {
      /* silent */
    }
  }, [orderId]);

  // ── Fetch payment status (poll every 10s) ────────────────────────────────
  const fetchPayment = useCallback(async () => {
    if (!orderId) return;
    try {
      const p = await api.orders.getPaymentStatus(orderId);
      setPaymentStatus((p as { status?: PaymentStatus }).status ?? null);
    } catch {
      /* silent */
    }
  }, [orderId]);

  // ── Mount: initial fetch + start polls ───────────────────────────────────
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    Promise.allSettled([fetchOrder(), fetchPayment()]).then(() => setLoading(false));

    orderPollRef.current = setInterval(fetchOrder, 6000);
    payPollRef.current = setInterval(fetchPayment, 10000);

    deliveryPollRef.current = setInterval(fetchDeliveryData, 8000);
    fetchDeliveryData(); // immediate first call

    return () => {
      if (orderPollRef.current) clearInterval(orderPollRef.current);
      if (deliveryPollRef.current) clearInterval(deliveryPollRef.current);
      if (etaPollRef.current) clearInterval(etaPollRef.current);
      if (payPollRef.current) clearInterval(payPollRef.current);
    };
  }, [orderId, fetchOrder, fetchDeliveryData, fetchPayment]);

  // ── Stop all polls when delivered / cancelled ─────────────────────────────
  useEffect(() => {
    if (isDelivered || isCancelled) {
      if (orderPollRef.current) clearInterval(orderPollRef.current);
      if (deliveryPollRef.current) clearInterval(deliveryPollRef.current);
      if (payPollRef.current) clearInterval(payPollRef.current);
      if (isDelivered) setDriverProgress(1);
    }
  }, [isDelivered, isCancelled]);

  const handleTabChange = useCallback(
    (tab: NavTabKey) => {
      setActiveTab(tab);
      if (tab === 'home') onHome();
      if (tab === 'profile') onAccount();
    },
    [onHome, onAccount],
  );

  const handleCancel = async () => {
    if (!orderId) return;
    setCancelling(true);
    setCancelError('');
    try {
      await api.orders.cancel(orderId, 'Cancelled by customer');
      setShowCancel(false);
      onHome();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Cancel failed. Try again.');
      setCancelling(false);
    }
  };

  const etaMin = eta ? Math.max(1, Math.ceil(eta.remainingSeconds / 60)) : 0;
  const totalDisplay = order ? `₦${order.total.toLocaleString()}` : '₦—';
  const orderNumber = order?.orderNumber ?? orderId?.slice(0, 8) ?? '—';
  const AI_PROMPTS = ['Where is my order?', 'When will it arrive?', 'Report an issue'];

  // ── No orderId fallback ───────────────────────────────────────────────────
  if (!orderId && !loading) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-4"
        style={{ background: NAVY_BASE }}
      >
        <span style={{ fontSize: 48 }}>📦</span>
        <p
          className="text-[16px] font-semibold text-white"
          style={{ fontFamily: "'Poppins',sans-serif" }}
        >
          No order selected
        </p>
        {onHistory && (
          <button
            onClick={onHistory}
            className="h-11 rounded-2xl px-6 text-[14px] font-semibold"
            style={{ background: `linear-gradient(135deg,${G0},${G2})`, color: '#FFF' }}
          >
            View Order History
          </button>
        )}
        <button onClick={onBack} className="text-[13px]" style={{ color: MUTED }}>
          Go back
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ background: NAVY_BASE }}
      >
        <p style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}>Loading order…</p>
      </div>
    );
  }

  if (isDelivered) {
    return (
      <DeliveredScreen
        orderNumber={orderNumber}
        onHome={onHome}
        hasRider={hasRider}
        onRate={
          delivery?.id && onRateRider
            ? () => onRateRider(delivery.id, delivery.riderName ?? undefined)
            : undefined
        }
      />
    );
  }

  if (isCancelled) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-5"
        style={{ background: NAVY_BASE }}
      >
        <span style={{ fontSize: 56 }}>❌</span>
        <p
          className="text-[22px] font-bold text-white"
          style={{ fontFamily: "'Poppins',sans-serif" }}
        >
          Order Cancelled
        </p>
        <p className="text-[13px]" style={{ color: MUTED }}>
          Order #{orderNumber} has been cancelled.
        </p>
        {order?.cancellationReason && (
          <p className="px-8 text-center text-[12px]" style={{ color: MUTED }}>
            Reason: {order.cancellationReason}
          </p>
        )}
        <button
          onClick={onHome}
          className="h-12 rounded-2xl px-8 text-[14px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  const currentStep = STATUS_STEPS.find((s) => s.key === uiStatus);
  const canCancel =
    order &&
    !['DRIVER_ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(
      order.status,
    );

  // Payment chip text
  const payChip =
    paymentStatus === 'PAID'
      ? { label: 'PAID', color: G3, bg: 'rgba(43,172,82,.12)' }
      : order?.paymentMethod === 'CASH'
        ? { label: 'Pay on delivery', color: '#FCD34D', bg: 'rgba(251,191,36,.1)' }
        : { label: 'PENDING', color: '#FCD34D', bg: 'rgba(251,191,36,.1)' };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      {/* Status bar */}
      <div
        className="flex shrink-0 items-center justify-between px-5 pb-1 pt-[52px]"
        style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: "'Inter',sans-serif" }}
      >
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="11" viewBox="0 0 17 12" fill="currentColor">
            <rect x="0" y="6" width="3" height="6" rx=".6" opacity=".4" />
            <rect x="4.5" y="3.5" width="3" height="8.5" rx=".6" opacity=".6" />
            <rect x="9" y="1" width="3" height="11" rx=".6" opacity=".85" />
            <rect x="13.5" y="0" width="3" height="12" rx=".6" />
          </svg>
          <svg width="24" height="11" viewBox="0 0 26 12" fill="currentColor">
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
            <rect x="2" y="2" width="17" height="8" rx="2" opacity=".6" />
            <path d="M24 4v4a2 2 0 000-4z" opacity=".4" />
          </svg>
        </div>
      </div>

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-90"
            style={{ background: 'rgba(255,255,255,.06)', border: `1px solid ${BORDER}` }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p
              className="text-[18px] font-bold leading-none text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              Track Order
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
              #{orderNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Payment chip */}
          <div
            className="flex h-7 items-center rounded-full px-3 text-[10px] font-bold"
            style={{ background: payChip.bg, color: payChip.color }}
          >
            {payChip.label}
          </div>
          {/* Live status pill */}
          <div
            className="flex h-8 items-center gap-1.5 rounded-full px-3"
            style={{ background: `rgba(43,172,82,.14)`, border: `1px solid rgba(43,172,82,.3)` }}
          >
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: G3, animation: 'avatar-pulse 1.8s ease-in-out infinite' }}
            />
            <span className="text-[11px] font-bold" style={{ color: G3 }}>
              {currentStep?.label ?? uiStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable */}
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ scrollbarWidth: 'none', paddingBottom: 100 }}
      >
        {/* Live Map */}
        <div className="mb-4">
          <LiveMap progress={driverProgress} etaMin={etaMin} />
        </div>

        {/* ETA hero */}
        <div
          className="mb-4 flex items-center justify-between rounded-2xl p-4"
          style={{
            background: `linear-gradient(135deg,${NAVY_SURFACE},rgba(43,172,82,.1))`,
            border: `1.5px solid rgba(43,172,82,.25)`,
          }}
        >
          <div>
            <p className="text-[12px]" style={{ color: MUTED }}>
              Estimated Arrival
            </p>
            <p
              className="text-[28px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif", lineHeight: 1.1 }}
            >
              {etaMin > 0 ? `~${etaMin} min` : hasRider ? 'Calculating…' : 'Pending rider'}
            </p>
            <p
              className="mt-1 text-[13px] font-bold"
              style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
            >
              {totalDisplay}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-4xl" style={{ animation: 'float-a 3s ease-in-out infinite' }}>
              🛵
            </div>
            <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
              {hasRider ? 'Rider assigned' : 'Awaiting rider'}
            </span>
          </div>
        </div>

        {/* Driver Card — only once rider is assigned */}
        {hasRider && (
          <div className="mb-4">
            <p
              className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              Your Rider
            </p>
            <DriverCard
              riderName={delivery?.riderName ?? null}
              riderPhone={delivery?.riderPhone ?? null}
            />
          </div>
        )}

        {/* Timeline */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Order Progress
          </p>
          <OrderTimeline currentStatus={uiStatus} />
        </div>

        {/* Ordered items (collapsible) */}
        {order && order.items && order.items.length > 0 && (
          <div
            className="mb-4 overflow-hidden rounded-2xl"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <button
              className="flex w-full items-center justify-between px-4 py-3.5"
              onClick={() => setItemsOpen((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[13px] font-semibold text-white"
                  style={{ fontFamily: "'Poppins',sans-serif" }}
                >
                  Ordered Items
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: 'rgba(255,255,255,.08)', color: MUTED }}
                >
                  {order.items.length}
                </span>
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
                  transform: itemsOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .25s',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {itemsOpen && (
              <div style={{ borderTop: `1px solid ${BORDER}` }}>
                {order.items.map((item, i) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom: i < order.items.length - 1 ? `1px solid ${BORDER}` : 'none',
                    }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl"
                      style={{ background: 'rgba(255,255,255,.05)' }}
                    >
                      🍽
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[13px] font-semibold text-white"
                        style={{ fontFamily: "'Poppins',sans-serif" }}
                      >
                        {item.quantity > 1 && <span style={{ color: G3 }}>{item.quantity}× </span>}
                        {item.snapshotName}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-[13px] font-semibold text-white"
                      style={{ fontFamily: "'Poppins',sans-serif" }}
                    >
                      ₦{item.subtotal.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: `1px solid ${BORDER}`, background: 'rgba(255,255,255,.02)' }}
                >
                  <span className="text-[12px]" style={{ color: MUTED }}>
                    Total
                  </span>
                  <span
                    className="text-[14px] font-bold"
                    style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
                  >
                    ₦{order.total.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI card */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{
            background: `linear-gradient(135deg,${NAVY_SURFACE},rgba(43,172,82,.08))`,
            border: `1px solid rgba(43,172,82,.2)`,
          }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
            >
              <span style={{ fontSize: 16 }}>✨</span>
            </div>
            <div>
              <p
                className="text-[13px] font-semibold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                Ask Drip
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Get updates on your delivery
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {AI_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setAiPrompt(p);
                  setShowAI(true);
                }}
                className="flex h-[28px] items-center gap-1 rounded-full px-3 text-[11px] font-medium transition-all active:scale-95"
                style={{
                  background: 'rgba(43,172,82,.12)',
                  border: `1px solid rgba(43,172,82,.24)`,
                  color: G3,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mb-4 flex gap-3">
          {onHistory && (
            <button
              onClick={onHistory}
              className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,.06)',
                border: `1px solid ${BORDER}`,
                color: 'rgba(255,255,255,.7)',
              }}
            >
              📋 Order History
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
              style={{
                background: 'rgba(248,113,113,.08)',
                border: `1px solid rgba(248,113,113,.22)`,
                color: '#F87171',
              }}
            >
              ✕ Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Floating AI */}
      <FloatingAIButton onPress={() => setShowAI((v) => !v)} bottom={80} />

      {/* Cancel sheet */}
      {showCancel && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={() => setShowCancel(false)}
        >
          <div
            className="flex flex-col gap-4 rounded-t-[32px] p-6"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              animation: 'fade-up .25s ease both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto h-1 w-10 rounded-full"
              style={{ background: 'rgba(255,255,255,.2)' }}
            />
            <div className="text-center">
              <span style={{ fontSize: 36 }}>⚠️</span>
              <p
                className="mb-1 mt-2 text-[17px] font-bold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                Cancel Order?
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
                This will cancel your order. Cancellation may incur a fee.
              </p>
            </div>
            {cancelError && (
              <p className="text-center text-[12px]" style={{ color: '#F87171' }}>
                {cancelError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancel(false);
                  setCancelError('');
                }}
                className="h-[48px] flex-1 rounded-2xl text-[14px] font-medium"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                }}
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="h-[48px] flex-1 rounded-2xl text-[14px] font-bold"
                style={{
                  background: 'rgba(248,113,113,.18)',
                  border: '1px solid rgba(248,113,113,.3)',
                  color: '#F87171',
                  opacity: cancelling ? 0.5 : 1,
                }}
              >
                {cancelling ? 'Cancelling…' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI sheet */}
      {showAI && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.7)' }}
          onClick={() => setShowAI(false)}
        >
          <div
            className="flex flex-col gap-4 rounded-t-[32px] p-6"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              animation: 'fade-up .25s ease both',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mx-auto h-1 w-10 rounded-full"
              style={{ background: 'rgba(255,255,255,.2)' }}
            />
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
              >
                <span style={{ fontSize: 18 }}>✨</span>
              </div>
              <div>
                <p
                  className="text-[15px] font-semibold text-white"
                  style={{ fontFamily: "'Poppins',sans-serif" }}
                >
                  Ask Drip
                </p>
                {aiPrompt && (
                  <p className="text-[12px]" style={{ color: G3 }}>
                    "{aiPrompt}"
                  </p>
                )}
              </div>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(43,172,82,.07)', border: `1px solid rgba(43,172,82,.18)` }}
            >
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,.72)', fontFamily: "'Inter',sans-serif" }}
              >
                {aiPrompt === 'Where is my order?' &&
                  `Your order #${orderNumber} is currently ${uiStatus.replace(/_/g, ' ')}. ${etaMin > 0 ? `Estimated arrival in ${etaMin} minutes.` : ''} 🛵`}
                {aiPrompt === 'When will it arrive?' &&
                  `${etaMin > 0 ? `Your order should arrive in approximately ${etaMin} minutes.` : 'Calculating arrival time…'} ⚡`}
                {aiPrompt === 'Report an issue' &&
                  `I can help you report an issue. Common options: Wrong items, Missing item, Driver not found, or Order arrived damaged. Shall I connect you to support?`}
                {!AI_PROMPTS.includes(aiPrompt) &&
                  `I'm monitoring your order in real-time. ${etaMin > 0 ? `${etaMin} minutes away.` : ''} Ask me anything!`}
              </p>
            </div>
            <button
              onClick={() => setShowAI(false)}
              className="h-[46px] rounded-2xl text-[14px] font-medium"
              style={{
                background: 'rgba(255,255,255,.06)',
                border: `1.5px solid ${BORDER}`,
                color: MUTED,
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
