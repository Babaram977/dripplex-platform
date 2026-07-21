import { clientEnv } from '@/env';

export const siteConfig = {
  name: clientEnv.NEXT_PUBLIC_APP_NAME,
  tagline: clientEnv.NEXT_PUBLIC_APP_TAGLINE,
  description:
    'Dripplex is Nigeria’s Super Platform for marketplace, food, parcels, rides, pharmacy, home services, and wallet — built for everyday life.',
  url: clientEnv.NEXT_PUBLIC_APP_URL,
  locale: 'en_NG',
  links: {
    privacy: '/privacy',
    terms: '/terms',
    contact: '/contact',
    about: '/about',
    login: '/login',
    register: '/register',
    dashboard: '/dashboard',
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
    description: 'Pay, receive, and manage money across Dripplex services.',
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
