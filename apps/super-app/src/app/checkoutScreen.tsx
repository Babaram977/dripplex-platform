import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { G0, G2, G3, NAVY_BASE, NAVY_CARD, NAVY_DEEP, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { api } from '../lib/api';
import type { OrderDto, CustomerAddressDto } from '../lib/api';
import { BottomNavigation } from '../components/navigation';
import type { NavTabKey } from '../components/navigation/BottomNavigation';
import { auth } from '../lib/auth';
import { getCurrentPosition, reverseGeocode } from '../lib/maps';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Address {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  name: string;
  phone: string;
  line1: string;
  line2: string;
}
type PaymentKey = 'CASH' | 'MERCHANT_DIRECT';
type DeliveryMode = 'standard' | 'express' | 'pickup';
type ScheduleMode = 'now' | 'later';

interface CheckoutMerchant {
  id: string;
  name: string;
  emoji: string;
  coverBg: string;
  isVerified: boolean;
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  cashback: number;
  eta: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
const ADDRESSES: Address[] = [
  {
    id: 'a1',
    label: 'Home',
    name: '',
    phone: '+234 801 234 5678',
    line1: '12 Murtala Way, GRA',
    line2: 'Kano, Kano State',
  },
  {
    id: 'a2',
    label: 'Work',
    name: '',
    phone: '+234 801 234 5678',
    line1: 'DrippleX HQ, 4 Tech Crescent',
    line2: 'Abuja, FCT',
  },
];

const MERCHANTS: CheckoutMerchant[] = [
  {
    id: 'kfc',
    name: 'KFC Nigeria',
    emoji: '🍗',
    coverBg: 'linear-gradient(135deg,#7C2D12,#F97316)',
    isVerified: true,
    itemCount: 3,
    subtotal: 15100,
    deliveryFee: 350,
    cashback: 240,
    eta: '18–25 min',
  },
  {
    id: 'shoprite',
    name: 'Shoprite Kano',
    emoji: '🛒',
    coverBg: 'linear-gradient(135deg,#1D4ED8,#06B6D4)',
    isVerified: true,
    itemCount: 2,
    subtotal: 10900,
    deliveryFee: 500,
    cashback: 180,
    eta: '35–50 min',
  },
];

const PAYMENT_METHODS: { key: PaymentKey; icon: string; label: string; sub: string }[] = [
  {
    key: 'CASH',
    icon: '💵',
    label: 'Cash on Delivery',
    sub: 'Pay the rider when your order arrives',
  },
  {
    key: 'MERCHANT_DIRECT',
    icon: '🏦',
    label: 'Pay to Merchant Bank',
    sub: "Transfer to merchant's account directly",
  },
];

const fmt = (n: number) => `₦${n.toLocaleString()}`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest"
      style={{ color: MUTED }}
    >
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADDRESS CARD
// ─────────────────────────────────────────────────────────────────────────────
function AddressSection({
  address,
  onChangeAddress,
  onUseLocation,
  busy,
}: {
  address: Address;
  onChangeAddress: () => void;
  onUseLocation?: () => void;
  busy?: boolean;
}) {
  const labelColors: Record<Address['label'], string> = {
    Home: G2,
    Work: '#60A5FA',
    Other: '#A78BFA',
  };
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: 'rgba(43,172,82,.12)' }}
        >
          📍
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="text-[13px] font-semibold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {address.name}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: `${labelColors[address.label]}22`,
                color: labelColors[address.label],
              }}
            >
              {address.label}
            </span>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
            {address.phone}
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
            {address.line1}
          </p>
          <p className="text-[12px]" style={{ color: MUTED }}>
            {address.line2}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
        {[
          { label: 'Change Address', icon: '✏️', fn: onChangeAddress },
          {
            label: busy ? 'Locating…' : 'Use My Location',
            icon: '📌',
            fn: onUseLocation ?? onChangeAddress,
          },
        ].map((btn) => (
          <button
            key={btn.icon}
            onClick={btn.fn}
            disabled={busy}
            className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,.05)',
              border: `1px solid ${BORDER}`,
              color: MUTED,
            }}
          >
            <span>{btn.icon}</span>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MERCHANT CHECKOUT CARD
// ─────────────────────────────────────────────────────────────────────────────
function MerchantCard({
  merchant,
  mode,
  note,
  schedule,
  onMode,
  onNote,
  onSchedule,
}: {
  merchant: CheckoutMerchant;
  mode: DeliveryMode;
  note: string;
  schedule: ScheduleMode;
  onMode: (m: DeliveryMode) => void;
  onNote: (v: string) => void;
  onSchedule: (v: ScheduleMode) => void;
}) {
  const [open, setOpen] = useState(true);
  const fee =
    mode === 'pickup' ? 0 : mode === 'express' ? merchant.deliveryFee * 2 : merchant.deliveryFee;

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
    >
      <button
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: merchant.coverBg }}
        >
          {merchant.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[14px] font-semibold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {merchant.name}
            </span>
            {merchant.isVerified && (
              <div
                className="flex h-4 w-4 items-center justify-center rounded-full"
                style={{ background: G2 }}
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
            )}
          </div>
          <span className="text-[11px]" style={{ color: MUTED }}>
            {merchant.itemCount} items · {fmt(merchant.subtotal)} · ⚡ {merchant.eta}
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
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .25s',
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="flex gap-2 pt-3">
            {[
              {
                key: 'standard' as const,
                label: 'Standard',
                icon: '🚚',
                sub: fmt(merchant.deliveryFee),
              },
              {
                key: 'express' as const,
                label: 'Express',
                icon: '⚡',
                sub: fmt(merchant.deliveryFee * 2),
              },
              { key: 'pickup' as const, label: 'Pickup', icon: '🏪', sub: 'Free' },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => onMode(opt.key)}
                className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 transition-all active:scale-95"
                style={{
                  background: mode === opt.key ? 'rgba(43,172,82,.14)' : 'rgba(255,255,255,.04)',
                  border: `1.5px solid ${mode === opt.key ? G2 : BORDER}`,
                }}
              >
                <span className="text-base">{opt.icon}</span>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: mode === opt.key ? G3 : 'rgba(255,255,255,.65)' }}
                >
                  {opt.label}
                </span>
                <span className="text-[10px]" style={{ color: mode === opt.key ? G3 : MUTED }}>
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {[['now', 'Deliver Now', '🕐'] as const, ['later', 'Schedule', '📅'] as const].map(
              ([k, l, icon]) => (
                <button
                  key={k}
                  onClick={() => onSchedule(k)}
                  className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
                  style={{
                    background: schedule === k ? 'rgba(43,172,82,.14)' : 'rgba(255,255,255,.04)',
                    border: `1.5px solid ${schedule === k ? G2 : BORDER}`,
                    color: schedule === k ? G3 : MUTED,
                  }}
                >
                  {icon} {l}
                </button>
              ),
            )}
          </div>
          {schedule === 'later' && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
            >
              <span>📅</span>
              <span className="text-[12px]" style={{ color: 'rgba(255,255,255,.55)' }}>
                Today, 7:00 PM
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G3}
                strokeWidth="2.5"
                strokeLinecap="round"
                className="ml-auto"
              >
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          )}

          <div
            className="flex h-[38px] items-center gap-2 rounded-xl px-3"
            style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={MUTED}
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <input
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="Delivery note (optional)"
              className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/25"
              style={{ fontFamily: "'Inter',sans-serif" }}
            />
          </div>

          <div className="flex flex-col gap-1 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
            {[
              { label: 'Subtotal', value: fmt(merchant.subtotal) },
              { label: 'Delivery', value: fee === 0 ? 'FREE' : fmt(fee), highlight: fee === 0 },
              { label: 'Cashback', value: `+${fmt(merchant.cashback)}`, green: true },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between text-[12px]">
                <span style={{ color: MUTED }}>{r.label}</span>
                <span style={{ color: r.green ? G3 : r.highlight ? G3 : 'rgba(255,255,255,.75)' }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER SUCCESS SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function OrderSuccess({
  orderNum,
  eta,
  onTrack,
  onContinue,
}: {
  orderNum: string;
  eta: string;
  onTrack: () => void;
  onContinue: () => void;
}) {
  const CONFETTI = ['🟢', '✨', '💚', '⭐', '🎉', '💫'];
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(155deg,${NAVY_DEEP} 0%,${NAVY_BASE} 60%,#0B1D2F 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-lg"
            style={{
              left: `${5 + ((i * 5.3) % 90)}%`,
              top: '-16px',
              animation: `fade-up ${1.2 + (i % 5) * 0.22}s ease ${0.1 + (i % 9) * 0.12}s both`,
              opacity: 0.7,
            }}
          >
            {CONFETTI[i % CONFETTI.length]}
          </div>
        ))}
      </div>

      <div
        className="relative mb-6 flex items-center justify-center"
        style={{
          width: 128,
          height: 128,
          animation: 'success-bounce .7s cubic-bezier(.34,1.56,.64,1) .1s both',
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: `2px solid ${G2}`, animation: 'pulse-ring 1.4s ease-out .6s infinite' }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: `2px solid ${G2}`, animation: 'pulse-ring 1.4s ease-out .9s infinite' }}
        />
        <svg width="128" height="128" viewBox="0 0 128 128" fill="none" className="absolute">
          <circle
            cx="64"
            cy="64"
            r="58"
            stroke="url(#cg)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="364"
            strokeDashoffset="364"
            style={{ animation: 'circle-draw .7s ease .2s both' }}
          />
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
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
            style={{ animation: 'check-draw .45s ease .75s both' }}
          />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-3 px-8 text-center">
        <h2
          className="text-[28px] font-bold text-white"
          style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.025em' }}
        >
          Order Confirmed!
        </h2>
        <p className="text-[14px]" style={{ color: MUTED }}>
          Your order has been placed successfully.
        </p>
        <div className="mt-1 flex items-center gap-3">
          <div
            className="flex flex-col items-center rounded-2xl px-4 py-2"
            style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.25)' }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              Order ID
            </span>
            <span
              className="text-[14px] font-bold"
              style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
            >
              {orderNum}
            </span>
          </div>
          <div
            className="flex flex-col items-center rounded-2xl px-4 py-2"
            style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.25)' }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: MUTED }}
            >
              ETA
            </span>
            <span
              className="text-[14px] font-bold"
              style={{ color: G3, fontFamily: "'Poppins',sans-serif" }}
            >
              {eta}
            </span>
          </div>
        </div>
        <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
          Tracking updates will be sent to your phone.
        </p>
      </div>

      <div className="mt-8 flex w-full flex-col gap-3 px-7">
        <button
          onClick={onTrack}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[.97]"
          style={{
            background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
            boxShadow: '0 10px 32px rgba(43,172,82,.36)',
            fontFamily: "'Poppins',sans-serif",
          }}
        >
          Track My Order 📦
        </button>
        <button
          onClick={onContinue}
          className="h-[50px] w-full rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
          style={{
            background: 'rgba(255,255,255,.05)',
            border: `1.5px solid ${BORDER}`,
            color: MUTED,
            fontFamily: "'Poppins',sans-serif",
          }}
        >
          Continue Shopping
        </button>
      </div>

      <p className="mt-6 text-[11px] font-semibold tracking-widest" style={{ color: G2 }}>
        life,Simplified
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BANNER
// ─────────────────────────────────────────────────────────────────────────────
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(248,113,113,.08)',
        border: '1.5px solid rgba(248,113,113,.28)',
        animation: 'fade-up .3s ease both',
      }}
    >
      <span className="mt-0.5 text-xl">⚠️</span>
      <div className="min-w-0 flex-1">
        <p
          className="text-[13px] font-semibold"
          style={{ color: '#F87171', fontFamily: "'Poppins',sans-serif" }}
        >
          Checkout Error
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: MUTED }}>
          {message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="flex h-6 w-6 items-center justify-center opacity-50 active:opacity-80"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export interface CheckoutScreenProps {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  onOrderTracking?: (orderId: string) => void;
}

export function CheckoutScreen({
  onBack,
  onHome,
  onAccount,
  onNotifications,
  onOrderTracking,
}: CheckoutScreenProps) {
  const [addressIdx, setAddressIdx] = useState(0);
  const [paymentKey, setPaymentKey] = useState<PaymentKey>('CASH');
  const [termsChecked, setTermsChecked] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddrSheet, setShowAddrSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTabKey>('market');

  // §3a payment flow
  const [pendingOrder, setPendingOrder] = useState<OrderDto | null>(null);
  const [bankDetails, setBankDetails] = useState<{
    bankName: string;
    accountName: string;
    accountNumber: string;
    currency: string;
  } | null>(null);
  const [showBankSheet, setShowBankSheet] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [confirmedOrderNum, setConfirmedOrderNum] = useState<string>('#DRX-XXXX');

  const [modes, setModes] = useState<Record<string, DeliveryMode>>({
    kfc: 'standard',
    shoprite: 'standard',
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [schedules, setSchedules] = useState<Record<string, ScheduleMode>>({
    kfc: 'now',
    shoprite: 'now',
  });

  const recipientName = auth.displayName(auth.getUser());

  // Real delivery addresses from the backend (every customer, not just seeded ones).
  const [realAddresses, setRealAddresses] = useState<CustomerAddressDto[] | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addrBusy, setAddrBusy] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!auth.isLoggedIn()) return;
    try {
      const res = await api.addresses.list();
      const list = res.items ?? [];
      setRealAddresses(list);
      setSelectedAddressId(
        (prev) => prev ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null,
      );
    } catch {
      setRealAddresses([]);
    }
  }, []);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  // "Use My Location": browser geolocation → (Google) reverse-geocode → create a
  // real CustomerAddress. Works for any customer; makes the delivery-address rule
  // passable through the UI instead of being pre-seeded.
  const handleUseMyLocation = useCallback(async () => {
    setAddrBusy(true);
    setAddrError(null);
    try {
      const pos = await getCurrentPosition();
      if (!pos) {
        setAddrError('Location permission is needed to set your delivery address.');
        return;
      }
      const geo = await reverseGeocode(pos);
      const user = auth.getUser();
      const created = await api.addresses.create({
        label: 'HOME',
        recipientName: recipientName || 'Customer',
        phone: user?.phone ?? '',
        addressLine1: geo?.addressLine1 || 'Current location',
        city: geo?.city || 'Lagos',
        state: geo?.state || 'Lagos',
        country: geo?.country || 'Nigeria',
        postalCode: geo?.postalCode,
        latitude: pos.latitude,
        longitude: pos.longitude,
        isDefault: !(realAddresses && realAddresses.length > 0),
      });
      setSelectedAddressId(created.id);
      await loadAddresses();
      setShowAddrSheet(false);
    } catch (e: unknown) {
      setAddrError(e instanceof Error ? e.message : 'Could not save your location.');
    } finally {
      setAddrBusy(false);
    }
  }, [recipientName, realAddresses, loadAddresses]);

  // Mock fallback only for the standalone design-preview (logged-out) navigator.
  const addresses = useMemo(
    () => ADDRESSES.map((a) => ({ ...a, name: recipientName || a.name })),
    [recipientName],
  );
  const selectedRealAddress =
    realAddresses?.find((a) => a.id === selectedAddressId) ?? realAddresses?.[0] ?? null;
  const labelMap: Record<string, Address['label']> = {
    HOME: 'Home',
    WORK: 'Work',
    OTHER: 'Other',
  };
  const address: Address = selectedRealAddress
    ? {
        id: selectedRealAddress.id,
        label: labelMap[selectedRealAddress.label] ?? 'Home',
        name: selectedRealAddress.recipientName,
        phone: selectedRealAddress.phone,
        line1: selectedRealAddress.addressLine1,
        line2: `${selectedRealAddress.city}, ${selectedRealAddress.state}`,
      }
    : addresses[addressIdx];
  const itemsTotal = MERCHANTS.reduce((s, m) => s + m.subtotal, 0);
  const deliveryTotal = MERCHANTS.reduce((s, m) => {
    const mode = modes[m.id] ?? 'standard';
    return s + (mode === 'pickup' ? 0 : mode === 'express' ? m.deliveryFee * 2 : m.deliveryFee);
  }, 0);
  const promoSavings = 500;
  const cashbackTotal = MERCHANTS.reduce((s, m) => s + m.cashback, 0);
  const grandTotal = itemsTotal + deliveryTotal - promoSavings;

  // Step 1: cart → order, then branch on payment method
  const handlePlaceOrder = async () => {
    if (!termsChecked) return;

    // A delivery address is required. Use the selected one; if the customer has
    // none, prompt them to set it (via "Use My Location") rather than silently
    // failing at the API.
    let deliveryAddressId = selectedAddressId ?? selectedRealAddress?.id ?? null;
    if (!deliveryAddressId) {
      setError('Add a delivery address to continue.');
      setShowAddrSheet(true);
      return;
    }

    setPlacing(true);
    setError(null);
    try {
      const { order } = await api.orders.checkout({
        fulfillmentType: 'DELIVERY',
        deliveryAddressId,
      });
      setPendingOrder(order);

      if (paymentKey === 'MERCHANT_DIRECT') {
        const bank = await api.orders.getMerchantBank(order.id);
        setBankDetails(bank);
        setPlacing(false);
        setShowBankSheet(true);
        return;
      }

      // CASH: pay immediately
      await api.orders.pay(order.id, { provider: 'CASH' });
      setConfirmedOrderId(order.id);
      setConfirmedOrderNum(order.orderNumber);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  // Step 2 (MERCHANT_DIRECT): user confirms they've transferred
  const handleConfirmBankTransfer = async () => {
    if (!pendingOrder) return;
    setPaying(true);
    try {
      await api.orders.pay(pendingOrder.id, { provider: 'MERCHANT_DIRECT' });
      setConfirmedOrderId(pendingOrder.id);
      setConfirmedOrderNum(pendingOrder.orderNumber);
      setShowBankSheet(false);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Payment confirmation failed.');
    } finally {
      setPaying(false);
    }
  };

  const handleTabChange = useCallback(
    (tab: NavTabKey) => {
      setActiveTab(tab);
      if (tab === 'home') onHome();
      if (tab === 'profile') onAccount();
    },
    [onHome, onAccount],
  );

  if (success) {
    return (
      <OrderSuccess
        orderNum={confirmedOrderNum}
        eta="18–25 min"
        onTrack={() => {
          if (confirmedOrderId) onOrderTracking?.(confirmedOrderId);
          else onHome();
        }}
        onContinue={onHome}
      />
    );
  }

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
              Checkout
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
              Review and confirm your order
            </p>
          </div>
        </div>
        <div
          className="flex h-8 items-center gap-1.5 rounded-full px-3"
          style={{ background: 'rgba(43,172,82,.12)', border: '1px solid rgba(43,172,82,.25)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={G3}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-[11px] font-semibold" style={{ color: G3 }}>
            Secure
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ scrollbarWidth: 'none', paddingBottom: 120 }}
      >
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="mb-4">
          <SectionLabel>Delivery Address</SectionLabel>
          <AddressSection
            address={address}
            onChangeAddress={() => setShowAddrSheet(true)}
            onUseLocation={handleUseMyLocation}
            busy={addrBusy}
          />
        </div>

        <div className="mb-4">
          <SectionLabel>Order Details ({MERCHANTS.length} Merchants)</SectionLabel>
          <div className="flex flex-col gap-3">
            {MERCHANTS.map((m) => (
              <MerchantCard
                key={m.id}
                merchant={m}
                mode={modes[m.id] ?? 'standard'}
                note={notes[m.id] ?? ''}
                schedule={schedules[m.id] ?? 'now'}
                onMode={(v) => setModes((p) => ({ ...p, [m.id]: v }))}
                onNote={(v) => setNotes((p) => ({ ...p, [m.id]: v }))}
                onSchedule={(v) => setSchedules((p) => ({ ...p, [m.id]: v }))}
              />
            ))}
          </div>
        </div>

        {/* Payment method */}
        <div className="mb-4">
          <SectionLabel>Payment Method</SectionLabel>
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            {PAYMENT_METHODS.map((pm, i) => (
              <button
                key={pm.key}
                onClick={() => setPaymentKey(pm.key)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all"
                style={{
                  background: paymentKey === pm.key ? 'rgba(43,172,82,.08)' : 'transparent',
                  borderBottom: i < PAYMENT_METHODS.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{
                    background:
                      paymentKey === pm.key ? 'rgba(43,172,82,.18)' : 'rgba(255,255,255,.05)',
                  }}
                >
                  {pm.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-semibold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    {pm.label}
                  </p>
                  <p className="text-[11px]" style={{ color: paymentKey === pm.key ? G3 : MUTED }}>
                    {pm.sub}
                  </p>
                </div>
                <div
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                  style={{ borderColor: paymentKey === pm.key ? G2 : BORDER }}
                >
                  {paymentKey === pm.key && (
                    <div className="h-2 w-2 rounded-full" style={{ background: G2 }} />
                  )}
                </div>
              </button>
            ))}
          </div>

          {paymentKey === 'MERCHANT_DIRECT' && (
            <div
              className="mt-2 flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{
                background: 'rgba(59,130,246,.08)',
                border: '1px solid rgba(59,130,246,.25)',
                animation: 'fade-up .2s ease both',
              }}
            >
              <span className="mt-0.5 text-base">ℹ️</span>
              <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(147,197,253,.85)' }}>
                After placing your order you&apos;ll be shown the merchant&apos;s bank details to
                complete the transfer.
              </p>
            </div>
          )}
        </div>

        {/* Promo & Rewards */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: '1.5px solid rgba(43,172,82,.22)' }}
        >
          <SectionLabel>Promo & Rewards</SectionLabel>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🎁</span>
                <div>
                  <p className="text-[12px] font-semibold text-white">DRIP20 Applied</p>
                  <p className="text-[11px]" style={{ color: MUTED }}>
                    ₦500 discount
                  </p>
                </div>
              </div>
              <button
                className="text-[11px] font-semibold active:opacity-60"
                style={{ color: '#F87171' }}
              >
                Remove
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💳</span>
                <p className="text-[12px]" style={{ color: MUTED }}>
                  Cashback Earned
                </p>
              </div>
              <span className="text-[12px] font-semibold" style={{ color: G3 }}>
                +{fmt(cashbackTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <SectionLabel>Order Summary</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Items Total', value: fmt(itemsTotal), color: 'rgba(255,255,255,.8)' },
              {
                label: 'Delivery Fees',
                value: deliveryTotal === 0 ? 'FREE' : fmt(deliveryTotal),
                color: 'rgba(255,255,255,.7)',
              },
              { label: 'Promo (DRIP20)', value: `−${fmt(promoSavings)}`, color: G3 },
              { label: 'Cashback Earned', value: `+${fmt(cashbackTotal)}`, color: G3 },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: MUTED }}>
                  {r.label}
                </span>
                <span className="text-[13px] font-medium" style={{ color: r.color }}>
                  {r.value}
                </span>
              </div>
            ))}
            <div className="my-1 h-px" style={{ background: BORDER }} />
            <div className="flex items-center justify-between">
              <span
                className="text-[15px] font-semibold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                Final Total
              </span>
              <span
                className="text-[20px] font-bold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                {fmt(Math.round(grandTotal))}
              </span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <button
          className="mb-2 flex w-full items-start gap-3 text-left"
          onClick={() => setTermsChecked((v) => !v)}
        >
          <div
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all"
            style={{
              background: termsChecked ? G2 : 'rgba(255,255,255,.07)',
              border: `1.5px solid ${termsChecked ? G2 : BORDER}`,
            }}
          >
            {termsChecked && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
            I have reviewed my order and agree to the merchant terms and{' '}
            <span style={{ color: G3 }}>DrippleX Terms of Service</span>.
          </p>
        </button>
      </div>

      {/* Sticky bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30"
        style={{ background: `linear-gradient(to top,${NAVY_BASE} 80%,transparent)` }}
      >
        <div className="flex items-center gap-3 px-5 pb-2 pt-2">
          <div className="flex shrink-0 flex-col">
            <span className="text-[11px]" style={{ color: MUTED }}>
              Final Total
            </span>
            <span
              className="text-[18px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {fmt(Math.round(grandTotal))}
            </span>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={!termsChecked || placing}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[.97]"
            style={{
              background:
                !termsChecked || placing
                  ? 'rgba(255,255,255,.07)'
                  : `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
              boxShadow: !termsChecked || placing ? 'none' : '0 10px 32px rgba(43,172,82,.36)',
              color: !termsChecked || placing ? 'rgba(255,255,255,.25)' : 'white',
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            {placing ? (
              <>
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
                </svg>{' '}
                Placing Order…
              </>
            ) : (
              <>Place Order · {fmt(Math.round(grandTotal))}</>
            )}
          </button>
        </div>
        <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Bank details sheet (MERCHANT_DIRECT step 2) */}
      {showBankSheet && bankDetails && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.78)' }}
        >
          <div
            className="flex flex-col gap-4 rounded-t-[32px] px-6 pb-8 pt-5"
            style={{
              background: NAVY_CARD,
              border: `1px solid ${BORDER}`,
              animation: 'fade-up .25s ease both',
            }}
          >
            <div
              className="mx-auto mb-1 h-1 w-10 rounded-full"
              style={{ background: 'rgba(255,255,255,.2)' }}
            />
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                style={{ background: 'rgba(59,130,246,.15)' }}
              >
                🏦
              </div>
              <div>
                <p
                  className="text-[16px] font-bold text-white"
                  style={{ fontFamily: "'Poppins',sans-serif" }}
                >
                  Merchant Bank Details
                </p>
                <p className="text-[11px]" style={{ color: MUTED }}>
                  Transfer the exact amount shown below
                </p>
              </div>
            </div>

            <div
              className="flex flex-col gap-3 rounded-2xl p-4"
              style={{ background: NAVY_SURFACE, border: `1px solid ${BORDER}` }}
            >
              {[
                { label: 'Bank Name', value: bankDetails.bankName },
                { label: 'Account Name', value: bankDetails.accountName },
                { label: 'Account Number', value: bankDetails.accountNumber },
                { label: 'Amount', value: `${bankDetails.currency} ${fmt(grandTotal)}` },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: MUTED }}>
                    {row.label}
                  </span>
                  <span
                    className="text-[13px] font-semibold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="flex items-start gap-2.5 rounded-xl px-4 py-3"
              style={{
                background: 'rgba(251,191,36,.07)',
                border: '1px solid rgba(251,191,36,.22)',
              }}
            >
              <span className="mt-0.5 text-base">⚠️</span>
              <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(253,230,138,.85)' }}>
                Complete the transfer, then tap &quot;I Have Paid&quot;. DrippleX marks your order
                as placed — the merchant will confirm receipt.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleConfirmBankTransfer}
                disabled={paying}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[.97]"
                style={{
                  background: paying
                    ? 'rgba(255,255,255,.07)'
                    : `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
                  boxShadow: paying ? 'none' : '0 10px 32px rgba(43,172,82,.36)',
                  fontFamily: "'Poppins',sans-serif",
                }}
              >
                {paying ? (
                  <>
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
                    </svg>{' '}
                    Confirming…
                  </>
                ) : (
                  '✅ I Have Paid'
                )}
              </button>
              <button
                onClick={() => setShowBankSheet(false)}
                disabled={paying}
                className="h-[46px] w-full rounded-2xl text-[13px] font-medium transition-all active:scale-[.97]"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: `1.5px solid ${BORDER}`,
                  color: MUTED,
                  fontFamily: "'Poppins',sans-serif",
                }}
              >
                Cancel / Change Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address picker sheet */}
      {showAddrSheet && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={() => setShowAddrSheet(false)}
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
            <p
              className="text-[16px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              Select Address
            </p>
            {addresses.map((addr, i) => (
              <button
                key={addr.id}
                onClick={() => {
                  setAddressIdx(i);
                  setShowAddrSheet(false);
                }}
                className="flex items-start gap-3 rounded-2xl p-3.5 text-left transition-all"
                style={{
                  background: addressIdx === i ? 'rgba(43,172,82,.1)' : 'rgba(255,255,255,.03)',
                  border: `1.5px solid ${addressIdx === i ? G2 : BORDER}`,
                }}
              >
                <span className="mt-0.5 text-xl">📍</span>
                <div>
                  <p className="text-[13px] font-semibold text-white">
                    {addr.name}{' '}
                    <span className="font-normal" style={{ color: G3 }}>
                      ({addr.label})
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
                    {addr.line1}, {addr.line2}
                  </p>
                </div>
              </button>
            ))}
            <button
              className="flex items-center gap-3 rounded-2xl p-3.5"
              style={{
                background: 'rgba(43,172,82,.08)',
                border: '1.5px dashed rgba(43,172,82,.35)',
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: 'rgba(43,172,82,.2)' }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={G3}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span className="text-[13px] font-semibold" style={{ color: G3 }}>
                Add New Address
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
