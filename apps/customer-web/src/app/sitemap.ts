import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/about',
    '/privacy',
    '/terms',
    '/account-deletion',
    '/contact',
    '/login',
    '/register',
  ] as const;

  return routes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.7,
  }));
}
