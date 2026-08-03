'use client';

import {
  NAVY_DEEP,
  SuperAppFontProvider,
  SuperAppMarketplaceHeader,
  SuperAppCategoryChips,
  SuperAppAIDiscoveryBanner,
  SuperAppDealsCarousel,
  SuperAppFeaturedMerchantsSection,
  SuperAppSectionHeader,
  SuperAppHorizontalSection,
  SuperAppProductCard,
  SuperAppVerticalListCard,
  SuperAppNearbyBusinessRow,
  SuperAppNearbyBusinessSkeletonRow,
  SuperAppAIRecommendationCard,
  SuperAppRecentlyViewedCard,
  SuperAppBottomNav,
  SuperAppAIFab,
  SuperAppAISheet,
  type SuperAppFeaturedMerchant,
  type SuperAppProduct,
  type SuperAppNearbyBusiness,
  type SuperAppAIRecommendation,
  type SuperAppRecentlyViewed,
  type SuperAppDeal,
} from '@dripplex/ui';
import { Inter, Poppins } from 'next/font/google';
import * as React from 'react';
import { useEffect, useState } from 'react';

/**
 * PREVIEW ONLY — not linked from real navigation, not wired to any backend.
 *
 * DPX-101: no screen owns UI. Every visual element below lives in
 * `packages/ui/src/components/super-app/` — this file only composes them
 * with data, matching the founder-approved Figma Make `MarketplaceScreen`
 * (docs/reference/figma-super-app-source/marketplaceScreen.tsx). This is
 * the Marketplace *entry* screen only — Store, Product Detail, Cart,
 * Checkout, and Tracking are separate screens in the source, ported in
 * later slices per the founder's module-by-module sequencing.
 *
 * Not to be confused with the real, backend-wired `(public)/marketplace`
 * route (from R1.5) — this lives entirely under /preview and exists only
 * to verify pixel parity against the Figma export.
 */

const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

const CATEGORY_CHIPS = [
  { key: 'all', icon: '✦', label: 'All' },
  { key: 'supermarkets', icon: '🛒', label: 'Supermarkets' },
  { key: 'restaurants', icon: '🍽', label: 'Restaurants' },
  { key: 'pharmacy', icon: '💊', label: 'Pharmacy' },
  { key: 'electronics', icon: '📱', label: 'Electronics' },
  { key: 'fashion', icon: '👗', label: 'Fashion' },
  { key: 'beauty', icon: '💄', label: 'Beauty' },
  { key: 'hardware', icon: '🔧', label: 'Hardware' },
  { key: 'hotels', icon: '🏨', label: 'Hotels' },
  { key: 'furniture', icon: '🛋', label: 'Furniture' },
  { key: 'services', icon: '⚙', label: 'Services' },
  { key: 'wholesale', icon: '📦', label: 'Wholesale' },
];

const AI_PROMPTS = [
  'Find the best shawarma near me',
  'Groceries under ₦20,000',
  'Pharmacy open right now',
  'Phone under ₦300,000',
  'Find an electrician nearby',
];

const FEATURED_MERCHANTS: SuperAppFeaturedMerchant[] = [
  {
    key: 'shoprite-ikeja',
    name: 'Shoprite Ikeja',
    category: 'Supermarket',
    rating: 4.8,
    distance: '0.4 km',
    eta: '12 min',
    deliveryFee: 'Free delivery',
    isFreeDelivery: true,
    open: true,
    verified: true,
    background: 'linear-gradient(135deg,#7F1D1D,#EF4444)',
    emoji: '🛒',
    tag: 'Free Delivery',
    tagColor: '#10B981',
  },
  {
    key: 'kfc-nigeria',
    name: 'KFC Nigeria',
    category: 'Restaurant',
    rating: 4.6,
    distance: '0.9 km',
    eta: '18 min',
    deliveryFee: '₦350 delivery',
    isFreeDelivery: false,
    open: true,
    verified: true,
    background: 'linear-gradient(135deg,#7C2D12,#F97316)',
    emoji: '🍗',
    tag: '20% Off',
    tagColor: '#F59E0B',
  },
  {
    key: 'healthplus',
    name: 'HealthPlus',
    category: 'Pharmacy',
    rating: 4.9,
    distance: '0.6 km',
    eta: '15 min',
    deliveryFee: '₦200 delivery',
    isFreeDelivery: false,
    open: true,
    verified: true,
    background: 'linear-gradient(135deg,#0C4A6E,#06B6D4)',
    emoji: '💊',
    tag: 'Trusted',
    tagColor: '#06B6D4',
  },
  {
    key: 'ruff-n-tumble',
    name: 'Ruff n Tumble',
    category: 'Fashion',
    rating: 4.7,
    distance: '1.8 km',
    eta: '28 min',
    deliveryFee: '₦500 delivery',
    isFreeDelivery: false,
    open: true,
    verified: true,
    background: 'linear-gradient(135deg,#2E1065,#8B5CF6)',
    emoji: '👗',
    tag: 'New In',
    tagColor: '#8B5CF6',
  },
  {
    key: 'slot-systems',
    name: 'Slot Systems',
    category: 'Electronics',
    rating: 4.5,
    distance: '2.2 km',
    eta: '35 min',
    deliveryFee: '₦600 delivery',
    isFreeDelivery: false,
    open: false,
    verified: true,
    background: 'linear-gradient(135deg,#1E3A5F,#3B82F6)',
    emoji: '📱',
    tag: 'Verified',
    tagColor: '#3B82F6',
  },
  {
    key: 'house-of-tara',
    name: 'House of Tara',
    category: 'Beauty',
    rating: 4.6,
    distance: '1.1 km',
    eta: '20 min',
    deliveryFee: '₦250 delivery',
    isFreeDelivery: false,
    open: true,
    verified: false,
    background: 'linear-gradient(135deg,#831843,#EC4899)',
    emoji: '💄',
    tag: 'Popular',
    tagColor: '#EC4899',
  },
];

const TRENDING_PRODUCTS: SuperAppProduct[] = [
  {
    key: 'basmati-rice',
    emoji: '🍚',
    name: 'Basmati Rice 5kg',
    price: '₦7,800',
    wasPrice: '₦9,500',
    rating: 4.7,
    store: 'Shoprite',
    badge: '-18%',
    badgeColor: '#EF4444',
  },
  {
    key: 'air-force-1',
    emoji: '👟',
    name: 'Nike Air Force 1',
    price: '₦48,000',
    wasPrice: '₦65,000',
    rating: 4.8,
    store: 'SportsDirect',
    badge: '-26%',
    badgeColor: '#F97316',
  },
  {
    key: 'samsung-a55',
    emoji: '📱',
    name: 'Samsung A55 128GB',
    price: '₦224,000',
    wasPrice: '₦285,000',
    rating: 4.6,
    store: 'Slot',
    badge: '-21%',
    badgeColor: '#3B82F6',
  },
  {
    key: 'dove-body-wash',
    emoji: '🧴',
    name: 'Dove Body Wash 500ml',
    price: '₦2,100',
    wasPrice: '₦2,800',
    rating: 4.5,
    store: 'HealthPlus',
    badge: '-25%',
    badgeColor: '#10B981',
  },
  {
    key: 'ankara-6-yards',
    emoji: '🧵',
    name: 'Ankara 6 Yards',
    price: '₦14,500',
    wasPrice: '₦18,000',
    rating: 4.9,
    store: 'Ruff n Tumble',
    badge: '-19%',
    badgeColor: '#8B5CF6',
  },
];

const DEALS: SuperAppDeal[] = [
  {
    key: 'free-delivery-all-day',
    background: 'linear-gradient(135deg,#064E3B,#065F46 42%,#10B981)',
    icon: '🚚',
    title: 'Free Delivery All Day',
    subtitle: 'On orders over ₦5,000',
    cta: 'Shop Now',
  },
  {
    key: 'weekend-flash-sale',
    background: 'linear-gradient(135deg,#431407,#B45309 42%,#FCD34D)',
    icon: '🏷',
    title: 'Weekend Flash Sale',
    subtitle: 'Up to 40% off — ends Sunday',
    cta: 'View Deals',
  },
  {
    key: 'wallet-cashback',
    background: 'linear-gradient(135deg,#1E3A5F,#1D4ED8 42%,#60A5FA)',
    icon: '💳',
    title: 'Wallet 5% Cashback',
    subtitle: 'Pay with DrippleX Wallet',
    cta: 'Activate',
  },
  {
    key: 'restaurant-specials',
    background: 'linear-gradient(135deg,#3B0764,#7C3AED 42%,#C084FC)',
    icon: '🍽',
    title: 'Restaurant Specials',
    subtitle: 'Lunch deals from ₦1,500',
    cta: 'Order Now',
  },
];

const NEARBY: SuperAppNearbyBusiness[] = [
  {
    key: 'mr-biggs',
    name: 'Mr Biggs',
    category: 'Fast Food',
    distance: '0.2 km',
    eta: '8 min',
    fee: '₦150',
    isFreeDelivery: false,
    rating: 4.4,
    emoji: '🍔',
    open: true,
  },
  {
    key: 'foodco',
    name: 'FoodCo',
    category: 'Supermarket',
    distance: '0.5 km',
    eta: '14 min',
    fee: 'Free',
    isFreeDelivery: true,
    rating: 4.7,
    emoji: '🛒',
    open: true,
  },
  {
    key: 'chi-farms',
    name: 'Chi Farms',
    category: 'Wholesale',
    distance: '0.8 km',
    eta: '20 min',
    fee: '₦400',
    isFreeDelivery: false,
    rating: 4.3,
    emoji: '🥚',
    open: true,
  },
  {
    key: 'dominos',
    name: 'Dominos Pizza',
    category: 'Restaurant',
    distance: '1.0 km',
    eta: '22 min',
    fee: '₦500',
    isFreeDelivery: false,
    rating: 4.5,
    emoji: '🍕',
    open: false,
  },
];

const AI_RECS: SuperAppAIRecommendation[] = [
  {
    key: 'avocado-facial-kit',
    type: 'product',
    emoji: '🥑',
    name: 'Avocado Facial Kit',
    sub: 'HealthPlus · ₦8,400',
    badge: 'Best Seller',
  },
  {
    key: 'chicken-republic',
    type: 'store',
    emoji: '🍗',
    name: 'Chicken Republic',
    sub: 'Restaurant · 0.7 km',
    badge: 'Trending',
  },
  {
    key: 'wireless-earbuds-pro',
    type: 'product',
    emoji: '🎧',
    name: 'Wireless Earbuds Pro',
    sub: 'Slot · ₦18,900',
    badge: 'Hot Deal',
  },
  {
    key: 'mane-and-glam-spa',
    type: 'store',
    emoji: '💆',
    name: 'Mane & Glam Spa',
    sub: 'Beauty · 1.3 km',
    badge: 'New',
  },
];

const RECENT_VIEWS: SuperAppRecentlyViewed[] = [
  { key: 'iphone-15-pro', emoji: '📱', name: 'iPhone 15 Pro', price: '₦890K', store: 'Slot' },
  { key: 'air-max-270', emoji: '👟', name: 'Air Max 270', price: '₦65K', store: 'SportsDirect' },
  {
    key: 'sofa-3-seater',
    emoji: '🛋',
    name: 'Sofa 3-Seater',
    price: '₦185K',
    store: 'FurniturePlus',
  },
  { key: 'jollof-combo', emoji: '🍛', name: 'Jollof Combo', price: '₦4,200', store: 'Mr Biggs' },
];

function filterMerchants(active: string): SuperAppFeaturedMerchant[] {
  if (active === 'all') return FEATURED_MERCHANTS;
  const filtered = FEATURED_MERCHANTS.filter((m) =>
    m.category.toLowerCase().includes(active.replace(/s$/, '').slice(0, 5)),
  );
  return filtered.length ? filtered : FEATURED_MERCHANTS;
}

export default function MarketplacePreviewPage(): React.JSX.Element {
  const [activeCategory, setActiveCategory] = useState('all');
  const [loaded, setLoaded] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [cartCount] = useState(3);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoaded(true);
    }, 950);
    return () => {
      clearTimeout(t);
    };
  }, []);

  return (
    <SuperAppFontProvider heading={poppins.className} body={inter.className}>
      <div
        className={`relative mx-auto flex h-[844px] w-[390px] flex-col overflow-hidden rounded-[32px] ${inter.className}`}
        style={{ background: NAVY_DEEP }}
      >
        <SuperAppMarketplaceHeader cartCount={cartCount} />
        <div
          className="flex-1 overflow-y-auto"
          style={{
            scrollbarWidth: 'none',
            background: `linear-gradient(180deg,${NAVY_DEEP} 0%,#060E1C 100%)`,
          }}
        >
          <SuperAppCategoryChips
            chips={CATEGORY_CHIPS}
            active={activeCategory}
            onChange={setActiveCategory}
          />
          <SuperAppAIDiscoveryBanner
            prompts={AI_PROMPTS}
            onAsk={() => {
              setShowAI(true);
            }}
          />
          <SuperAppDealsCarousel deals={DEALS} />
          <SuperAppFeaturedMerchantsSection
            merchants={filterMerchants(activeCategory)}
            loaded={loaded}
          />
          <SuperAppHorizontalSection
            title="Trending Products 🔥"
            items={TRENDING_PRODUCTS}
            loaded={loaded}
            skeletonCount={4}
            skeletonWidth={145}
            skeletonHeight={212}
            keyExtractor={(p) => p.key}
            renderItem={(p) => <SuperAppProductCard product={p} />}
          />
          <SuperAppVerticalListCard
            title="Nearby Businesses"
            subtitle="Based on your location"
            items={NEARBY}
            loaded={loaded}
            skeletonCount={3}
            keyExtractor={(b) => b.key}
            renderSkeletonRow={(i) => <SuperAppNearbyBusinessSkeletonRow key={i} />}
            renderItem={(b, _i, isLast) => (
              <SuperAppNearbyBusinessRow business={b} showDivider={!isLast} />
            )}
          />
          <SuperAppHorizontalSection
            title="✨ AI Picks for You"
            items={AI_RECS}
            loaded={loaded}
            skeletonCount={4}
            skeletonWidth={130}
            skeletonHeight={148}
            keyExtractor={(r) => r.key}
            renderItem={(r) => <SuperAppAIRecommendationCard item={r} />}
          />
          <div className="mb-5">
            <SuperAppSectionHeader
              title="Continue Shopping"
              subtitle="Recently viewed"
              showSeeAll={false}
            />
            <div className="flex gap-2.5 overflow-x-auto px-5" style={{ scrollbarWidth: 'none' }}>
              {RECENT_VIEWS.map((item) => (
                <SuperAppRecentlyViewedCard key={item.key} item={item} />
              ))}
            </div>
          </div>
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
            subtitle="AI Shopping Assistant"
            prompts={AI_PROMPTS}
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
