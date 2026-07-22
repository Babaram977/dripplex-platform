import { dripplexNextHeaders } from '@dripplex/config/next/security-headers';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@dripplex/ui',
    '@dripplex/hooks',
    '@dripplex/types',
    '@dripplex/utils',
    '@dripplex/sdk',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@dripplex/ui'],
  },
  headers: dripplexNextHeaders(),
};

export default nextConfig;
