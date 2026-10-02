import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if running standalone (Vercel) with ./shared or inside monorepo with ../src
const localSharedExists = fs.existsSync(path.resolve(__dirname, 'shared'));
const monorepoSrcExists = fs.existsSync(path.resolve(__dirname, '../src'));
const sharedPath = localSharedExists
  ? path.resolve(__dirname, 'shared')
  : path.resolve(__dirname, '../src');

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(monorepoSrcExists ? { outputFileTracingRoot: path.resolve(__dirname, '..') } : {}),
  reactStrictMode: false,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  webpack: (config, { webpack, dev }) => {
    config.plugins.push(
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(Boolean(dev)),
      })
    );

    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      ...(config.resolve.modules || ['node_modules']),
    ];

    config.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      ...(config.resolve.extensions || []),
    ];

    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'shims/async-storage.ts'),
      'react-native$': path.resolve(__dirname, 'shims/react-native.ts'),
      'expo-print': path.resolve(__dirname, 'shims/expo-print.ts'),
      'expo-sharing': path.resolve(__dirname, 'shims/expo-sharing.ts'),
      'lucide-react-native': 'lucide-react',
      '@shared': sharedPath,
      'payments': path.resolve(__dirname, 'payments'),
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
