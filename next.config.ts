import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
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
    domains: [
      'pilateq.de', // Add your production domain here
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
  // Standalone build: ensure public assets are served correctly
  assetPrefix: process.env.ASSET_PREFIX || '',
  // Ensure production builds are optimized
  reactStrictMode: true,
  poweredByHeader: false,
  // Add headers for static assets
  headers: async () => {
    return [
      {
        source: '/logo.(png|jpg|jpeg|svg|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
