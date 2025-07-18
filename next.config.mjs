import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Server Components用のパッケージ設定
    serverComponentsExternalPackages: ['@google/generative-ai'],
    // 大きなファイルサイズに対応
    serverMinification: false,
  },
  // API Routes の設定
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
})(nextConfig);
