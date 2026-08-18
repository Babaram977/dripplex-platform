import React, { useState, useEffect, useRef, useCallback } from 'react';
import { G0, G2, G3, NAVY_BASE, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { BottomNavigation, FloatingAIButton } from '../components/navigation';
import type { NavTabKey } from '../components/navigation/BottomNavigation';
import type { StoreMerchant, StoreProduct } from './storeScreen';
import { api } from '../lib/api';
import type { ProductSummaryDto, MerchantSummaryDto } from '../lib/api';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

// A gallery/thumbnail entry is a real uploaded image when it looks like a URL;
// otherwise it is an emoji placeholder rendered as text.
const isImageUrl = (s: string) => /^(https?:|\/|data:)/.test(s);

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
      {/* Slides — real uploaded image when available, emoji placeholder otherwise */}
      {product.images.map((img, i) => (
        <div
          key={i}
          className="absolute inset-0 flex items-center justify-center overflow-hidden transition-opacity duration-300"
          style={{
            background: product.imageBgs[i] ?? product.imageBgs[0],
            opacity: idx === i ? 1 : 0,
          }}
        >
          {isImageUrl(img) ? (
            <ImageWithFallback
              src={img}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span style={{ fontSize: 96, filter: 'drop-shadow(0 16px 32px rgba(0,0,0,.35))' }}>
              {img}
            </span>
          )}
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
                    Seller replied
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
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-4xl"
            style={{ background: product.imageBgs[0] }}
          >
            {isImageUrl(product.images[0]) ? (
              <ImageWithFallback
                src={product.images[0]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              product.images[0]
            )}
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
  // Real uploaded image identifies the product; the neutral 🛍️ shows only when the
  // merchant hasn't uploaded one. No invented ratings, delivery fees, or copy.
  const hasImage = !!dto.primaryImageUrl;
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? '',
    price: `₦${dto.basePrice.toLocaleString()}`,
    emoji: '🛍️',
    imageUrl: dto.primaryImageUrl,
    merchantId: dto.merchantId,
    unitPrice: dto.basePrice,
    rating: dto.rating?.average ?? 0,
    // The count behind the star, from the same real `rating` object the merchant
    // card already reads. Without it the page always said "(0)" next to a live
    // rating average.
    reviewCount: dto.rating?.count ?? 0,
    inStock: dto.inStock,
    badge: dto.isFeatured ? 'Featured' : undefined,
    badgeColor: dto.isFeatured ? '#8B5CF6' : undefined,
    images: [hasImage ? (dto.primaryImageUrl as string) : '🛍️'],
    imageBgs: ['linear-gradient(135deg,#0D2E18,#176B30)'],
    category: '',
    availability: dto.inStock ? 'In Stock' : 'Out of Stock',
    variantGroups: [],
    reviews: [],
    ratingBreakdown: [0, 0, 0, 0, 0],
    deliveryEta: '—',
    deliveryFee: '—',
    pickupAvailable: false,
    returnPolicy: '',
    related: [],
  };
}

// Minimal MerchantSummaryDto → StoreMerchant for the product-detail merchant card.
// Only real fields; unknowns render as "—" rather than fabricated values.
function dtoToDetailMerchant(dto: MerchantSummaryDto): StoreMerchant {
  return {
    id: dto.id,
    name: dto.businessName,
    category: dto.businessType,
    coverBg: 'linear-gradient(135deg,#0D2E18,#123B22 42%,#1B5E33)',
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
    logoUrl: dto.logoUrl,
    coverPhotoUrl: dto.coverPhotoUrl,
  };
}

// Neutral placeholders for the real (routed) path — never the KFC/Zinger mock,
// which would leak fake identity onto a real product while it loads or on error.
const NEUTRAL_MERCHANT: StoreMerchant = {
  id: '',
  name: 'Store',
  category: '',
  coverBg: 'linear-gradient(135deg,#0D2E18,#123B22 42%,#1B5E33)',
  emoji: '🏪',
  tagline: '',
  rating: 0,
  reviewCount: 0,
  distance: '',
  eta: '—',
  deliveryFee: '—',
  minOrder: '—',
  isOpen: true,
  isVerified: false,
  hours: '—',
  phone: '—',
  address: '—',
};

const NEUTRAL_PRODUCT: ProductDetail = {
  id: '',
  name: '',
  description: '',
  price: '—',
  emoji: '🛍️',
  rating: 0,
  inStock: true,
  images: ['🛍️'],
  imageBgs: ['linear-gradient(135deg,#0D2E18,#176B30)'],
  category: '',
  availability: 'In Stock',
  variantGroups: [],
  reviews: [],
  ratingBreakdown: [0, 0, 0, 0, 0],
  deliveryEta: '—',
  deliveryFee: '—',
  pickupAvailable: false,
  returnPolicy: '',
  related: [],
};

export interface ProductDetailScreenProps {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  onCart?: () => void;
  onCheckout?: () => void;
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
  onCheckout,
  product: productProp,
  merchant: merchantProp,
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
  const [activeTab, setActiveTab] = useState<NavTabKey>('market');
  const [cartCount, setCartCount] = useState(0);
  const [liveProduct, setLiveProduct] = useState<ProductDetail | null>(null);
  const [liveMerchant, setLiveMerchant] = useState<StoreMerchant | null>(null);
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!productId) return;
    api.marketplace
      .getProduct(productId)
      .then((dto) => {
        setLiveProduct(dtoToProductDetail(dto));
        // Fetch the real merchant behind this product so the storefront card and
        // reviews header show the actual seller — not the KFC mock.
        const mid = merchantId ?? dto.merchantId;
        if (mid) {
          api.marketplace
            .getMerchant(mid)
            .then((m) => setLiveMerchant(dtoToDetailMerchant(m)))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [productId, merchantId]);

  // Never fabricate a product. Live backend data wins; an explicitly supplied
  // prop is next; otherwise render the neutral empty state. Previously the mock
  // KFC "Zinger Meal" was the DEFAULT PROP, so any route that reached this
  // screen without a productId showed a fake product to a real customer.
  const product = liveProduct ?? productProp ?? NEUTRAL_PRODUCT;
  const merchant = liveMerchant ?? merchantProp ?? NEUTRAL_MERCHANT;
  const isOutOfStock = product.availability === 'Out of Stock';

  const handleAddToCart = async () => {
    if (isOutOfStock || adding) return;
    setAdding(true);
    try {
      await api.cart.addItem({
        merchantId: merchantId ?? merchant.id,
        productId: productId ?? product.id,
        productName: product.name,
        unitPrice: product.unitPrice ?? (parseInt(product.price.replace(/[₦,]/g, ''), 10) || 0),
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

  // Buy Now: add to cart then jump straight to checkout (skip the confirmation sheet).
  const handleBuyNow = async () => {
    if (isOutOfStock || adding) return;
    setAdding(true);
    try {
      await api.cart.addItem({
        merchantId: merchantId ?? merchant.id,
        productId: productId ?? product.id,
        productName: product.name,
        unitPrice: product.unitPrice ?? (parseInt(product.price.replace(/[₦,]/g, ''), 10) || 0),
        quantity: qty,
      });
    } catch {
      // optimistic — proceed to checkout even if API unavailable
    } finally {
      setAdding(false);
    }
    onCheckout?.();
  };

  const handleTabChange = useCallback(
    (tab: NavTabKey) => {
      setActiveTab(tab);
      if (tab === 'home') onHome();
      if (tab === 'profile') onAccount();
    },
    [onHome, onAccount],
  );

  // GAP: no AI backend exists — these are non-interactive example prompts only.
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
                Coming soon
              </p>
            </div>
          </div>
          <p className="mb-2 text-[11px]" style={{ color: MUTED }}>
            Soon you'll be able to ask:
          </p>
          {/* GAP: no AI backend exists — non-interactive example prompts, not working questions. */}
          <div className="flex flex-wrap gap-2">
            {AI_PROMPTS.map((p) => (
              <span
                key={p}
                className="flex h-[30px] items-center rounded-full px-3 text-[11px] font-medium"
                style={{
                  background: 'rgba(43,172,82,.12)',
                  border: `1px solid rgba(43,172,82,.24)`,
                  color: G3,
                }}
              >
                {p}
              </span>
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
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-2xl"
              style={{ background: merchant.coverBg }}
            >
              {merchant.logoUrl ? (
                <ImageWithFallback
                  src={merchant.logoUrl}
                  alt={merchant.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                merchant.emoji
              )}
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
              onClick={handleBuyNow}
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
                <p className="text-[12px]" style={{ color: MUTED }}>
                  Coming soon
                </p>
              </div>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(43,172,82,.07)', border: `1px solid rgba(43,172,82,.18)` }}
            >
              {/* GAP: no AI backend exists — honest placeholder, no canned replies. */}
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,.7)', fontFamily: "'Inter',sans-serif" }}
              >
                Ask Drip is coming soon. Our AI shopping assistant isn't available yet — check back
                later.
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
