import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  compress: true,
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Add future avatar hosts here (S3, Bunny, etc.)
      // {
      //   protocol: 'https',
      //   hostname: '*.s3.amazonaws.com',
      // },
    ],
  },
  // Standalone build: ensure public assets are served correctly
  assetPrefix: process.env.ASSET_PREFIX || '',
  // Optimize static assets in standalone mode
  experimental: {
    isrMemoryCacheSize: 52 * 1024 * 1024,
  },
  // Ensure production builds are optimized
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
