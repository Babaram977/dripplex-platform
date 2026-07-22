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
  experimental: {
    optimizePackageImports: ['lucide-react', '@dripplex/ui'],
  },
};

export default nextConfig;
