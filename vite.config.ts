import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' — приложение можно разместить в любой подпапке (например, /qada/ на GitHub Pages).
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '') },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Регистрация вручную в main.tsx — только на сайте, не в приложении.
      injectRegister: null,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'QADA — قضاء الصلاة',
        short_name: 'QADA',
        description: 'Учёт и возмещение пропущенных намазов',
        theme_color: '#0b1512',
        background_color: '#0b1512',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node' },
});
