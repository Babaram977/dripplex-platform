import React, { useState, useCallback, useEffect } from 'react';
import { G0, G2, G3, NAVY_BASE, NAVY_CARD, NAVY_SURFACE, BORDER, MUTED } from './shared';
import { api } from '../lib/api';
import type { CartDto } from '../lib/api';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { BottomNavigation, FloatingAIButton } from '../components/navigation';
import type { NavTabKey } from '../components/navigation/BottomNavigation';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
export interface CartItemVariant {
  label: string;
  value: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  emoji: string;
  imageUrl?: string | null;
  imageBg: string;
  unitPrice: number;
  qty: number;
  variants: CartItemVariant[];
  badge?: string;
  badgeColor?: string;
  inStock: boolean;
  priceChanged?: boolean;
}

export interface CartMerchant {
  id: string;
  name: string;
  emoji: string;
  coverBg: string;
  isVerified: boolean;
  isOpen: boolean;
  deliveryFee: number;
  eta: string;
  cashback: number;
  items: CartItem[];
}

type DeliveryMode = 'standard' | 'express' | 'pickup';

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_CART: CartMerchant[] = [
  {
    id: 'kfc',
    name: 'KFC Nigeria',
    emoji: '🍗',
    coverBg: 'linear-gradient(135deg,#7C2D12,#F97316)',
    isVerified: true,
    isOpen: true,
    deliveryFee: 350,
    eta: '18–25 min',
    cashback: 240,
    items: [
      {
        id: 'ci1',
        productId: 'p1',
        name: 'Zinger Meal',
        emoji: '🍔',
        imageBg: 'linear-gradient(145deg,#7C2D12,#EA580C)',
        unitPrice: 4800,
        qty: 2,
        variants: [
          { label: 'Size', value: 'Large' },
          { label: 'Spice', value: 'Medium 🌶🌶' },
          { label: 'Drink', value: 'Pepsi' },
        ],
        badge: '-13%',
        badgeColor: '#EF4444',
        inStock: true,
      },
      {
        id: 'ci2',
        productId: 'p8',
        name: 'Loaded Fries',
        emoji: '🍟',
        imageBg: 'linear-gradient(145deg,#92400E,#D97706)',
        unitPrice: 2200,
        qty: 1,
        variants: [{ label: 'Size', value: 'Regular' }],
        badge: 'New',
        badgeColor: '#10B981',
        inStock: true,
      },
      {
        id: 'ci3',
        productId: 'p7',
        name: 'Coleslaw',
        emoji: '🥗',
        imageBg: 'linear-gradient(145deg,#166534,#22C55E)',
        unitPrice: 900,
        qty: 1,
        variants: [],
        inStock: true,
      },
    ],
  },
  {
    id: 'shoprite',
    name: 'Shoprite Kano',
    emoji: '🛒',
    coverBg: 'linear-gradient(135deg,#1D4ED8,#06B6D4)',
    isVerified: true,
    isOpen: true,
    deliveryFee: 500,
    eta: '35–50 min',
    cashback: 180,
    items: [
      {
        id: 'ci4',
        productId: 's1',
        name: 'Golden Penny Rice 5kg',
        emoji: '🍚',
        imageBg: 'linear-gradient(145deg,#B45309,#FCD34D)',
        unitPrice: 5500,
        qty: 1,
        variants: [{ label: 'Size', value: '5 kg bag' }],
        inStock: true,
      },
      {
        id: 'ci5',
        productId: 's2',
        name: 'Peak Milk 400g',
        emoji: '🥛',
        imageBg: 'linear-gradient(145deg,#1E3A5F,#0EA5E9)',
        unitPrice: 1800,
        qty: 3,
        variants: [{ label: 'Pack', value: '400g × 3' }],
        inStock: true,
        priceChanged: true,
      },
    ],
  },
];

const SAVED_LATER: CartItem[] = [
  {
    id: 'sl1',
    productId: 'p5',
    name: 'KFC Family Feast',
    emoji: '🍽',
    imageBg: 'linear-gradient(145deg,#7C2D12,#F97316)',
    unitPrice: 28000,
    qty: 1,
    variants: [{ label: 'Size', value: '14 pcs' }],
    inStock: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₦${n.toLocaleString()}`;

// ─────────────────────────────────────────────────────────────────────────────
// CART ITEM ROW
// ─────────────────────────────────────────────────────────────────────────────
function CartItemRow({
  item,
  onQtyChange,
  onRemove,
  onSaveForLater,
}: {
  item: CartItem;
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onSaveForLater: (id: string) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const lineTotal = item.unitPrice * item.qty;

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => onRemove(item.id), 320);
  };

  return (
    <div
      className="transition-all duration-300"
      style={{
        opacity: removing ? 0 : 1,
        transform: removing ? 'scale(.95) translateX(24px)' : 'scale(1)',
      }}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        {/* Product thumbnail — real image when available, neutral icon otherwise */}
        <div
          className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          style={{ background: item.imageBg }}
        >
          {item.imageUrl ? (
            <ImageWithFallback
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span style={{ fontSize: 32 }}>{item.emoji}</span>
          )}
          {item.badge && (
            <span
              className="absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
              style={{ background: item.badgeColor, color: '#FFF' }}
            >
              {item.badge}
            </span>
          )}
          {!item.inStock && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl"
              style={{ background: 'rgba(0,0,0,.6)' }}
            >
              <span className="text-[10px] font-bold text-white">Out</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className="text-[14px] font-semibold leading-tight text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              {item.name}
            </p>
            <button
              onClick={handleRemove}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all active:scale-90"
              style={{
                background: 'rgba(248,113,113,.1)',
                border: '1px solid rgba(248,113,113,.2)',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F87171"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {item.variants.length > 0 && (
            <p className="mt-0.5 truncate text-[11px]" style={{ color: MUTED }}>
              {item.variants.map((v) => `${v.value}`).join(' · ')}
            </p>
          )}

          {item.priceChanged && (
            <div className="mt-1 flex items-center gap-1.5">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span className="text-[10px] font-semibold" style={{ color: '#FCD34D' }}>
                Price updated
              </span>
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between">
            {/* Qty controls */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onQtyChange(item.id, Math.max(1, item.qty - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-90"
                style={{
                  background: item.qty <= 1 ? 'rgba(255,255,255,.04)' : 'rgba(43,172,82,.14)',
                  border: `1px solid ${item.qty <= 1 ? BORDER : 'rgba(43,172,82,.28)'}`,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={item.qty <= 1 ? MUTED : G3}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <span
                className="w-5 text-center text-[14px] font-bold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                {item.qty}
              </span>
              <button
                onClick={() => onQtyChange(item.id, item.qty + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-all active:scale-90"
                style={{
                  background: 'rgba(43,172,82,.14)',
                  border: `1px solid rgba(43,172,82,.28)`,
                }}
              >
                <svg
                  width="12"
                  height="12"
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

            <div className="flex items-center gap-3">
              <button
                onClick={() => onSaveForLater(item.id)}
                className="text-[11px] font-semibold transition-opacity active:opacity-60"
                style={{ color: G3 }}
              >
                Save
              </button>
              <span
                className="text-[15px] font-bold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                {fmt(lineTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MERCHANT GROUP
// ─────────────────────────────────────────────────────────────────────────────
function MerchantGroup({
  merchant,
  deliveryMode,
  onQtyChange,
  onRemove,
  onSaveForLater,
}: {
  merchant: CartMerchant;
  deliveryMode: DeliveryMode;
  onQtyChange: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
  onSaveForLater: (itemId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const subtotal = merchant.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const fee =
    deliveryMode === 'pickup'
      ? 0
      : deliveryMode === 'express'
        ? merchant.deliveryFee * 2
        : merchant.deliveryFee;
  const hasIssues = merchant.items.some((i) => !i.inStock || i.priceChanged) || !merchant.isOpen;

  return (
    <div
      className="mb-4 overflow-hidden rounded-3xl"
      style={{
        background: NAVY_CARD,
        border: `1.5px solid ${hasIssues ? 'rgba(248,113,113,.28)' : BORDER}`,
      }}
    >
      {/* Merchant header */}
      <button
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
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
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
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
            {!merchant.isOpen && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                style={{ background: 'rgba(248,113,113,.18)', color: '#F87171' }}
              >
                CLOSED
              </span>
            )}
          </div>
          <span className="text-[11px]" style={{ color: MUTED }}>
            {merchant.items.length} item{merchant.items.length > 1 ? 's' : ''} · ⚡ {merchant.eta}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasIssues && (
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: 'rgba(248,113,113,.2)' }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F87171"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={MUTED}
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform .25s',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Items */}
      {!collapsed && (
        <>
          <div style={{ borderTop: `1px solid ${BORDER}` }}>
            {merchant.items.map((item, i) => (
              <div key={item.id}>
                <CartItemRow
                  item={item}
                  onQtyChange={onQtyChange}
                  onRemove={onRemove}
                  onSaveForLater={onSaveForLater}
                />
                {i < merchant.items.length - 1 && (
                  <div className="mx-4 h-px" style={{ background: BORDER }} />
                )}
              </div>
            ))}
          </div>

          {/* Merchant subtotal strip */}
          <div
            className="flex flex-col gap-1.5 px-4 py-3"
            style={{ borderTop: `1px solid ${BORDER}`, background: 'rgba(255,255,255,.02)' }}
          >
            <div className="flex items-center justify-between text-[12px]">
              <span style={{ color: MUTED }}>Subtotal</span>
              <span className="font-medium text-white">{fmt(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span style={{ color: MUTED }}>
                Delivery{' '}
                {deliveryMode === 'pickup'
                  ? '(Pickup)'
                  : deliveryMode === 'express'
                    ? '(Express)'
                    : ''}
              </span>
              <span style={{ color: fee === 0 ? G3 : 'rgba(255,255,255,.7)' }}>
                {fee === 0 ? 'FREE' : fmt(fee)}
              </span>
            </div>
            {merchant.cashback > 0 && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-1">
                  💳 <span style={{ color: G3 }}>Wallet Cashback</span>
                </span>
                <span style={{ color: G3 }}>+{fmt(merchant.cashback)}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY CART
// ─────────────────────────────────────────────────────────────────────────────
function EmptyCart({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 py-16">
      <div className="relative">
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full"
          style={{ background: 'rgba(255,255,255,.04)', border: `1.5px solid ${BORDER}` }}
        >
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,.18)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-1 text-3xl">😔</div>
      </div>
      <div className="flex flex-col gap-2 text-center">
        <p
          className="text-[20px] font-bold text-white"
          style={{ fontFamily: "'Poppins',sans-serif" }}
        >
          Your cart is empty
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
          Looks like you haven't added anything yet. Explore the marketplace and find something you
          love!
        </p>
      </div>
      <button
        onClick={onBrowse}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[.97]"
        style={{
          background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
          boxShadow: `0 10px 32px rgba(43,172,82,.36)`,
          fontFamily: "'Poppins',sans-serif",
        }}
      >
        Browse Marketplace
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export interface CartScreenProps {
  onBack: () => void;
  onHome: () => void;
  onAccount: () => void;
  onNotifications: () => void;
  onCheckout?: () => void;
}

function applyCart(cart: CartDto | null): CartMerchant[] {
  if (!cart || !cart.items?.length) return [];
  const merchant: CartMerchant = {
    id: cart.merchantId,
    name: 'Your Cart',
    emoji: '🛒',
    coverBg: 'linear-gradient(135deg,#0D2E18,#2BAC52)',
    isVerified: true,
    isOpen: true,
    deliveryFee: 350,
    eta: '20–35 min',
    cashback: 0,
    items: cart.items.map((ci) => ({
      id: ci.id,
      productId: ci.productId,
      name: ci.productNameSnapshot ?? 'Item',
      // Real product image captured at add-to-cart; neutral 🛍️ fallback when the
      // product has no image (was a hardcoded 🍽 plate, wrong for non-food stores).
      imageUrl: ci.imageSnapshot,
      emoji: '🛍️',
      imageBg: 'linear-gradient(135deg,#0D2E18,#2BAC52)',
      unitPrice: ci.unitPriceSnapshot,
      qty: ci.quantity,
      variants: [],
      inStock: true,
    })),
  };
  return [merchant];
}

export function CartScreen({
  onBack,
  onHome,
  onAccount,
  onNotifications,
  onCheckout,
}: CartScreenProps) {
  const [merchants, setMerchants] = useState<CartMerchant[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState<string | null>(null);
  const [savedLater, setSavedLater] = useState<CartItem[]>(SAVED_LATER);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('standard');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [clearSheet, setClearSheet] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTabKey>('market');

  useEffect(() => {
    api.cart
      .get()
      .then((cart) => {
        setMerchants(applyCart(cart));
        setCartLoading(false);
      })
      .catch(() => {
        setMerchants(MOCK_CART);
        setCartLoading(false);
      });
  }, []);

  const WALLET_BALANCE = 12500;
  const PROMO_DISCOUNT = promoApplied ? 500 : 0;
  const PROMO_CODE_VALID = 'DRIP20';

  // Aggregated totals
  const allItems = merchants.flatMap((m) => m.items);
  const itemCount = allItems.reduce((s, i) => s + i.qty, 0);
  const itemsTotal = allItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const deliveryTotal = merchants.reduce(
    (s, m) =>
      s +
      (deliveryMode === 'pickup'
        ? 0
        : deliveryMode === 'express'
          ? m.deliveryFee * 2
          : m.deliveryFee),
    0,
  );
  const cashbackTotal = merchants.reduce((s, m) => s + m.cashback, 0);
  const walletApplied = useWallet ? Math.min(WALLET_BALANCE, itemsTotal * 0.2) : 0;
  const grandTotal = itemsTotal + deliveryTotal - PROMO_DISCOUNT - walletApplied;

  const updateQty = useCallback((itemId: string, qty: number) => {
    // Optimistic update
    setMerchants((prev) =>
      prev.map((m) => ({
        ...m,
        items: m.items.map((i) => (i.id === itemId ? { ...i, qty } : i)),
      })),
    );
    api.cart.updateItem(itemId, qty).catch(() => {});
  }, []);

  const removeItem = useCallback((itemId: string) => {
    // Optimistic update
    setMerchants((prev) =>
      prev
        .map((m) => ({
          ...m,
          items: m.items.filter((i) => i.id !== itemId),
        }))
        .filter((m) => m.items.length > 0),
    );
    api.cart.removeItem(itemId).catch(() => {});
  }, []);

  const saveForLater = useCallback(
    (itemId: string) => {
      const found = allItems.find((i) => i.id === itemId);
      if (!found) return;
      setSavedLater((prev) => [...prev, found]);
      removeItem(itemId);
    },
    [allItems, removeItem],
  );

  const moveToCart = useCallback(
    (itemId: string) => {
      const found = savedLater.find((i) => i.id === itemId);
      if (!found) return;
      setSavedLater((prev) => prev.filter((i) => i.id !== itemId));
      setMerchants((prev) => {
        const first = prev[0];
        if (!first) return prev;
        return prev.map((m, idx) => (idx === 0 ? { ...m, items: [...m.items, found] } : m));
      });
    },
    [savedLater],
  );

  const applyPromo = () => {
    if (promoCode.toUpperCase() === PROMO_CODE_VALID) {
      setPromoApplied(true);
      setPromoError(false);
    } else {
      setPromoError(true);
      setPromoApplied(false);
    }
  };

  const clearCart = () => {
    setMerchants([]);
    setClearSheet(false);
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
    'Find cheaper alternatives',
    'Combine deliveries',
    'Apply best promo',
    'Complementary items',
    'Optimize my order',
  ];

  const isEmpty = merchants.length === 0;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: NAVY_BASE }}
    >
      {/* ── Status bar ── */}
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

      {/* ── Header ── */}
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
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p
              className="text-[18px] font-bold leading-none text-white"
              style={{ fontFamily: "'Poppins',sans-serif" }}
            >
              Shopping Cart
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
              {itemCount} item{itemCount !== 1 ? 's' : ''} from {merchants.length} merchant
              {merchants.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={() => setClearSheet(true)}
            className="h-8 rounded-xl px-3 text-[12px] font-semibold transition-opacity active:opacity-70"
            style={{
              background: 'rgba(248,113,113,.1)',
              border: '1px solid rgba(248,113,113,.22)',
              color: '#F87171',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div
        className="flex-1 overflow-y-auto px-4"
        style={{ scrollbarWidth: 'none', paddingBottom: 120 }}
      >
        {isEmpty ? (
          <EmptyCart onBrowse={onBack} />
        ) : (
          <>
            {/* Merchant groups */}
            {merchants.map((m) => (
              <MerchantGroup
                key={m.id}
                merchant={m}
                deliveryMode={deliveryMode}
                onQtyChange={updateQty}
                onRemove={removeItem}
                onSaveForLater={saveForLater}
              />
            ))}

            {/* Delivery options */}
            <div
              className="mb-4 rounded-2xl p-4"
              style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            >
              <p
                className="mb-3 text-[12px] font-semibold uppercase tracking-widest"
                style={{ color: MUTED }}
              >
                Delivery Option
              </p>
              <div className="flex flex-col gap-2">
                {[
                  {
                    key: 'standard' as const,
                    icon: '🚚',
                    label: 'Standard',
                    sub: '18–50 min',
                    extraFee: '',
                  },
                  {
                    key: 'express' as const,
                    icon: '⚡',
                    label: 'Express',
                    sub: '< 20 min',
                    extraFee: '2× fee',
                  },
                  {
                    key: 'pickup' as const,
                    icon: '🏪',
                    label: 'Pickup',
                    sub: 'Ready in 15 min',
                    extraFee: 'Free',
                  },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setDeliveryMode(opt.key)}
                    className="flex items-center gap-3 rounded-xl p-3 text-left transition-all"
                    style={{
                      background:
                        deliveryMode === opt.key ? 'rgba(43,172,82,.12)' : 'rgba(255,255,255,.03)',
                      border: `1.5px solid ${deliveryMode === opt.key ? G2 : BORDER}`,
                    }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-xl"
                      style={{
                        background:
                          deliveryMode === opt.key ? 'rgba(43,172,82,.2)' : 'rgba(255,255,255,.05)',
                      }}
                    >
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <p
                        className="text-[13px] font-semibold text-white"
                        style={{ fontFamily: "'Poppins',sans-serif" }}
                      >
                        {opt.label}
                      </p>
                      <p className="text-[11px]" style={{ color: MUTED }}>
                        {opt.sub}
                      </p>
                    </div>
                    {opt.extraFee && (
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: deliveryMode === opt.key ? G3 : MUTED }}
                      >
                        {opt.extraFee}
                      </span>
                    )}
                    <div
                      className="flex h-4 w-4 items-center justify-center rounded-full border-2"
                      style={{ borderColor: deliveryMode === opt.key ? G2 : BORDER }}
                    >
                      {deliveryMode === opt.key && (
                        <div className="h-2 w-2 rounded-full" style={{ background: G2 }} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Card */}
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
                    className="flex h-[28px] items-center rounded-full px-3 text-[11px] font-medium"
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

            {/* Promo Code */}
            <div
              className="mb-4 rounded-2xl p-4"
              style={{
                background: NAVY_CARD,
                border: `1px solid ${promoApplied ? 'rgba(43,172,82,.35)' : BORDER}`,
              }}
            >
              <p
                className="mb-2.5 text-[12px] font-semibold uppercase tracking-widest"
                style={{ color: MUTED }}
              >
                Promo Code
              </p>
              {promoApplied ? (
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-[44px] flex-1 items-center gap-2 rounded-xl px-3"
                    style={{
                      background: 'rgba(43,172,82,.1)',
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
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="text-[13px] font-semibold" style={{ color: G3 }}>
                      DRIP20 — ₦500 off
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setPromoApplied(false);
                      setPromoCode('');
                    }}
                    className="text-[12px] font-semibold active:opacity-60"
                    style={{ color: '#F87171' }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoError(false);
                    }}
                    placeholder="Enter promo code"
                    className="h-[44px] flex-1 rounded-xl px-4 text-[13px] text-white outline-none"
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      background: 'rgba(255,255,255,.05)',
                      border: `1.5px solid ${promoError ? 'rgba(248,113,113,.5)' : BORDER}`,
                    }}
                  />
                  <button
                    onClick={applyPromo}
                    className="h-[44px] rounded-xl px-4 text-[13px] font-semibold text-white transition-all active:scale-95"
                    style={{
                      background: promoCode
                        ? `linear-gradient(135deg,${G0},${G2})`
                        : 'rgba(255,255,255,.06)',
                      color: promoCode ? 'white' : MUTED,
                    }}
                  >
                    Apply
                  </button>
                </div>
              )}
              {promoError && (
                <p className="mt-1.5 text-[11px]" style={{ color: '#F87171' }}>
                  Invalid code. Try DRIP20 🎁
                </p>
              )}
            </div>

            {/* Wallet toggle */}
            <div
              className="mb-4 rounded-2xl p-4"
              style={{
                background: NAVY_CARD,
                border: `1.5px solid ${useWallet ? 'rgba(43,172,82,.35)' : BORDER}`,
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                  style={{
                    background: useWallet ? 'rgba(43,172,82,.18)' : 'rgba(255,255,255,.05)',
                  }}
                >
                  💳
                </div>
                <div className="flex-1">
                  <p
                    className="text-[13px] font-semibold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    DrippleX Wallet
                  </p>
                  <p className="text-[12px]" style={{ color: useWallet ? G3 : MUTED }}>
                    Balance: {fmt(WALLET_BALANCE)}
                  </p>
                </div>
                <button
                  onClick={() => setUseWallet((v) => !v)}
                  className="relative h-6 w-12 rounded-full transition-all duration-300"
                  style={{ background: useWallet ? G2 : 'rgba(255,255,255,.12)' }}
                >
                  <div
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all duration-300"
                    style={{ left: useWallet ? 'calc(100% - 22px)' : 2 }}
                  />
                </button>
              </div>
              {useWallet && (
                <div
                  className="mt-2 flex items-center justify-between pt-2.5 text-[12px]"
                  style={{ borderTop: `1px solid rgba(43,172,82,.18)` }}
                >
                  <span style={{ color: G3 }}>Applying wallet</span>
                  <span className="font-semibold" style={{ color: G3 }}>
                    −{fmt(Math.round(walletApplied))}
                  </span>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div
              className="mb-4 rounded-2xl p-4"
              style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
            >
              <p
                className="mb-3 text-[12px] font-semibold uppercase tracking-widest"
                style={{ color: MUTED }}
              >
                Order Summary
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Items Total', value: fmt(itemsTotal), color: 'rgba(255,255,255,.8)' },
                  {
                    label: 'Delivery Fees',
                    value: deliveryTotal === 0 ? 'FREE' : fmt(deliveryTotal),
                    color: 'rgba(255,255,255,.7)',
                  },
                  ...(PROMO_DISCOUNT > 0
                    ? [{ label: `Promo (DRIP20)`, value: `−${fmt(PROMO_DISCOUNT)}`, color: G3 }]
                    : []),
                  ...(useWallet && walletApplied > 0
                    ? [
                        {
                          label: 'Wallet Applied',
                          value: `−${fmt(Math.round(walletApplied))}`,
                          color: G3,
                        },
                      ]
                    : []),
                  { label: 'Wallet Cashback', value: `+${fmt(cashbackTotal)}`, color: G3 },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: MUTED }}>
                      {row.label}
                    </span>
                    <span className="text-[13px] font-medium" style={{ color: row.color }}>
                      {row.value}
                    </span>
                  </div>
                ))}
                <div className="my-1 h-px" style={{ background: BORDER }} />
                <div className="flex items-center justify-between">
                  <span
                    className="text-[15px] font-semibold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    Grand Total
                  </span>
                  <span
                    className="text-[18px] font-bold text-white"
                    style={{ fontFamily: "'Poppins',sans-serif" }}
                  >
                    {fmt(Math.round(grandTotal))}
                  </span>
                </div>
              </div>
            </div>

            {/* Saved for later */}
            {savedLater.length > 0 && (
              <div
                className="mb-4 overflow-hidden rounded-2xl"
                style={{ background: NAVY_CARD, border: `1px solid ${BORDER}` }}
              >
                <button
                  className="flex w-full items-center justify-between px-4 py-3.5"
                  onClick={() => setSavedOpen((v) => !v)}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={MUTED}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                    </svg>
                    <span
                      className="text-[13px] font-semibold text-white"
                      style={{ fontFamily: "'Poppins',sans-serif" }}
                    >
                      Saved for Later
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: 'rgba(255,255,255,.08)', color: MUTED }}
                    >
                      {savedLater.length}
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
                      transform: savedOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform .25s',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {savedOpen && (
                  <div style={{ borderTop: `1px solid ${BORDER}` }}>
                    {savedLater.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: `1px solid ${BORDER}` }}
                      >
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                          style={{ background: item.imageBg }}
                        >
                          {item.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-[13px] font-semibold text-white"
                            style={{ fontFamily: "'Poppins',sans-serif" }}
                          >
                            {item.name}
                          </p>
                          <p className="text-[12px]" style={{ color: G3 }}>
                            {fmt(item.unitPrice)}
                          </p>
                        </div>
                        <button
                          onClick={() => moveToCart(item.id)}
                          className="h-8 rounded-xl px-3 text-[12px] font-semibold transition-all active:scale-95"
                          style={{
                            background: 'rgba(43,172,82,.14)',
                            border: `1px solid rgba(43,172,82,.28)`,
                            color: G3,
                          }}
                        >
                          Add to Cart
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Sticky Bottom Bar ── */}
      {!isEmpty && (
        <div
          className="absolute bottom-0 left-0 right-0 z-30"
          style={{ background: `linear-gradient(to top,${NAVY_BASE} 80%,transparent)` }}
        >
          <div className="flex items-center gap-3 px-5 pb-2 pt-2">
            <div className="flex flex-col">
              <span className="text-[11px]" style={{ color: MUTED }}>
                Grand Total
              </span>
              <span
                className="text-[18px] font-bold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                {fmt(Math.round(grandTotal))}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all active:scale-[.97]"
              style={{
                background: `linear-gradient(135deg,${G0},${G2} 55%,${G3})`,
                boxShadow: `0 10px 32px rgba(43,172,82,.36)`,
                fontFamily: "'Poppins',sans-serif",
              }}
            >
              Proceed to Checkout
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <BottomNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
            marketBadge={itemCount}
          />
        </div>
      )}

      {/* Floating AI */}
      <FloatingAIButton onPress={() => setShowAI((v) => !v)} bottom={96} />

      {/* Clear cart sheet */}
      {clearSheet && (
        <div
          className="absolute inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,.72)' }}
          onClick={() => setClearSheet(false)}
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
              <span style={{ fontSize: 36 }}>🗑</span>
              <p
                className="mb-1 mt-2 text-[17px] font-bold text-white"
                style={{ fontFamily: "'Poppins',sans-serif" }}
              >
                Clear Cart?
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>
                All items will be removed. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setClearSheet(false)}
                className="h-[48px] flex-1 rounded-2xl text-[14px] font-medium"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: `1px solid ${BORDER}`,
                  color: MUTED,
                }}
              >
                Cancel
              </button>
              <button
                onClick={clearCart}
                className="h-[48px] flex-1 rounded-2xl text-[14px] font-bold"
                style={{
                  background: 'rgba(248,113,113,.18)',
                  border: '1px solid rgba(248,113,113,.3)',
                  color: '#F87171',
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
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
                style={{ color: 'rgba(255,255,255,.72)', fontFamily: "'Inter',sans-serif" }}
              >
                Ask Drip is coming soon. Our AI assistant isn't available yet — check back later.
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
