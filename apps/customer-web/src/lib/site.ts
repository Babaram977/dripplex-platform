export const siteConfig = {
  name: 'DrippleX',
  tagline: 'life, Simplified',
  description:
    'DrippleX is Nigeria’s Super Platform for marketplace, food, parcels, rides, pharmacy, home services, and wallet — built for everyday life.',
  url: process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3001',
  /**
   * The Super App itself. The website is marketing; this is where a customer
   * is sent to actually use DrippleX, and it is what the Android build wraps.
   */
  appUrl: process.env['NEXT_PUBLIC_SUPER_APP_URL'] ?? 'https://app.dripplex.com',
  locale: 'en_NG',
  links: {
    privacy: '/privacy',
    terms: '/terms',
    contact: '/contact',
    about: '/about',
    login: '/login',
    register: '/get-started',
    getTheApp: '/get-the-app',
    marketplace: '/marketplace',
  },
  /**
   * Cross-portal deep links for the role-toggle drawer (Super App shell,
   * DPX-100 Phase 1). Each role's real screens still live in their own
   * deployed app (driver-portal, merchant-portal, operations-console)
   * -- this is honest cross-app navigation for a user whose
   * backend `roles` grant that portal, not an embedded in-app section yet.
   * See docs/reference/figma-super-app-source: the Admin/Ops screens are
   * themselves designed as a desktop console (`DesktopFrame`), not mobile.
   */
  crossPortalUrls: {
    driver: process.env['NEXT_PUBLIC_DRIVER_PORTAL_URL'] ?? 'https://driver.dripplex.com',
    merchant: process.env['NEXT_PUBLIC_MERCHANT_PORTAL_URL'] ?? 'https://merchant.dripplex.com',
    operations: process.env['NEXT_PUBLIC_OPS_CONSOLE_URL'] ?? 'https://ops.dripplex.com',
  },
} as const;

export const featureCatalog = [
  {
    id: 'marketplace',
    title: 'Marketplace',
    description: 'Discover local merchants and everyday essentials in one place.',
  },
  {
    id: 'food',
    title: 'Food Delivery',
    description: 'Order from nearby kitchens with live delivery tracking.',
  },
  {
    id: 'parcel',
    title: 'Parcel Delivery',
    description: 'Send packages across town with trusted riders.',
  },
  {
    id: 'ride',
    title: 'Ride',
    description: 'Book safe, affordable rides when you need to move.',
  },
  {
    id: 'wallet',
    title: 'Wallet',
    description: 'Pay, receive, and manage money across DrippleX services.',
  },
  {
    id: 'pharmacy',
    title: 'Pharmacy',
    description: 'Get medicines and health essentials delivered with care.',
  },
  {
    id: 'home',
    title: 'Home Services',
    description: 'Book trusted professionals for home maintenance and care.',
  },
] as const;
