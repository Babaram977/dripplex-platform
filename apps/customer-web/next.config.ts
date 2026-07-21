import type { NextConfig } from 'next';

import { validateClientEnv } from './src/env';

validateClientEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
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
};

export default nextConfig;
