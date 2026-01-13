import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg', '@whiskeysockets/baileys', 'jimp', 'sharp', 'pino', 'bullmq', 'ioredis'],
  // Allow ngrok and other dev origins for cross-origin requests
  allowedDevOrigins: ['*.ngrok-free.dev', '*.ngrok.io'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
    ],
  },
};

export default nextConfig;
