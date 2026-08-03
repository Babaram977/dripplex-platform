'use client';

import {
  NAVY_DEEP,
  SuperAppFontProvider,
  SuperAppHeader,
  SuperAppServiceTabs,
  SuperAppBalanceCard,
  SuperAppQuickActionsGrid,
  SuperAppAIWidget,
  SuperAppPromoCarousel,
  SuperAppCategoryGrid,
  SuperAppSectionHeader,
  SuperAppHorizontalSection,
  SuperAppMerchantCard,
  SuperAppRecommendationCard,
  SuperAppActivityList,
  SuperAppBottomNav,
  SuperAppAIFab,
  SuperAppAISheet,
  type SuperAppMerchant,
  type SuperAppRecommendation,
} from '@dripplex/ui';
import { Inter, Poppins } from 'next/font/google';
import * as React from 'react';
import { useEffect, useState } from 'react';

/**
 * PREVIEW ONLY — not linked from real navigation, not wired to any backend.
 *
 * DPX-101: no screen owns UI. Every visual element below lives in
 * `packages/ui/src/components/super-app/` — this file only composes them
 * with data, matching the founder-approved Figma Make `HomeScreen`
 * (docs/reference/figma-super-app-source/homeScreen.tsx). Mock data is
 * copied verbatim from the source file — this exists purely to let the
 * founder visually confirm the port is faithful before any real screen
 * gets built against live APIs. Delete once that's confirmed (or promote
 * to a real route and wire it up).
 */

const poppins = Poppins({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

const SERVICE_TABS = [
  { key: 'marketplace', icon: '🛍', label: 'Marketplace' },
  { key: 'ride', icon: '🚖', label: 'Ride' },
  { key: 'wallet', icon: '💳', label: 'Wallet' },
];

const CATEGORIES = [
  { key: 'supermarkets', icon: '🛒', label: 'Supermarkets' },
  { key: 'restaurants', icon: '🍽', label: 'Restaurants' },
  { key: 'pharmacy', icon: '💊', label: 'Pharmacy' },
  { key: 'fashion', icon: '👗', label: 'Fashion' },
  { key: 'electronics', icon: '📱', label: 'Electronics' },
  { key: 'beauty', icon: '💄', label: 'Beauty' },
  { key: 'home', icon: '🛋', label: 'Home' },
  { key: 'hardware', icon: '🔧', label: 'Hardware' },
];

const QUICK_ACTIONS = [
  { key: 'marketplace', icon: '🛍', label: 'Marketplace', color: '#2BAC52' },
  { key: 'ride', icon: '🚖', label: 'Ride', color: '#3B82F6' },
  { key: 'wallet', icon: '💳', label: 'Wallet', color: '#8B5CF6' },
  { key: 'orders', icon: '📦', label: 'Orders', color: '#F59E0B' },
  { key: 'utilities', icon: '⚡', label: 'Utilities', color: '#06B6D4' },
  { key: 'food', icon: '🍔', label: 'Food', color: '#F97316' },
  { key: 'health', icon: '🏥', label: 'Health', color: '#10B981' },
  { key: 'more', icon: '⋯', label: 'More', color: '#6B7280' },
];

const MERCHANTS: SuperAppMerchant[] = [
  {
    key: 'shoprite',
    name: 'Shoprite',
    category: 'Supermarket',
    rating: 4.8,
    distance: '0.4 km',
    eta: '12 min',
    background: 'linear-gradient(135deg,#7F1D1D,#EF4444)',
    emoji: '🛒',
  },
  {
    key: 'kfc-ikeja',
    name: 'KFC Ikeja',
    category: 'Fast Food',
    rating: 4.6,
    distance: '0.9 km',
    eta: '18 min',
    background: 'linear-gradient(135deg,#7C2D12,#F97316)',
    emoji: '🍗',
  },
  {
    key: 'jumia-express',
    name: 'Jumia Express',
    category: 'E-commerce',
    rating: 4.7,
    distance: '1.2 km',
    eta: '25 min',
    background: 'linear-gradient(135deg,#0D2E18,#2BAC52)',
    emoji: '📦',
  },
  {
    key: 'healthplus',
    name: 'HealthPlus',
    category: 'Pharmacy',
    rating: 4.9,
    distance: '0.6 km',
    eta: '15 min',
    background: 'linear-gradient(135deg,#0C4A6E,#06B6D4)',
    emoji: '💊',
  },
  {
    key: 'zara-nigeria',
    name: 'ZARA Nigeria',
    category: 'Fashion',
    rating: 4.5,
    distance: '2.1 km',
    eta: '30 min',
    background: 'linear-gradient(135deg,#2E1065,#8B5CF6)',
    emoji: '👗',
  },
];

const RECOMMENDATIONS: SuperAppRecommendation[] = [
  {
    key: 'iphone-15-pro',
    emoji: '📱',
    name: 'iPhone 15 Pro',
    price: '₦890K',
    badge: 'Trending',
    badgeColor: '#EF4444',
  },
  {
    key: 'jollof-protein',
    emoji: '🍛',
    name: 'Jollof + Protein',
    price: '₦4,200',
    badge: 'Popular',
    badgeColor: '#F97316',
  },
  {
    key: 'adire-set',
    emoji: '👘',
    name: 'Adire Set',
    price: '₦18K',
    badge: 'New In',
    badgeColor: '#8B5CF6',
  },
  {
    key: 'wireless-buds',
    emoji: '🎧',
    name: 'Wireless Buds',
    price: '₦45K',
    badge: 'Hot',
    badgeColor: '#2BAC52',
  },
];

const PROMOS = [
  {
    key: 'weekend-cashback',
    background: 'linear-gradient(135deg,#064E3B,#065F46 40%,#10B981)',
    icon: '🎁',
    title: '5% Weekend Cashback',
    subtitle: 'On all DrippleX spends',
    cta: 'Claim',
  },
  {
    key: 'free-first-ride',
    background: 'linear-gradient(135deg,#1E3A5F,#1D4ED8 40%,#60A5FA)',
    icon: '🚗',
    title: 'Free First Ride',
    subtitle: 'New users ride free today',
    cta: 'Book',
  },
  {
    key: 'upgrade-premium',
    background: 'linear-gradient(135deg,#3B0764,#7C3AED 40%,#C084FC)',
    icon: '💎',
    title: 'Upgrade to Premium',
    subtitle: 'Unlock all exclusive perks',
    cta: 'Unlock',
  },
  {
    key: 'free-delivery-week',
    background: 'linear-gradient(135deg,#431407,#B45309 40%,#FCD34D)',
    icon: '🛒',
    title: 'Free Delivery Week',
    subtitle: 'All marketplace orders',
    cta: 'Shop',
  },
];

const AI_PROMPTS = [
  'Find the best shawarma near me',
  'Book a ride to Victoria Island',
  'Track my last order',
  'Find a pharmacy open now',
  'Show weekend deals near me',
];

const ACTIVITY = [
  {
    key: 'ride-1',
    icon: '🚗',
    label: 'DrippleX Ride',
    sub: 'Lagos Island · 2 min ago',
    amount: '-₦2,800',
    credit: false,
  },
  {
    key: 'shopping-1',
    icon: '🛒',
    label: 'Shoprite Ikeja',
    sub: 'Shopping · 1 hr ago',
    amount: '-₦12,500',
    credit: false,
  },
  {
    key: 'transfer-1',
    icon: '↙',
    label: 'From Yusuf',
    sub: 'Transfer · 3 hrs ago',
    amount: '+₦50,000',
    credit: true,
  },
];

const BALANCE_STATS = [
  { label: '↑ Income', value: '+₦320K', background: 'rgba(255,255,255,.12)' },
  { label: '↓ Spent', value: '-₦87.5K', background: 'rgba(0,0,0,.15)' },
  { label: '⊙ Savings', value: '₦150K', background: 'rgba(255,255,255,.09)' },
];

export default function HomePreviewPage(): React.JSX.Element {
  const [loaded, setLoaded] = useState(false);
  const [showAI, setShowAI] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setLoaded(true);
    }, 1000);
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
        <SuperAppHeader
          greeting="Good Morning"
          name="Saeed"
          tagline="life,Simplified"
          avatarInitial="S"
          searchPlaceholder="Search products, rides, pharmacies…"
          hasUnreadNotifications
        />
        <div
          className="flex-1 overflow-y-auto"
          style={{
            scrollbarWidth: 'none',
            background: `linear-gradient(180deg,${NAVY_DEEP} 0%,#060E1C 100%)`,
          }}
        >
          <div className="mx-5 mb-4 mt-4">
            <SuperAppServiceTabs tabs={SERVICE_TABS} active="marketplace" />
          </div>
          <SuperAppBalanceCard
            amount="₦847,250"
            decimals=".00"
            fxEquivalent="≈ $563.50 USD"
            stats={BALANCE_STATS}
          />
          <div className="mb-1">
            <SuperAppSectionHeader title="Quick Actions" />
            <SuperAppQuickActionsGrid items={QUICK_ACTIONS} />
          </div>
          <SuperAppAIWidget
            prompts={AI_PROMPTS}
            onAsk={() => {
              setShowAI(true);
            }}
          />
          <SuperAppPromoCarousel promos={PROMOS} />
          <div className="mb-5">
            <SuperAppSectionHeader title="Categories" />
            <SuperAppCategoryGrid categories={CATEGORIES} activeKey={CATEGORIES[0]?.key} />
          </div>
          <SuperAppHorizontalSection
            title="Nearby Merchants"
            items={MERCHANTS}
            loaded={loaded}
            skeletonCount={3}
            skeletonWidth={155}
            skeletonHeight={188}
            keyExtractor={(m) => m.key}
            renderItem={(m) => <SuperAppMerchantCard merchant={m} />}
          />
          <SuperAppHorizontalSection
            title="Recommended for You"
            items={RECOMMENDATIONS}
            loaded={loaded}
            skeletonCount={4}
            skeletonWidth={130}
            skeletonHeight={148}
            keyExtractor={(r) => r.key}
            renderItem={(r) => <SuperAppRecommendationCard item={r} />}
          />
          <SuperAppActivityList items={ACTIVITY} loaded={loaded} />
          <div style={{ height: 104 }} />
        </div>
        <SuperAppAIFab
          onPress={() => {
            setShowAI(true);
          }}
        />
        <SuperAppBottomNav active="home" />
        {showAI && (
          <SuperAppAISheet
            prompts={AI_PROMPTS}
            onClose={() => {
              setShowAI(false);
            }}
          />
        )}
      </div>
    </SuperAppFontProvider>
  );
}
