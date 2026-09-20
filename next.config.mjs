import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  reactStrictMode: false,
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

    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'shims/async-storage.ts'),
      'react-native$': path.resolve(__dirname, 'shims/react-native.ts'),
      'expo-print': path.resolve(__dirname, 'shims/expo-print.ts'),
      'expo-sharing': path.resolve(__dirname, 'shims/expo-sharing.ts'),
      'lucide-react-native': 'lucide-react',
      '@shared': path.resolve(__dirname, '../src'),
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
