/**
 * Realistic marketplace fixture data for local/dev environments — Phase 1
 * testing substrate per the founder's seed-data policy: exercises every
 * Marketplace screen (Store, Product Detail, Cart, Checkout, Tracking)
 * against the real backend and real UI, with no data hardcoded into the
 * frontend. Structured to resemble real production content, not random
 * placeholders. Centralized here (not scattered across frontend mocks) so
 * it can be trimmed or removed in one place once each module goes fully
 * live — see `seedMarketplace()` in `prisma/seed.ts` for how it's applied.
 */

export interface SeedMerchantUser {
  email: string;
  firstName: string;
  lastName: string;
}

export interface SeedBusiness {
  businessName: string;
  registrationNumber: string;
  city: string;
  state: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SeedProductImage {
  url: string;
  position: number;
}

export interface SeedProductVariant {
  name: string;
  priceOverride: number | null;
}

export interface SeedReview {
  authorEmail: string;
  rating: number;
  comment: string;
  merchantReply?: string;
}

export interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  sku: string;
  isFeatured: boolean;
  images: SeedProductImage[];
  variants: SeedProductVariant[];
  quantity: number;
  reviews: SeedReview[];
}

export interface SeedMerchant {
  user: SeedMerchantUser;
  business: SeedBusiness;
  category: { name: string; slug: string };
  products: SeedProduct[];
}

export const SEED_REVIEWER_USERS: SeedMerchantUser[] = [
  { email: 'reviewer.seed.amaka@dripplex.dev', firstName: 'Amaka', lastName: 'Okafor' },
  { email: 'reviewer.seed.tunde@dripplex.dev', firstName: 'Tunde', lastName: 'Bakare' },
];

export const SEED_MERCHANTS: SeedMerchant[] = [
  {
    user: { email: 'merchant.seed.kfc@dripplex.dev', firstName: 'KFC', lastName: 'Nigeria' },
    business: {
      businessName: 'KFC Nigeria',
      registrationNumber: 'RC-SEED-KFC-0001',
      city: 'Lekki',
      state: 'Lagos',
      address: '12 Admiralty Way',
      latitude: 6.4432,
      longitude: 3.4726,
    },
    category: { name: 'Fast Food', slug: 'seed-fast-food' },
    products: [
      {
        slug: 'seed-zinger-meal-combo',
        name: 'Zinger Meal Combo',
        description:
          'Crispy zinger fillet burger with fries and a chilled drink. Made fresh to order with our signature spice blend.',
        basePrice: 3500,
        sku: 'KFC-ZNG-001',
        isFeatured: true,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800',
            position: 0,
          },
          {
            url: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=800',
            position: 1,
          },
        ],
        variants: [
          { name: 'Regular', priceOverride: null },
          { name: 'Large', priceOverride: 4200 },
          { name: 'Family Size', priceOverride: 7800 },
        ],
        quantity: 40,
        reviews: [
          {
            authorEmail: 'reviewer.seed.amaka@dripplex.dev',
            rating: 5,
            comment:
              'Absolutely delicious, crispy and fresh every time. This is my go-to order whenever I want something quick but really satisfying — highly recommend the large size.',
            merchantReply: 'Thank you so much for the kind words! See you again soon.',
          },
          {
            authorEmail: 'reviewer.seed.tunde@dripplex.dev',
            rating: 4,
            comment: 'Good value combo, arrived warm.',
          },
        ],
      },
      {
        slug: 'seed-spicy-wings-bucket',
        name: 'Spicy Wings Bucket',
        description: 'A dozen bone-in wings tossed in our hot pepper glaze, served with ranch dip.',
        basePrice: 5200,
        sku: 'KFC-WNG-012',
        isFeatured: false,
        images: [
          {
            url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
            position: 0,
          },
        ],
        variants: [],
        quantity: 20,
        reviews: [],
      },
    ],
  },
];
