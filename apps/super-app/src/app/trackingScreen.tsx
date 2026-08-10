import React, { useState, useEffect, useCallback, useRef } from 'react';
import { G0, G2, G3, NAVY_BASE, NAVY_CARD, NAVY_DEEP, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { api } from '../lib/api';
import type { OrderDto, CustomerDeliveryDto, DeliveryEtaDto } from '../lib/api';
import { BottomNavigation, FloatingAIButton } from '../components/navigation';
import type { NavTabKey } from '../components/navigation/BottomNavigation';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
type OrderStatus = 'confirmed' | 'accepted' | 'preparing' | 'assigned' | 'on_the_way' | 'delivered';

function mapApiStatus(order: OrderDto, delivery?: CustomerDeliveryDto | null): OrderStatus {
  const ds = delivery?.status;
  if (ds === 'DELIVERED') return 'delivered';
  if (ds === 'ON_THE_WAY' || ds === 'PICKED_UP') return 'on_the_way';
  if (ds === 'ASSIGNED' || ds === 'ACCEPTED') return 'assigned';
  switch (order.status) {
    case 'DELIVERED':
    case 'COMPLETED':
      return 'delivered';
    case 'IN_TRANSIT':
    case 'PICKED_UP':
      return 'on_the_way';
    case 'DRIVER_ASSIGNED':
      return 'assigned';
    case 'READY':
    case 'PREPARING':
      return 'preparing';
    case 'CONFIRMED':
      return 'accepted';
    default:
      return 'confirmed';
  }
}

const STATUS_STEPS: { key: OrderStatus; label: string; icon: string; sub: string }[] = [
  { key: 'confirmed', label: 'Order Confirmed', icon: '✓', sub: 'Payment received' },
  { key: 'accepted', label: 'Merchant Accepted', icon: '✓', sub: 'KFC Nigeria confirmed' },
  { key: 'preparing', label: 'Preparing Order', icon: '✓', sub: 'Your meal is being cooked' },
  { key: 'assigned', label: 'Driver Assigned', icon: '✓', sub: 'Emeka is heading to KFC' },
  { key: 'on_the_way', label: 'On the Way', icon: '🛵', sub: 'Emeka is 2.1 km away' },
  { key: 'delivered', label: 'Delivered', icon: '○', sub: 'Estimated in 8 min' },
];

const STATUS_ORDER: OrderStatus[] = STATUS_STEPS.map((s) => s.key);

interface OrderedItem {
  name: string;
  emoji: string;
  qty: number;
  price: string;
  variant: string;
}

const ORDERED_ITEMS: OrderedItem[] = [
  {
    name: 'Zinger Meal',
    emoji: '🍔',
    qty: 2,
    price: '₦9,600',
    variant: 'Large · Medium 🌶🌶 · Pepsi',
  },
  { name: 'Loaded Fries', emoji: '🍟', qty: 1, price: '₦2,200', variant: 'Regular' },
  { name: 'Coleslaw', emoji: '🥗', qty: 1, price: '₦900', variant: '300g' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED MAP
// ─────────────────────────────────────────────────────────────────────────────
function LiveMap({ progress }: { progress: number }) {
  // progress: 0–1, where 1 = driver at customer
  // Route is a cubic bezier: merchant (top-left area) → customer (bottom-right area)
  const W = 350,
    H = 200;
  const MX = 68,
    MY = 52; // Merchant pin
  const CX = 278,
    CY = 158; // Customer pin

  // Control points for smooth route
  const CP1X = 160,
    CP1Y = 30;
  const CP2X = 200,
    CP2Y = 178;

  // Compute driver position along cubic bezier
  const t = progress;
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
      {/* Grid roads */}
      <svg width={W} height={H} className="absolute inset-0" style={{ opacity: 0.55 }}>
        {/* Horizontal roads */}
        {[40, 80, 120, 160].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2={W} y2={y} stroke="#1E3A5F" strokeWidth="6" />
        ))}
        {/* Vertical roads */}
        {[50, 120, 200, 280].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2={H} stroke="#1E3A5F" strokeWidth="6" />
        ))}
        {/* Road center lines */}
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
        {/* Buildings */}
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

      {/* Route (full) — dashed grey */}
      <svg width={W} height={H} className="absolute inset-0">
        <path
          d={routeD}
          fill="none"
          stroke="rgba(43,172,82,.2)"
          strokeWidth="3"
          strokeDasharray="6 5"
        />
      </svg>

      {/* Route (travelled) */}
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

      {/* Merchant pin */}
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

      {/* Customer pin */}
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

      {/* Driver pin — animated */}
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

      {/* ETA bubble */}
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
          ~8 min
        </span>
      </div>

      {/* Distance badge */}
      <div
        className="absolute bottom-3 left-3 rounded-xl px-3 py-1"
        style={{
          background: 'rgba(6,14,28,.82)',
          border: `1px solid ${BORDER}`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span className="text-[11px]" style={{ color: MUTED }}>
          2.1 km remaining
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
function OrderTimeline({ currentStatus }: { currentStatus: OrderStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  return (
    <div className="flex flex-col gap-0">
      {STATUS_STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const pending = i > currentIdx;
        return (
          <div key={step.key} className="flex items-stretch gap-3">
            {/* Line + dot column */}
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
            {/* Text */}
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
  name,
  phone,
  onCall,
  onMessage,
}: {
  name: string;
  phone: string;
  onCall: () => void;
  onMessage: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div className="mb-3 flex items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
            style={{
              background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
              border: `2px solid rgba(255,255,255,.1)`,
            }}
          >
            👨🏿
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
            {name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-[12px] font-semibold text-white">4.9</span>
            <span className="text-[12px]" style={{ color: MUTED }}>
              · 1,842 deliveries
            </span>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
            {phone} ·{' '}
            <span className="font-semibold" style={{ color: 'rgba(255,255,255,.6)' }}>
              KNO-423-AA
            </span>
          </p>
        </div>
        {/* Live status */}
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
        <button
          onClick={onCall}
          className="flex h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white transition-all active:scale-95"
          style={{
            background: `linear-gradient(135deg,${G0},${G2})`,
            boxShadow: `0 6px 18px rgba(43,172,82,.3)`,
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
        </button>
        <button
          onClick={onMessage}
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
// COMPLETION STATE
// ─────────────────────────────────────────────────────────────────────────────
function DeliveredScreen({
  orderNum,
  onRate,
  onReorder,
  onReceipt,
  onHome,
}: {
  orderNum: string;
  onRate: () => void;
  onReorder: () => void;
  onReceipt: () => void;
  onHome: () => void;
}) {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 60%,#0B1D2F 100%)`,
      }}
    >
      {/* Particles */}
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

      {/* Animated check */}
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
            stroke={`url(#dg)`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="364"
            strokeDashoffset="364"
            style={{ animation: 'circle-draw .7s ease .25s both' }}
          />
          <defs>
            <linearGradient id="dg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
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
        <div
          className="mt-2 flex items-center gap-2 rounded-2xl px-4 py-2"
          style={{ background: 'rgba(43,172,82,.12)', border: `1px solid rgba(43,172,82,.25)` }}
        >
          <span className="text-[13px]" style={{ color: MUTED }}>
            Order <span className="font-bold text-white">{orderNum}</span>
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 px-7">
        <div className="flex gap-3">
          <button
            onClick={onRate}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97]"
            style={{
              background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
              boxShadow: `0 10px 32px rgba(43,172,82,.36)`,
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            ⭐ Rate
          </button>
          <button
            onClick={onReorder}
            className="h-[50px] flex-1 rounded-2xl text-[14px] font-semibold transition-all active:scale-[.97]"
            style={{
              background: 'rgba(255,255,255,.07)',
              border: `1.5px solid ${BORDER}`,
              color: 'rgba(255,255,255,.75)',
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            🔄 Reorder
          </button>
        </div>
        <button
          onClick={onReceipt}
          className="flex h-[44px] w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-medium transition-all active:scale-[.97]"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: `1px solid ${BORDER}`,
            color: MUTED,
            fontFamily: "'Poppins',sans-serif",
          }}
        >
          📄 Download Receipt
        </button>
        <button
          onClick={onHome}
          className="w-full py-2 text-[13px] font-medium transition-opacity active:opacity-60"
          style={{ color: MUTED }}
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
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export interface TrackingScreenProps {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  orderId?: string;
}

export function TrackingScreen({
  onBack,
  onHome,
  onAccount,
  onNotifications,
  orderId,
}: TrackingScreenProps) {
  const [status, setStatus] = useState<OrderStatus>('on_the_way');
  const [driverProgress, setDriverProgress] = useState(0.52);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<NavTabKey>('market');
  const [showCancel, setShowCancel] = useState(false);
  const [delivered, setDelivered] = useState(false);

  // Live API state
  const [liveOrder, setLiveOrder] = useState<OrderDto | null>(null);
  const [liveDelivery, setLiveDelivery] = useState<CustomerDeliveryDto | null>(null);
  const [liveEta, setLiveEta] = useState<DeliveryEtaDto | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!orderId) return;
    try {
      const [orderRes, deliveryRes, etaRes] = await Promise.allSettled([
        api.orders.get(orderId),
        api.orders.getDelivery(orderId),
        api.orders.getEta(orderId),
      ]);
      if (orderRes.status === 'fulfilled') {
        const order = orderRes.value;
        setLiveOrder(order);
        const delivery = deliveryRes.status === 'fulfilled' ? deliveryRes.value : null;
        if (deliveryRes.status === 'fulfilled') setLiveDelivery(deliveryRes.value);
        if (etaRes.status === 'fulfilled') setLiveEta(etaRes.value);
        const mapped = mapApiStatus(order, delivery);
        setStatus(mapped);
        if (mapped === 'delivered') setTimeout(() => setDelivered(true), 1200);
      }
      setPollError(null);
    } catch {
      setPollError('Connection issue — retrying…');
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    fetchAll();
    pollRef.current = setInterval(fetchAll, 7000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, fetchAll]);

  // Demo animation when no real orderId
  useEffect(() => {
    if (orderId || status !== 'on_the_way') return;
    const interval = setInterval(() => {
      setDriverProgress((p) => {
        const next = p + 0.018;
        if (next >= 1) {
          clearInterval(interval);
          setStatus('delivered');
          setTimeout(() => setDelivered(true), 1200);
          return 1;
        }
        return next;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [orderId, status]);

  const handleTabChange = useCallback(
    (tab: NavTabKey) => {
      setActiveTab(tab);
      if (tab === 'home') onHome();
      if (tab === 'profile') onAccount();
    },
    [onHome, onAccount],
  );

  const AI_PROMPTS = [
    'Where is my order?',
    'When will it arrive?',
    'Delay prediction',
    'Report an issue',
    'Reorder this',
  ];

  const etaMin = liveEta
    ? Math.max(1, Math.round(liveEta.remainingSeconds / 60))
    : Math.max(1, Math.round((1 - driverProgress) * 12));
  const displayOrderNum = liveOrder?.orderNumber ?? '#DRX-2026-0124';
  const riderName = liveDelivery?.riderName ?? 'Emeka Okafor';
  const riderPhone = liveDelivery?.riderPhone ?? '+234 801 234 5678';

  if (delivered) {
    return (
      <DeliveredScreen
        orderNum={displayOrderNum}
        onRate={() => {}}
        onReorder={onHome}
        onReceipt={() => {}}
        onHome={onHome}
      />
    );
  }

  const currentStep = STATUS_STEPS.find((s) => s.key === status);

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
              {displayOrderNum} · {liveOrder ? 'Your Order' : 'KFC Nigeria'}
            </p>
          </div>
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
            {currentStep?.label}
          </span>
        </div>
      </div>

      {/* Scrollable */}
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ scrollbarWidth: 'none', paddingBottom: 100 }}
      >
        {pollError && (
          <div
            className="mb-3 flex items-center gap-2.5 rounded-xl px-4 py-2.5"
            style={{
              background: 'rgba(248,113,113,.08)',
              border: '1px solid rgba(248,113,113,.22)',
            }}
          >
            <span className="text-sm">📡</span>
            <span className="text-[11px]" style={{ color: '#F87171' }}>
              {pollError}
            </span>
          </div>
        )}

        {/* Live Map */}
        <div className="mb-4">
          <LiveMap progress={driverProgress} />
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
              ~{etaMin} min
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: G3 }}>
              12 Murtala Way, GRA · Kano
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-4xl" style={{ animation: 'float-a 3s ease-in-out infinite' }}>
              🛵
            </div>
            <span className="text-[11px] font-semibold" style={{ color: MUTED }}>
              2.1 km away
            </span>
          </div>
        </div>

        {/* Driver Card */}
        <div className="mb-4">
          <p
            className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Your Driver
          </p>
          <DriverCard
            name={riderName}
            phone={riderPhone}
            onCall={() => {
              if (riderPhone) window.open(`tel:${riderPhone}`);
            }}
            onMessage={() => {}}
          />
        </div>

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
          <OrderTimeline currentStatus={status} />
        </div>

        {/* Merchant info */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
              style={{ background: 'linear-gradient(135deg,#7C2D12,#F97316)' }}
            >
              🍗
            </div>
            <div className="flex-1">
              <p
                className="text-[14px] font-semibold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                KFC Nigeria
              </p>
              <div className="flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="text-[12px]" style={{ color: MUTED }}>
                  4.6 · 1,284 reviews
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {[
                { icon: '📞', label: 'Call' },
                { icon: '🏪', label: 'Store' },
              ].map((btn) => (
                <button
                  key={btn.label}
                  className="h-8 rounded-xl px-3 text-[11px] font-semibold transition-all active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,.06)',
                    border: `1px solid ${BORDER}`,
                    color: MUTED,
                  }}
                >
                  {btn.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ordered items (collapsible) */}
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
                {ORDERED_ITEMS.length}
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
              {ORDERED_ITEMS.map((item, i) => (
                <div
                  key={item.name}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: i < ORDERED_ITEMS.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{ background: 'rgba(255,255,255,.05)' }}
                  >
                    {item.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[13px] font-semibold text-white"
                      style={{ fontFamily: "'Poppins',sans-serif" }}
                    >
                      {item.qty > 1 && <span style={{ color: G3 }}>{item.qty}× </span>}
                      {item.name}
                    </p>
                    <p className="truncate text-[11px]" style={{ color: MUTED }}>
                      {item.variant}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[13px] font-semibold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    {item.price}
                  </span>
                </div>
              ))}
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: `1px solid ${BORDER}`, background: 'rgba(255,255,255,.02)' }}
              >
                <span className="text-[12px]" style={{ color: MUTED }}>
                  Total paid
                </span>
                <span
                  className="text-[14px] font-bold"
                  style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
                >
                  ₦12,700
                </span>
              </div>
            </div>
          )}
        </div>

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
          <button
            className="flex h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,.06)',
              border: `1px solid ${BORDER}`,
              color: 'rgba(255,255,255,.7)',
            }}
          >
            📤 Share Tracking
          </button>
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
        </div>

        <button
          className="flex h-[40px] w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
          style={{
            background: 'rgba(251,191,36,.06)',
            border: `1px solid rgba(251,191,36,.18)`,
            color: '#FCD34D',
          }}
        >
          ⚠️ Report an Issue
        </button>
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
                Your driver is already heading to KFC. Cancellation may incur a fee of up to ₦300.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancel(false)}
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
                onClick={() => {
                  setShowCancel(false);
                  onHome();
                }}
                className="h-[48px] flex-1 rounded-2xl text-[14px] font-bold"
                style={{
                  background: 'rgba(248,113,113,.18)',
                  border: '1px solid rgba(248,113,113,.3)',
                  color: '#F87171',
                }}
              >
                Cancel
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
                  `Your driver Emeka is ${1 - driverProgress < 0.2 ? 'almost at your door' : '~2.1 km from your address'}. Estimated arrival in ${etaMin} minutes. 🛵`}
                {aiPrompt === 'When will it arrive?' &&
                  `Based on current traffic and driver speed, your order should arrive in approximately ${etaMin} minutes. Emeka is making great progress! ⚡`}
                {aiPrompt === 'Delay prediction?' &&
                  `No significant delays detected on the route. Traffic on Murtala Way is light right now. Your order should arrive on time. ✅`}
                {aiPrompt === 'Report an issue' &&
                  `I can help you report an issue. Common options: Wrong items, Missing item, Driver not moving, or Arrived damaged. Shall I connect you to support?`}
                {aiPrompt === 'Reorder this' &&
                  `I can save your current order (Zinger Meal ×2, Loaded Fries, Coleslaw) as a favourite for one-tap reordering. Would you like to save it? 💾`}
                {!AI_PROMPTS.includes(aiPrompt) &&
                  `I'm monitoring your order in real-time. Emeka is ${etaMin} minutes away. Ask me anything about your delivery!`}
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
