/**
 * Платформенный слой: всё, что отличается между сайтом (браузер) и приложением (iOS/Android).
 * Остальной код вызывает только эти функции и не знает, где он запущен.
 */
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'web' | 'ios' | 'android';

/** Адрес сайта — для ссылок в письмах (в приложении location указывает на внутренний адрес). */
export const SITE_URL: string =
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  (typeof location !== 'undefined' ? location.origin + location.pathname : '');

/** Лёгкий тактильный отклик на нажатие (+1). */
export function hapticTap() {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  else if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Отдать файл пользователю: на сайте — скачивание, в приложении — системное меню
 * «Поделиться» (сохранить в «Файлы», отправить в мессенджер, на почту и т. д.).
 */
export async function shareFile(name: string, content: string | Blob, mime: string): Promise<void> {
  if (!isNative) {
    const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const written =
    typeof content === 'string'
      ? await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
      : await Filesystem.writeFile({ path: name, data: await blobToBase64(content), directory: Directory.Cache });
  try {
    await Share.share({ title: name, files: [written.uri] });
  } catch (e) {
    // Пользователь закрыл меню «Поделиться» — это не ошибка.
    if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e;
  }
}

/** Цвет значков строки состояния под текущую тему. */
export function setSystemBarsDark(dark: boolean) {
  if (!isNative) return;
  // Style.Dark — светлые значки для тёмного фона.
  void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
}

export function hideSplash() {
  if (isNative) void SplashScreen.hide().catch(() => {});
}

/** Кнопка «Назад» на Android: закрыть открытое окно, вернуться назад или выйти из приложения. */
export function setupBackButton() {
  if (platform !== 'android') return;
  void App.addListener('backButton', ({ canGoBack }) => {
    const dialog = document.querySelector('dialog[open]') as HTMLDialogElement | null;
    if (dialog) dialog.close();
    else if (canGoBack && location.hash && location.hash !== '#/') history.back();
    else void App.exitApp();
  });
}

/** Сообщить, когда приложение возвращается из фона (для синхронизации). */
export function onAppResume(cb: () => void): () => void {
  if (!isNative) return () => {};
  const h = App.addListener('resume', cb);
  return () => void h.then((x) => x.remove());
}
