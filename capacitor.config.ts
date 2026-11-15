import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Нативные приложения iOS и Android (Capacitor).
 * Используется тот же веб-код, что и на сайте: `npm run build` → папка dist → внутрь приложения.
 * appId нельзя менять после публикации в магазинах.
 */
const config: CapacitorConfig = {
  appId: 'com.ajyma.qada',
  appName: 'QADA',
  webDir: 'dist',
  // Цвет фона под приложением (виден при запуске и при «оттягивании» экрана) — как фон тёмной темы.
  backgroundColor: '#09110f',
  ios: {
    // Отступы под «чёлку» делаем сами через env(safe-area-inset-*), чтобы фон шёл до краёв.
    contentInset: 'never',
  },
  plugins: {
    SystemBars: {
      // На Android веб-вид получает правильные значения safe-area (и CSS-переменные --safe-area-inset-*).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      // Заставка скрывается вручную, когда данные загружены (initStore), — без «пустого» экрана.
      launchAutoHide: false,
      launchShowDuration: 3000,
      backgroundColor: '#0f5e4a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
