import React, { useState, useEffect } from 'react';
import { G0, G2, G3, NAVY_DEEP, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { BottomNavigation, FloatingAIButton } from '../components/navigation';
import type { NavTabKey } from '../components/navigation/BottomNavigation';
import { api } from '../lib/api';
import type { MerchantSummaryDto, ProductSummaryDto } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface StoreMerchant {
  id: string;
  name: string;
  category: string;
  coverBg: string;
  emoji: string;
  tagline: string;
  rating: number;
  reviewCount: number;
  distance: string;
  eta: string;
  deliveryFee: string;
  minOrder: string;
  isOpen: boolean;
  isVerified: boolean;
  isFollowed?: boolean;
  hours: string;
  phone: string;
  address: string;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  originalPrice?: string;
  emoji: string;
  rating: number;
  badge?: string;
  badgeColor?: string;
  inStock: boolean;
  isService?: boolean;
  duration?: string;
}

interface StoreReview {
  name: string;
  initials: string;
  rating: number;
  date: string;
  comment: string;
  reply?: string;
  avatarBg: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA — generic merchant (swap for real API data)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_MERCHANT: StoreMerchant = {
  id: 'kfc-ikeja',
  name: 'KFC Nigeria',
  category: 'Restaurant',
  coverBg: 'linear-gradient(135deg,#7C2D12,#B45309 42%,#F97316)',
  emoji: '🍗',
  tagline: "It's finger lickin' good.",
  rating: 4.6,
  reviewCount: 1284,
  distance: '0.9 km',
  eta: '18 min',
  deliveryFee: '₦350',
  minOrder: '₦2,000',
  isOpen: true,
  isVerified: true,
  isFollowed: false,
  hours: '8:00 AM – 11:00 PM daily',
  phone: '+234 800 532 0000',
  address: 'KFC Ikeja City Mall, Alausa, Lagos',
};

const STORE_CATS = ['All', 'Featured', 'Meals', 'Burgers', 'Sides', 'Drinks', 'Promotions'];

const PRODUCTS: StoreProduct[] = [
  {
    id: 'p1',
    name: 'Zinger Meal',
    description: 'Spicy fillet burger, fries & drink',
    price: '₦4,800',
    originalPrice: '₦5,500',
    emoji: '🍔',
    rating: 4.8,
    badge: '-13%',
    badgeColor: '#EF4444',
    inStock: true,
  },
  {
    id: 'p2',
    name: 'Bucket Meal ×8',
    description: '8 pieces, coleslaw & 2 drinks',
    price: '₦12,500',
    emoji: '🍗',
    rating: 4.9,
    badge: 'Best Seller',
    badgeColor: '#F97316',
    inStock: true,
  },
  {
    id: 'p3',
    name: 'Tower Burger',
    description: 'Double patty, cheese, jalapeños',
    price: '₦3,900',
    emoji: '🥪',
    rating: 4.5,
    inStock: true,
  },
  {
    id: 'p4',
    name: 'Twister Wrap',
    description: 'Crispy chicken, salsa, lettuce',
    price: '₦2,800',
    originalPrice: '₦3,200',
    emoji: '🌯',
    rating: 4.4,
    badge: '-13%',
    badgeColor: '#EF4444',
    inStock: true,
  },
  {
    id: 'p5',
    name: 'Family Feast',
    description: '14 pieces + 4 sides + 4 drinks',
    price: '₦28,000',
    emoji: '🍽',
    rating: 4.9,
    badge: 'Popular',
    badgeColor: '#8B5CF6',
    inStock: true,
  },
  {
    id: 'p6',
    name: 'Krushers Mango',
    description: 'Frozen mango smoothie 400ml',
    price: '₦1,600',
    emoji: '🥤',
    rating: 4.3,
    inStock: false,
  },
  {
    id: 'p7',
    name: 'Coleslaw Large',
    description: 'Creamy coleslaw 300g',
    price: '₦900',
    emoji: '🥗',
    rating: 4.2,
    inStock: true,
  },
  {
    id: 'p8',
    name: 'Loaded Fries',
    description: 'Fries topped with cheese & jalapeño',
    price: '₦2,200',
    emoji: '🍟',
    rating: 4.6,
    badge: 'New',
    badgeColor: '#10B981',
    inStock: true,
  },
];

const REVIEWS: StoreReview[] = [
  {
    name: 'Adaeze O.',
    initials: 'AO',
    rating: 5,
    date: '2 days ago',
    comment: 'Always consistent quality. The Zinger Meal never disappoints. Fast delivery too!',
    reply: "Thank you Adaeze! 🍗 We're glad you enjoyed it. See you next time!",
    avatarBg: 'linear-gradient(135deg,#7C3AED,#C084FC)',
  },
  {
    name: 'Chukwudi M.',
    initials: 'CM',
    rating: 4,
    date: '5 days ago',
    comment:
      'Great food, packaging was intact. Took 22 minutes which is slightly longer than usual but still acceptable.',
    avatarBg: 'linear-gradient(135deg,#0C4A6E,#06B6D4)',
  },
  {
    name: 'Fatima B.',
    initials: 'FB',
    rating: 5,
    date: '1 week ago',
    comment:
      'Ordered the Family Feast for a birthday — everyone loved it. Will definitely order again.',
    reply: 'Happy birthday to the family! 🎉 We appreciate your order.',
    avatarBg: 'linear-gradient(135deg,#831843,#EC4899)',
  },
];

const POLICIES = [
  {
    title: 'Delivery Policy',
    icon: '🚚',
    body: 'Standard delivery within 5 km radius. Orders above ₦10,000 qualify for free delivery. Delivery time may vary due to traffic and order volume.',
  },
  {
    title: 'Returns & Refunds',
    icon: '↩',
    body: 'Food items cannot be returned once prepared. If your order is incorrect or of poor quality, contact support within 30 minutes of delivery.',
  },
  {
    title: 'Order Cancellation',
    icon: '✕',
    body: 'Orders may be cancelled within 2 minutes of placement. After preparation has started, cancellations are not accepted.',
  },
  {
    title: 'Allergen Notice',
    icon: '⚠',
    body: 'Our products may contain gluten, dairy, eggs, and soy. Please inform us of any allergies before ordering.',
  },
];

const AI_QUESTIONS = [
  'What are the best sellers here?',
  'Is there a meal under ₦3,000?',
  'How long does delivery take?',
  'Any promotions today?',
  "What's the spiciest item?",
];

// ─────────────────────────────────────────────────────────────────────────────
// LIVE DATA MAPPERS — backend DTO → screen shape (connect only, no invented data)
// Fields the backend does not provide (eta, delivery fee, hours, phone…) render
// as "—" rather than fabricated values.
// ─────────────────────────────────────────────────────────────────────────────
function dtoToStoreMerchant(dto: MerchantSummaryDto): StoreMerchant {
  return {
    id: dto.id,
    name: dto.businessName,
    category: dto.businessType,
    coverBg: DEFAULT_MERCHANT.coverBg,
    emoji: '🏪',
    tagline: dto.businessType,
    rating: dto.rating?.average ?? 0,
    reviewCount: dto.rating?.count ?? 0,
    distance: dto.distanceKm != null ? `${dto.distanceKm.toFixed(1)} km` : dto.city,
    eta: '—',
    deliveryFee: '—',
    minOrder: '—',
    isOpen: dto.isOpenNow ?? true,
    isVerified: dto.verificationStatus === 'VERIFIED' || dto.verificationStatus === 'APPROVED',
    hours: '—',
    phone: '—',
    address: [dto.city, dto.state].filter(Boolean).join(', ') || '—',
  };
}

function dtoToStoreProduct(dto: ProductSummaryDto): StoreProduct {
  return {
    id: dto.id,
    name: dto.name,
    description: '',
    price: `₦${dto.basePrice.toLocaleString()}`,
    emoji: '🛍️',
    rating: dto.rating?.average ?? 0,
    inStock: dto.inStock,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BAR
// ─────────────────────────────────────────────────────────────────────────────
function StoreStatusBar() {
  return (
    <div
      className="flex items-center justify-between px-5 pb-1 pt-[52px]"
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
        <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor">
          <path d="M8 9a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
          <path d="M2.5 5.5a7.7 7.7 0 0111 0l-1.4 1.4a5.7 5.7 0 00-8.2 0z" opacity=".7" />
          <path d="M.2 3.3a11 11 0 0115.6 0L14.3 4.8a9 9 0 00-12.6 0z" opacity=".4" />
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE HEADER
// ─────────────────────────────────────────────────────────────────────────────
function StoreHeader({
  merchant,
  onBack,
  onCart,
  cartCount,
  followed,
  onFollow,
}: {
  merchant: StoreMerchant;
  onBack: () => void;
  onCart: () => void;
  cartCount: number;
  followed: boolean;
  onFollow: () => void;
}) {
  return (
    <div className="relative flex-shrink-0 overflow-hidden">
      {/* Cover */}
      <div className="relative" style={{ height: 200, background: merchant.coverBg }}>
        <StoreStatusBar />
        {/* Glare */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 70% 30%,rgba(255,255,255,.12) 0%,transparent 55%)',
          }}
        />
        {/* Big emoji bg */}
        <div
          className="pointer-events-none absolute bottom-6 right-6"
          style={{ fontSize: 90, opacity: 0.1 }}
        >
          {merchant.emoji}
        </div>

        {/* Top action bar */}
        <div className="absolute left-0 right-0 top-[88px] z-10 flex items-center justify-between px-4">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-90"
            style={{
              background: 'rgba(0,0,0,.45)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,.12)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFF"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onFollow}
              className="flex h-9 items-center gap-1.5 rounded-2xl px-3.5 text-[11px] font-semibold transition-all active:scale-90"
              style={{
                background: followed ? `rgba(43,172,82,.3)` : 'rgba(0,0,0,.45)',
                backdropFilter: 'blur(12px)',
                border: followed
                  ? '1px solid rgba(43,172,82,.4)'
                  : '1px solid rgba(255,255,255,.12)',
                color: followed ? G3 : '#FFF',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {followed ? '✓ Following' : '+ Follow'}
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-90"
              style={{
                background: 'rgba(0,0,0,.45)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,.12)',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFF"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
            </button>
            <button
              onClick={onCart}
              className="relative flex h-9 w-9 items-center justify-center rounded-2xl transition-all active:scale-90"
              style={{
                background: 'rgba(0,0,0,.45)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,.12)',
              }}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
              </svg>
              {cartCount > 0 && (
                <div
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{
                    background: G2,
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#FFF',
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  {cartCount}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Merchant info card overlapping cover */}
      <div
        className="relative z-10 mx-4 -mt-5 rounded-3xl p-4"
        style={{
          background: NAVY_CARD,
          border: `1.5px solid ${BORDER}`,
          boxShadow: '0 8px 32px rgba(0,0,0,.45)',
        }}
      >
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-[32px]"
            style={{ background: merchant.coverBg, boxShadow: '0 4px 14px rgba(0,0,0,.35)' }}
          >
            {merchant.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
              <p
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: '#FFF',
                  fontFamily: "'Poppins',sans-serif",
                }}
              >
                {merchant.name}
              </p>
              {merchant.isVerified && (
                <div
                  className="flex flex-shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-0.5"
                  style={{
                    background: 'rgba(43,172,82,.15)',
                    border: '1px solid rgba(43,172,82,.25)',
                  }}
                >
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={G3}
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <p
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: G3,
                      fontFamily: "'Inter',sans-serif",
                    }}
                  >
                    Verified
                  </p>
                </div>
              )}
            </div>
            <p
              style={{
                fontSize: 11,
                color: MUTED,
                fontFamily: "'Inter',sans-serif",
                marginBottom: 8,
              }}
            >
              {merchant.tagline}
            </p>
            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#FBBF24' }}>
                ★ {merchant.rating} ({(merchant.reviewCount / 1000).toFixed(1)}k)
              </span>
              <span style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter',sans-serif" }}>
                📍 {merchant.distance}
              </span>
              <span style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter',sans-serif" }}>
                ⏱ {merchant.eta}
              </span>
              <div
                className="rounded-lg px-2 py-0.5"
                style={{
                  background: merchant.isOpen ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: merchant.isOpen ? '#10B981' : '#EF4444',
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  {merchant.isOpen ? '● Open Now' : '● Closed'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery info strip */}
        <div
          className="mt-3 flex items-center gap-0 overflow-hidden rounded-2xl"
          style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${BORDER}` }}
        >
          {[
            { icon: '🚚', label: 'Delivery', value: merchant.deliveryFee },
            { icon: '🛒', label: 'Min Order', value: merchant.minOrder },
            { icon: '⏱', label: 'ETA', value: merchant.eta },
          ].map((s, i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center py-2.5"
              style={{ borderRight: i < 2 ? `1px solid ${BORDER}` : 'none' }}
            >
              <span style={{ fontSize: 14, marginBottom: 2 }}>{s.icon}</span>
              <p style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter',sans-serif" }}>
                {s.label}
              </p>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#FFF',
                  fontFamily: "'Poppins',sans-serif",
                }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH BAR
// ─────────────────────────────────────────────────────────────────────────────
function StoreSearch({ storeName }: { storeName: string }) {
  return (
    <div className="mb-2 mt-4 px-4">
      <div
        className="flex items-center gap-3 rounded-2xl px-4"
        style={{ height: 48, background: 'rgba(255,255,255,.07)', border: `1.5px solid ${BORDER}` }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,.35)"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <p
          style={{
            fontSize: 12.5,
            color: 'rgba(255,255,255,.28)',
            fontFamily: "'Inter',sans-serif",
            flex: 1,
          }}
        >
          Search {storeName}…
        </p>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,.06)' }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,.45)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="20" y2="12" />
            <line x1="12" y1="18" x2="20" y2="18" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY CHIPS
// ─────────────────────────────────────────────────────────────────────────────
function StoreCats({ active, onChange }: { active: string; onChange: (s: string) => void }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 pb-1"
      style={{ scrollbarWidth: 'none', marginTop: 10 }}
    >
      {STORE_CATS.map((c) => {
        const on = active === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="h-9 flex-shrink-0 rounded-full px-4 text-[11.5px] font-semibold transition-all active:scale-95"
            style={{
              background: on ? `linear-gradient(135deg,${G0},${G2})` : 'rgba(255,255,255,.06)',
              border: on ? 'none' : `1px solid ${BORDER}`,
              boxShadow: on ? `0 4px 14px rgba(43,172,82,.28)` : 'none',
              color: on ? '#FFF' : 'rgba(255,255,255,.5)',
              fontFamily: "'Inter',sans-serif",
              whiteSpace: 'nowrap',
            }}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT GRID
// ─────────────────────────────────────────────────────────────────────────────
function ProductGrid({
  products,
  loaded,
  onProduct,
}: {
  products: StoreProduct[];
  loaded: boolean;
  onProduct: (p: StoreProduct) => void;
}) {
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setWishlist((w) => {
      const n = new Set(w);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const addCart = (id: string) =>
    setCart((c) => {
      const n = new Set(c);
      n.add(id);
      return n;
    });

  return (
    <div className="mb-5 px-4">
      <div className="mb-3 flex items-center justify-between">
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#FFF',
            fontFamily: "'Poppins',sans-serif",
          }}
        >
          Menu
        </p>
        <button
          style={{ fontSize: 12, fontWeight: 600, color: G3, fontFamily: "'Inter',sans-serif" }}
        >
          See all →
        </button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {!loaded ? (
          [1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-3xl"
              style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
            >
              <div style={{ height: 88, background: 'rgba(255,255,255,.04)' }} />
              <div className="flex flex-col gap-2 p-3">
                <div
                  style={{
                    height: 11,
                    width: '70%',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,.055)',
                  }}
                />
                <div
                  style={{
                    height: 9,
                    width: '50%',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,.04)',
                  }}
                />
                <div
                  style={{
                    height: 28,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,.04)',
                    marginTop: 4,
                  }}
                />
              </div>
            </div>
          ))
        ) : products.length === 0 ? (
          <div
            className="col-span-2 rounded-2xl p-6 text-center text-[12.5px]"
            style={{
              color: MUTED,
              background: NAVY_CARD,
              border: `1.5px solid ${BORDER}`,
              fontFamily: "'Inter',sans-serif",
            }}
          >
            No items available yet.
          </div>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              onClick={() => onProduct(p)}
              className="overflow-hidden rounded-3xl transition-all active:scale-[.97]"
              style={{
                background: NAVY_CARD,
                border: `1.5px solid ${BORDER}`,
                opacity: p.inStock ? 1 : 0.55,
              }}
            >
              {/* Image area */}
              <div
                className="relative flex items-center justify-center"
                style={{ height: 88, background: 'linear-gradient(135deg,#0D1B2E,#1A2E45)' }}
              >
                <span style={{ fontSize: 44 }}>{p.emoji}</span>
                {p.badge && (
                  <div
                    className="absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[9px] font-bold"
                    style={{
                      background: p.badgeColor,
                      color: '#FFF',
                      fontFamily: "'Inter',sans-serif",
                    }}
                  >
                    {p.badge}
                  </div>
                )}
                {!p.inStock && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(6,14,28,.72)' }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,.5)',
                        fontFamily: "'Inter',sans-serif",
                      }}
                    >
                      Out of Stock
                    </p>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(p.id);
                  }}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-xl active:scale-90"
                  style={{
                    background: wishlist.has(p.id) ? 'rgba(239,68,68,.2)' : 'rgba(0,0,0,.4)',
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill={wishlist.has(p.id) ? '#F87171' : 'none'}
                    stroke={wishlist.has(p.id) ? '#F87171' : 'rgba(255,255,255,.6)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                </button>
              </div>
              {/* Info */}
              <div style={{ padding: '10px 12px 12px' }}>
                <p
                  className="truncate"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#FFF',
                    fontFamily: "'Poppins',sans-serif",
                    marginBottom: 2,
                  }}
                >
                  {p.name}
                </p>
                <p
                  className="truncate"
                  style={{
                    fontSize: 9.5,
                    color: MUTED,
                    fontFamily: "'Inter',sans-serif",
                    marginBottom: 4,
                  }}
                >
                  {p.description}
                </p>
                <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#FBBF24' }}>
                    ★ {p.rating}
                  </span>
                </div>
                {p.originalPrice && (
                  <p
                    style={{
                      fontSize: 9.5,
                      textDecoration: 'line-through',
                      color: MUTED,
                      fontFamily: "'Inter',sans-serif",
                    }}
                  >
                    {p.originalPrice}
                  </p>
                )}
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: G3,
                    fontFamily: "'Poppins',sans-serif",
                    marginBottom: 8,
                  }}
                >
                  {p.price}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (p.inStock) addCart(p.id);
                  }}
                  className="h-[30px] w-full rounded-xl text-[10.5px] font-semibold transition-all active:scale-95"
                  disabled={!p.inStock}
                  style={{
                    background: cart.has(p.id)
                      ? 'rgba(43,172,82,.2)'
                      : p.inStock
                        ? `linear-gradient(135deg,${G0},${G2})`
                        : 'rgba(255,255,255,.05)',
                    color: cart.has(p.id) ? G3 : p.inStock ? '#FFF' : 'rgba(255,255,255,.3)',
                    border: cart.has(p.id) ? `1px solid rgba(43,172,82,.3)` : 'none',
                    fontFamily: "'Inter',sans-serif",
                    boxShadow:
                      !cart.has(p.id) && p.inStock ? `0 3px 10px rgba(43,172,82,.22)` : 'none',
                  }}
                >
                  {cart.has(p.id) ? '✓ Added' : p.isService ? 'Book Now' : 'Add to Cart'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────────────────────
function ReviewsSection({ merchant }: { merchant: StoreMerchant }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? REVIEWS : REVIEWS.slice(0, 2);

  return (
    <div className="mb-5 px-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#FFF',
              fontFamily: "'Poppins',sans-serif",
            }}
          >
            Reviews
          </p>
          <p style={{ fontSize: 10, color: MUTED, fontFamily: "'Inter',sans-serif", marginTop: 1 }}>
            ★ {merchant.rating} · {merchant.reviewCount.toLocaleString()} ratings
          </p>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ fontSize: 12, fontWeight: 600, color: G3, fontFamily: "'Inter',sans-serif" }}
        >
          {expanded ? 'Show less' : 'See all →'}
        </button>
      </div>
      {/* Rating bar summary */}
      <div
        className="mb-3 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <p
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: '#FFF',
                fontFamily: "'Poppins',sans-serif",
                lineHeight: 1,
              }}
            >
              {merchant.rating}
            </p>
            <p style={{ fontSize: 10, color: '#FBBF24', marginTop: 2 }}>★★★★★</p>
            <p
              style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter',sans-serif", marginTop: 1 }}
            >
              {merchant.reviewCount.toLocaleString()}
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <p
                  style={{ fontSize: 9, color: MUTED, fontFamily: "'Inter',sans-serif", width: 8 }}
                >
                  {n}
                </p>
                <div
                  className="flex-1 overflow-hidden rounded-full"
                  style={{ height: 5, background: 'rgba(255,255,255,.08)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:
                        n === 5 ? '65%' : n === 4 ? '22%' : n === 3 ? '8%' : n === 2 ? '3%' : '2%',
                      background: n >= 4 ? G2 : n === 3 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Review cards */}
      <div className="flex flex-col gap-3">
        {visible.map((r, i) => (
          <div
            key={i}
            className="rounded-2xl p-3.5"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <div className="mb-2 flex items-start gap-3">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl"
                style={{ background: r.avatarBg }}
              >
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#FFF',
                    fontFamily: "'Poppins',sans-serif",
                  }}
                >
                  {r.initials}
                </p>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#FFF',
                      fontFamily: "'Poppins',sans-serif",
                    }}
                  >
                    {r.name}
                  </p>
                  <p style={{ fontSize: 9.5, color: MUTED, fontFamily: "'Inter',sans-serif" }}>
                    {r.date}
                  </p>
                </div>
                <p style={{ fontSize: 10, color: '#FBBF24' }}>
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </p>
              </div>
            </div>
            <p
              style={{
                fontSize: 11.5,
                color: 'rgba(255,255,255,.72)',
                fontFamily: "'Inter',sans-serif",
                lineHeight: 1.6,
                marginBottom: r.reply ? 10 : 0,
              }}
            >
              {r.comment}
            </p>
            {r.reply && (
              <div
                className="mt-2 rounded-xl p-2.5"
                style={{
                  background: 'rgba(43,172,82,.07)',
                  border: `1px solid rgba(43,172,82,.15)`,
                }}
              >
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: G3,
                    fontFamily: "'Inter',sans-serif",
                    marginBottom: 3,
                  }}
                >
                  💬 Merchant Reply
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,.6)',
                    fontFamily: "'Inter',sans-serif",
                    lineHeight: 1.55,
                  }}
                >
                  {r.reply}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE POLICIES
// ─────────────────────────────────────────────────────────────────────────────
function StorePolicies() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mb-5 px-4">
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: '#FFF',
          fontFamily: "'Poppins',sans-serif",
          marginBottom: 12,
        }}
      >
        Store Policies
      </p>
      <div
        className="overflow-hidden rounded-3xl"
        style={{ border: `1.5px solid ${BORDER}`, background: NAVY_CARD }}
      >
        {POLICIES.map((p, i) => (
          <div key={i}>
            <button
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/[.025]"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[15px]"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                {p.icon}
              </div>
              <p
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#FFF',
                  fontFamily: "'Poppins',sans-serif",
                }}
              >
                {p.title}
              </p>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,.35)"
                strokeWidth="2"
                strokeLinecap="round"
                style={{
                  transition: 'transform .2s ease',
                  transform: open === i ? 'rotate(180deg)' : 'none',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open === i && (
              <div className="px-4 pb-4" style={{ animation: 'fade-in .15s ease' }}>
                <p
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,.58)',
                    fontFamily: "'Inter',sans-serif",
                    lineHeight: 1.65,
                    paddingLeft: 44,
                  }}
                >
                  {p.body}
                </p>
              </div>
            )}
            {i < POLICIES.length - 1 && (
              <div style={{ height: 1, background: BORDER, marginLeft: 56, marginRight: 16 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE INFO FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function StoreInfo({ merchant }: { merchant: StoreMerchant }) {
  return (
    <div className="mb-5 px-4">
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: '#FFF',
          fontFamily: "'Poppins',sans-serif",
          marginBottom: 12,
        }}
      >
        Store Information
      </p>
      <div
        className="overflow-hidden rounded-3xl"
        style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
      >
        {[
          { icon: '🕐', label: 'Hours', value: merchant.hours },
          { icon: '📞', label: 'Phone', value: merchant.phone },
          { icon: '📍', label: 'Address', value: merchant.address },
        ].map((row, i) => (
          <div key={i}>
            <div className="flex items-start gap-3 px-4 py-3.5">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[15px]"
                style={{ background: 'rgba(255,255,255,.06)' }}
              >
                {row.icon}
              </div>
              <div className="flex-1">
                <p
                  style={{
                    fontSize: 10,
                    color: MUTED,
                    fontFamily: "'Inter',sans-serif",
                    marginBottom: 2,
                  }}
                >
                  {row.label}
                </p>
                <p
                  style={{
                    fontSize: 12.5,
                    color: 'rgba(255,255,255,.78)',
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  {row.value}
                </p>
              </div>
            </div>
            {i < 2 && (
              <div style={{ height: 1, background: BORDER, marginLeft: 56, marginRight: 16 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI SHEET
// ─────────────────────────────────────────────────────────────────────────────
function StoreAISheet({ merchant, onClose }: { merchant: StoreMerchant; onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(10px)',
        animation: 'fade-in .2s ease',
      }}
    >
      <div
        className="rounded-t-[32px] p-5 pb-8"
        style={{
          background: 'linear-gradient(180deg,#0D1F2E 0%,#091420 100%)',
          border: '1.5px solid rgba(43,172,82,.18)',
          boxShadow: '0 -20px 60px rgba(0,0,0,.5)',
        }}
      >
        <div
          className="mx-auto mb-5 h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.14)' }}
        />
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{
              background: `linear-gradient(135deg,${G0},${G2})`,
              boxShadow: `0 6px 20px rgba(43,172,82,.35)`,
            }}
          >
            <span style={{ fontSize: 22 }}>✨</span>
          </div>
          <div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#FFF',
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              Ask Drip
            </p>
            <p style={{ fontSize: 11, color: G3, fontFamily: "'Inter',sans-serif" }}>
              About {merchant.name}
            </p>
          </div>
        </div>
        <div className="mb-5 flex flex-col gap-2.5">
          {AI_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={onClose}
              className="w-full rounded-2xl px-4 py-3.5 text-left text-[12.5px] transition-all active:scale-[.98]"
              style={{
                background: 'rgba(255,255,255,.045)',
                color: 'rgba(255,255,255,.78)',
                fontFamily: "'Inter',sans-serif",
                border: `1px solid ${BORDER}`,
              }}
            >
              {q}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="active:scale-97 h-12 w-full rounded-2xl text-[13px] font-semibold"
          style={{
            background: 'rgba(255,255,255,.07)',
            color: 'rgba(255,255,255,.4)',
            fontFamily: "'Inter',sans-serif",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE SCREEN — HOME-003
// ─────────────────────────────────────────────────────────────────────────────
export function StoreScreen({
  onBack,
  onHome,
  onAccount,
  onNotifications,
  onProduct,
  onCart,
  merchantId,
  merchant: merchantProp = DEFAULT_MERCHANT,
}: {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  onProduct?: (p: StoreProduct) => void;
  onCart?: () => void;
  merchantId?: string;
  merchant?: StoreMerchant;
}) {
  const [activeCat, setActiveCat] = useState('All');
  const [loaded, setLoaded] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [cartCount] = useState(0);

  // Live merchant + products (from real backend when a merchantId is routed in).
  const [liveMerchant, setLiveMerchant] = useState<StoreMerchant | null>(null);
  const [liveProducts, setLiveProducts] = useState<StoreProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = () => {
    if (!merchantId) {
      // Design-preview only (no id routed): keep the mock so the standalone
      // navigator still renders. Never falls back to mock when live is expected.
      const t = setTimeout(() => setLoaded(true), 300);
      return () => clearTimeout(t);
    }
    setLoaded(false);
    setLoadError(null);
    api.marketplace
      .getMerchant(merchantId)
      .then((dto) => {
        setLiveMerchant(dtoToStoreMerchant(dto));
        setLiveProducts((dto.products ?? []).map(dtoToStoreProduct));
        setLoaded(true);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load store');
        setLoaded(true);
      });
  };

  useEffect(load, [merchantId]);

  const merchant = liveMerchant ?? merchantProp;
  const products = liveProducts ?? (merchantId ? [] : PRODUCTS);
  const [followed, setFollowed] = useState(false);

  const filteredProducts =
    activeCat === 'All'
      ? products
      : products.filter((p) => {
          if (activeCat === 'Promotions') return !!p.badge;
          if (activeCat === 'Featured') return p.rating >= 4.7;
          return true;
        });

  const handleNav = (t: NavTabKey) => {
    if (t === 'home') onHome();
    if (t === 'profile') onAccount();
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_DEEP }}
    >
      <StoreHeader
        merchant={merchant}
        onBack={onBack}
        onCart={onCart ?? (() => {})}
        cartCount={cartCount}
        followed={followed}
        onFollow={() => setFollowed((f) => !f)}
      />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <StoreSearch storeName={merchant.name} />
        <StoreCats active={activeCat} onChange={setActiveCat} />

        <div style={{ height: 16 }} />
        {loadError ? (
          <div
            className="mx-5 my-6 rounded-2xl p-5 text-center"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <p
              className="mb-3 text-[13px]"
              style={{ color: '#FFF', fontFamily: "'Inter',sans-serif" }}
            >
              {loadError}
            </p>
            <button
              onClick={load}
              className="h-[38px] rounded-xl px-5 text-[12px] font-semibold active:scale-95"
              style={{ background: `linear-gradient(135deg,${G0},${G2})`, color: '#FFF' }}
            >
              Retry
            </button>
          </div>
        ) : (
          <ProductGrid
            products={filteredProducts}
            loaded={loaded}
            onProduct={(p) => onProduct?.(p)}
          />
        )}
        <ReviewsSection merchant={merchant} />
        <StorePolicies />
        <StoreInfo merchant={merchant} />

        <div style={{ height: 104 }} />
      </div>

      <FloatingAIButton onPress={() => setShowAI(true)} />
      <BottomNavigation activeTab="market" onTabChange={handleNav} />
      {showAI && <StoreAISheet merchant={merchant} onClose={() => setShowAI(false)} />}
    </div>
  );
}
