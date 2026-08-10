import React, { useState, useEffect, useRef, useCallback } from 'react';
import { G0, G2, G3, NAVY_BASE, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { BottomNavigation, FloatingAIButton } from '../components/navigation';
import type { NavTabKey } from '../components/navigation/BottomNavigation';
import type { StoreMerchant, StoreProduct } from './storeScreen';
import { api } from '../lib/api';
import type { ProductSummaryDto } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED PRODUCT TYPE
// ─────────────────────────────────────────────────────────────────────────────
export interface ProductVariantGroup {
  key: string;
  label: string;
  options: { id: string; label: string; price?: string; available?: boolean }[];
  required: boolean;
}

export interface ProductReview {
  id: string;
  author: string;
  initials: string;
  avatarBg: string;
  rating: number;
  date: string;
  comment: string;
  photo?: string;
  reply?: string;
}

export interface ProductDetail extends StoreProduct {
  images: string[]; // emoji placeholders / real URLs later
  imageBgs: string[];
  cashback?: string;
  sku?: string;
  category: string;
  availability: 'In Stock' | 'Low Stock' | 'Out of Stock';
  soldCount?: string;
  specs?: { label: string; value: string }[];
  ingredients?: string;
  variantGroups: ProductVariantGroup[];
  reviews: ProductReview[];
  ratingBreakdown: number[]; // [5,4,3,2,1] counts
  deliveryEta: string;
  deliveryFee: string;
  pickupAvailable: boolean;
  returnPolicy: string;
  related: StoreProduct[];
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_MERCHANT: StoreMerchant = {
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

const MOCK_PRODUCT: ProductDetail = {
  id: 'p1',
  name: 'Zinger Meal',
  description:
    'Our signature spicy fillet burger served with crispy seasoned fries and your choice of drink. Made with 100% fresh chicken, marinated in our secret 11 herbs and spices blend.',
  price: '₦4,800',
  originalPrice: '₦5,500',
  emoji: '🍔',
  rating: 4.8,
  badge: '-13%',
  badgeColor: '#EF4444',
  inStock: true,
  category: 'Meals',
  images: ['🍔', '🍟', '🥤', '🍗'],
  imageBgs: [
    'linear-gradient(145deg,#7C2D12,#EA580C)',
    'linear-gradient(145deg,#92400E,#D97706)',
    'linear-gradient(145deg,#1D4ED8,#0EA5E9)',
    'linear-gradient(145deg,#7C2D12,#DC2626)',
  ],
  cashback: '₦240',
  sku: 'KFC-ZM-001',
  availability: 'In Stock',
  soldCount: '3.2k sold',
  specs: [
    { label: 'Calories', value: '780 kcal' },
    { label: 'Protein', value: '42g' },
    { label: 'Allergens', value: 'Gluten, Dairy' },
    { label: 'Prep Time', value: '8–12 min' },
  ],
  variantGroups: [
    {
      key: 'size',
      label: 'Meal Size',
      required: true,
      options: [
        { id: 'regular', label: 'Regular', price: '₦4,800', available: true },
        { id: 'large', label: 'Large +', price: '₦5,800', available: true },
        { id: 'sharing', label: 'Sharing', price: '₦8,500', available: true },
      ],
    },
    {
      key: 'spice',
      label: 'Spice Level',
      required: true,
      options: [
        { id: 'mild', label: 'Mild 🌶', available: true },
        { id: 'medium', label: 'Medium 🌶🌶', available: true },
        { id: 'hot', label: 'Hot 🌶🌶🌶', available: true },
        { id: 'xhot', label: 'Extra Hot 🔥', available: false },
      ],
    },
    {
      key: 'drink',
      label: 'Choose Drink',
      required: false,
      options: [
        { id: 'pepsi', label: 'Pepsi', available: true },
        { id: '7up', label: '7UP', available: true },
        { id: 'mirinda', label: 'Mirinda', available: true },
        { id: 'water', label: 'Water', available: true },
      ],
    },
  ],
  ratingBreakdown: [612, 498, 104, 48, 22],
  reviews: [
    {
      id: 'r1',
      author: 'Amara O.',
      initials: 'AO',
      avatarBg: `linear-gradient(135deg,${G0},${G2})`,
      rating: 5,
      date: '2 days ago',
      comment:
        "Absolutely incredible! The spicy fillet was perfectly cooked and the fries were still hot on delivery. Best meal I've had this week.",
      reply: "Thank you, Amara! We're delighted you enjoyed it. See you again soon! 🍗",
    },
    {
      id: 'r2',
      author: 'Emeka J.',
      initials: 'EJ',
      avatarBg: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
      rating: 4,
      date: '5 days ago',
      comment:
        'Great taste but delivery took a bit longer than expected. The burger itself was 10/10 though.',
      reply: undefined,
    },
    {
      id: 'r3',
      author: 'Fatima B.',
      initials: 'FB',
      avatarBg: 'linear-gradient(135deg,#DB2777,#9333EA)',
      rating: 5,
      date: '1 week ago',
      comment: 'Ordered large size — worth every naira! The Zinger remains my go-to comfort meal.',
      reply: 'We love hearing that, Fatima! The Large size is always a crowd pleaser 😊',
    },
    {
      id: 'r4',
      author: 'Chidi N.',
      initials: 'CN',
      avatarBg: 'linear-gradient(135deg,#D97706,#DC2626)',
      rating: 4,
      date: '2 weeks ago',
      comment:
        'Solid meal, consistent quality as always with KFC. Would like more drink options though.',
      reply: undefined,
    },
  ],
  deliveryEta: '18–25 min',
  deliveryFee: '₦350',
  pickupAvailable: true,
  returnPolicy: 'Fresh quality guaranteed. Report issues within 30 min.',
  related: [
    {
      id: 'p2',
      name: 'Bucket ×8',
      description: '8 pcs + coleslaw',
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
      description: 'Double cheese',
      price: '₦3,900',
      emoji: '🥪',
      rating: 4.5,
      inStock: true,
    },
    {
      id: 'p8',
      name: 'Loaded Fries',
      description: 'Cheese & jalapeño',
      price: '₦2,200',
      emoji: '🍟',
      rating: 4.6,
      badge: 'New',
      badgeColor: '#10B981',
      inStock: true,
    },
    {
      id: 'p4',
      name: 'Twister Wrap',
      description: 'Crispy + salsa',
      price: '₦2,800',
      emoji: '🌯',
      rating: 4.4,
      inStock: true,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// GALLERY
// ─────────────────────────────────────────────────────────────────────────────
function Gallery({
  product,
  onBack,
  onFavoriteToggle,
  favorited,
}: {
  product: ProductDetail;
  onBack: () => void;
  onFavoriteToggle: () => void;
  favorited: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const startX = useRef(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40)
      setIdx((i) => (dx < 0 ? Math.min(i + 1, product.images.length - 1) : Math.max(i - 1, 0)));
  };

  return (
    <div
      className="relative w-full"
      style={{ height: 280 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides */}
      {product.images.map((emoji, i) => (
        <div
          key={i}
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{
            background: product.imageBgs[i] ?? product.imageBgs[0],
            opacity: idx === i ? 1 : 0,
          }}
        >
          <span style={{ fontSize: 96, filter: 'drop-shadow(0 16px 32px rgba(0,0,0,.35))' }}>
            {emoji}
          </span>
        </div>
      ))}

      {/* Gradient overlays */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,.45),transparent)' }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
        style={{ background: `linear-gradient(to top,${NAVY_BASE},transparent)` }}
      />

      {/* Nav buttons */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-5 pt-14">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
          style={{ background: 'rgba(0,0,0,.38)', backdropFilter: 'blur(8px)' }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
            style={{ background: 'rgba(0,0,0,.38)', backdropFilter: 'blur(8px)' }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button
            onClick={onFavoriteToggle}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90"
            style={{
              background: favorited ? 'rgba(239,68,68,.75)' : 'rgba(0,0,0,.38)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill={favorited ? 'white' : 'none'}
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Badge overlay */}
      {product.badge && (
        <div
          className="absolute left-5 top-16 z-10 rounded-full px-3 py-1 text-[11px] font-bold"
          style={{ background: product.badgeColor ?? G2, color: '#FFF' }}
        >
          {product.badge}
        </div>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
        {product.images.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="rounded-full transition-all duration-200"
            style={{
              width: idx === i ? 16 : 6,
              height: 6,
              background: idx === i ? '#FFF' : 'rgba(255,255,255,.38)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT SELECTOR
// ─────────────────────────────────────────────────────────────────────────────
function VariantSelector({
  groups,
  selected,
  onSelect,
}: {
  groups: ProductVariantGroup[];
  selected: Record<string, string>;
  onSelect: (key: string, id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-[13px] font-semibold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {group.label}
            </span>
            {group.required && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: selected[group.key] ? 'rgba(43,172,82,.2)' : 'rgba(255,255,255,.08)',
                  color: selected[group.key] ? G3 : MUTED,
                }}
              >
                {selected[group.key] ? '✓ Selected' : 'Required'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.options.map((opt) => {
              const isSelected = selected[group.key] === opt.id;
              const unavailable = opt.available === false;
              return (
                <button
                  key={opt.id}
                  onClick={() => !unavailable && onSelect(group.key, opt.id)}
                  disabled={unavailable}
                  className="flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95"
                  style={{
                    padding: '8px 14px',
                    minWidth: 64,
                    background: isSelected ? 'rgba(43,172,82,.18)' : 'rgba(255,255,255,.05)',
                    border: `1.5px solid ${isSelected ? G2 : unavailable ? 'rgba(255,255,255,.04)' : BORDER}`,
                    opacity: unavailable ? 0.38 : 1,
                    boxShadow: isSelected ? `0 0 0 2px rgba(43,172,82,.12)` : 'none',
                  }}
                >
                  <span
                    className="text-[13px] font-medium"
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      color: isSelected
                        ? G3
                        : unavailable
                          ? 'rgba(255,255,255,.25)'
                          : 'rgba(255,255,255,.8)',
                    }}
                  >
                    {opt.label}
                  </span>
                  {opt.price && (
                    <span className="mt-0.5 text-[11px]" style={{ color: isSelected ? G3 : MUTED }}>
                      {opt.price}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────────────────────
type ReviewSort = 'recent' | 'highest' | 'lowest';
function ReviewsSection({ product }: { product: ProductDetail }) {
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [expanded, setExpanded] = useState<string | null>(null);
  const total = product.ratingBreakdown.reduce((a, b) => a + b, 0);

  const sorted = [...product.reviews].sort((a, b) =>
    sort === 'highest' ? b.rating - a.rating : sort === 'lowest' ? a.rating - b.rating : 0,
  );

  const Stars = ({ n, size = 12 }: { n: number; size?: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i <= n ? '#F59E0B' : 'rgba(255,255,255,.15)'}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div
        className="flex items-start gap-5 rounded-2xl p-4"
        style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
      >
        <div className="flex flex-col items-center gap-1">
          <span
            className="text-[40px] font-bold text-white"
            style={{ fontFamily: "'Poppins',sans-serif", lineHeight: 1 }}
          >
            {product.rating}
          </span>
          <Stars n={Math.round(product.rating)} size={14} />
          <span className="text-[11px]" style={{ color: MUTED }}>
            {total.toLocaleString()} reviews
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((star, i) => {
            const count = product.ratingBreakdown[i];
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-2 text-right text-[11px]" style={{ color: MUTED }}>
                  {star}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,.08)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: star >= 4 ? G2 : star === 3 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
                <span className="w-6 text-right text-[10px]" style={{ color: MUTED }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sort chips */}
      <div className="flex gap-2">
        {(
          [
            ['recent', 'Most Recent'],
            ['highest', 'Highest'],
            ['lowest', 'Lowest'],
          ] as [ReviewSort, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className="h-[28px] rounded-full px-3 text-[11px] font-semibold transition-all"
            style={{
              background: sort === k ? G2 : 'rgba(255,255,255,.06)',
              border: `1px solid ${sort === k ? G2 : BORDER}`,
              color: sort === k ? '#FFF' : MUTED,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Review cards */}
      {sorted.map((rv) => {
        const isExp = expanded === rv.id;
        return (
          <div
            key={rv.id}
            className="flex flex-col gap-3 rounded-2xl p-4"
            style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{ background: rv.avatarBg }}
              >
                {rv.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[13px] font-semibold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    {rv.author}
                  </span>
                  <span className="text-[11px]" style={{ color: MUTED }}>
                    {rv.date}
                  </span>
                </div>
                <Stars n={rv.rating} />
              </div>
            </div>
            <p
              className="text-[13px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,.7)', fontFamily: "'Inter',sans-serif" }}
            >
              {isExp || rv.comment.length <= 100 ? rv.comment : rv.comment.slice(0, 100) + '…'}
              {rv.comment.length > 100 && (
                <button
                  onClick={() => setExpanded(isExp ? null : rv.id)}
                  className="ml-1 font-semibold"
                  style={{ color: G3 }}
                >
                  {isExp ? 'less' : 'more'}
                </button>
              )}
            </p>
            {rv.reply && (
              <div
                className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                style={{
                  background: 'rgba(43,172,82,.07)',
                  border: `1px solid rgba(43,172,82,.15)`,
                }}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                  style={{ background: `linear-gradient(135deg,${G0},${G2})` }}
                >
                  🍗
                </div>
                <div>
                  <p className="mb-0.5 text-[10px] font-semibold" style={{ color: G3 }}>
                    KFC Nigeria replied
                  </p>
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: 'rgba(255,255,255,.55)', fontFamily: "'Inter',sans-serif" }}
                  >
                    {rv.reply}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CART BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────
function CartSheet({
  product,
  qty,
  onContinue,
  onViewCart,
}: {
  product: ProductDetail;
  qty: number;
  onContinue: () => void;
  onViewCart: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,.72)' }}
      onClick={onContinue}
    >
      <div
        className="flex flex-col gap-5 rounded-t-[32px] p-6"
        style={{
          background: NAVY_CARD,
          border: `1px solid ${BORDER}`,
          animation: 'fade-up .28s ease both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.2)' }}
        />
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl text-4xl"
            style={{ background: product.imageBgs[0] }}
          >
            {product.images[0]}
          </div>
          <div className="flex-1">
            <p
              className="text-[15px] font-semibold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {product.name}
            </p>
            <p className="text-[13px]" style={{ color: MUTED }}>
              Qty: {qty} · {product.price}
            </p>
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'rgba(43,172,82,.2)', border: `1.5px solid rgba(43,172,82,.35)` }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={G3}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-center text-[13px] font-semibold" style={{ color: G3 }}>
            Added to Cart!
          </p>
          <div className="flex gap-3">
            <button
              onClick={onContinue}
              className="h-[50px] flex-1 rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
              style={{
                background: 'rgba(255,255,255,.06)',
                border: `1.5px solid ${BORDER}`,
                color: MUTED,
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              Continue Shopping
            </button>
            <button
              onClick={onViewCart}
              className="h-[50px] flex-1 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97]"
              style={{
                background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
                boxShadow: `0 10px 32px rgba(43,172,82,.36)`,
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              View Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
// ─── DTO → ProductDetail converter ───────────────────────────────────────────
function dtoToProductDetail(dto: ProductSummaryDto & { description?: string }): ProductDetail {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? `From ${dto.merchantName}`,
    price: `₦${dto.basePrice.toLocaleString()}`,
    emoji: '🍽',
    rating: dto.rating?.average ?? 4.5,
    inStock: dto.inStock,
    badge: dto.isFeatured ? 'Featured' : undefined,
    badgeColor: dto.isFeatured ? '#8B5CF6' : undefined,
    images: ['🍽'],
    imageBgs: ['linear-gradient(135deg,#0D2E18,#176B30)'],
    category: 'Food',
    availability: dto.inStock ? 'In Stock' : 'Out of Stock',
    variantGroups: [],
    reviews: [],
    ratingBreakdown: [0, 0, 0, 0, 0],
    deliveryEta: '20–35 min',
    deliveryFee: '₦350',
    pickupAvailable: false,
    returnPolicy: 'Non-refundable once prepared.',
    related: [],
  };
}

export interface ProductDetailScreenProps {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  onCart?: () => void;
  product?: ProductDetail;
  merchant?: StoreMerchant;
  productId?: string;
  merchantId?: string;
}

export function ProductDetailScreen({
  onBack,
  onHome,
  onAccount,
  onNotifications,
  onCart,
  product: productProp = MOCK_PRODUCT,
  merchant: merchantProp = MOCK_MERCHANT,
  productId,
  merchantId,
}: ProductDetailScreenProps) {
  const [favorited, setFavorited] = useState(false);
  const [qty, setQty] = useState(1);
  const [selectedVars, setSelectedVars] = useState<Record<string, string>>({
    size: 'regular',
    spice: 'medium',
    drink: 'pepsi',
  });
  const [cartSheet, setCartSheet] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [specExpanded, setSpecExpanded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<NavTabKey>('market');
  const [cartCount, setCartCount] = useState(0);
  const [liveProduct, setLiveProduct] = useState<ProductDetail | null>(null);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!productId) return;
    api.marketplace
      .getProduct(productId)
      .then((dto) => {
        setLiveProduct(dtoToProductDetail(dto));
      })
      .catch(() => {});
  }, [productId]);

  const product = liveProduct ?? productProp;
  const merchant = merchantProp;
  const isOutOfStock = product.availability === 'Out of Stock';

  const handleAddToCart = async () => {
    if (isOutOfStock || adding) return;
    setAdding(true);
    try {
      await api.cart.addItem({
        merchantId: merchantId ?? merchant.id,
        productId: productId ?? product.id,
        productName: product.name,
        unitPrice: parseInt(product.price.replace(/[₦,]/g, ''), 10) || 0,
        quantity: qty,
      });
    } catch {
      // optimistic — show success even if API unavailable
    } finally {
      setAdding(false);
    }
    setCartCount((c) => c + qty);
    setCartSheet(true);
  };

  const handleTabChange = useCallback(
    (tab: NavTabKey) => {
      setActiveTab(tab);
      if (tab === 'home') onHome();
      if (tab === 'profile') onAccount();
    },
    [onHome, onAccount],
  );

  const AI_PROMPTS = [
    'Is this a good choice?',
    'Compare with similar products',
    'Show cheaper alternatives',
    'What do customers say?',
    'Nutrition & ingredients',
  ];

  const totalPrice = (() => {
    const base = parseInt(product.price.replace(/[₦,]/g, ''), 10);
    const sizeOpt = product.variantGroups[0]?.options.find((o) => o.id === selectedVars['size']);
    const sizePrice = sizeOpt?.price ? parseInt(sizeOpt.price.replace(/[₦,]/g, ''), 10) : base;
    return `₦${(sizePrice * qty).toLocaleString()}`;
  })();

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'none', paddingBottom: 96 }}
      >
        {/* Gallery */}
        <Gallery
          product={product}
          onBack={onBack}
          onFavoriteToggle={() => setFavorited((f) => !f)}
          favorited={favorited}
        />

        {/* Product Info */}
        <div className="px-5 pb-2 pt-4">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h1
              className="flex-1 text-[22px] font-bold leading-tight text-white"
              style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.02em' }}
            >
              {product.name}
            </h1>
            {product.cashback && (
              <div
                className="mt-0.5 flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1"
                style={{
                  background: 'rgba(43,172,82,.14)',
                  border: `1px solid rgba(43,172,82,.28)`,
                }}
              >
                <span className="text-[10px]">💳</span>
                <span className="text-[11px] font-bold" style={{ color: G3 }}>
                  {product.cashback}
                </span>
              </div>
            )}
          </div>

          {/* Merchant + rating row */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="text-[13px]"
                style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
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
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-[13px] font-semibold text-white">{product.rating}</span>
              <span className="text-[12px]" style={{ color: MUTED }}>
                ({product.reviewCount?.toLocaleString() ?? '0'})
              </span>
              {product.soldCount && (
                <span className="text-[12px]" style={{ color: MUTED }}>
                  · {product.soldCount}
                </span>
              )}
            </div>
          </div>

          {/* Price row */}
          <div className="mb-3 flex items-baseline gap-3">
            <span
              className="text-[28px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif", letterSpacing: '-0.03em' }}
            >
              {product.price}
            </span>
            {product.originalPrice && (
              <span className="text-[15px] line-through" style={{ color: MUTED }}>
                {product.originalPrice}
              </span>
            )}
            {product.badge && product.badge.includes('%') && (
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-bold"
                style={{
                  background: 'rgba(239,68,68,.15)',
                  color: '#F87171',
                  border: '1px solid rgba(239,68,68,.25)',
                }}
              >
                {product.badge} OFF
              </span>
            )}
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="flex h-[24px] items-center rounded-full px-3 text-[11px] font-medium"
              style={{
                background: 'rgba(255,255,255,.06)',
                border: `1px solid ${BORDER}`,
                color: MUTED,
              }}
            >
              {product.category}
            </span>
            <span
              className="flex h-[24px] items-center gap-1 rounded-full px-3 text-[11px] font-medium"
              style={{
                background: isOutOfStock ? 'rgba(248,113,113,.1)' : 'rgba(43,172,82,.1)',
                border: `1px solid ${isOutOfStock ? 'rgba(248,113,113,.25)' : 'rgba(43,172,82,.25)'}`,
                color: isOutOfStock ? '#F87171' : G3,
              }}
            >
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: isOutOfStock ? '#EF4444' : G3 }}
              />
              {product.availability}
            </span>
            {product.sku && (
              <span
                className="flex h-[24px] items-center rounded-full px-3 text-[11px]"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: `1px solid ${BORDER}`,
                  color: 'rgba(255,255,255,.28)',
                }}
              >
                {product.sku}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 my-3 h-px" style={{ background: BORDER }} />

        {/* Description */}
        <div className="mb-4 px-5">
          <p
            className="mb-2 text-[12px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Description
          </p>
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,.68)', fontFamily: "'Inter',sans-serif" }}
          >
            {product.description}
          </p>
          {product.specs && (
            <button
              onClick={() => setSpecExpanded((v) => !v)}
              className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold transition-opacity active:opacity-70"
              style={{ color: G3 }}
            >
              {specExpanded ? 'Hide' : 'View'} Specifications
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{
                  transform: specExpanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform .2s',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          {specExpanded && product.specs && (
            <div
              className="mt-3 overflow-hidden rounded-2xl"
              style={{ border: `1px solid ${BORDER}`, animation: 'fade-up .2s ease both' }}
            >
              {product.specs.map((spec, i) => (
                <div
                  key={spec.label}
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    borderBottom: i < product.specs!.length - 1 ? `1px solid ${BORDER}` : 'none',
                    background: i % 2 === 0 ? 'rgba(255,255,255,.025)' : 'transparent',
                  }}
                >
                  <span
                    className="text-[12px]"
                    style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
                  >
                    {spec.label}
                  </span>
                  <span
                    className="text-[12px] font-medium text-white"
                    style={{ fontFamily: "'Inter',sans-serif" }}
                  >
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Variants */}
        <div className="mb-4 px-5">
          <p
            className="mb-3 text-[12px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Customise
          </p>
          <VariantSelector
            groups={product.variantGroups}
            selected={selectedVars}
            onSelect={(key, id) => setSelectedVars((v) => ({ ...v, [key]: id }))}
          />
        </div>

        {/* Qty selector inline */}
        <div className="mb-4 flex items-center justify-between px-5">
          <p
            className="text-[13px] font-semibold text-white"
            style={{ fontFamily: "'Poppins',sans-serif" }}
          >
            Quantity
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
              style={{
                background: qty === 1 ? 'rgba(255,255,255,.04)' : 'rgba(43,172,82,.14)',
                border: `1.5px solid ${qty === 1 ? BORDER : 'rgba(43,172,82,.3)'}`,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={qty === 1 ? MUTED : G3}
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span
              className="w-6 text-center text-[18px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
              style={{
                background: 'rgba(43,172,82,.14)',
                border: `1.5px solid rgba(43,172,82,.3)`,
              }}
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
            </button>
          </div>
        </div>

        {/* Delivery Info */}
        <div
          className="mx-5 mb-4 flex flex-col gap-3 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <p
            className="text-[12px] font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Delivery
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: '⚡', label: 'ETA', value: product.deliveryEta },
              { icon: '💳', label: 'Fee', value: product.deliveryFee },
              {
                icon: '🏪',
                label: 'Pickup',
                value: product.pickupAvailable ? 'Available' : 'Not available',
              },
              { icon: '🔄', label: 'Returns', value: '30 min window' },
            ].map((d) => (
              <div
                key={d.label}
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,.03)', border: `1px solid ${BORDER}` }}
              >
                <span className="text-[14px]">{d.icon}</span>
                <p className="mt-0.5 text-[10px]" style={{ color: MUTED }}>
                  {d.label}
                </p>
                <p className="text-[12px] font-semibold text-white">{d.value}</p>
              </div>
            ))}
          </div>
          <p
            className="text-[11px] leading-relaxed"
            style={{ color: MUTED, fontFamily: "'Inter',sans-serif" }}
          >
            {product.returnPolicy}
          </p>
        </div>

        {/* AI Card */}
        <div
          className="mx-5 mb-4 overflow-hidden rounded-2xl p-4"
          style={{
            background: `linear-gradient(135deg,${NAVY_SURFACE} 0%,rgba(43,172,82,.08) 100%)`,
            border: `1px solid rgba(43,172,82,.2)`,
          }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                boxShadow: `0 6px 20px rgba(43,172,82,.35)`,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M12 2a10 10 0 1 0 10 10" />
                <path d="M12 8v4l3 3" />
                <path d="M22 2L16 8" />
                <path d="M22 8V2h-6" />
              </svg>
            </div>
            <div>
              <p
                className="text-[14px] font-semibold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                Ask Drip ✨
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Your AI shopping assistant
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
                className="flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[11px] font-medium transition-all active:scale-95"
                style={{
                  background: 'rgba(43,172,82,.12)',
                  border: `1px solid rgba(43,172,82,.24)`,
                  color: G3,
                }}
              >
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Related Products */}
        <div className="mb-4">
          <p
            className="mb-3 px-5 text-[14px] font-semibold text-white"
            style={{ fontFamily: "'Poppins',sans-serif" }}
          >
            You May Also Like
          </p>
          <div className="flex gap-3 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
            {product.related.map((rel) => (
              <div
                key={rel.id}
                className="w-[140px] shrink-0 overflow-hidden rounded-2xl"
                style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
              >
                <div
                  className="flex h-[90px] items-center justify-center"
                  style={{ background: 'linear-gradient(145deg,#1e2d44,#243347)' }}
                >
                  <span style={{ fontSize: 44 }}>{rel.emoji}</span>
                </div>
                <div className="p-3">
                  <p
                    className="truncate text-[12px] font-semibold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    {rel.name}
                  </p>
                  <p className="mb-1 truncate text-[11px]" style={{ color: MUTED }}>
                    {rel.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold" style={{ color: G3 }}>
                      {rel.price}
                    </span>
                    {rel.badge && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ background: rel.badgeColor, color: '#FFF' }}
                      >
                        {rel.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Merchant section */}
        <div
          className="mx-5 mb-4 rounded-2xl p-4"
          style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
              style={{ background: merchant.coverBg }}
            >
              {merchant.emoji}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p
                  className="text-[14px] font-semibold text-white"
                  style={{ fontFamily: "'Poppins',sans-serif" }}
                >
                  {merchant.name}
                </p>
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
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="text-[12px]" style={{ color: MUTED }}>
                  {merchant.rating} · {merchant.reviewCount.toLocaleString()} reviews
                </span>
              </div>
            </div>
            <button
              onClick={onBack}
              className="h-[34px] rounded-full px-4 text-[12px] font-semibold text-white transition-all active:scale-95"
              style={{
                background: `linear-gradient(135deg,${G0},${G2})`,
                boxShadow: `0 6px 18px rgba(43,172,82,.3)`,
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              Visit Store
            </button>
          </div>
        </div>

        {/* Reviews */}
        <div className="mb-6 px-5">
          <p
            className="mb-3 text-[14px] font-semibold text-white"
            style={{ fontFamily: "'Poppins',sans-serif" }}
          >
            Customer Reviews
          </p>
          <ReviewsSection product={product} />
        </div>
      </div>

      {/* ── Sticky Bottom Bar ───────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30"
        style={{
          background: `linear-gradient(to top,${NAVY_BASE} 75%,transparent)`,
          paddingBottom: 0,
        }}
      >
        <div className="flex items-center gap-3 px-5 pb-3 pt-3">
          {/* Qty mini */}
          <div
            className="flex h-[50px] shrink-0 items-center gap-3 rounded-2xl px-3"
            style={{ background: NAVY_CARD, border: `1.5px solid ${BORDER}` }}
          >
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="transition-all active:scale-90"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={MUTED}
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span
              className="w-5 text-center text-[16px] font-bold text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {qty}
            </span>
            <button onClick={() => setQty((q) => q + 1)} className="transition-all active:scale-90">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={G3}
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Add to Cart */}
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold text-white transition-all active:scale-[.97]"
            style={{
              background: isOutOfStock
                ? 'rgba(255,255,255,.06)'
                : `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
              boxShadow: isOutOfStock ? 'none' : `0 10px 32px rgba(43,172,82,.36)`,
              color: isOutOfStock ? 'rgba(255,255,255,.22)' : 'white',
              fontFamily: "'Poppins',sans-serif",
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
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {isOutOfStock ? 'Out of Stock' : `Add · ${totalPrice}`}
          </button>

          {/* Buy Now */}
          {!isOutOfStock && (
            <button
              className="h-[50px] rounded-2xl px-4 text-[13px] font-semibold transition-all active:scale-[.97]"
              style={{
                background: 'rgba(255,255,255,.07)',
                border: `1.5px solid ${BORDER}`,
                color: 'rgba(255,255,255,.7)',
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              Buy Now
            </button>
          )}
        </div>

        {/* Bottom nav */}
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          marketBadge={cartCount > 0 ? cartCount : undefined}
        />
      </div>

      {/* Floating AI */}
      <FloatingAIButton onPress={() => setShowAI((v) => !v)} bottom={96} />

      {/* Cart confirmation sheet */}
      {cartSheet && (
        <CartSheet
          product={product}
          qty={qty}
          onContinue={() => setCartSheet(false)}
          onViewCart={() => {
            setCartSheet(false);
            onCart?.();
          }}
        />
      )}

      {/* AI Sheet */}
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
              animation: 'fade-up .28s ease both',
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
                style={{ color: 'rgba(255,255,255,.7)', fontFamily: "'Inter',sans-serif" }}
              >
                {aiPrompt === 'Is this a good choice?' &&
                  `The ${product.name} has a ${product.rating}⭐ rating from ${product.reviewCount} customers. 89% of recent buyers rated it 4+ stars. Based on your order history, this matches your taste preferences — a solid choice! 🍔`}
                {aiPrompt === 'Compare with similar products' &&
                  `Compared to Tower Burger (₦3,900 · 4.5⭐), the Zinger Meal at ₦4,800 offers better value with a drink + fries included. The Bucket ×8 is ideal for groups. Zinger Meal wins on value-per-item.`}
                {aiPrompt === 'Show cheaper alternatives' &&
                  `You might enjoy: Twister Wrap at ₦2,800 (4.4⭐) or Coleslaw Large at ₦900. For a full meal under ₦4,000, consider the Tower Burger combo deal.`}
                {aiPrompt === 'What do customers say?' &&
                  `Most customers love the crunch and spice balance. Common praise: "perfectly cooked fillet", "great value". One common feedback: longer delivery times during peak hours. Overall very positive!`}
                {aiPrompt === 'Nutrition & ingredients' &&
                  `Zinger Meal: ~780 kcal. Contains gluten, dairy. The fillet is marinated in 11 herbs & spices. No artificial preservatives. Not suitable for strict vegetarians.`}
                {!AI_PROMPTS.includes(aiPrompt) &&
                  `I'm here to help you with ${product.name}. You can ask me about nutrition, compare alternatives, check reviews, or get personalised recommendations!`}
              </p>
            </div>
            <button
              onClick={() => setShowAI(false)}
              className="h-[46px] rounded-2xl text-[14px] font-medium transition-all active:scale-[.97]"
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
