'use client';

import {
  NAVY_DEEP,
  SuperAppFontProvider,
  SuperAppStoreHeader,
  SuperAppStoreSearchBar,
  SuperAppTextChips,
  SuperAppProductGrid,
  SuperAppStoreProductCard,
  SuperAppReviewsSection,
  SuperAppAccordionCard,
  SuperAppInfoList,
  SuperAppBottomNav,
  SuperAppAIFab,
  SuperAppAISheet,
  type SuperAppStoreMerchant,
  type SuperAppStoreProduct,
} from '@dripplex/ui';
import { Inter, Poppins } from 'next/font/google';
import * as React from 'react';
import { useEffect, useState } from 'react';

/**
 * PREVIEW ONLY — not linked from real navigation, not wired to any backend.
 *
 * DPX-101: no screen owns UI. Every visual element below lives in
 * `packages/ui/src/components/super-app/` — this file only composes them
 * with data, matching the founder-approved Figma Make `StoreScreen`
 * (docs/reference/figma-super-app-source/storeScreen.tsx). Second slice
 * of the Marketplace module (after the entry screen) — Product Detail,
 * Cart, Checkout, and Tracking remain.
 */

const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

const MERCHANT: SuperAppStoreMerchant = {
  name: 'KFC Nigeria',
  category: 'Restaurant',
  coverBackground: 'linear-gradient(135deg,#7C2D12,#B45309 42%,#F97316)',
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
};

const STORE_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'featured', label: 'Featured' },
  { key: 'meals', label: 'Meals' },
  { key: 'burgers', label: 'Burgers' },
  { key: 'sides', label: 'Sides' },
  { key: 'drinks', label: 'Drinks' },
  { key: 'promotions', label: 'Promotions' },
];

const PRODUCTS: SuperAppStoreProduct[] = [
  {
    key: 'zinger-meal',
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
    key: 'bucket-meal-8',
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
    key: 'tower-burger',
    name: 'Tower Burger',
    description: 'Double patty, cheese, jalapeños',
    price: '₦3,900',
    emoji: '🥪',
    rating: 4.5,
    inStock: true,
  },
  {
    key: 'twister-wrap',
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
    key: 'family-feast',
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
    key: 'krushers-mango',
    name: 'Krushers Mango',
    description: 'Frozen mango smoothie 400ml',
    price: '₦1,600',
    emoji: '🥤',
    rating: 4.3,
    inStock: false,
  },
  {
    key: 'coleslaw-large',
    name: 'Coleslaw Large',
    description: 'Creamy coleslaw 300g',
    price: '₦900',
    emoji: '🥗',
    rating: 4.2,
    inStock: true,
  },
  {
    key: 'loaded-fries',
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

const RATING_BREAKDOWN = [
  { stars: 5 as const, percent: 65 },
  { stars: 4 as const, percent: 22 },
  { stars: 3 as const, percent: 8 },
  { stars: 2 as const, percent: 3 },
  { stars: 1 as const, percent: 2 },
];

const REVIEWS = [
  {
    key: 'adaeze-o',
    name: 'Adaeze O.',
    initials: 'AO',
    rating: 5,
    date: '2 days ago',
    comment: 'Always consistent quality. The Zinger Meal never disappoints. Fast delivery too!',
    reply: "Thank you Adaeze! 🍗 We're glad you enjoyed it. See you next time!",
    avatarBackground: 'linear-gradient(135deg,#7C3AED,#C084FC)',
  },
  {
    key: 'chukwudi-m',
    name: 'Chukwudi M.',
    initials: 'CM',
    rating: 4,
    date: '5 days ago',
    comment:
      'Great food, packaging was intact. Took 22 minutes which is slightly longer than usual but still acceptable.',
    avatarBackground: 'linear-gradient(135deg,#0C4A6E,#06B6D4)',
  },
  {
    key: 'fatima-b',
    name: 'Fatima B.',
    initials: 'FB',
    rating: 5,
    date: '1 week ago',
    comment:
      'Ordered the Family Feast for a birthday — everyone loved it. Will definitely order again.',
    reply: 'Happy birthday to the family! 🎉 We appreciate your order.',
    avatarBackground: 'linear-gradient(135deg,#831843,#EC4899)',
  },
];

const POLICIES = [
  {
    key: 'delivery',
    icon: '🚚',
    title: 'Delivery Policy',
    body: 'Standard delivery within 5 km radius. Orders above ₦10,000 qualify for free delivery. Delivery time may vary due to traffic and order volume.',
  },
  {
    key: 'returns',
    icon: '↩',
    title: 'Returns & Refunds',
    body: 'Food items cannot be returned once prepared. If your order is incorrect or of poor quality, contact support within 30 minutes of delivery.',
  },
  {
    key: 'cancellation',
    icon: '✕',
    title: 'Order Cancellation',
    body: 'Orders may be cancelled within 2 minutes of placement. After preparation has started, cancellations are not accepted.',
  },
  {
    key: 'allergen',
    icon: '⚠',
    title: 'Allergen Notice',
    body: 'Our products may contain gluten, dairy, eggs, and soy. Please inform us of any allergies before ordering.',
  },
];

const STORE_INFO = [
  { key: 'hours', icon: '🕐', label: 'Hours', value: '8:00 AM – 11:00 PM daily' },
  { key: 'phone', icon: '📞', label: 'Phone', value: '+234 800 532 0000' },
  { key: 'address', icon: '📍', label: 'Address', value: 'KFC Ikeja City Mall, Alausa, Lagos' },
];

const AI_QUESTIONS = [
  'What are the best sellers here?',
  'Is there a meal under ₦3,000?',
  'How long does delivery take?',
  'Any promotions today?',
  "What's the spiciest item?",
];

function filterProducts(active: string): SuperAppStoreProduct[] {
  if (active === 'all') return PRODUCTS;
  if (active === 'promotions') return PRODUCTS.filter((p) => Boolean(p.badge));
  if (active === 'featured') return PRODUCTS.filter((p) => p.rating >= 4.7);
  return PRODUCTS;
}

export default function StorePreviewPage(): React.JSX.Element {
  const [activeCategory, setActiveCategory] = useState('all');
  const [followed, setFollowed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => {
      setLoaded(true);
    }, 900);
    return () => {
      clearTimeout(t);
    };
  }, []);

  const toggleWishlist = (key: string): void => {
    setWishlist((w) => {
      const next = new Set(w);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addToCart = (key: string): void => {
    setCart((c) => new Set(c).add(key));
  };

  return (
    <SuperAppFontProvider heading={poppins.className} body={inter.className}>
      <div
        className={`relative mx-auto flex h-[844px] w-[390px] flex-col overflow-hidden rounded-[32px] ${inter.className}`}
        style={{ background: NAVY_DEEP }}
      >
        <SuperAppStoreHeader
          merchant={MERCHANT}
          cartCount={cart.size}
          followed={followed}
          onFollow={() => {
            setFollowed((f) => !f);
          }}
        />
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <SuperAppStoreSearchBar storeName={MERCHANT.name} />
          <SuperAppTextChips
            chips={STORE_CATEGORIES}
            active={activeCategory}
            onChange={setActiveCategory}
          />
          <div style={{ height: 16 }} />
          <SuperAppProductGrid
            title="Menu"
            items={filterProducts(activeCategory)}
            loaded={loaded}
            keyExtractor={(p) => p.key}
            renderItem={(p) => (
              <SuperAppStoreProductCard
                product={p}
                isWishlisted={wishlist.has(p.key)}
                isInCart={cart.has(p.key)}
                onToggleWishlist={() => {
                  toggleWishlist(p.key);
                }}
                onAddToCart={() => {
                  addToCart(p.key);
                }}
              />
            )}
          />
          <SuperAppReviewsSection
            rating={MERCHANT.rating}
            reviewCount={MERCHANT.reviewCount}
            breakdown={RATING_BREAKDOWN}
            reviews={REVIEWS}
          />
          <SuperAppAccordionCard title="Store Policies" items={POLICIES} />
          <SuperAppInfoList title="Store Information" rows={STORE_INFO} />
          <div style={{ height: 104 }} />
        </div>
        <SuperAppAIFab
          onPress={() => {
            setShowAI(true);
          }}
        />
        <SuperAppBottomNav active="marketplace" />
        {showAI && (
          <SuperAppAISheet
            subtitle={`About ${MERCHANT.name}`}
            prompts={AI_QUESTIONS}
            showIcons={false}
            onClose={() => {
              setShowAI(false);
            }}
          />
        )}
      </div>
    </SuperAppFontProvider>
  );
}
