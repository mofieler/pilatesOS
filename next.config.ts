import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
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
  // Ensure production builds are optimized
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
