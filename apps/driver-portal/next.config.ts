import { dripplexNextHeaders } from '@dripplex/config/next/security-headers';

import type { NextConfig } from 'next';

/** `output: 'standalone'` is required for Docker images. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(process.env['DOCKER_BUILD'] === '1' ? { output: 'standalone' as const } : {}),
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
