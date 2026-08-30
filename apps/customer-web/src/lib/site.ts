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
   * Cross-portal deep links for the role-toggle drawer.
   *
   * Operations only. The driver and merchant entries pointed at
   * driver.dripplex.com and merchant.dripplex.com, both retired on
   * 2026-08-30 — those roles work in the Super App now, and the sidebar links
   * that used these were removed when dripplex.com became marketing-only.
   * Left here they were two dead hostnames waiting to be linked again.
   *
   * Operations stays because the console is a desktop tool that is not part
   * of the app: the Figma source renders it in a `DesktopFrame`, not a phone.
   */
  crossPortalUrls: {
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
